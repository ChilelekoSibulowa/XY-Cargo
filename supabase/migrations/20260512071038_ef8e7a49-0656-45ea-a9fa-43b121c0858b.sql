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

  -- Only notification rows that explicitly request sms/email/bell in metadata
  -- are allowed to fan out those channels. Plain bell rows created by the app
  -- still default to push-only to avoid duplicate SMS/email sends.
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
      'sms_message', COALESCE(NEW.metadata->>'sms_message', NEW.message),
      'email_subject', COALESCE(NEW.metadata->>'email_subject', NEW.title),
      'email_body', NEW.metadata->>'email_body',
      'notification_type', NEW.notification_type,
      'reference_id', NEW.reference_id,
      'notification_id', NEW.id,
      'email', NEW.metadata->>'email',
      'phone', NEW.metadata->>'phone',
      'customer_name', NEW.metadata->>'customer_name',
      'channels', v_channels
    )
  );

  RETURN NEW;
END;
$$;