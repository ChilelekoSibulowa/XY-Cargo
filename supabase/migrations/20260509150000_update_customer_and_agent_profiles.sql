-- Add customer_type to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_type TEXT CHECK (customer_type IN ('personal', 'company')) DEFAULT 'personal';

-- Add city and country to profiles table for consistency
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country TEXT;

-- Add bank details to profiles table for agents
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bank_account_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bank_account_number TEXT;

-- Updated trigger function to handle more details from metadata
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
  v_customer_type text := COALESCE(NEW.raw_user_meta_data->>'customer_type', 'personal');
BEGIN
  IF COALESCE(NEW.raw_user_meta_data->>'requested_role', '') = 'agent' THEN
    v_requested_role := 'agent'::public.app_role;
  ELSIF COALESCE(NEW.raw_user_meta_data->>'requested_role', '') = 'driver' THEN
    v_requested_role := 'driver'::public.app_role;
  END IF;

  INSERT INTO public.profiles (user_id, full_name, email, phone, address, city, country)
  VALUES (
    NEW.id, 
    v_full_name, 
    NEW.email, 
    NULLIF(v_phone, 'Pending'),
    NEW.raw_user_meta_data->>'address',
    NEW.raw_user_meta_data->>'city',
    NEW.raw_user_meta_data->>'country'
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    phone = COALESCE(profiles.phone, EXCLUDED.phone),
    address = COALESCE(profiles.address, EXCLUDED.address),
    city = COALESCE(profiles.city, EXCLUDED.city),
    country = COALESCE(profiles.country, EXCLUDED.country);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_requested_role)
  ON CONFLICT DO NOTHING;

  IF v_requested_role = 'customer'::public.app_role THEN
    INSERT INTO public.customers (
      user_id, 
      code, 
      full_name, 
      email, 
      phone, 
      address, 
      city, 
      country, 
      customer_type,
      company_name,
      company_registration_number,
      company_email,
      company_phone,
      company_address,
      is_active
    )
    SELECT 
      NEW.id, 
      v_customer_code, 
      v_full_name, 
      NEW.email, 
      v_phone,
      NEW.raw_user_meta_data->>'address',
      NEW.raw_user_meta_data->>'city',
      NEW.raw_user_meta_data->>'country',
      v_customer_type,
      NEW.raw_user_meta_data->>'company_name',
      NEW.raw_user_meta_data->>'company_registration_number',
      NEW.raw_user_meta_data->>'company_email',
      NEW.raw_user_meta_data->>'company_phone',
      NEW.raw_user_meta_data->>'company_address',
      true
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
