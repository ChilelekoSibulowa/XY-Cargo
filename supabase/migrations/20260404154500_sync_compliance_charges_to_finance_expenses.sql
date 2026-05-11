BEGIN;

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
BEGIN
  -- Support either notes/note columns without hard dependency on schema shape.
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

  INSERT INTO public.finance_expenses (
    code,
    expense_date,
    expense_type,
    description,
    amount,
    approved_by
  )
  VALUES (
    v_code,
    CURRENT_DATE,
    'Compliance Duty/Charge',
    v_description,
    NEW.amount,
    NEW.entered_by_id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_compliance_charge_to_finance_expense ON public.compliance_charges;

CREATE TRIGGER trg_sync_compliance_charge_to_finance_expense
AFTER INSERT ON public.compliance_charges
FOR EACH ROW
EXECUTE FUNCTION public.sync_compliance_charge_to_finance_expense();

COMMIT;
