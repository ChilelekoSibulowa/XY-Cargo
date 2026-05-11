-- Unified Strict Notification Workflow Migration
-- Enforces exact messaging, channel synchronization, and profile-based contact info.

-- 1. Robust Cleanup of old/stale notification logic
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Drop all triggers on shipments, consolidations, and notifications that might call our functions
    FOR r IN (
        SELECT trigger_name, event_object_table 
        FROM information_schema.triggers 
        WHERE event_object_table IN ('shipments', 'consolidations', 'notifications')
    ) LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || r.trigger_name || ' ON ' || r.event_object_table || ' CASCADE;';
    END LOOP;
END $$;

-- Ensure user_id is nullable to support unregistered customers in history
ALTER TABLE public.notifications ALTER COLUMN user_id DROP NOT NULL;

-- Add metadata column to notifications if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'metadata') THEN
        ALTER TABLE public.notifications ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

DROP FUNCTION IF EXISTS public.get_standardized_notification_message(text, text, text, boolean, text) CASCADE;
DROP FUNCTION IF EXISTS public.get_unified_notification_message(text, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.notify_shipment_status_change() CASCADE;
DROP FUNCTION IF EXISTS public.notify_consolidation_status_change() CASCADE;
DROP FUNCTION IF EXISTS public.trigger_notification_dispatch() CASCADE;
DROP FUNCTION IF EXISTS public.extract_note_value(text, text) CASCADE;

-- 2. Helper function to extract values from notes
CREATE OR REPLACE FUNCTION public.extract_note_value(p_notes text, p_key text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_match text;
BEGIN
  IF p_notes IS NULL OR p_key IS NULL THEN
    RETURN NULL;
  END IF;
  -- Matches "Key: Value" or "Key:Value" within a pipe-separated string or just a newline-separated list
  v_match := (regexp_matches(p_notes, '(?i)' || p_key || ':\s*([^|\n]+)', 'g'))[1];
  RETURN btrim(v_match);
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

-- 3. Function to generate exact standardized messages
CREATE OR REPLACE FUNCTION public.get_unified_notification_message(
  p_stage_transition text,
  p_customer_name text,
  p_tracking_number text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  CASE lower(p_stage_transition)
    WHEN 'created_to_incoming' THEN
      RETURN 'Dear ' || p_customer_name || ', your parcel with tracking number ' || p_tracking_number || ' is on the way to the origin warehouse.';
    
    WHEN 'incoming_to_need_action' THEN
      RETURN 'Dear ' || p_customer_name || ', your parcel with tracking number ' || p_tracking_number || ' has arrived at the origin warehouse. Kindly log in and consolidate your items.';
    
    WHEN 'incoming_to_submitted' THEN
      RETURN 'Dear ' || p_customer_name || ', your parcel with tracking number ' || p_tracking_number || ' has arrived at the origin warehouse and is awaiting your action.';
    
    WHEN 'need_action_to_submitted' THEN
      RETURN 'Dear ' || p_customer_name || ', your parcels have been consolidated successfully.';
    
    WHEN 'submitted_to_confirm' THEN
      RETURN 'Dear ' || p_customer_name || ', your shipment is awaiting confirmation. Kindly log in and confirm your shipment.';
    
    WHEN 'confirm_to_outgoing' THEN
      RETURN 'Dear ' || p_customer_name || ', your shipment has been confirmed successfully.';
    
    WHEN 'outgoing_to_transit' THEN
      RETURN 'Dear ' || p_customer_name || ', your shipment with tracking number ' || p_tracking_number || ' is now in transit.';
    
    WHEN 'transit_to_ready' THEN
      RETURN 'Dear ' || p_customer_name || ', your shipment with tracking number ' || p_tracking_number || ' has arrived at the destination warehouse and is awaiting collection.';
    
    WHEN 'ready_to_collected' THEN
      RETURN 'Dear ' || p_customer_name || ', your shipment with tracking number ' || p_tracking_number || ' has been collected successfully.';
    
    WHEN 'collected_to_unpaid' THEN
      RETURN 'Dear ' || p_customer_name || ', an invoice has been sent to you and is awaiting payment.';
    
    WHEN 'unpaid_to_paid' THEN
      RETURN 'Dear ' || p_customer_name || ', your payment has been received successfully.';
    
    ELSE
      RETURN NULL;
  END CASE;
END;
$$;

-- 4. Function to handle shipment status change notifications
CREATE OR REPLACE FUNCTION public.notify_shipment_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_user_id uuid;
  v_customer_name text;
  v_customer_email text;
  v_customer_phone text;
  v_customer_tracking text;
  v_warehouse_tracking text;
  v_transition text;
  v_message text;
  v_is_consolidated boolean;
  v_custom_msg text;
BEGIN
  -- Fetch customer info from registered profile or fallback to customer record
  SELECT 
    c.user_id,
    COALESCE(p.full_name, c.full_name),
    COALESCE(p.email, c.email),
    COALESCE(p.phone, c.phone)
  INTO 
    v_customer_user_id, v_customer_name, v_customer_email, v_customer_phone
  FROM public.customers c
  LEFT JOIN public.profiles p ON p.user_id = c.user_id
  WHERE c.id = NEW.customer_id;

  v_customer_name := COALESCE(v_customer_name, 'Customer');
  v_customer_tracking := COALESCE(NEW.custom_tracking_number, NEW.code);
  v_warehouse_tracking := COALESCE(public.extract_note_value(NEW.notes, 'Warehouse Tracking Number'), NEW.code);

  -- Check if consolidated to avoid duplicate notifications
  SELECT EXISTS (
    SELECT 1 FROM public.consolidation_shipments WHERE shipment_id = NEW.id
  ) INTO v_is_consolidated;

  v_transition := NULL;
  
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status) THEN
    IF (TG_OP = 'INSERT' AND NEW.status IN ('saved_pickup', 'saved_dropoff')) OR (OLD.status = 'saved_pickup' AND NEW.status = 'saved_dropoff') THEN
      v_transition := 'created_to_incoming';
    ELSIF (TG_OP = 'INSERT' AND NEW.status = 'received') OR (OLD.status = 'saved_dropoff' AND NEW.status = 'received' AND NEW.handling_method <> 'single') THEN
      v_transition := 'incoming_to_need_action';
    ELSIF (TG_OP = 'INSERT' AND NEW.status = 'requested_pickup') OR ((OLD.status IN ('saved_dropoff', 'received')) AND NEW.status = 'requested_pickup' AND NEW.handling_method = 'single') THEN
      v_transition := 'incoming_to_submitted';
    ELSIF (TG_OP = 'INSERT' AND NEW.status = 'approved') OR (OLD.status = 'requested_pickup' AND NEW.status = 'approved') THEN
      v_transition := 'submitted_to_confirm';
    ELSIF (TG_OP = 'INSERT' AND NEW.status = 'assigned') OR (OLD.status = 'approved' AND NEW.status = 'assigned') THEN
      v_transition := 'confirm_to_outgoing';
    ELSIF (TG_OP = 'INSERT' AND NEW.status = 'supplied') OR (OLD.status = 'assigned' AND NEW.status = 'supplied') THEN
      v_transition := 'outgoing_to_transit';
    ELSIF (TG_OP = 'INSERT' AND NEW.status = 'delivered') OR (OLD.status = 'supplied' AND NEW.status = 'delivered') THEN
      v_transition := 'transit_to_ready';
    ELSIF (TG_OP = 'INSERT' AND NEW.status = 'closed') OR (OLD.status = 'delivered' AND NEW.status = 'closed') THEN
      v_transition := 'ready_to_collected';
    END IF;
  END IF;

  -- Dispatch Status Transition (Skip if consolidated)
  IF v_transition IS NOT NULL AND NOT v_is_consolidated THEN
    v_message := public.get_unified_notification_message(
      v_transition,
      v_customer_name,
      CASE 
        WHEN v_transition IN ('created_to_incoming', 'incoming_to_need_action', 'incoming_to_submitted') THEN COALESCE(v_customer_tracking, NEW.code)
        ELSE COALESCE(v_warehouse_tracking, NEW.code)
      END
    );

    IF v_message IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, notification_type, reference_id, metadata)
      VALUES (
        v_customer_user_id,
        'Shipment Update',
        v_message,
        'shipment',
        NEW.id,
        jsonb_build_object('email', v_customer_email, 'phone', v_customer_phone, 'channels', jsonb_build_array('sms', 'email', 'push', 'bell'))
      );
    END IF;
  END IF;

  -- Payment Status Transitions
  IF TG_OP = 'UPDATE' AND NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
    IF NEW.payment_status = 'unpaid' AND OLD.status = 'closed' THEN
      v_transition := 'collected_to_unpaid';
    ELSIF NEW.payment_status = 'completed' THEN
      v_transition := 'unpaid_to_paid';
    ELSE
      v_transition := NULL;
    END IF;

    IF v_transition IS NOT NULL THEN
      v_message := public.get_unified_notification_message(v_transition, v_customer_name);
      IF v_message IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, notification_type, reference_id, metadata)
        VALUES (
          v_customer_user_id,
          'Payment Update',
          v_message,
          'payment',
          NEW.id,
          jsonb_build_object('email', v_customer_email, 'phone', v_customer_phone, 'channels', jsonb_build_array('sms', 'email', 'push', 'bell'))
        );
      END IF;
    END IF;
  END IF;

  -- Bulk / Custom Message Updates
  IF TG_OP = 'UPDATE' AND NEW.notes IS DISTINCT FROM OLD.notes THEN
    -- Transit
    v_custom_msg := public.extract_note_value(NEW.notes, 'Transit Status Message');
    IF v_custom_msg IS NOT NULL AND v_custom_msg IS DISTINCT FROM public.extract_note_value(OLD.notes, 'Transit Status Message') THEN
      INSERT INTO public.notifications (user_id, title, message, notification_type, reference_id, metadata)
      VALUES (
        v_customer_user_id,
        'Transit Update',
        'Dear ' || v_customer_name || ', Update for ' || v_warehouse_tracking || ': ' || v_custom_msg,
        'shipment_note',
        NEW.id,
        jsonb_build_object('email', v_customer_email, 'phone', v_customer_phone, 'channels', jsonb_build_array('sms', 'email', 'push', 'bell'))
      );
    END IF;

    -- Clearance
    v_custom_msg := public.extract_note_value(NEW.notes, 'Clearance Status Message');
    IF v_custom_msg IS NOT NULL AND v_custom_msg IS DISTINCT FROM public.extract_note_value(OLD.notes, 'Clearance Status Message') THEN
      INSERT INTO public.notifications (user_id, title, message, notification_type, reference_id, metadata)
      VALUES (
        v_customer_user_id,
        'Clearance Update',
        'Dear ' || v_customer_name || ', Update for ' || v_warehouse_tracking || ': ' || v_custom_msg,
        'shipment_note',
        NEW.id,
        jsonb_build_object('email', v_customer_email, 'phone', v_customer_phone, 'channels', jsonb_build_array('sms', 'email', 'push', 'bell'))
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 5. Function to handle consolidation status change notifications
CREATE OR REPLACE FUNCTION public.notify_consolidation_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_user_id uuid;
  v_customer_name text;
  v_customer_email text;
  v_customer_phone text;
  v_warehouse_tracking text;
  v_transition text;
  v_message text;
  v_custom_msg text;
BEGIN
  -- Fetch customer info from registered profile or fallback to customer record
  SELECT 
    c.user_id,
    COALESCE(p.full_name, c.full_name),
    COALESCE(p.email, c.email),
    COALESCE(p.phone, c.phone)
  INTO 
    v_customer_user_id, v_customer_name, v_customer_email, v_customer_phone
  FROM public.customers c
  LEFT JOIN public.profiles p ON p.user_id = c.user_id
  WHERE c.id = NEW.customer_id;

  v_customer_name := COALESCE(v_customer_name, 'Customer');
  v_warehouse_tracking := COALESCE(NEW.tracking_code, public.extract_note_value(NEW.notes, 'Warehouse Tracking Number'), NEW.code);

  v_transition := NULL;

  IF TG_OP = 'INSERT' THEN
    v_transition := 'need_action_to_submitted';
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status IN ('submitted', 'requested_pickup') AND NEW.status IN ('confirmed', 'approved') THEN
      v_transition := 'submitted_to_confirm';
    ELSIF OLD.status IN ('confirmed', 'approved') AND NEW.status IN ('outgoing', 'assigned') THEN
      v_transition := 'confirm_to_outgoing';
    ELSIF OLD.status IN ('outgoing', 'assigned') AND NEW.status IN ('in_transit', 'supplied') THEN
      v_transition := 'outgoing_to_transit';
    ELSIF OLD.status IN ('in_transit', 'supplied') AND NEW.status IN ('arrived', 'delivered') THEN
      v_transition := 'transit_to_ready';
    ELSIF OLD.status IN ('arrived', 'delivered') AND NEW.status IN ('collected', 'closed') THEN
      v_transition := 'ready_to_collected';
    END IF;
  END IF;

  IF v_transition IS NOT NULL THEN
    v_message := public.get_unified_notification_message(v_transition, v_customer_name, COALESCE(v_warehouse_tracking, NEW.code));
    IF v_message IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, notification_type, reference_id, metadata)
      VALUES (
        v_customer_user_id,
        'Consolidation Update',
        v_message,
        'consolidation',
        NEW.id,
        jsonb_build_object('email', v_customer_email, 'phone', v_customer_phone, 'channels', jsonb_build_array('sms', 'email', 'push', 'bell'))
      );
    END IF;
  END IF;

  -- Custom Message Updates for consolidations
  IF TG_OP = 'UPDATE' AND NEW.notes IS DISTINCT FROM OLD.notes THEN
    -- Transit
    v_custom_msg := public.extract_note_value(NEW.notes, 'Transit Status Message');
    IF v_custom_msg IS NOT NULL AND v_custom_msg IS DISTINCT FROM public.extract_note_value(OLD.notes, 'Transit Status Message') THEN
      INSERT INTO public.notifications (user_id, title, message, notification_type, reference_id, metadata)
      VALUES (
        v_customer_user_id,
        'Transit Update',
        'Dear ' || v_customer_name || ', Update for ' || v_warehouse_tracking || ': ' || v_custom_msg,
        'consolidation_note',
        NEW.id,
        jsonb_build_object('email', v_customer_email, 'phone', v_customer_phone, 'channels', jsonb_build_array('sms', 'email', 'push', 'bell'))
      );
    END IF;

    -- Clearance
    v_custom_msg := public.extract_note_value(NEW.notes, 'Clearance Status Message');
    IF v_custom_msg IS NOT NULL AND v_custom_msg IS DISTINCT FROM public.extract_note_value(OLD.notes, 'Clearance Status Message') THEN
      INSERT INTO public.notifications (user_id, title, message, notification_type, reference_id, metadata)
      VALUES (
        v_customer_user_id,
        'Clearance Update',
        'Dear ' || v_customer_name || ', Update for ' || v_warehouse_tracking || ': ' || v_custom_msg,
        'consolidation_note',
        NEW.id,
        jsonb_build_object('email', v_customer_email, 'phone', v_customer_phone, 'channels', jsonb_build_array('sms', 'email', 'push', 'bell'))
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 6. Update Dispatch Trigger
CREATE OR REPLACE FUNCTION public.trigger_notification_dispatch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_url text;
  v_anon_key text;
  v_channels jsonb;
BEGIN
  SELECT setting_value INTO v_project_url FROM public.system_settings WHERE setting_key = 'supabase_url';
  SELECT secret_value INTO v_anon_key FROM public.api_secrets WHERE secret_key = 'SUPABASE_ANON_KEY' AND is_active = true;
  v_project_url := COALESCE(v_project_url, 'https://vjkocqsqnhhgegagnjtj.supabase.co');
  
  v_channels := COALESCE(NEW.metadata->'channels', jsonb_build_array('push'));

  PERFORM net.http_post(
    url := v_project_url || '/functions/v1/send-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(v_anon_key, '')
    ),
    body := jsonb_build_object(
      'user_id', NEW.user_id,
      'title', NEW.title,
      'message', NEW.message,
      'notification_type', NEW.notification_type,
      'reference_id', NEW.reference_id,
      'notification_id', NEW.id,
      'email', NEW.metadata->>'email',
      'phone', NEW.metadata->>'phone',
      'channels', v_channels
    )
  );

  RETURN NEW;
END;
$$;

-- 7. Apply Triggers
CREATE TRIGGER shipment_status_notify
AFTER INSERT OR UPDATE OF status, payment_status, notes ON public.shipments
FOR EACH ROW
EXECUTE FUNCTION public.notify_shipment_status_change();

CREATE TRIGGER consolidation_status_notify
AFTER INSERT OR UPDATE OF status, notes ON public.consolidations
FOR EACH ROW
EXECUTE FUNCTION public.notify_consolidation_status_change();

CREATE TRIGGER on_notification_created
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.trigger_notification_dispatch();
