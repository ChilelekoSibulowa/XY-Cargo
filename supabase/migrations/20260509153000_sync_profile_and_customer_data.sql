CREATE OR REPLACE FUNCTION public.sync_profile_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Synchronize to customers table if a record exists
  UPDATE public.customers
  SET
    full_name = COALESCE(NEW.full_name, full_name),
    email = COALESCE(NEW.email, email),
    phone = COALESCE(NEW.phone, phone, 'Pending'),
    address = COALESCE(NEW.address, address),
    city = COALESCE(NEW.city, city),
    country = COALESCE(NEW.country, country)
  WHERE user_id = NEW.user_id;

  -- Synchronize to drivers table if a record exists
  UPDATE public.drivers
  SET
    full_name = COALESCE(NEW.full_name, full_name),
    email = COALESCE(NEW.email, email),
    phone = COALESCE(NEW.phone, phone, 'Pending')
  WHERE user_id = NEW.user_id;

  -- If it's a new profile, we might want to create the customer/driver record
  -- but handle_new_user usually takes care of this for auth-based signups.
  -- This part ensures manual profile creations also sync.
  IF TG_OP = 'INSERT' THEN
    -- Check if they have a customer role and no customer record
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.user_id AND role = 'customer') AND 
       NOT EXISTS (SELECT 1 FROM public.customers WHERE user_id = NEW.user_id) THEN
      INSERT INTO public.customers (user_id, code, full_name, email, phone, address, city, country)
      VALUES (
        NEW.user_id, 
        'CUST-' || upper(substr(replace(NEW.user_id::text, '-', ''), 1, 6)),
        COALESCE(NEW.full_name, 'Unknown'),
        NEW.email,
        COALESCE(NEW.phone, 'Pending'),
        NEW.address,
        NEW.city,
        NEW.country
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create the trigger on the profiles table for both INSERT and UPDATE
DROP TRIGGER IF EXISTS on_profile_change_sync ON public.profiles;
CREATE TRIGGER on_profile_change_sync
AFTER INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_changes();

-- Clean up the old trigger name if it exists
DROP TRIGGER IF EXISTS on_profile_update ON public.profiles;

-- Also ensure that if customers or drivers are updated directly (e.g. by admin), 
-- the changes flow back to profiles for consistency.
CREATE OR REPLACE FUNCTION public.sync_customer_to_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    UPDATE public.profiles
    SET
      full_name = NEW.full_name,
      email = NEW.email,
      phone = NEW.phone,
      address = NEW.address,
      city = NEW.city,
      country = NEW.country
    WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_customer_update_sync ON public.customers;
CREATE TRIGGER on_customer_update_sync
AFTER UPDATE ON public.customers
FOR EACH ROW
WHEN (pg_trigger_depth() = 0)
EXECUTE FUNCTION public.sync_customer_to_profile();

-- Retroactively create missing customer records for existing profiles that have the 'customer' role
INSERT INTO public.customers (
  user_id, code, full_name, email, phone, address, city, country, is_active
)
SELECT 
  p.user_id,
  'CUST-' || upper(substr(replace(p.user_id::text, '-', ''), 1, 6)),
  COALESCE(p.full_name, 'Unknown'),
  p.email,
  COALESCE(p.phone, 'Pending'),
  p.address,
  p.city,
  p.country,
  true
FROM public.profiles p
JOIN public.user_roles ur ON p.user_id = ur.user_id
WHERE ur.role = 'customer'
  AND NOT EXISTS (
    SELECT 1 FROM public.customers c WHERE c.user_id = p.user_id
  );

-- Retroactively create missing driver records for existing profiles that have the 'driver' role
INSERT INTO public.drivers (
  user_id, code, full_name, email, phone, is_active
)
SELECT 
  p.user_id,
  'DRV-' || upper(substr(replace(p.user_id::text, '-', ''), 1, 6)),
  COALESCE(p.full_name, 'Unknown'),
  p.email,
  COALESCE(p.phone, 'Pending'),
  true
FROM public.profiles p
JOIN public.user_roles ur ON p.user_id = ur.user_id
WHERE ur.role = 'driver'
  AND NOT EXISTS (
    SELECT 1 FROM public.drivers d WHERE d.user_id = p.user_id
  );

-- Ensure all existing customers have a user_id if an email match is found in profiles
UPDATE public.customers c
SET user_id = p.user_id
FROM public.profiles p
WHERE c.email = p.email AND c.user_id IS NULL;

-- Final cleanup: Ensure no customer has a NULL phone which would break triggers
UPDATE public.customers SET phone = 'Pending' WHERE phone IS NULL;
UPDATE public.drivers SET phone = 'Pending' WHERE phone IS NULL;
