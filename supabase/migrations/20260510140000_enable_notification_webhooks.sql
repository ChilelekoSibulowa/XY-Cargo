-- Enable pg_net extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Function to call the send-notification Edge Function
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
  -- We attempt to resolve the project URL and key from settings
  -- In a standard Supabase setup, we can use these if they were previously inserted
  SELECT setting_value INTO v_project_url FROM public.system_settings WHERE setting_key = 'supabase_url';
  SELECT secret_value INTO v_anon_key FROM public.api_secrets WHERE secret_key = 'SUPABASE_ANON_KEY' AND is_active = true;

  -- Fallback to hardcoded for this specific project if not found
  v_project_url := COALESCE(v_project_url, 'https://vjkocqsqnhhgegagnjtj.supabase.co');
  
  -- Trigger the Edge Function asynchronously
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
      'channels', jsonb_build_array('push') -- Only trigger 'push' for now to avoid loop if send-notification inserts into bell
    )
  );

  RETURN NEW;
END;
$$;

-- Insert settings if they don't exist
INSERT INTO public.system_settings (setting_key, setting_value, category, description)
VALUES ('supabase_url', 'https://vjkocqsqnhhgegagnjtj.supabase.co', 'api', 'Supabase Project URL')
ON CONFLICT (setting_key) DO NOTHING;

-- Drop if exists
DROP TRIGGER IF EXISTS on_notification_created ON public.notifications;

-- Create the trigger
CREATE TRIGGER on_notification_created
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.trigger_notification_dispatch();
