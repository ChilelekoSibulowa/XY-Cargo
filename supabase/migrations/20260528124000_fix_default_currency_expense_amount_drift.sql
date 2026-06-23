BEGIN;

-- Default-currency expenses should never be converted against their own rate.
-- If a historical sync stored a drifted base amount such as 9500.16 while the
-- preserved original amount is 9500 ZMW, restore the exact original value.
WITH default_currency AS (
  SELECT code
  FROM public.currencies
  WHERE is_default = true AND is_active = true
  LIMIT 1
)
UPDATE public.finance_expenses fe
SET amount = fe.original_amount
FROM default_currency dc
WHERE fe.original_amount IS NOT NULL
  AND fe.original_currency = dc.code
  AND fe.amount IS DISTINCT FROM fe.original_amount;

WITH default_currency AS (
  SELECT code, COALESCE(NULLIF(exchange_rate, 0), 1) AS exchange_rate
  FROM public.currencies
  WHERE is_default = true AND is_active = true
  LIMIT 1
),
source_charges AS (
  SELECT
    cc.finance_expense_id,
    cc.amount,
    cc.currency
  FROM public.compliance_charges cc
  CROSS JOIN default_currency dc
  LEFT JOIN public.currencies src
    ON src.code = COALESCE(cc.currency, '')
   AND src.is_active = true
  WHERE cc.finance_expense_id IS NOT NULL
    AND (
      cc.currency = dc.code
      OR COALESCE(NULLIF(src.exchange_rate, 0), 1) = dc.exchange_rate
    )
)
UPDATE public.finance_expenses fe
SET amount = source_charges.amount,
    original_amount = source_charges.amount,
    original_currency = source_charges.currency
FROM source_charges
WHERE fe.id = source_charges.finance_expense_id
  AND (
    fe.amount IS DISTINCT FROM source_charges.amount
    OR fe.original_amount IS DISTINCT FROM source_charges.amount
    OR fe.original_currency IS DISTINCT FROM source_charges.currency
  );

COMMIT;
