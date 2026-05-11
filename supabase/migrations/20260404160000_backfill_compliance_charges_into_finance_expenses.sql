BEGIN;

-- Backfill historical compliance charges into finance expenses.
-- Idempotent: uses deterministic code + ON CONFLICT DO NOTHING.
INSERT INTO public.finance_expenses (
  code,
  expense_date,
  expense_type,
  description,
  amount,
  approved_by
)
SELECT
  'EXP-CMP-' || substr(replace(c.id::text, '-', ''), 1, 12) AS code,
  COALESCE((to_jsonb(c)->>'created_at')::timestamptz::date, CURRENT_DATE) AS expense_date,
  'Compliance Duty/Charge' AS expense_type,
  NULLIF(btrim(COALESCE(to_jsonb(c)->>'notes', to_jsonb(c)->>'note')), '') AS description,
  c.amount,
  c.entered_by_id
FROM public.compliance_charges c
ON CONFLICT (code) DO NOTHING;

COMMIT;
