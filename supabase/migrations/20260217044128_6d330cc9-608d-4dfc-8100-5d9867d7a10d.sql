
-- Ensure tracking lookup column exists before functions reference it.
ALTER TABLE public.shipments
ADD COLUMN IF NOT EXISTS custom_tracking_number text;

-- Normalize legacy "friendly" statuses back to canonical enum workflow values.
-- This keeps compatibility with the current workflow guards.
UPDATE public.shipments SET status = 'saved_pickup' WHERE status = 'created';
UPDATE public.shipments SET status = 'saved_dropoff' WHERE status = 'incoming';
UPDATE public.shipments SET status = 'received' WHERE status = 'need_action';
UPDATE public.shipments SET status = 'requested_pickup' WHERE status = 'submitted';
UPDATE public.shipments SET status = 'approved' WHERE status = 'confirm_shipment';
UPDATE public.shipments SET status = 'assigned' WHERE status = 'outgoing';
UPDATE public.shipments SET status = 'supplied' WHERE status = 'in_transit';
UPDATE public.shipments SET status = 'delivered' WHERE status = 'arrived';
UPDATE public.shipments SET status = 'closed' WHERE status = 'collected';

-- Update the notification trigger for new statuses
CREATE OR REPLACE FUNCTION public.notify_shipment_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    CASE NEW.status::text
      WHEN 'created' THEN
        v_title := 'Shipment created';
        v_message := 'Your shipment ' || NEW.code || ' has been created.';
      WHEN 'incoming' THEN
        v_title := 'Parcel incoming';
        v_message := 'Your parcel ' || NEW.code || ' is on the way to the warehouse.';
      WHEN 'need_action' THEN
        v_title := 'Action required';
        v_message := 'Your parcel ' || NEW.code || ' arrived at warehouse. Please take action.';
      WHEN 'submitted' THEN
        v_title := 'Consolidation submitted';
        v_message := 'Your consolidation for ' || NEW.code || ' has been submitted for processing.';
      WHEN 'confirm_shipment' THEN
        v_title := 'Confirm shipment';
        v_message := 'Final weight and cost are ready for ' || NEW.code || '. Please confirm.';
      WHEN 'outgoing' THEN
        v_title := 'Shipment outgoing';
        v_message := 'Your shipment ' || NEW.code || ' is being prepared for dispatch.';
      WHEN 'in_transit' THEN
        v_title := 'Shipment in transit';
        v_message := 'Your shipment ' || NEW.code || ' is in transit.';
      WHEN 'arrived' THEN
        v_title := 'Shipment arrived';
        v_message := 'Your shipment ' || NEW.code || ' has arrived and is ready for collection.';
      WHEN 'collected' THEN
        v_title := 'Shipment collected';
        v_message := 'Your shipment ' || NEW.code || ' has been collected.';
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
      VALUES (v_user_id, 'Payment received', 'Payment completed for shipment ' || NEW.code || '.', 'payment', NEW.id);
    ELSIF NEW.payment_status = 'failed' THEN
      INSERT INTO public.notifications (user_id, title, message, notification_type, reference_id)
      VALUES (v_user_id, 'Payment failed', 'Payment failed for shipment ' || NEW.code || '. Please retry.', 'payment', NEW.id);
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Update tracking function to also search consolidation tracking codes
DROP FUNCTION IF EXISTS public.track_shipment_by_code(text);

CREATE OR REPLACE FUNCTION public.track_shipment_by_code(p_code text)
 RETURNS TABLE(code text, status text, origin text, destination text, created_at timestamp with time zone, pickup_date timestamp with time zone, estimated_delivery_date timestamp with time zone, actual_delivery_date timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    s.code,
    s.status::text,
    ob.name AS origin,
    db.name AS destination,
    s.created_at,
    s.pickup_date,
    s.estimated_delivery_date,
    s.actual_delivery_date
  FROM shipments s
  LEFT JOIN branches ob ON s.branch_id = ob.id
  LEFT JOIN branches db ON s.destination_branch_id = db.id
  WHERE s.code = p_code 
     OR s.custom_tracking_number = p_code;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      c.tracking_code AS code,
      c.status,
      ''::text AS origin,
      ''::text AS destination,
      c.created_at,
      NULL::timestamptz AS pickup_date,
      NULL::timestamptz AS estimated_delivery_date,
      NULL::timestamptz AS actual_delivery_date
    FROM consolidations c
    WHERE c.tracking_code = p_code
       OR c.code = p_code;
  END IF;
END;
$function$;

-- Update consolidation notification trigger
CREATE OR REPLACE FUNCTION public.notify_consolidation_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_customer_user_id uuid;
  v_status text;
  v_title text;
  v_message text;
  v_staff_user_id uuid;
  v_display_code text;
BEGIN
  SELECT c.user_id INTO v_customer_user_id
  FROM public.customers c
  WHERE c.id = NEW.customer_id;

  v_display_code := COALESCE(NEW.tracking_code, NEW.code);

  IF TG_OP = 'INSERT' THEN
    IF v_customer_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, notification_type, reference_id)
      VALUES (v_customer_user_id, 'Consolidation submitted', 'Your consolidation ' || v_display_code || ' has been submitted.', 'route:/customer/dashboard', NEW.id);
    END IF;

    FOR v_staff_user_id IN
      SELECT DISTINCT ur.user_id FROM public.user_roles ur WHERE ur.role IN ('admin', 'staff', 'branch_manager')
    LOOP
      INSERT INTO public.notifications (user_id, title, message, notification_type, reference_id)
      VALUES (v_staff_user_id, 'New consolidation request', 'Customer submitted consolidation ' || v_display_code || '.', 'route:/warehouse/consolidation', NEW.id);
    END LOOP;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    v_status := lower(trim(NEW.status));
    IF v_status = 'submitted' THEN
      v_title := 'Consolidation submitted'; v_message := 'Consolidation ' || v_display_code || ' is submitted for processing.';
    ELSIF v_status = 'confirm_shipment' THEN
      v_title := 'Confirm your shipment'; v_message := 'Consolidation ' || v_display_code || ' is ready. Please confirm to ship.';
    ELSIF v_status = 'outgoing' THEN
      v_title := 'Shipment outgoing'; v_message := 'Consolidation ' || v_display_code || ' is being prepared.';
    ELSIF v_status = 'in_transit' THEN
      v_title := 'In transit'; v_message := 'Consolidation ' || v_display_code || ' is in transit.';
    ELSIF v_status = 'arrived' THEN
      v_title := 'Arrived'; v_message := 'Consolidation ' || v_display_code || ' has arrived.';
    ELSIF v_status = 'collected' THEN
      v_title := 'Collected'; v_message := 'Consolidation ' || v_display_code || ' has been collected.';
    ELSE
      v_title := NULL; v_message := NULL;
    END IF;

    IF v_customer_user_id IS NOT NULL AND v_title IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, notification_type, reference_id)
      VALUES (v_customer_user_id, v_title, v_message, 'route:/customer/dashboard', NEW.id);
    END IF;
  END IF;

  IF TG_OP = 'UPDATE'
    AND (NEW.item_count IS DISTINCT FROM OLD.item_count OR NEW.total_weight IS DISTINCT FROM OLD.total_weight OR NEW.total_cost IS DISTINCT FROM OLD.total_cost)
    AND NEW.status IS NOT DISTINCT FROM OLD.status
    AND v_customer_user_id IS NOT NULL
  THEN
    INSERT INTO public.notifications (user_id, title, message, notification_type, reference_id)
    VALUES (v_customer_user_id, 'Consolidation details updated', 'Warehouse updated details for ' || v_display_code || '.', 'route:/customer/dashboard', NEW.id);
  END IF;

  RETURN NEW;
END;
$function$;
