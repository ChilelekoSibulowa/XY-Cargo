-- Expand cross-portal notifications and keep bell payloads actionable

CREATE OR REPLACE FUNCTION public.insert_route_notification(
  _user_id uuid,
  _title text,
  _message text,
  _route text,
  _reference_id uuid DEFAULT NULL,
  _exclude_user_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _user_id IS NULL
     OR NULLIF(BTRIM(COALESCE(_title, '')), '') IS NULL
     OR NULLIF(BTRIM(COALESCE(_message, '')), '') IS NULL
     OR (_exclude_user_id IS NOT NULL AND _user_id = _exclude_user_id) THEN
    RETURN;
  END IF;

  INSERT INTO public.notifications (user_id, title, message, notification_type, reference_id)
  VALUES (
    _user_id,
    _title,
    _message,
    COALESCE(NULLIF(BTRIM(_route), ''), 'notification'),
    _reference_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.insert_portal_route_notifications(
  _portal_id text,
  _title text,
  _message text,
  _route text,
  _reference_id uuid DEFAULT NULL,
  _exclude_user_id uuid DEFAULT NULL,
  _include_admins boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NULLIF(BTRIM(COALESCE(_title, '')), '') IS NULL
     OR NULLIF(BTRIM(COALESCE(_message, '')), '') IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.notifications (user_id, title, message, notification_type, reference_id)
  SELECT DISTINCT recipients.user_id, _title, _message, COALESCE(NULLIF(BTRIM(_route), ''), 'notification'), _reference_id
  FROM (
    SELECT spa.user_id
    FROM public.staff_portal_assignments spa
    WHERE spa.portal_id = _portal_id

    UNION

    SELECT ur.user_id
    FROM public.user_roles ur
    WHERE _include_admins
      AND ur.role = 'admin'
  ) AS recipients
  WHERE recipients.user_id IS NOT NULL
    AND (_exclude_user_id IS NULL OR recipients.user_id <> _exclude_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.insert_customer_agent_route_notifications(
  _customer_id uuid,
  _title text,
  _message text,
  _customer_route text,
  _agent_route text,
  _reference_id uuid DEFAULT NULL,
  _exclude_user_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_user_id uuid;
  v_agent_user_id uuid;
BEGIN
  SELECT c.user_id, c.agent_id
  INTO v_customer_user_id, v_agent_user_id
  FROM public.customers c
  WHERE c.id = _customer_id;

  PERFORM public.insert_route_notification(
    v_customer_user_id,
    _title,
    _message,
    _customer_route,
    _reference_id,
    _exclude_user_id
  );

  PERFORM public.insert_route_notification(
    v_agent_user_id,
    _title,
    _message,
    _agent_route,
    _reference_id,
    _exclude_user_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.insert_driver_route_notification(
  _driver_id uuid,
  _title text,
  _message text,
  _route text,
  _reference_id uuid DEFAULT NULL,
  _exclude_user_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver_user_id uuid;
BEGIN
  SELECT d.user_id
  INTO v_driver_user_id
  FROM public.drivers d
  WHERE d.id = _driver_id;

  PERFORM public.insert_route_notification(
    v_driver_user_id,
    _title,
    _message,
    _route,
    _reference_id,
    _exclude_user_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_invoice_notification_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text;
  v_message text;
  v_shipment_ref text;
BEGIN
  SELECT COALESCE(NULLIF(BTRIM(s.custom_tracking_number), ''), s.code)
  INTO v_shipment_ref
  FROM public.shipments s
  WHERE s.id = NEW.shipment_id;

  v_shipment_ref := COALESCE(v_shipment_ref, NEW.code);

  IF TG_OP = 'INSERT' THEN
    CASE lower(COALESCE(NEW.status, 'draft'))
      WHEN 'sent' THEN
        v_title := 'New invoice available';
        v_message := 'Invoice ' || NEW.code || ' for shipment ' || v_shipment_ref || ' is ready for payment.';
      WHEN 'approved' THEN
        v_title := 'Invoice approved';
        v_message := 'Invoice ' || NEW.code || ' for shipment ' || v_shipment_ref || ' has been approved.';
      WHEN 'paid' THEN
        v_title := 'Invoice settled';
        v_message := 'Invoice ' || NEW.code || ' for shipment ' || v_shipment_ref || ' is fully paid.';
      ELSE
        RETURN NEW;
    END CASE;
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    CASE lower(COALESCE(NEW.status, 'draft'))
      WHEN 'sent' THEN
        v_title := 'New invoice available';
        v_message := 'Invoice ' || NEW.code || ' for shipment ' || v_shipment_ref || ' is ready for payment.';
      WHEN 'approved' THEN
        v_title := 'Invoice approved';
        v_message := 'Invoice ' || NEW.code || ' for shipment ' || v_shipment_ref || ' has been approved.';
      WHEN 'paid' THEN
        v_title := 'Invoice settled';
        v_message := 'Invoice ' || NEW.code || ' for shipment ' || v_shipment_ref || ' is fully paid.';
      ELSE
        RETURN NEW;
    END CASE;
  ELSIF (
    NEW.amount IS DISTINCT FROM OLD.amount
    OR NEW.due_date IS DISTINCT FROM OLD.due_date
    OR NEW.notes IS DISTINCT FROM OLD.notes
  ) AND lower(COALESCE(NEW.status, 'draft')) IN ('sent', 'approved', 'paid') THEN
    v_title := 'Invoice updated';
    v_message := 'Invoice ' || NEW.code || ' for shipment ' || v_shipment_ref || ' was updated by finance.';
  ELSE
    RETURN NEW;
  END IF;

  PERFORM public.insert_customer_agent_route_notifications(
    NEW.customer_id,
    v_title,
    v_message,
    'route:/customer/payments',
    'route:/agent/payments',
    NEW.id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invoice_notification_events ON public.invoices;
CREATE TRIGGER invoice_notification_events
AFTER INSERT OR UPDATE OF status, amount, due_date, notes ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.notify_invoice_notification_events();

CREATE OR REPLACE FUNCTION public.notify_credit_note_notification_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text;
  v_message text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_title := 'Credit note issued';
    v_message := 'Credit note ' || NEW.code || ' has been issued for your account.';
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    v_title := 'Credit note updated';
    v_message := 'Credit note ' || NEW.code || ' is now marked as ' || COALESCE(NEW.status, 'pending') || '.';
  ELSIF NEW.amount IS DISTINCT FROM OLD.amount OR NEW.reason IS DISTINCT FROM OLD.reason THEN
    v_title := 'Credit note updated';
    v_message := 'Credit note ' || NEW.code || ' has been updated by finance.';
  ELSE
    RETURN NEW;
  END IF;

  PERFORM public.insert_customer_agent_route_notifications(
    NEW.customer_id,
    v_title,
    v_message,
    'route:/customer/payments',
    'route:/agent/payments',
    NEW.id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS credit_note_notification_events ON public.credit_notes;
CREATE TRIGGER credit_note_notification_events
AFTER INSERT OR UPDATE OF status, amount, reason ON public.credit_notes
FOR EACH ROW
EXECUTE FUNCTION public.notify_credit_note_notification_events();

CREATE OR REPLACE FUNCTION public.notify_payment_notification_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text;
  v_message text;
  v_shipment_ref text;
  v_is_manual_entry boolean := COALESCE(NEW.callback_data ->> 'manual_entry', 'false') = 'true';
BEGIN
  IF v_is_manual_entry THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(BTRIM(s.custom_tracking_number), ''), s.code)
  INTO v_shipment_ref
  FROM public.shipments s
  WHERE s.id = NEW.shipment_id;

  v_shipment_ref := COALESCE(v_shipment_ref, NEW.code);

  IF TG_OP = 'INSERT' THEN
    CASE lower(COALESCE(NEW.status, 'pending'))
      WHEN 'pending', 'processing' THEN
        v_title := 'New payment initiated';
        v_message := 'Payment ' || NEW.code || ' for shipment ' || v_shipment_ref || ' needs review.';
      WHEN 'completed' THEN
        v_title := 'Payment completed';
        v_message := 'Payment ' || NEW.code || ' for shipment ' || v_shipment_ref || ' completed successfully.';
      WHEN 'failed' THEN
        v_title := 'Payment failed';
        v_message := 'Payment ' || NEW.code || ' for shipment ' || v_shipment_ref || ' failed.';
      ELSE
        RETURN NEW;
    END CASE;
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    CASE lower(COALESCE(NEW.status, 'pending'))
      WHEN 'completed' THEN
        v_title := 'Payment completed';
        v_message := 'Payment ' || NEW.code || ' for shipment ' || v_shipment_ref || ' completed successfully.';
      WHEN 'failed' THEN
        v_title := 'Payment failed';
        v_message := 'Payment ' || NEW.code || ' for shipment ' || v_shipment_ref || ' failed.';
      ELSE
        RETURN NEW;
    END CASE;
  ELSE
    RETURN NEW;
  END IF;

  PERFORM public.insert_portal_route_notifications(
    'finance',
    v_title,
    v_message,
    'route:/finance/payments',
    NEW.id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payment_notification_events ON public.payments;
CREATE TRIGGER payment_notification_events
AFTER INSERT OR UPDATE OF status, callback_data, provider_reference ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.notify_payment_notification_events();

CREATE OR REPLACE FUNCTION public.notify_customer_claim_notification_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text;
  v_message text;
  v_shipment_ref text := COALESCE(NULLIF(BTRIM(NEW.shipment_code), ''), 'unspecified shipment');
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_title := 'New customer claim';
    v_message := 'A new claim was submitted for ' || v_shipment_ref || '.';

    PERFORM public.insert_portal_route_notifications(
      'support',
      v_title,
      v_message,
      'route:/support/claims',
      NEW.id,
      NULL,
      true
    );

    PERFORM public.insert_portal_route_notifications(
      'finance',
      v_title,
      v_message,
      'route:/finance/claims',
      NEW.id,
      NULL,
      false
    );

    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_title := 'Claim status updated';
    v_message := 'Your claim for ' || v_shipment_ref || ' is now ' || COALESCE(NEW.status, 'submitted') || '.';

    PERFORM public.insert_customer_agent_route_notifications(
      NEW.customer_id,
      v_title,
      v_message,
      'route:/customer/claims',
      'route:/agent/shipments?tab=claim',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS customer_claim_notification_events ON public.customer_claims;
CREATE TRIGGER customer_claim_notification_events
AFTER INSERT OR UPDATE OF status ON public.customer_claims
FOR EACH ROW
EXECUTE FUNCTION public.notify_customer_claim_notification_events();

CREATE OR REPLACE FUNCTION public.notify_agent_shipment_notification_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent_user_id uuid;
  v_customer_name text;
  v_title text;
  v_message text;
  v_route text;
BEGIN
  SELECT c.agent_id, COALESCE(NULLIF(BTRIM(c.full_name), ''), c.code, 'Client')
  INTO v_agent_user_id, v_customer_name
  FROM public.customers c
  WHERE c.id = NEW.customer_id;

  IF v_agent_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    DECLARE
      v_ship_ref text;
    BEGIN
      v_ship_ref := COALESCE(
        public.shipment_warehouse_tracking_from_notes(NEW.notes),
        CASE 
          WHEN NEW.status NOT IN ('saved_pickup', 'saved_dropoff', 'received', 'requested_pickup') 
          THEN NULLIF(BTRIM(NEW.custom_tracking_number), '') 
        END,
        NEW.code
      );

      CASE NEW.status
        WHEN 'saved_dropoff' THEN
          v_title := 'Incoming client parcel';
          v_message := 'Parcel ' || v_ship_ref || ' for ' || v_customer_name || ' is incoming to the warehouse.';
          v_route := 'route:/agent/shipments?tab=incoming';
        WHEN 'received' THEN
          v_title := 'Client parcel needs action';
          v_message := 'Parcel ' || v_ship_ref || ' for ' || v_customer_name || ' is ready for review.';
          v_route := 'route:/agent/shipments?tab=need_action';
        WHEN 'requested_pickup' THEN
          v_title := 'Client parcel submitted';
          v_message := 'Parcel ' || v_ship_ref || ' for ' || v_customer_name || ' has been submitted.';
          v_route := 'route:/agent/shipments?tab=submitted';
        WHEN 'approved' THEN
          v_title := 'Client shipment confirmed';
          v_message := 'Shipment ' || v_ship_ref || ' for ' || v_customer_name || ' is ready to send out.';
          v_route := 'route:/agent/shipments?tab=confirm';
        WHEN 'assigned' THEN
          v_title := 'Client shipment sent out';
          v_message := 'Shipment ' || v_ship_ref || ' for ' || v_customer_name || ' has left the warehouse.';
          v_route := 'route:/agent/shipments?tab=outgoing';
        WHEN 'supplied' THEN
          v_title := 'Client shipment in transit';
          v_message := 'Shipment ' || v_ship_ref || ' for ' || v_customer_name || ' is in transit.';
          v_route := 'route:/agent/shipments?tab=in_transit';
        WHEN 'delivered' THEN
          v_title := 'Client shipment arrived';
          v_message := 'Shipment ' || v_ship_ref || ' for ' || v_customer_name || ' has arrived.';
          v_route := 'route:/agent/shipments?tab=arrived';
        WHEN 'closed' THEN
          v_title := 'Client shipment collected';
          v_message := 'Shipment ' || v_ship_ref || ' for ' || v_customer_name || ' has been collected.';
          v_route := 'route:/agent/shipments?tab=collected';
        WHEN 'returned' THEN
          v_title := 'Client parcel issue';
          v_message := 'Shipment ' || v_ship_ref || ' for ' || v_customer_name || ' has a delivery issue.';
          v_route := 'route:/agent/shipments?tab=problem';
        WHEN 'returned_stock' THEN
          v_title := 'Client parcel issue';
          v_message := 'Shipment ' || v_ship_ref || ' for ' || v_customer_name || ' was returned to stock.';
          v_route := 'route:/agent/shipments?tab=problem';
        WHEN 'returned_delivered' THEN
          v_title := 'Client parcel issue';
          v_message := 'Shipment ' || v_ship_ref || ' for ' || v_customer_name || ' was returned after delivery.';
          v_route := 'route:/agent/shipments?tab=problem';
        ELSE
          v_title := NULL;
          v_message := NULL;
          v_route := NULL;
      END CASE;
    END;

    IF v_title IS NOT NULL THEN
      PERFORM public.insert_route_notification(
        v_agent_user_id,
        v_title,
        v_message,
        v_route,
        NEW.id
      );
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
    CASE lower(COALESCE(NEW.payment_status, 'pending'))
      WHEN 'completed' THEN
        v_title := 'Client payment completed';
        v_message := 'Payment for shipment ' || NEW.code || ' is now complete.';
      WHEN 'partial' THEN
        v_title := 'Client payment partially settled';
        v_message := 'Shipment ' || NEW.code || ' now has a partial payment recorded.';
      WHEN 'failed' THEN
        v_title := 'Client payment failed';
        v_message := 'Payment for shipment ' || NEW.code || ' failed and needs attention.';
      ELSE
        v_title := NULL;
        v_message := NULL;
    END CASE;

    IF v_title IS NOT NULL THEN
      PERFORM public.insert_route_notification(
        v_agent_user_id,
        v_title,
        v_message,
        'route:/agent/payments',
        NEW.id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS agent_shipment_notification_events ON public.shipments;
CREATE TRIGGER agent_shipment_notification_events
AFTER INSERT OR UPDATE OF status, payment_status ON public.shipments
FOR EACH ROW
EXECUTE FUNCTION public.notify_agent_shipment_notification_events();

CREATE OR REPLACE FUNCTION public.notify_driver_shipment_notification_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text;
  v_message text;
BEGIN
  DECLARE
    v_ship_ref text;
  BEGIN
    v_ship_ref := COALESCE(
      public.shipment_warehouse_tracking_from_notes(NEW.notes),
      CASE 
        WHEN NEW.status NOT IN ('saved_pickup', 'saved_dropoff', 'received', 'requested_pickup') 
        THEN NULLIF(BTRIM(NEW.custom_tracking_number), '') 
      END,
      NEW.code
    );

    IF NEW.assigned_driver_id IS NOT NULL
       AND (
         TG_OP = 'INSERT'
         OR NEW.assigned_driver_id IS DISTINCT FROM OLD.assigned_driver_id
       ) THEN
      PERFORM public.insert_driver_route_notification(
        NEW.assigned_driver_id,
        'New delivery assigned',
        'Shipment ' || v_ship_ref || ' has been assigned to you.',
        'route:/driver/deliveries',
        NEW.id
      );
    END IF;

    IF TG_OP = 'UPDATE'
       AND NEW.assigned_driver_id IS NOT NULL
       AND NEW.status IS DISTINCT FROM OLD.status THEN
      CASE NEW.status
        WHEN 'supplied' THEN
          v_title := 'Delivery in transit';
          v_message := 'Shipment ' || v_ship_ref || ' is now in transit.';
        WHEN 'delivered' THEN
          v_title := 'Delivery arrived';
          v_message := 'Shipment ' || v_ship_ref || ' is marked as arrived.';
        WHEN 'closed' THEN
          v_title := 'Delivery closed';
          v_message := 'Shipment ' || v_ship_ref || ' has been collected and closed.';
        WHEN 'returned' THEN
          v_title := 'Delivery issue';
          v_message := 'Shipment ' || v_ship_ref || ' has been marked as returned.';
        WHEN 'returned_stock' THEN
          v_title := 'Delivery issue';
          v_message := 'Shipment ' || v_ship_ref || ' was returned to stock.';
        WHEN 'returned_delivered' THEN
          v_title := 'Delivery issue';
          v_message := 'Shipment ' || v_ship_ref || ' was returned after delivery.';
        ELSE
          v_title := NULL;
          v_message := NULL;
      END CASE;

      IF v_title IS NOT NULL THEN
        PERFORM public.insert_driver_route_notification(
          NEW.assigned_driver_id,
          v_title,
          v_message,
          'route:/driver/deliveries',
          NEW.id
        );
      END IF;
    END IF;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS driver_shipment_notification_events ON public.shipments;
CREATE TRIGGER driver_shipment_notification_events
AFTER INSERT OR UPDATE OF assigned_driver_id, status ON public.shipments
FOR EACH ROW
EXECUTE FUNCTION public.notify_driver_shipment_notification_events();
