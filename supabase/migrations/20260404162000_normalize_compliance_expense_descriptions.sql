BEGIN;

-- Normalize existing compliance-linked finance expense descriptions to note-only.
-- 1) Backfilled rows with deterministic code EXP-CMP-<first12(id-no-dashes)>
UPDATE public.finance_expenses fe
SET description = NULLIF(btrim(COALESCE(to_jsonb(c)->>'notes', to_jsonb(c)->>'note')), '')
FROM public.compliance_charges c
WHERE fe.expense_type = 'Compliance Duty/Charge'
  AND fe.code = 'EXP-CMP-' || substr(replace(c.id::text, '-', ''), 1, 12);

-- 2) Older auto-recorded rows that embedded compliance UUID in description text
UPDATE public.finance_expenses fe
SET description = NULLIF(btrim(COALESCE(to_jsonb(c)->>'notes', to_jsonb(c)->>'note')), '')
FROM public.compliance_charges c
WHERE fe.expense_type = 'Compliance Duty/Charge'
  AND c.id::text = (
    regexp_match(
      COALESCE(fe.description, ''),
      '(?i)compliance charge\s+([0-9a-fA-F-]{36})'
    )
  )[1];

COMMIT;
