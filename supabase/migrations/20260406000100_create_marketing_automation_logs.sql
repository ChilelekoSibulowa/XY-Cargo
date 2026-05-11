BEGIN;

CREATE TABLE IF NOT EXISTS public.marketing_automation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  event_type text NOT NULL,
  source text DEFAULT 'system',
  payload jsonb,
  triggered_at timestamptz NOT NULL,
  processed_at timestamptz,
  status text DEFAULT 'pending',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marketing_automation_logs_email_idx
  ON public.marketing_automation_logs (email);

CREATE INDEX IF NOT EXISTS marketing_automation_logs_event_type_idx
  ON public.marketing_automation_logs (event_type);

CREATE INDEX IF NOT EXISTS marketing_automation_logs_triggered_at_idx
  ON public.marketing_automation_logs (triggered_at);

ALTER TABLE public.marketing_automation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Marketing staff can view automation logs"
  ON public.marketing_automation_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.staff_portal_assignments spa
      WHERE spa.user_id = auth.uid()
        AND spa.portal_id = 'marketing'
    )
  );

COMMIT;
