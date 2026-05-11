CREATE OR REPLACE FUNCTION public.normalize_consolidation_status_value(_status text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _status IS NULL THEN 'submitted'
    WHEN lower(trim(_status)) IN ('pending', 'requested', 'submitted') THEN 'submitted'
    WHEN lower(trim(_status)) IN ('processed', 'completed', 'confirmed', 'confirm_shipment') THEN 'confirmed'
    WHEN lower(trim(_status)) IN ('assigned', 'outgoing') THEN 'outgoing'
    WHEN lower(trim(_status)) IN ('in_transit', 'intransit', 'supplied') THEN 'in_transit'
    WHEN lower(trim(_status)) IN ('arrived', 'delivered') THEN 'arrived'
    WHEN lower(trim(_status)) IN ('collected', 'closed') THEN 'collected'
    ELSE lower(trim(_status))
  END;
$$;

CREATE OR REPLACE FUNCTION public.shipment_airway_bill_from_notes(_notes text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(BTRIM((regexp_match(COALESCE(_notes, ''), '(?i)AWB/BL No\.\s*:\s*([^|]+)'))[1]), ''),
    NULLIF(BTRIM((regexp_match(COALESCE(_notes, ''), '(?i)Airway Bill\s*:\s*([^|]+)'))[1]), ''),
    NULLIF(BTRIM((regexp_match(COALESCE(_notes, ''), '(?i)Bill of Lading\s*:\s*([^|]+)'))[1]), '')
  );
$$;

CREATE OR REPLACE FUNCTION public.shipment_cbm_from_notes(_notes text)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  WITH extracted AS (
    SELECT NULLIF(BTRIM(SUBSTRING(COALESCE(_notes, '') FROM '(?i)CBM:\s*([^|]+)')), '') AS value
  )
  SELECT CASE WHEN value ~ '^-?[0-9]+(\.[0-9]+)?$' THEN value::numeric ELSE NULL END
  FROM extracted;
$$;

CREATE OR REPLACE FUNCTION public.shipsgo_transport_from_service_type(_service_type text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN lower(BTRIM(COALESCE(_service_type, ''))) IN ('air', 'air freight', 'air_freight') THEN 'air'
    WHEN lower(BTRIM(COALESCE(_service_type, ''))) IN ('sea', 'sea freight', 'sea_freight', 'ocean', 'ocean freight', 'ocean_freight') THEN 'ocean'
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.support_department_portal_id(_department text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE lower(COALESCE(NULLIF(BTRIM(_department), ''), 'support'))
    WHEN 'support'    THEN 'support'
    WHEN 'finance'    THEN 'finance'
    WHEN 'warehouse'  THEN 'warehouse'
    WHEN 'operations' THEN 'warehouse'
    WHEN 'compliance' THEN 'compliance'
    ELSE NULL
  END;
$$;