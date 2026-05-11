BEGIN;

CREATE OR REPLACE FUNCTION public.notify_agent_shipment_notification_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent_user_id uuid;
  v_customer_name text;
  v_shipment_ref text;
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

  v_shipment_ref := COALESCE(NULLIF(BTRIM(NEW.custom_tracking_number), ''), NEW.code);

  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    CASE NEW.status
      WHEN 'saved_dropoff' THEN
        v_title := 'Incoming client parcel';
        v_message := 'Parcel ' || v_shipment_ref || ' for ' || v_customer_name || ' is incoming to the warehouse.';
        v_route := 'route:/agent/shipments?tab=incoming';
      WHEN 'received' THEN
        v_title := 'Client parcel needs action';
        v_message := 'Parcel ' || v_shipment_ref || ' for ' || v_customer_name || ' is ready for review.';
        v_route := 'route:/agent/shipments?tab=need_action';
      WHEN 'requested_pickup' THEN
        v_title := 'Client parcel submitted';
        v_message := 'Parcel ' || v_shipment_ref || ' for ' || v_customer_name || ' has been submitted.';
        v_route := 'route:/agent/shipments?tab=submitted';
      WHEN 'approved' THEN
        v_title := 'Client shipment confirmed';
        v_message := 'Shipment ' || v_shipment_ref || ' for ' || v_customer_name || ' is ready to send out.';
        v_route := 'route:/agent/shipments?tab=confirm';
      WHEN 'assigned' THEN
        v_title := 'Client shipment sent out';
        v_message := 'Shipment ' || v_shipment_ref || ' for ' || v_customer_name || ' has left the warehouse.';
        v_route := 'route:/agent/shipments?tab=outgoing';
      WHEN 'supplied' THEN
        v_title := 'Client shipment in transit';
        v_message := 'Shipment ' || v_shipment_ref || ' for ' || v_customer_name || ' is in transit.';
        v_route := 'route:/agent/shipments?tab=in_transit';
      WHEN 'delivered' THEN
        v_title := 'Client shipment arrived';
        v_message := 'Shipment ' || v_shipment_ref || ' for ' || v_customer_name || ' has arrived.';
        v_route := 'route:/agent/shipments?tab=arrived';
      WHEN 'closed' THEN
        v_title := 'Client shipment collected';
        v_message := 'Shipment ' || v_shipment_ref || ' for ' || v_customer_name || ' has been collected.';
        v_route := 'route:/agent/shipments?tab=collected';
      WHEN 'returned' THEN
        v_title := 'Client parcel issue';
        v_message := 'Shipment ' || v_shipment_ref || ' for ' || v_customer_name || ' has a delivery issue.';
        v_route := 'route:/agent/shipments?tab=problem';
      WHEN 'returned_stock' THEN
        v_title := 'Client parcel issue';
        v_message := 'Shipment ' || v_shipment_ref || ' for ' || v_customer_name || ' was returned to stock.';
        v_route := 'route:/agent/shipments?tab=problem';
      WHEN 'returned_delivered' THEN
        v_title := 'Client parcel issue';
        v_message := 'Shipment ' || v_shipment_ref || ' for ' || v_customer_name || ' was returned after delivery.';
        v_route := 'route:/agent/shipments?tab=problem';
      ELSE
        v_title := NULL;
        v_message := NULL;
        v_route := NULL;
    END CASE;

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
        v_message := 'Payment for shipment ' || v_shipment_ref || ' is now complete.';
      WHEN 'partial' THEN
        v_title := 'Client payment partially settled';
        v_message := 'Shipment ' || v_shipment_ref || ' now has a partial payment recorded.';
      WHEN 'failed' THEN
        v_title := 'Client payment failed';
        v_message := 'Payment for shipment ' || v_shipment_ref || ' failed and needs attention.';
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
  v_shipment_ref text;
BEGIN
  v_shipment_ref := COALESCE(NULLIF(BTRIM(NEW.custom_tracking_number), ''), NEW.code);

  IF NEW.assigned_driver_id IS NOT NULL
     AND (
       TG_OP = 'INSERT'
       OR NEW.assigned_driver_id IS DISTINCT FROM OLD.assigned_driver_id
     ) THEN
    PERFORM public.insert_driver_route_notification(
      NEW.assigned_driver_id,
      'New delivery assigned',
      'Shipment ' || v_shipment_ref || ' has been assigned to you.',
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
        v_message := 'Shipment ' || v_shipment_ref || ' is now in transit.';
      WHEN 'delivered' THEN
        v_title := 'Delivery arrived';
        v_message := 'Shipment ' || v_shipment_ref || ' is marked as arrived.';
      WHEN 'closed' THEN
        v_title := 'Delivery closed';
        v_message := 'Shipment ' || v_shipment_ref || ' has been collected and closed.';
      WHEN 'returned' THEN
        v_title := 'Delivery issue';
        v_message := 'Shipment ' || v_shipment_ref || ' has been marked as returned.';
      WHEN 'returned_stock' THEN
        v_title := 'Delivery issue';
        v_message := 'Shipment ' || v_shipment_ref || ' was returned to stock.';
      WHEN 'returned_delivered' THEN
        v_title := 'Delivery issue';
        v_message := 'Shipment ' || v_shipment_ref || ' was returned after delivery.';
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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS driver_shipment_notification_events ON public.shipments;
CREATE TRIGGER driver_shipment_notification_events
AFTER INSERT OR UPDATE OF assigned_driver_id, status ON public.shipments
FOR EACH ROW
EXECUTE FUNCTION public.notify_driver_shipment_notification_events();

COMMIT;
