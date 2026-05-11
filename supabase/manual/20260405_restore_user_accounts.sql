BEGIN;

-- Restore portal account rows from preserved identities.
-- This script rebuilds customer and driver records from:
-- - auth.users
-- - public.profiles
-- - public.user_roles
--
-- Notes:
-- - agent/admin/staff accounts are role-based and do not need separate table rows
-- - branch assignments, agent assignments, vehicle details, and company metadata
--   cannot be recovered automatically if they were deleted

WITH auth_profile_source AS (
  SELECT
    au.id AS user_id,
    COALESCE(
      NULLIF(BTRIM(p.full_name), ''),
      NULLIF(BTRIM(au.raw_user_meta_data->>'full_name'), ''),
      au.email,
      'User'
    ) AS full_name,
    COALESCE(
      NULLIF(BTRIM(p.email), ''),
      au.email
    ) AS email,
    COALESCE(
      NULLIF(BTRIM(p.phone), ''),
      NULLIF(BTRIM(au.raw_user_meta_data->>'phone'), ''),
      'Pending'
    ) AS phone
  FROM auth.users au
  LEFT JOIN public.profiles p
    ON p.user_id = au.id
),
customer_candidates AS (
  SELECT
    aps.user_id,
    'CUST-' || upper(substr(replace(aps.user_id::text, '-', ''), 1, 6)) AS code,
    aps.full_name,
    aps.email,
    aps.phone
  FROM auth_profile_source aps
  JOIN public.user_roles ur
    ON ur.user_id = aps.user_id
   AND ur.role = 'customer'::public.app_role
)
INSERT INTO public.customers (
  user_id,
  code,
  full_name,
  email,
  phone,
  wallet_balance,
  is_active,
  mfa_enabled
)
SELECT
  cc.user_id,
  cc.code,
  cc.full_name,
  cc.email,
  cc.phone,
  0,
  true,
  false
FROM customer_candidates cc
WHERE NOT EXISTS (
  SELECT 1
  FROM public.customers c
  WHERE c.user_id = cc.user_id
);

WITH auth_profile_source AS (
  SELECT
    au.id AS user_id,
    COALESCE(
      NULLIF(BTRIM(p.full_name), ''),
      NULLIF(BTRIM(au.raw_user_meta_data->>'full_name'), ''),
      au.email,
      'User'
    ) AS full_name,
    COALESCE(
      NULLIF(BTRIM(p.email), ''),
      au.email
    ) AS email,
    COALESCE(
      NULLIF(BTRIM(p.phone), ''),
      NULLIF(BTRIM(au.raw_user_meta_data->>'phone'), ''),
      'Pending'
    ) AS phone
  FROM auth.users au
  LEFT JOIN public.profiles p
    ON p.user_id = au.id
),
driver_candidates AS (
  SELECT
    aps.user_id,
    'DRV-' || upper(substr(replace(aps.user_id::text, '-', ''), 1, 6)) AS code,
    aps.full_name,
    aps.email,
    aps.phone
  FROM auth_profile_source aps
  JOIN public.user_roles ur
    ON ur.user_id = aps.user_id
   AND ur.role = 'driver'::public.app_role
)
INSERT INTO public.drivers (
  user_id,
  code,
  full_name,
  email,
  phone,
  wallet_balance,
  is_active
)
SELECT
  dc.user_id,
  dc.code,
  dc.full_name,
  dc.email,
  dc.phone,
  0,
  true
FROM driver_candidates dc
WHERE NOT EXISTS (
  SELECT 1
  FROM public.drivers d
  WHERE d.user_id = dc.user_id
);

COMMIT;

SELECT 'profiles' AS table_name, COUNT(*) AS total_rows FROM public.profiles
UNION ALL
SELECT 'user_roles', COUNT(*) FROM public.user_roles
UNION ALL
SELECT 'customers', COUNT(*) FROM public.customers
UNION ALL
SELECT 'drivers', COUNT(*) FROM public.drivers;
