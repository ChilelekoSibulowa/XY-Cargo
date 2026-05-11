-- Ensure USD is the default currency

UPDATE public.currencies
SET is_default = (code = 'USD');

INSERT INTO public.system_settings (setting_key, setting_value, category, description)
VALUES ('default_currency', 'USD', 'general', 'Default currency code')
ON CONFLICT (setting_key)
DO UPDATE SET setting_value = EXCLUDED.setting_value;
