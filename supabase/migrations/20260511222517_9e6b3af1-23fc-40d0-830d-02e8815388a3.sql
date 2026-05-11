
-- Single source of truth for notifications: app-side sendNotification calls only.
-- Disable DB trigger duplicates and lock the webhook to push-only fanout to prevent
-- any sms/email/bell loops or duplicates.

-- 1. Replace the shipment status notify trigger so it NO LONGER inserts notifications.
-- The app (notifyShipmentCreated, notifyStatusChange, notifyPaymentReceived) is the
-- single source of truth and already calls send-notification for every transition.
CREATE OR REPLACE FUNCTION public.notify_shipment_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Intentionally no-op. App-layer notifications handle every shipment status
  -- and payment status transition. Keeping the trigger as a no-op preserves the
  -- attached trigger binding so we don't have to touch the table definition.
  RETURN NEW;
END;
$$;

-- 2. Replace the consolidation notify trigger with a no-op for the same reason.
CREATE OR REPLACE FUNCTION public.notify_consolidation_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN NEW;
END;
$$;

-- 3. Lock the notification webhook to push-only. The app's send-notification call
-- already inserts the bell row AND sends sms+email itself. The webhook should only
-- fan out web-push so users with subscriptions get a desktop alert. Anything else
-- causes 2x or 3x duplicates.
CREATE OR REPLACE FUNCTION public.trigger_notification_dispatch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_url text;
  v_anon_key text;
BEGIN
  SELECT setting_value INTO v_project_url FROM public.system_settings WHERE setting_key = 'supabase_url';
  SELECT secret_value INTO v_anon_key FROM public.api_secrets WHERE secret_key = 'SUPABASE_ANON_KEY' AND is_active = true;
  v_project_url := COALESCE(v_project_url, 'https://vjkocqsqnhhgegagnjtj.supabase.co');

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
      -- Hard-locked to push only. Bell row already exists (this row), and the
      -- caller that inserted it has already sent sms+email synchronously.
      'channels', jsonb_build_array('push')
    )
  );

  RETURN NEW;
END;
$$;
