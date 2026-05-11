-- Add AED (UAE Dirham) currency if it doesn't already exist
INSERT INTO public.currencies (code, name, symbol, exchange_rate, is_default, is_active)
SELECT 'AED', 'UAE Dirham', 'د.إ', 3.6800, false, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.currencies WHERE code = 'AED'
);
