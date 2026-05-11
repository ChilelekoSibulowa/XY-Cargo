-- Expand shipment and consolidation notifications so customers get bell updates
-- for warehouse edits (tracking, AWB/BL, transit status message, and detail changes).

CREATE OR REPLACE FUNCTION public.notify_shipment_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_title text;
  v_message text;
  v_route text;
  v_old_transit text;
  v_new_transit text;
  v_old_awb text;
  v_new_awb text;
BEGIN
  SELECT user_id INTO v_user_id
  FROM public.customers
  WHERE id = NEW.customer_id;

  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    CASE NEW.status
      WHEN 'saved_pickup' THEN
        v_title := 'Created';
        v_message := 'Your shipment has been created.';
        v_route := 'route:/customer/shipments?tab=all';
      WHEN 'saved_dropoff' THEN
        v_title := 'Incoming';
        v_message := 'Your parcel is on the way to the warehouse.';
        v_route := 'route:/customer/shipments?tab=incoming';
      WHEN 'received' THEN
        v_title := 'Need Action';
        v_message := 'Parcel arrived at warehouse. Select products to consolidate.';
        v_route := 'route:/customer/shipments?tab=need_action';
      WHEN 'requested_pickup' THEN
        v_title := 'Submitted';
        v_message := 'Your consolidation request was submitted for warehouse processing.';
        v_route := 'route:/customer/shipments?tab=submitted';
      WHEN 'approved' THEN
        v_title := 'Confirm Shipment';
        v_message := 'Weight and cost are ready. Please review and click Ship.';
        v_route := 'route:/customer/shipments?tab=confirm';
      WHEN 'assigned' THEN
        v_title := 'Outgoing Parcels';
        v_message := 'Shipping has started.';
        v_route := 'route:/customer/shipments?tab=outgoing';
      WHEN 'supplied' THEN
        v_title := 'In Transit';
        v_message := 'Your shipment is in transit.';
        v_route := 'route:/customer/shipments?tab=intransit';
      WHEN 'delivered' THEN
        v_title := 'Arrived';
        v_message := 'Your shipment has arrived.';
        v_route := 'route:/customer/shipments?tab=arrived';
      WHEN 'closed' THEN
        v_title := 'Collected';
        v_message := 'Collection confirmed.';
        v_route := 'route:/customer/shipments?tab=collected';
      ELSE
        v_title := NULL;
        v_message := NULL;
        v_route := NULL;
    END CASE;

    IF v_title IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, notification_type, reference_id)
      VALUES (v_user_id, v_title, v_message, COALESCE(v_route, 'shipment'), NEW.id);
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
    IF NEW.payment_status = 'completed' THEN
      INSERT INTO public.notifications (user_id, title, message, notification_type, reference_id)
      VALUES (
        v_user_id,
        'Payment received',
        'Payment completed for shipment ' || NEW.code || '.',
        'route:/customer/payments',
        NEW.id
      );
    ELSIF NEW.payment_status = 'failed' THEN
      INSERT INTO public.notifications (user_id, title, message, notification_type, reference_id)
      VALUES (
        v_user_id,
        'Payment failed',
        'Payment failed for shipment ' || NEW.code || '. Please retry.',
        'route:/customer/payments',
        NEW.id
      );
    END IF;
  END IF;

  IF TG_OP = 'UPDATE'
    AND NEW.status IS NOT DISTINCT FROM OLD.status
    AND NEW.payment_status IS NOT DISTINCT FROM OLD.payment_status
  THEN
    v_old_transit := NULLIF(BTRIM((regexp_match(COALESCE(OLD.notes, ''), '(?i)Transit Status:\\s*([^|]+)'))[1]), '');
    v_new_transit := NULLIF(BTRIM((regexp_match(COALESCE(NEW.notes, ''), '(?i)Transit Status:\\s*([^|]+)'))[1]), '');
    v_old_awb := NULLIF(BTRIM((regexp_match(COALESCE(OLD.notes, ''), '(?i)AWB/BL No\\.:\\s*([^|]+)'))[1]), '');
    v_new_awb := NULLIF(BTRIM((regexp_match(COALESCE(NEW.notes, ''), '(?i)AWB/BL No\\.:\\s*([^|]+)'))[1]), '');

    v_route := CASE NEW.status
      WHEN 'saved_pickup' THEN 'route:/customer/shipments?tab=all'
      WHEN 'saved_dropoff' THEN 'route:/customer/shipments?tab=incoming'
      WHEN 'received' THEN 'route:/customer/shipments?tab=need_action'
      WHEN 'requested_pickup' THEN 'route:/customer/shipments?tab=submitted'
      WHEN 'approved' THEN 'route:/customer/shipments?tab=confirm'
      WHEN 'assigned' THEN 'route:/customer/shipments?tab=outgoing'
      WHEN 'supplied' THEN 'route:/customer/shipments?tab=intransit'
      WHEN 'delivered' THEN 'route:/customer/shipments?tab=arrived'
      WHEN 'closed' THEN 'route:/customer/shipments?tab=collected'
      ELSE 'route:/customer/shipments'
    END;

    IF v_new_transit IS DISTINCT FROM v_old_transit AND v_new_transit IS NOT NULL THEN
      v_title := 'Transit update';
      v_message := v_new_transit;
      v_route := 'route:/customer/shipments?tab=intransit';
    ELSIF NEW.custom_tracking_number IS DISTINCT FROM OLD.custom_tracking_number
      OR v_new_awb IS DISTINCT FROM v_old_awb
    THEN
      v_title := 'Tracking details updated';
      v_message := 'Tracking No. and AWB/BL No. were updated for shipment ' || NEW.code || '.';
    ELSIF NEW.weight IS DISTINCT FROM OLD.weight
      OR NEW.cbm IS DISTINCT FROM OLD.cbm
      OR NEW.quantity IS DISTINCT FROM OLD.quantity
      OR NEW.total_cost IS DISTINCT FROM OLD.total_cost
      OR NEW.shipping_cost IS DISTINCT FROM OLD.shipping_cost
      OR NEW.description IS DISTINCT FROM OLD.description
    THEN
      v_title := 'Shipment details updated';
      v_message := 'Warehouse updated shipment details for ' || NEW.code || '.';
    ELSE
      v_title := NULL;
      v_message := NULL;
    END IF;

    IF v_title IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, notification_type, reference_id)
      VALUES (v_user_id, v_title, v_message, COALESCE(v_route, 'route:/customer/shipments'), NEW.id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shipment_status_notify ON public.shipments;

CREATE TRIGGER shipment_status_notify
AFTER INSERT OR UPDATE ON public.shipments
FOR EACH ROW
EXECUTE FUNCTION public.notify_shipment_status_change();

CREATE OR REPLACE FUNCTION public.notify_consolidation_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_user_id uuid;
  v_status text;
  v_title text;
  v_message text;
  v_route text;
  v_staff_user_id uuid;
  v_old_transit text;
  v_new_transit text;
  v_old_awb text;
  v_new_awb text;
BEGIN
  SELECT c.user_id INTO v_customer_user_id
  FROM public.customers c
  WHERE c.id = NEW.customer_id;

  IF TG_OP = 'INSERT' THEN
    IF v_customer_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, notification_type, reference_id)
      VALUES (
        v_customer_user_id,
        'Submitted',
        'Your consolidation request ' || NEW.code || ' has been submitted to warehouse.',
        'route:/customer/shipments?tab=submitted',
        NEW.id
      );
    END IF;

    FOR v_staff_user_id IN
      SELECT DISTINCT ur.user_id
      FROM public.user_roles ur
      WHERE ur.role IN ('admin', 'staff', 'branch_manager')
    LOOP
      INSERT INTO public.notifications (user_id, title, message, notification_type, reference_id)
      VALUES (
        v_staff_user_id,
        'New consolidation request',
        'A customer submitted consolidation request ' || NEW.code || '.',
        'route:/warehouse/consolidation',
        NEW.id
      );
    END LOOP;

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    v_status := public.normalize_consolidation_status_value(NEW.status);

    IF v_status = 'submitted' THEN
      v_title := 'Submitted';
      v_message := 'Consolidation ' || NEW.code || ' is submitted.';
      v_route := 'route:/customer/shipments?tab=submitted';
    ELSIF v_status = 'confirmed' THEN
      v_title := 'Confirm Shipment';
      v_message := 'Consolidation ' || NEW.code || ' is ready for your shipping approval.';
      v_route := 'route:/customer/shipments?tab=confirm';
    ELSIF v_status = 'outgoing' THEN
      v_title := 'Outgoing Parcels';
      v_message := 'Consolidation ' || NEW.code || ' is now outgoing.';
      v_route := 'route:/customer/shipments?tab=outgoing';
    ELSIF v_status = 'in_transit' THEN
      v_title := 'In Transit';
      v_message := 'Consolidation ' || NEW.code || ' is in transit.';
      v_route := 'route:/customer/shipments?tab=intransit';
    ELSIF v_status = 'arrived' THEN
      v_title := 'Arrived';
      v_message := 'Consolidation ' || NEW.code || ' has arrived.';
      v_route := 'route:/customer/shipments?tab=arrived';
    ELSIF v_status = 'collected' THEN
      v_title := 'Collected';
      v_message := 'Consolidation ' || NEW.code || ' has been collected.';
      v_route := 'route:/customer/shipments?tab=collected';
    ELSE
      v_title := NULL;
      v_message := NULL;
      v_route := NULL;
    END IF;

    IF v_customer_user_id IS NOT NULL AND v_title IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, notification_type, reference_id)
      VALUES (
        v_customer_user_id,
        v_title,
        v_message,
        COALESCE(v_route, 'route:/customer/shipments'),
        NEW.id
      );
    END IF;
  END IF;

  IF TG_OP = 'UPDATE'
    AND NEW.status IS NOT DISTINCT FROM OLD.status
    AND v_customer_user_id IS NOT NULL
  THEN
    v_old_transit := NULLIF(BTRIM((regexp_match(COALESCE(OLD.notes, ''), '(?i)Transit Status:\\s*([^|]+)'))[1]), '');
    v_new_transit := NULLIF(BTRIM((regexp_match(COALESCE(NEW.notes, ''), '(?i)Transit Status:\\s*([^|]+)'))[1]), '');
    v_old_awb := NULLIF(BTRIM((regexp_match(COALESCE(OLD.notes, ''), '(?i)AWB/BL No\\.:\\s*([^|]+)'))[1]), '');
    v_new_awb := NULLIF(BTRIM((regexp_match(COALESCE(NEW.notes, ''), '(?i)AWB/BL No\\.:\\s*([^|]+)'))[1]), '');

    v_status := public.normalize_consolidation_status_value(NEW.status);
    v_route := CASE v_status
      WHEN 'submitted' THEN 'route:/customer/shipments?tab=submitted'
      WHEN 'confirmed' THEN 'route:/customer/shipments?tab=confirm'
      WHEN 'outgoing' THEN 'route:/customer/shipments?tab=outgoing'
      WHEN 'in_transit' THEN 'route:/customer/shipments?tab=intransit'
      WHEN 'arrived' THEN 'route:/customer/shipments?tab=arrived'
      WHEN 'collected' THEN 'route:/customer/shipments?tab=collected'
      ELSE 'route:/customer/shipments'
    END;

    IF v_new_transit IS DISTINCT FROM v_old_transit AND v_new_transit IS NOT NULL THEN
      v_title := 'Transit update';
      v_message := v_new_transit;
      v_route := 'route:/customer/shipments?tab=intransit';
    ELSIF NEW.tracking_code IS DISTINCT FROM OLD.tracking_code
      OR v_new_awb IS DISTINCT FROM v_old_awb
    THEN
      v_title := 'Tracking details updated';
      v_message := 'Tracking No. and AWB/BL No. were updated for consolidation ' || NEW.code || '.';
    ELSIF NEW.item_count IS DISTINCT FROM OLD.item_count
      OR NEW.total_weight IS DISTINCT FROM OLD.total_weight
      OR NEW.total_cbm IS DISTINCT FROM OLD.total_cbm
      OR NEW.total_cost IS DISTINCT FROM OLD.total_cost
    THEN
      v_title := 'Consolidation details updated';
      v_message := 'Warehouse updated details for consolidation ' || NEW.code || '.';
    ELSE
      v_title := NULL;
      v_message := NULL;
    END IF;

    IF v_title IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, notification_type, reference_id)
      VALUES (
        v_customer_user_id,
        v_title,
        v_message,
        COALESCE(v_route, 'route:/customer/shipments'),
        NEW.id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS consolidation_status_notify ON public.consolidations;

CREATE TRIGGER consolidation_status_notify
AFTER INSERT OR UPDATE ON public.consolidations
FOR EACH ROW
EXECUTE FUNCTION public.notify_consolidation_status_change();
