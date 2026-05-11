BEGIN;

-- 1. Add original amount and currency columns for financial auditing
ALTER TABLE public.finance_expenses 
ADD COLUMN IF NOT EXISTS original_amount numeric,
ADD COLUMN IF NOT EXISTS original_currency text;

-- 2. Cleanup duplicate/stuck "processing" payments for shipments that are already paid
DELETE FROM public.payments
WHERE status IN ('pending', 'processing', 'failed')
AND shipment_id IN (
    SELECT id FROM public.shipments WHERE payment_status = 'completed'
);

-- 3. Cleanup existing drifted amounts for default currency expenses (e.g. K5550 -> K5550.03)
UPDATE public.finance_expenses fe
SET amount = cc.amount
FROM public.compliance_charges cc
WHERE fe.id = cc.finance_expense_id
AND fe.amount != cc.amount
AND cc.currency = (SELECT code FROM public.currencies WHERE is_default = true AND is_active = true LIMIT 1);

-- 4. Specifically fix invoice 581543A1 and its associated shipment
-- Ensure shipment paid_amount reflects the sum of completed payments
UPDATE public.shipments s
SET paid_amount = COALESCE((
    SELECT SUM(p.amount) 
    FROM public.payments p 
    WHERE p.shipment_id = s.id 
    AND p.status = 'completed'
), s.paid_amount),
payment_status = CASE 
    WHEN COALESCE((SELECT SUM(p.amount) FROM public.payments p WHERE p.shipment_id = s.id AND p.status = 'completed'), 0) >= COALESCE(s.shipping_cost, s.total_cost, 0) 
    THEN 'completed' 
    ELSE s.payment_status 
END
WHERE s.code = '581543A1' OR s.custom_tracking_number = '581543A1';

-- Ensure invoice status is set to 'paid' if shipment is completed
UPDATE public.invoices i
SET status = 'paid'
FROM public.shipments s
WHERE i.shipment_id = s.id
AND (s.code = '581543A1' OR s.custom_tracking_number = '581543A1')
AND s.payment_status = 'completed';

-- 4. Update the trigger to capture original values from compliance charges
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
  -- Get default currency info
  DECLARE
    v_default_currency_code text;
  BEGIN
    SELECT code, COALESCE(exchange_rate, 1)
      INTO v_default_currency_code, v_default_rate
      FROM public.currencies
     WHERE is_default = true AND is_active = true
     LIMIT 1;
    
    -- If same currency, use exact amount to avoid rounding drift (e.g. 5550 -> 5550.03)
    IF NEW.currency = v_default_currency_code THEN
      v_base_amount := NEW.amount;
    ELSE
      -- Fetch source rate
      SELECT COALESCE(cr.exchange_rate, 1)
        INTO v_source_rate
        FROM public.currencies cr
       WHERE cr.code = COALESCE(NEW.currency, '')
         AND cr.is_active = true
       LIMIT 1;

      IF v_source_rate IS NULL OR v_source_rate = 0 THEN
        v_source_rate := 1;
      END IF;
      
      IF v_default_rate IS NULL OR v_default_rate = 0 THEN
        v_default_rate := 1;
      END IF;

      v_base_amount := ROUND((NEW.amount / v_source_rate) * v_default_rate, 2);
    END IF;
  END;

  INSERT INTO public.finance_expenses (
    code, expense_date, expense_type, description, amount, approved_by,
    original_amount, original_currency
  ) VALUES (
    v_code, CURRENT_DATE, v_expense_type, v_description,
    v_base_amount, NEW.entered_by_id,
    NEW.amount, NEW.currency
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

COMMIT;
