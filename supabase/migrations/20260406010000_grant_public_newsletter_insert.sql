BEGIN;

GRANT INSERT ON TABLE public.marketing_email_subscribers TO anon, authenticated;
GRANT INSERT ON TABLE public.marketing_newsletter_subscribers TO anon, authenticated;

COMMIT;