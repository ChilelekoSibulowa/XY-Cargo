-- Migration to standardize notifications with branded templates
-- This ensures all channels (SMS, Email, System, Push) use the same approved messages.

CREATE OR REPLACE FUNCTION public.get_standardized_notification_message(
  p_status text,
  p_customer_name text,
  p_tracking_number text,
  p_is_consolidation boolean DEFAULT false,
  p_transit_message text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  CASE lower(trim(p_status))
    WHEN 'saved_pickup', 'created' THEN
      RETURN 'Dear ' || p_customer_name || ', your parcel with tracking number ' || p_tracking_number || ' has been created successfully.';
    
    WHEN 'saved_dropoff', 'incoming' THEN
      RETURN 'Dear ' || p_customer_name || ', your parcel with tracking number ' || p_tracking_number || ' is on the way to the origin warehouse.';
    
    WHEN 'received', 'need action', 'need_action' THEN
      IF p_is_consolidation THEN
        RETURN 'Dear ' || p_customer_name || ', your parcel with tracking number ' || p_tracking_number || ' has arrived at the origin warehouse and is awaiting consolidation.';
      ELSE
        RETURN 'Dear ' || p_customer_name || ', your parcel with tracking number ' || p_tracking_number || ' has arrived at the origin warehouse and is awaiting your action.';
      END IF;
    
    WHEN 'requested_pickup', 'submitted' THEN
      RETURN 'Dear ' || p_customer_name || ', your shipment with tracking number ' || p_tracking_number || ' has been submitted and is awaiting warehouse review.';

    WHEN 'approved', 'confirm shipment', 'confirm_shipment' THEN
      RETURN 'Dear ' || p_customer_name || ', your shipment with tracking number ' || p_tracking_number || ' has been processed. Please review the shipping cost and confirm shipment.';
    
    WHEN 'assigned', 'outgoing' THEN
      RETURN 'Dear ' || p_customer_name || ', your shipment with tracking number ' || p_tracking_number || ' is ready for dispatch.';
    
    WHEN 'supplied', 'in transit', 'in_transit' THEN
      RETURN 'Dear ' || p_customer_name || ', your shipment with tracking number ' || p_tracking_number || ' is now in transit.' || 
             CASE WHEN p_transit_message IS NOT NULL AND trim(p_transit_message) <> '' THEN ' ' || p_transit_message ELSE '' END;
    
    WHEN 'delivered', 'ready for collection', 'ready_for_collection' THEN
      RETURN 'Dear ' || p_customer_name || ', your shipment with tracking number ' || p_tracking_number || ' has arrived at the destination and is ready for collection.';
    
    WHEN 'closed', 'collected' THEN
      RETURN 'Dear ' || p_customer_name || ', your shipment with tracking number ' || p_tracking_number || ' has been collected successfully. Thank you for shipping with XY Cargo.';
    
    ELSE
      RETURN 'Dear ' || p_customer_name || ', your shipment ' || p_tracking_number || ' status has been updated to ' || p_status || '.';
  END CASE;
END;
$$;

-- Update the shipment notification trigger
CREATE OR REPLACE FUNCTION public.notify_shipment_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_user_id uuid;
  v_customer_name text;
  v_tracking_number text;
  v_is_consolidation boolean := false;
  v_message text;
  v_transit_message text;
  v_customer_email text;
  v_customer_phone text;
BEGIN
  -- Get customer info
  SELECT 
    p.full_name, 
    p.id,
    p.email,
    p.phone
  INTO 
    v_customer_name, 
    v_customer_user_id,
    v_customer_email,
    v_customer_phone
  FROM public.profiles p
  JOIN public.customers c ON c.user_id = p.id
  WHERE c.id = NEW.customer_id;

  v_customer_name := COALESCE(v_customer_name, 'Customer');
  
  -- Resolve tracking number
  v_tracking_number := COALESCE(NEW.custom_tracking_number, NEW.code);
  
  -- Check if consolidation
  v_is_consolidation := (NEW.notes ~* 'Consolidation:');
  
  -- Get transit message if any
  v_transit_message := public.extract_note_value(NEW.notes, 'Transit Status Message');

  -- Generate message
  v_message := public.get_standardized_notification_message(
    NEW.status::text,
    v_customer_name,
    v_tracking_number,
    v_is_consolidation,
    v_transit_message
  );

  -- Insert into notifications table
  IF v_customer_user_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status) THEN
    INSERT INTO public.notifications (
      user_id, 
      title, 
      message, 
      notification_type, 
      reference_id,
      metadata
    )
    VALUES (
      v_customer_user_id,
      'Shipment Update: ' || NEW.status,
      v_message,
      'route:/customer/shipments',
      NEW.id,
      jsonb_build_object(
        'status', NEW.status,
        'tracking_number', v_tracking_number,
        'email', v_customer_email,
        'phone', v_customer_phone
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Update the consolidation notification trigger
CREATE OR REPLACE FUNCTION public.notify_consolidation_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_user_id uuid;
  v_customer_name text;
  v_status text;
  v_message text;
  v_staff_user_id uuid;
  v_customer_email text;
  v_customer_phone text;
BEGIN
  -- Get customer info
  SELECT 
    p.full_name, 
    p.id,
    p.email,
    p.phone
  INTO 
    v_customer_name, 
    v_customer_user_id,
    v_customer_email,
    v_customer_phone
  FROM public.profiles p
  JOIN public.customers c ON c.user_id = p.id
  WHERE c.id = NEW.customer_id;

  v_customer_name := COALESCE(v_customer_name, 'Customer');

  IF TG_OP = 'INSERT' THEN
    IF v_customer_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, notification_type, reference_id)
      VALUES (
        v_customer_user_id,
        'Consolidation submitted',
        'Dear ' || v_customer_name || ', your consolidation request ' || NEW.code || ' has been submitted to warehouse.',
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
    v_message := public.get_standardized_notification_message(
      NEW.status,
      v_customer_name,
      NEW.code,
      true
    );

    IF v_customer_user_id IS NOT NULL AND v_message IS NOT NULL THEN
      INSERT INTO public.notifications (
        user_id, 
        title, 
        message, 
        notification_type, 
        reference_id,
        metadata
      )
      VALUES (
        v_customer_user_id,
        'Consolidation Update: ' || NEW.status,
        v_message,
        'route:/customer/shipments',
        NEW.id,
        jsonb_build_object(
          'status', NEW.status,
          'tracking_number', NEW.code,
          'email', v_customer_email,
          'phone', v_customer_phone
        )
      );
    END IF;
  END IF;

  IF TG_OP = 'UPDATE'
    AND (
      NEW.item_count IS DISTINCT FROM OLD.item_count
      OR NEW.total_weight IS DISTINCT FROM OLD.total_weight
      OR NEW.total_cost IS DISTINCT FROM OLD.total_cost
    )
    AND NEW.status IS NOT DISTINCT FROM OLD.status
    AND v_customer_user_id IS NOT NULL
  THEN
    INSERT INTO public.notifications (user_id, title, message, notification_type, reference_id)
    VALUES (
      v_customer_user_id,
      'Consolidation details updated',
      'Dear ' || v_customer_name || ', warehouse has updated the weight and cost for your consolidation ' || NEW.code || '. Please review.',
      'route:/customer/shipments',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure extract_note_value exists
CREATE OR REPLACE FUNCTION public.extract_note_value(p_notes text, p_key text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_part text;
BEGIN
  IF p_notes IS NULL OR p_key IS NULL THEN
    RETURN NULL;
  END IF;

  FOR v_part IN SELECT btrim(part) FROM unnest(string_to_array(p_notes, '|')) AS part LOOP
    IF lower(split_part(v_part, ':', 1)) = lower(p_key) THEN
      RETURN btrim(split_part(v_part, ':', 2));
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$;
