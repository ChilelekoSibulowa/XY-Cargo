-- Hardening shipment notification reliability and removing duplicates
-- Ensures consolidated items send a single message and removes "Pending" tracking references.

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
  v_tracking text;
  v_tracking_suffix text;
  v_is_consolidated boolean;
BEGIN
  -- 1. Check if shipment is part of a consolidation to avoid duplicate notifications
  SELECT EXISTS (
    SELECT 1 FROM public.consolidation_shipments WHERE shipment_id = NEW.id
  ) INTO v_is_consolidated;

  -- 2. Resolve tracking number (prefer warehouse tracking from notes)
  SELECT NULLIF(BTRIM(SUBSTRING(COALESCE(NEW.notes, '') FROM '(?i)Warehouse Tracking Number:\\s*([^|]+)')), '')
  INTO v_tracking;

  IF v_tracking IS NULL OR v_tracking = 'Pending' THEN
    v_tracking := NULL;
  END IF;

  IF v_tracking IS NOT NULL THEN
    v_tracking_suffix := ' with tracking number ' || v_tracking;
  ELSE
    v_tracking_suffix := '';
  END IF;

  SELECT user_id INTO v_user_id
  FROM public.customers
  WHERE id = NEW.customer_id;

  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- 3. Status Change Notifications (Skip if consolidated - let consolidation trigger handle it)
  IF NOT v_is_consolidated AND (TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status) THEN
    CASE NEW.status
      WHEN 'requested_pickup' THEN
        v_title := 'Parcel Submitted';
        v_message := 'Your parcel' || v_tracking_suffix || ' has been submitted.' || CASE WHEN v_tracking IS NULL THEN ' Please log in and check.' ELSE '' END;
      WHEN 'approved' THEN
        v_title := 'Confirm Shipment';
        v_message := 'Your parcel has been moved to confirm shipment. Please log in and confirm.';
      WHEN 'received' THEN
        v_title := 'Parcel Moved to Incoming';
        v_message := 'Your parcel' || v_tracking_suffix || ' has been moved to incoming.' || CASE WHEN v_tracking IS NULL THEN ' Please log in and check.' ELSE '' END;
      WHEN 'assigned' THEN
        v_title := 'Moved to Outgoing';
        v_message := 'Your shipment' || v_tracking_suffix || ' has been moved to outgoing parcels.' || CASE WHEN v_tracking IS NULL THEN ' Please log in and check.' ELSE '' END;
      WHEN 'supplied' THEN
        v_title := 'Parcel In Transit';
        v_message := 'Your parcel' || v_tracking_suffix || ' has moved to in-transit.' || CASE WHEN v_tracking IS NULL THEN ' Please log in and check.' ELSE '' END;
      WHEN 'delivered' THEN
        v_title := 'Ready for Collection';
        v_message := 'Your parcel' || v_tracking_suffix || ' has moved to ready for collection.' || CASE WHEN v_tracking IS NULL THEN ' Please log in and check.' ELSE '' END;
      WHEN 'closed' THEN
        v_title := 'Parcel Collected';
        v_message := 'Your parcel' || v_tracking_suffix || ' has been collected. Thank you!';
      WHEN 'need_action' THEN
        v_title := 'Need Action';
        v_message := 'Your parcel' || v_tracking_suffix || ' has been moved to need action.' || CASE WHEN v_tracking IS NULL THEN ' Please log in and check.' ELSE '' END;
      ELSE
        v_title := NULL;
        v_message := NULL;
    END CASE;

    IF v_title IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, notification_type, reference_id)
      VALUES (v_user_id, v_title, v_message, 'shipment', NEW.id);
    END IF;
  END IF;

  -- 4. Payment Notification (Always send, even if consolidated)
  IF TG_OP = 'UPDATE'
     AND NEW.payment_status IS DISTINCT FROM OLD.payment_status
     AND NEW.payment_status = 'completed' THEN
    INSERT INTO public.notifications (user_id, title, message, notification_type, reference_id)
    VALUES (
      v_user_id,
      'Payment received',
      'Payment completed for shipment ' || COALESCE(v_tracking, NEW.code) || '.',
      'payment',
      NEW.id
    );
  END IF;

  -- 5. Delivery Request Notifications
  IF TG_OP = 'UPDATE' AND NEW.delivery_request_status IS DISTINCT FROM OLD.delivery_request_status THEN
    CASE NEW.delivery_request_status
      WHEN 'requested' THEN
        v_title := 'Delivery Requested';
        v_message := 'A doorstep delivery has been requested for your parcel' || v_tracking_suffix || '.';
      WHEN 'assigned' THEN
        v_title := 'Driver Assigned';
        v_message := 'A driver has been assigned to deliver your parcel' || v_tracking_suffix || '.';
      WHEN 'successful' THEN
        v_title := 'Delivery Successful';
        v_message := 'Your parcel' || v_tracking_suffix || ' has been successfully delivered.';
      WHEN 'failed' THEN
        v_title := 'Delivery Failed';
        v_message := 'Doorstep delivery failed for your parcel' || v_tracking_suffix || '. We will contact you soon.';
      ELSE
        v_title := NULL;
        v_message := NULL;
    END CASE;

    IF v_title IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, notification_type, reference_id)
      VALUES (v_user_id, v_title, v_message, 'shipment', NEW.id);
    END IF;
  END IF;

  -- 6. Tracking Number Added Notification
  IF TG_OP = 'UPDATE' 
     AND (v_tracking IS NOT NULL) 
     AND (NULLIF(BTRIM(SUBSTRING(COALESCE(OLD.notes, '') FROM '(?i)Warehouse Tracking Number:\\s*([^|]+)')), '') IS NULL) THEN
    INSERT INTO public.notifications (user_id, title, message, notification_type, reference_id)
    VALUES (v_user_id, 'Tracking Number Assigned', 'A tracking number has been assigned to your shipment.', 'shipment', NEW.id);
  END IF;

  -- 7. Custom Transit Message Notification
  IF TG_OP = 'UPDATE' AND NEW.notes IS DISTINCT FROM OLD.notes THEN
    DECLARE
      v_old_msg text;
      v_new_msg text;
    BEGIN
      SELECT NULLIF(BTRIM(SUBSTRING(COALESCE(OLD.notes, '') FROM '(?i)Transit Status Message:\\s*([^|]+)')), '') INTO v_old_msg;
      SELECT NULLIF(BTRIM(SUBSTRING(COALESCE(NEW.notes, '') FROM '(?i)Transit Status Message:\\s*([^|]+)')), '') INTO v_new_msg;
      
      IF v_new_msg IS NOT NULL AND (v_old_msg IS NULL OR v_old_msg <> v_new_msg) THEN
        INSERT INTO public.notifications (user_id, title, message, notification_type, reference_id)
        VALUES (v_user_id, 'Shipping Update', 'Update for ' || COALESCE(v_tracking, NEW.code) || ': ' || v_new_msg, 'shipment', NEW.id);
      END IF;
    END;
  END IF;

  RETURN NEW;
END;
$$;

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
  v_staff_user_id uuid;
  v_tracking text;
  v_tracking_suffix text;
BEGIN
  SELECT c.user_id INTO v_customer_user_id
  FROM public.customers c
  WHERE c.id = NEW.customer_id;

  -- Resolve tracking number
  SELECT NULLIF(BTRIM(SUBSTRING(COALESCE(NEW.notes, '') FROM '(?i)Warehouse Tracking Number:\\s*([^|]+)')), '')
  INTO v_tracking;

  IF v_tracking IS NULL OR v_tracking = 'Pending' THEN
    v_tracking := NULL;
  END IF;

  IF v_tracking IS NOT NULL THEN
    v_tracking_suffix := ' with tracking number ' || v_tracking;
  ELSE
    v_tracking_suffix := '';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF v_customer_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, notification_type, reference_id)
      VALUES (
        v_customer_user_id,
        'Consolidation submitted',
        'Your consolidation request ' || NEW.code || ' has been submitted to warehouse.',
        'route:/customer/shipments',
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
    v_status := lower(trim(NEW.status));

    IF v_status IN ('pending', 'requested', 'submitted') THEN
      v_title := 'Consolidation submitted';
      v_message := 'Consolidation ' || NEW.code || ' is submitted.';
    ELSIF v_status IN ('processed', 'completed', 'confirmed') THEN
      v_title := 'Consolidation confirmed';
      v_message := 'Consolidation ' || NEW.code || ' is confirmed. You can now ship it.';
    ELSIF v_status IN ('outgoing', 'assigned') THEN
      v_title := 'Moved to Outgoing';
      v_message := 'Your shipment' || v_tracking_suffix || ' has been moved to outgoing parcels.' || CASE WHEN v_tracking IS NULL THEN ' Please log in and check.' ELSE '' END;
    ELSIF v_status IN ('in_transit', 'intransit', 'supplied') THEN
      v_title := 'Parcel In Transit';
      v_message := 'Your shipment' || v_tracking_suffix || ' has moved to in-transit.' || CASE WHEN v_tracking IS NULL THEN ' Please log in and check.' ELSE '' END;
    ELSIF v_status IN ('arrived', 'delivered') THEN
      v_title := 'Ready for Collection';
      v_message := 'Your shipment' || v_tracking_suffix || ' has moved to ready for collection.' || CASE WHEN v_tracking IS NULL THEN ' Please log in and check.' ELSE '' END;
    ELSIF v_status IN ('collected', 'closed') THEN
      v_title := 'Parcel Collected';
      v_message := 'Your shipment' || v_tracking_suffix || ' has been collected and closed.';
    ELSE
      v_title := NULL;
      v_message := NULL;
    END IF;

    IF v_customer_user_id IS NOT NULL AND v_title IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, notification_type, reference_id)
      VALUES (
        v_customer_user_id,
        v_title,
        v_message,
        'route:/customer/shipments',
        NEW.id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
