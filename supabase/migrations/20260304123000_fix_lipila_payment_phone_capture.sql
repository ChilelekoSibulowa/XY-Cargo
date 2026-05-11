-- Capture and backfill real phone numbers so Lipila checkout always receives
-- the required payment contact details without asking for phone input on the
-- payment form.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requested_role public.app_role := 'customer'::public.app_role;
  v_full_name text := COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), NEW.email);
  v_phone text := COALESCE(NULLIF(BTRIM(NEW.raw_user_meta_data->>'phone'), ''), 'Pending');
  v_customer_code text := 'CUST-' || upper(substr(replace(NEW.id::text, '-', ''), 1, 6));
  v_driver_code text := 'DRV-' || upper(substr(replace(NEW.id::text, '-', ''), 1, 6));
BEGIN
  IF COALESCE(NEW.raw_user_meta_data->>'requested_role', '') = 'agent' THEN
    v_requested_role := 'agent'::public.app_role;
  ELSIF COALESCE(NEW.raw_user_meta_data->>'requested_role', '') = 'driver' THEN
    v_requested_role := 'driver'::public.app_role;
  END IF;

  INSERT INTO public.profiles (user_id, full_name, email, phone)
  VALUES (NEW.id, v_full_name, NEW.email, NULLIF(v_phone, 'Pending'))
  ON CONFLICT (user_id) DO UPDATE
  SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    phone = COALESCE(profiles.phone, EXCLUDED.phone);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_requested_role)
  ON CONFLICT DO NOTHING;

  IF v_requested_role = 'customer'::public.app_role THEN
    INSERT INTO public.customers (user_id, code, full_name, email, phone, is_active)
    SELECT NEW.id, v_customer_code, v_full_name, NEW.email, v_phone, true
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.user_id = NEW.id
    );
  ELSIF v_requested_role = 'driver'::public.app_role THEN
    INSERT INTO public.drivers (user_id, code, full_name, email, phone, is_active)
    SELECT NEW.id, v_driver_code, v_full_name, NEW.email, v_phone, true
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.drivers d
      WHERE d.user_id = NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

UPDATE public.profiles p
SET phone = src.phone
FROM (
  SELECT
    u.id AS user_id,
    NULLIF(BTRIM(u.raw_user_meta_data->>'phone'), '') AS phone
  FROM auth.users u
) AS src
WHERE p.user_id = src.user_id
  AND src.phone IS NOT NULL
  AND (
    p.phone IS NULL
    OR BTRIM(p.phone) = ''
  );

UPDATE public.customers c
SET phone = src.phone
FROM (
  SELECT
    c0.id,
    COALESCE(
      NULLIF(BTRIM(p.phone), ''),
      NULLIF(BTRIM(u.raw_user_meta_data->>'phone'), ''),
      NULLIF(BTRIM(c0.company_phone), '')
    ) AS phone
  FROM public.customers c0
  LEFT JOIN public.profiles p ON p.user_id = c0.user_id
  LEFT JOIN auth.users u ON u.id = c0.user_id
) AS src
WHERE c.id = src.id
  AND src.phone IS NOT NULL
  AND (
    BTRIM(c.phone) = ''
    OR lower(BTRIM(c.phone)) = 'pending'
    OR regexp_replace(COALESCE(c.phone, ''), '\D', '', 'g') = ''
  );

UPDATE public.drivers d
SET phone = src.phone
FROM (
  SELECT
    d0.id,
    COALESCE(
      NULLIF(BTRIM(p.phone), ''),
      NULLIF(BTRIM(u.raw_user_meta_data->>'phone'), '')
    ) AS phone
  FROM public.drivers d0
  LEFT JOIN public.profiles p ON p.user_id = d0.user_id
  LEFT JOIN auth.users u ON u.id = d0.user_id
) AS src
WHERE d.id = src.id
  AND src.phone IS NOT NULL
  AND (
    BTRIM(d.phone) = ''
    OR lower(BTRIM(d.phone)) = 'pending'
    OR regexp_replace(COALESCE(d.phone, ''), '\D', '', 'g') = ''
  );
