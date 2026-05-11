BEGIN;

ALTER TABLE public.marketing_email_subscribers
  ADD COLUMN IF NOT EXISTS fbp text,
  ADD COLUMN IF NOT EXISTS fbc text,
  ADD COLUMN IF NOT EXISTS fbclid text,
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS utm_term text,
  ADD COLUMN IF NOT EXISTS utm_content text,
  ADD COLUMN IF NOT EXISTS page_url text,
  ADD COLUMN IF NOT EXISTS page_path text,
  ADD COLUMN IF NOT EXISTS referrer text;

ALTER TABLE public.marketing_automation_logs
  ADD COLUMN IF NOT EXISTS fb_event_name text,
  ADD COLUMN IF NOT EXISTS fb_event_id text,
  ADD COLUMN IF NOT EXISTS provider_response jsonb;

CREATE INDEX IF NOT EXISTS marketing_email_subscribers_fbclid_idx
  ON public.marketing_email_subscribers (fbclid);

CREATE INDEX IF NOT EXISTS marketing_email_subscribers_utm_campaign_idx
  ON public.marketing_email_subscribers (utm_campaign);

CREATE INDEX IF NOT EXISTS marketing_automation_logs_fb_event_name_idx
  ON public.marketing_automation_logs (fb_event_name);

COMMIT;
