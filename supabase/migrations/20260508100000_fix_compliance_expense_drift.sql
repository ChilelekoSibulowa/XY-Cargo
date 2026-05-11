BEGIN;

-- 1. Update the trigger to handle both INSERT and UPDATE, preventing rounding drift and keeping data in sync
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
  v_default_currency_code text;
BEGIN
  v_note := COALESCE(to_jsonb(NEW)->>'notes', to_jsonb(NEW)->>'note');
  v_description := NULLIF(btrim(COALESCE(v_note, '')), '');
  v_expense_type := CASE
    WHEN NEW.charge_type IN ('custom_duty', 'customs_duty', 'duty') THEN 'Custom Duty'
    WHEN NEW.charge_type = 'miscellaneous' THEN 'Miscellaneous'
    ELSE 'Compliance Duty/Charge'
  END;

  -- Get currency/rate info
  SELECT code, COALESCE(exchange_rate, 1) INTO v_default_currency_code, v_default_rate
    FROM public.currencies WHERE is_default = true AND is_active = true LIMIT 1;
  
  SELECT COALESCE(cr.exchange_rate, 1) INTO v_source_rate FROM public.currencies cr
   WHERE cr.code = COALESCE(NEW.currency, '') AND cr.is_active = true LIMIT 1;

  v_source_rate := COALESCE(NULLIF(v_source_rate, 0), 1);
  v_default_rate := COALESCE(NULLIF(v_default_rate, 0), 1);

  -- Apply anti-drift logic
  IF NEW.currency = v_default_currency_code OR v_source_rate = v_default_rate THEN
    v_base_amount := NEW.amount;
  ELSE
    v_base_amount := ROUND((NEW.amount / v_source_rate) * v_default_rate, 2);
    IF ABS(v_base_amount - NEW.amount) < 1.0 AND v_base_amount > NEW.amount THEN
        v_base_amount := NEW.amount;
    END IF;
  END IF;

  -- If we already have a linked expense, update it
  IF NEW.finance_expense_id IS NOT NULL THEN
    UPDATE public.finance_expenses
    SET amount = v_base_amount,
        original_amount = NEW.amount,
        original_currency = NEW.currency,
        description = v_description,
        expense_type = v_expense_type,
        expense_date = NEW.created_at::date
    WHERE id = NEW.finance_expense_id;
    
    RETURN NEW;
  END IF;

  -- Otherwise, insert a new one
  BEGIN
    SELECT public.generate_code('EXP') INTO v_code;
  EXCEPTION WHEN OTHERS THEN
    v_code := NULL;
  END;

  IF v_code IS NULL OR btrim(v_code) = '' THEN
    v_code := 'EXP-' || to_char(now(), 'YYYYMMDDHH24MISSMS') || '-' || substr(replace(NEW.id::text, '-', ''), 1, 6);
  END IF;

  INSERT INTO public.finance_expenses (
    code, expense_date, expense_type, description, amount, approved_by,
    original_amount, original_currency
  ) VALUES (
    v_code, NEW.created_at::date, v_expense_type, v_description,
    v_base_amount, NEW.entered_by_id,
    NEW.amount, NEW.currency
  )
  RETURNING id INTO v_expense_id;

  -- Link the compliance charge to the finance expense
  -- Use a non-triggering update to avoid recursion if needed, 
  -- but since we're in AFTER trigger it's generally safe if we don't change monitored columns.
  UPDATE public.compliance_charges
  SET finance_expense_id = v_expense_id,
      recorded_in_finance = true
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_compliance_charge_to_finance_expense ON public.compliance_charges;
CREATE TRIGGER trg_sync_compliance_charge_to_finance_expense
AFTER INSERT OR UPDATE OF amount, currency, charge_type, notes ON public.compliance_charges
FOR EACH ROW
EXECUTE FUNCTION public.sync_compliance_charge_to_finance_expense();

-- 2. Cleanup existing drifted amounts for compliance-linked expenses
-- This handles records where the amount was slightly altered by rounding during sync.
-- We match by direct ID link, deterministic code, or description fuzzy matching for trigger-created rows.
UPDATE public.finance_expenses fe
SET amount = cc.amount,
    original_amount = cc.amount,
    original_currency = cc.currency
FROM public.compliance_charges cc
WHERE (fe.amount != cc.amount OR fe.original_amount IS NULL)
AND ABS(fe.amount - cc.amount) < 5.0 -- Increased tolerance for very drifted rows
AND (
    fe.id = cc.finance_expense_id
    OR fe.code = 'EXP-CMP-' || substr(replace(cc.id::text, '-', ''), 1, 12)
    OR (
        (fe.description ILIKE '%' || cc.notes || '%' OR cc.notes ILIKE '%' || fe.description || '%')
        AND fe.expense_date >= (cc.created_at::date - 2)
        AND fe.expense_date <= (cc.created_at::date + 2)
    )
    OR (
        fe.expense_date = cc.created_at::date
        AND fe.expense_type IN ('Custom Duty', 'Miscellaneous', 'Compliance Duty/Charge')
        AND ABS(fe.amount - cc.amount) < 1.0
    )
);

-- Establish missing links from compliance_charges to finance_expenses for better cascade deletes
UPDATE public.compliance_charges cc
SET finance_expense_id = fe.id,
    recorded_in_finance = true
FROM public.finance_expenses fe
WHERE cc.finance_expense_id IS NULL
AND (
    fe.code = 'EXP-CMP-' || substr(replace(cc.id::text, '-', ''), 1, 12)
    OR (
        (fe.description ILIKE '%' || cc.notes || '%' OR cc.notes ILIKE '%' || fe.description || '%')
        AND fe.expense_date >= (cc.created_at::date - 2)
        AND fe.expense_date <= (cc.created_at::date + 2)
    )
);

COMMIT;
