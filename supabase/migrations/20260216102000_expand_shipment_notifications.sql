-- Expand shipment workflow notifications for all customer-facing actions

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
        v_title := 'Shipment created';
        v_message := 'Your shipment has been created and is now in All Parcels.';
      WHEN 'saved_dropoff' THEN
        v_title := 'Incoming parcel';
        v_message := 'Your parcel is on the way to the warehouse.';
      WHEN 'received' THEN
        v_title := 'Action required';
        v_message := 'Warehouse received your parcel. Please choose the next action.';
      WHEN 'requested_pickup' THEN
        v_title := 'Parcel submitted';
        v_message := 'Your parcel was submitted for consolidation and processing.';
      WHEN 'approved' THEN
        v_title := 'Shipment confirmation needed';
        v_message := 'Final weight and cost are ready. Please confirm shipment.';
      WHEN 'assigned' THEN
        v_title := 'Shipment outgoing';
        v_message := 'Shipping has started and your parcel is now outgoing.';
      WHEN 'supplied' THEN
        v_title := 'Shipment in transit';
        v_message := 'Your shipment is in transit.';
      WHEN 'delivered' THEN
        v_title := 'Shipment arrived';
        v_message := 'Your shipment has arrived and is ready for collection.';
      WHEN 'closed' THEN
        v_title := 'Shipment collected';
        v_message := 'Collection confirmed. This shipment is now closed.';
      WHEN 'returned' THEN
        v_title := 'Shipment returned';
        v_message := 'The shipment was returned. Contact support if you need help.';
      WHEN 'returned_stock' THEN
        v_title := 'Shipment returned to stock';
        v_message := 'The shipment was returned to stock.';
      WHEN 'returned_delivered' THEN
        v_title := 'Returned shipment delivered';
        v_message := 'The returned shipment has been delivered.';
      ELSE
        v_title := NULL;
        v_message := NULL;
    END CASE;

    IF v_title IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, notification_type, reference_id)
      VALUES (v_user_id, v_title, v_message, 'shipment', NEW.id);
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
    IF NEW.payment_status = 'completed' THEN
      INSERT INTO public.notifications (user_id, title, message, notification_type, reference_id)
      VALUES (
        v_user_id,
        'Payment received',
        'Payment completed for shipment ' || NEW.code || '.',
        'payment',
        NEW.id
      );
    ELSIF NEW.payment_status = 'failed' THEN
      INSERT INTO public.notifications (user_id, title, message, notification_type, reference_id)
      VALUES (
        v_user_id,
        'Payment failed',
        'Payment failed for shipment ' || NEW.code || '. Please retry.',
        'payment',
        NEW.id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shipment_status_notify ON public.shipments;

CREATE TRIGGER shipment_status_notify
AFTER INSERT OR UPDATE OF status, payment_status ON public.shipments
FOR EACH ROW
EXECUTE FUNCTION public.notify_shipment_status_change();
