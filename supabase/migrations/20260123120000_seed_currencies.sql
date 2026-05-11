-- Seed currencies (USD default, ZMW, CNY)
INSERT INTO public.currencies (code, name, symbol, exchange_rate, is_default, is_active)
VALUES
  ('USD', 'US Dollar', '$', 1, true, true),
  ('ZMW', 'Zambian Kwacha', 'K', 0.038, false, true),
  ('CNY', 'Chinese Yuan', '?', 0.14, false, true)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    symbol = EXCLUDED.symbol,
    is_default = EXCLUDED.is_default,
    is_active = EXCLUDED.is_active;
