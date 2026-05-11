BEGIN;

CREATE TABLE IF NOT EXISTS public.marketing_email_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  subscribed_at timestamptz NOT NULL DEFAULT now(),
  unsubscribed_at timestamptz,
  subscription_source text DEFAULT 'homepage_newsletter',
  is_active boolean NOT NULL DEFAULT true,
  marketing_consent boolean NOT NULL DEFAULT true,
  metadata jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS marketing_email_subscribers_email_idx
  ON public.marketing_email_subscribers (lower(email));

CREATE INDEX IF NOT EXISTS marketing_email_subscribers_is_active_idx
  ON public.marketing_email_subscribers (is_active);

CREATE INDEX IF NOT EXISTS marketing_email_subscribers_subscription_source_idx
  ON public.marketing_email_subscribers (subscription_source);

ALTER TABLE public.marketing_email_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can subscribe to newsletter"
  ON public.marketing_email_subscribers
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Users can view their own subscription"
  ON public.marketing_email_subscribers
  FOR SELECT
  TO authenticated
  USING (
    lower(email) = lower(COALESCE(nullif(auth.jwt()->>'email', ''), ''))
  );

CREATE POLICY "Marketing staff can view all subscriptions"
  ON public.marketing_email_subscribers
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.staff_portal_assignments spa
      WHERE spa.user_id = auth.uid()
        AND spa.portal_id = 'marketing'
    )
  );

CREATE OR REPLACE FUNCTION public.unsubscribe_from_newsletter(p_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(btrim(COALESCE(p_email, '')));
BEGIN
  IF v_email = '' OR v_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$' THEN
    RETURN false;
  END IF;

  UPDATE public.marketing_email_subscribers
  SET
    is_active = false,
    unsubscribed_at = now(),
    updated_at = now()
  WHERE lower(email) = v_email;

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.unsubscribe_from_newsletter(text) TO anon, authenticated;

COMMIT;
