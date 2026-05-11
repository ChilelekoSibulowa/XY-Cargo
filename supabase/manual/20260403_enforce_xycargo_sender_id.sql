BEGIN;

-- 1) Update existing sender ID record
UPDATE public.api_secrets
SET
  secret_value = 'XY Cargo',
  is_active = true,
  description = 'Sender ID shown to recipients as XY Cargo'
WHERE secret_key = 'ZAMTEL_SMS_SENDER_ID';

-- 2) Insert sender ID record if missing
INSERT INTO public.api_secrets (
  secret_key,
  secret_value,
  category,
  description,
  is_active
)
SELECT
  'ZAMTEL_SMS_SENDER_ID',
  'XY Cargo',
  'sms',
  'Sender ID shown to recipients as XY Cargo',
  true
WHERE NOT EXISTS (
  SELECT 1
  FROM public.api_secrets
  WHERE secret_key = 'ZAMTEL_SMS_SENDER_ID'
);

-- 3) Trigger function to enforce XYCARGO on every insert/update
CREATE OR REPLACE FUNCTION public.enforce_xycargo_sender_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.secret_key = 'ZAMTEL_SMS_SENDER_ID' THEN
    NEW.secret_value := 'XY Cargo';
    NEW.is_active := true;
  END IF;
  RETURN NEW;
END;
$$;

-- 4) Recreate trigger safely
DROP TRIGGER IF EXISTS trg_enforce_xycargo_sender_id ON public.api_secrets;

CREATE TRIGGER trg_enforce_xycargo_sender_id
BEFORE INSERT OR UPDATE OF secret_key, secret_value, is_active
ON public.api_secrets
FOR EACH ROW
EXECUTE FUNCTION public.enforce_xycargo_sender_id();

COMMIT;

-- Verification
SELECT
  secret_key,
  secret_value,
  is_active,
  description
FROM public.api_secrets
WHERE secret_key = 'ZAMTEL_SMS_SENDER_ID';
