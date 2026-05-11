BEGIN;

ALTER TABLE public.marketing_newsletter_subscribers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'marketing_newsletter_subscribers'
      AND policyname = 'Public can subscribe newsletter'
  ) THEN
    CREATE POLICY "Public can subscribe newsletter"
      ON public.marketing_newsletter_subscribers
      FOR INSERT
      TO anon, authenticated
      WITH CHECK (
        email IS NOT NULL
        AND btrim(email) <> ''
      );
  END IF;
END
$$;

COMMIT;
