BEGIN;

-- =================================================================
-- 1. Updated INSERT trigger: converts compliance charge amount from
--    its original currency to the system default currency, inserts
--    into finance_expenses, and stores the finance_expense_id back
--    on the compliance_charges row for reliable linkage.
-- =================================================================
CREATE OR REPLACE FUNCTION public.sync_compliance_charge_to_finance_expense()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_note text;
  v_description text;
  v_expense_type text;
  v_source_rate  numeric;
  v_default_rate numeric;
  v_base_amount  numeric;
  v_expense_id   uuid;
BEGIN
  v_note := COALESCE(to_jsonb(NEW)->>'notes', to_jsonb(NEW)->>'note');

  BEGIN
    SELECT public.generate_code('EXP') INTO v_code;
  EXCEPTION WHEN OTHERS THEN
    v_code := NULL;
  END;

  IF v_code IS NULL OR btrim(v_code) = '' THEN
    v_code :=
      'EXP-' ||
      to_char(now(), 'YYYYMMDDHH24MISSMS') ||
      '-' ||
      substr(replace(NEW.id::text, '-', ''), 1, 6);
  END IF;

  v_description := NULLIF(btrim(COALESCE(v_note, '')), '');

  v_expense_type := CASE
    WHEN NEW.charge_type IN ('custom_duty', 'customs_duty', 'duty') THEN 'Custom Duty'
    WHEN NEW.charge_type = 'miscellaneous' THEN 'Miscellaneous'
    ELSE 'Compliance Duty/Charge'
  END;

  -- ---- currency conversion ----
  SELECT COALESCE(cr.exchange_rate, 1)
    INTO v_source_rate
    FROM public.currencies cr
   WHERE cr.code = COALESCE(NEW.currency, '')
     AND cr.is_active = true
   LIMIT 1;
  IF v_source_rate IS NULL OR v_source_rate = 0 THEN
    v_source_rate := 1;
  END IF;

  SELECT COALESCE(cr.exchange_rate, 1)
    INTO v_default_rate
    FROM public.currencies cr
   WHERE cr.is_default = true AND cr.is_active = true
   LIMIT 1;
  IF v_default_rate IS NULL OR v_default_rate = 0 THEN
    v_default_rate := 1;
  END IF;

  v_base_amount := ROUND((NEW.amount / v_source_rate) * v_default_rate, 2);

  INSERT INTO public.finance_expenses (
    code, expense_date, expense_type, description, amount, approved_by
  ) VALUES (
    v_code, CURRENT_DATE, v_expense_type, v_description,
    v_base_amount, NEW.entered_by_id
  )
  RETURNING id INTO v_expense_id;

  -- Link the compliance charge to the finance expense for cascade deletes.
  UPDATE public.compliance_charges
  SET finance_expense_id = v_expense_id,
      recorded_in_finance = true
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- =================================================================
-- 2. DELETE trigger: when a compliance charge is deleted, remove the
--    linked finance_expenses row automatically.
-- =================================================================
CREATE OR REPLACE FUNCTION public.delete_compliance_charge_finance_expense()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete by direct link if available
  IF OLD.finance_expense_id IS NOT NULL THEN
    DELETE FROM public.finance_expenses WHERE id = OLD.finance_expense_id;
  END IF;

  -- Also delete by deterministic code pattern (for older backfilled rows)
  DELETE FROM public.finance_expenses
  WHERE code = 'EXP-CMP-' || substr(replace(OLD.id::text, '-', ''), 1, 12);

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_delete_compliance_charge_finance_expense ON public.compliance_charges;

CREATE TRIGGER trg_delete_compliance_charge_finance_expense
BEFORE DELETE ON public.compliance_charges
FOR EACH ROW
EXECUTE FUNCTION public.delete_compliance_charge_finance_expense();

-- =================================================================
-- 3. Backfill: reclassify expense_type, convert amounts, and
--    establish finance_expense_id links for existing records.
-- =================================================================

-- 3a. Fix rows created by the deterministic backfill (code = EXP-CMP-…)
UPDATE public.finance_expenses fe
SET
  expense_type = CASE
    WHEN c.charge_type IN ('custom_duty', 'customs_duty', 'duty') THEN 'Custom Duty'
    WHEN c.charge_type = 'miscellaneous' THEN 'Miscellaneous'
    ELSE 'Compliance Duty/Charge'
  END,
  amount = ROUND(
    (c.amount / COALESCE(NULLIF(src.exchange_rate, 0), 1))
    * COALESCE(NULLIF(def.exchange_rate, 0), 1),
    2
  )
FROM public.compliance_charges c
LEFT JOIN public.currencies src
  ON src.code = COALESCE(c.currency, '') AND src.is_active = true
CROSS JOIN (
  SELECT COALESCE(exchange_rate, 1) AS exchange_rate
  FROM public.currencies
  WHERE is_default = true AND is_active = true
  LIMIT 1
) def
WHERE fe.code = 'EXP-CMP-' || substr(replace(c.id::text, '-', ''), 1, 12);

-- Link those rows back to compliance_charges
UPDATE public.compliance_charges c
SET finance_expense_id = fe.id,
    recorded_in_finance = true
FROM public.finance_expenses fe
WHERE fe.code = 'EXP-CMP-' || substr(replace(c.id::text, '-', ''), 1, 12)
  AND c.finance_expense_id IS NULL;

-- 3b. Fix rows created by the AFTER INSERT trigger (non-EXP-CMP codes).
--     Match on description + raw amount + compliance expense_type.
UPDATE public.finance_expenses fe
SET
  expense_type = CASE
    WHEN c.charge_type IN ('custom_duty', 'customs_duty', 'duty') THEN 'Custom Duty'
    WHEN c.charge_type = 'miscellaneous' THEN 'Miscellaneous'
    ELSE fe.expense_type
  END,
  amount = ROUND(
    (c.amount / COALESCE(NULLIF(src.exchange_rate, 0), 1))
    * COALESCE(NULLIF(def.exchange_rate, 0), 1),
    2
  )
FROM public.compliance_charges c
LEFT JOIN public.currencies src
  ON src.code = COALESCE(c.currency, '') AND src.is_active = true
CROSS JOIN (
  SELECT COALESCE(exchange_rate, 1) AS exchange_rate
  FROM public.currencies
  WHERE is_default = true AND is_active = true
  LIMIT 1
) def
WHERE fe.expense_type IN ('Compliance Duty/Charge', 'Custom Duty', 'Miscellaneous')
  AND fe.code NOT LIKE 'EXP-CMP-%'
  AND fe.amount = c.amount
  AND c.finance_expense_id IS NULL
  AND fe.description IS NOT DISTINCT FROM
      NULLIF(btrim(COALESCE(to_jsonb(c)->>'notes', to_jsonb(c)->>'note')), '');

-- Link trigger-created rows back to compliance_charges
UPDATE public.compliance_charges c
SET finance_expense_id = fe.id,
    recorded_in_finance = true
FROM public.finance_expenses fe
WHERE fe.expense_type IN ('Compliance Duty/Charge', 'Custom Duty', 'Miscellaneous')
  AND fe.code NOT LIKE 'EXP-CMP-%'
  AND c.finance_expense_id IS NULL
  AND fe.description IS NOT DISTINCT FROM
      NULLIF(btrim(COALESCE(to_jsonb(c)->>'notes', to_jsonb(c)->>'note')), '');

-- 3c. Insert any miscellaneous charges that were never synced at all.
INSERT INTO public.finance_expenses (code, expense_date, expense_type, description, amount, approved_by)
SELECT
  'EXP-CMP-' || substr(replace(c.id::text, '-', ''), 1, 12),
  COALESCE((to_jsonb(c)->>'created_at')::timestamptz::date, CURRENT_DATE),
  'Miscellaneous',
  NULLIF(btrim(COALESCE(to_jsonb(c)->>'notes', to_jsonb(c)->>'note')), ''),
  ROUND(
    (c.amount / COALESCE(NULLIF(src.exchange_rate, 0), 1))
    * COALESCE(NULLIF(def.exchange_rate, 0), 1),
    2
  ),
  c.entered_by_id
FROM public.compliance_charges c
LEFT JOIN public.currencies src
  ON src.code = COALESCE(c.currency, '') AND src.is_active = true
CROSS JOIN (
  SELECT COALESCE(exchange_rate, 1) AS exchange_rate
  FROM public.currencies
  WHERE is_default = true AND is_active = true
  LIMIT 1
) def
WHERE c.charge_type = 'miscellaneous'
  AND c.finance_expense_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.finance_expenses fe
    WHERE fe.code = 'EXP-CMP-' || substr(replace(c.id::text, '-', ''), 1, 12)
  )
ON CONFLICT (code) DO NOTHING;

-- Link those newly inserted rows
UPDATE public.compliance_charges c
SET finance_expense_id = fe.id,
    recorded_in_finance = true
FROM public.finance_expenses fe
WHERE fe.code = 'EXP-CMP-' || substr(replace(c.id::text, '-', ''), 1, 12)
  AND c.charge_type = 'miscellaneous'
  AND c.finance_expense_id IS NULL;

-- 3d. Remove duplicate finance_expenses for the same compliance charge.
--     Keep only the one linked via finance_expense_id (or the first one).
DELETE FROM public.finance_expenses fe
WHERE fe.expense_type IN ('Compliance Duty/Charge', 'Custom Duty', 'Miscellaneous')
  AND EXISTS (
    SELECT 1 FROM public.compliance_charges c
    WHERE c.finance_expense_id IS NOT NULL
      AND c.finance_expense_id <> fe.id
      AND (
        fe.code = 'EXP-CMP-' || substr(replace(c.id::text, '-', ''), 1, 12)
        OR (
          fe.description IS NOT DISTINCT FROM
            NULLIF(btrim(COALESCE(to_jsonb(c)->>'notes', to_jsonb(c)->>'note')), '')
        )
      )
  );

-- 3e. Remove orphaned finance_expenses whose compliance_charges have been deleted.
--     These are compliance-linked expenses (EXP-CMP- codes) with no matching charge.
DELETE FROM public.finance_expenses fe
WHERE fe.code LIKE 'EXP-CMP-%'
  AND NOT EXISTS (
    SELECT 1 FROM public.compliance_charges c
    WHERE fe.code = 'EXP-CMP-' || substr(replace(c.id::text, '-', ''), 1, 12)
  );

-- Also remove trigger-created orphans that were linked but the charge was deleted.
DELETE FROM public.finance_expenses fe
WHERE fe.expense_type IN ('Compliance Duty/Charge', 'Custom Duty', 'Miscellaneous')
  AND fe.code NOT LIKE 'EXP-CMP-%'
  AND NOT EXISTS (
    SELECT 1 FROM public.compliance_charges c
    WHERE c.finance_expense_id = fe.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.compliance_charges c
    WHERE fe.description IS NOT DISTINCT FROM
          NULLIF(btrim(COALESCE(to_jsonb(c)->>'notes', to_jsonb(c)->>'note')), '')
      AND fe.amount = ROUND(
            (c.amount / COALESCE(NULLIF(
              (SELECT exchange_rate FROM public.currencies WHERE code = COALESCE(c.currency, '') AND is_active = true LIMIT 1)
            , 0), 1))
            * COALESCE(NULLIF(
              (SELECT exchange_rate FROM public.currencies WHERE is_default = true AND is_active = true LIMIT 1)
            , 0), 1),
            2
          )
  );

COMMIT;
