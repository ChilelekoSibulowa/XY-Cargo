-- Workflow notifications and bulk assignment helpers

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
      WHEN 'requested_pickup' THEN
        v_title := 'Pickup requested';
        v_message := 'Your pickup request has been submitted.';
      WHEN 'approved' THEN
        v_title := 'Shipment approved';
        v_message := 'Your shipment has been approved by operations.';
      WHEN 'received' THEN
        v_title := 'Shipment received';
        v_message := 'Your shipment arrived at the origin warehouse.';
      WHEN 'assigned' THEN
        v_title := 'Assigned to bulk shipment';
        v_message := 'Your shipment was assigned to a bulk manifest.';
      WHEN 'supplied' THEN
        v_title := 'Customs cleared';
        v_message := 'Your shipment has cleared customs.';
      WHEN 'delivered' THEN
        v_title := 'Delivered';
        v_message := 'Your shipment has been delivered.';
      WHEN 'closed' THEN
        v_title := 'Shipment closed';
        v_message := 'Your shipment is now closed.';
      ELSE
        v_title := NULL;
        v_message := NULL;
    END CASE;

    IF v_title IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, notification_type, reference_id)
      VALUES (v_user_id, v_title, v_message, 'shipment', NEW.id);
    END IF;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.payment_status IS DISTINCT FROM OLD.payment_status
     AND NEW.payment_status = 'completed' THEN
    INSERT INTO public.notifications (user_id, title, message, notification_type, reference_id)
    VALUES (
      v_user_id,
      'Payment received',
      'Payment completed for shipment ' || NEW.code || '.',
      'payment',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shipment_status_notify ON public.shipments;

CREATE TRIGGER shipment_status_notify
AFTER INSERT OR UPDATE OF status, payment_status ON public.shipments
FOR EACH ROW
EXECUTE FUNCTION public.notify_shipment_status_change();

CREATE OR REPLACE FUNCTION public.assign_shipment_to_manifest()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.shipments
  SET status = 'assigned'
  WHERE id = NEW.shipment_id
    AND status IS DISTINCT FROM 'assigned';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS manifest_shipments_assign ON public.manifest_shipments;

CREATE TRIGGER manifest_shipments_assign
AFTER INSERT ON public.manifest_shipments
FOR EACH ROW
EXECUTE FUNCTION public.assign_shipment_to_manifest();
