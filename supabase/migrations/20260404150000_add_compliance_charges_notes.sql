BEGIN;

ALTER TABLE public.compliance_charges
  ADD COLUMN IF NOT EXISTS notes text;

COMMIT;
