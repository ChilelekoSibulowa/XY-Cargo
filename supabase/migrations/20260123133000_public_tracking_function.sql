-- Public tracking lookup with limited fields

CREATE OR REPLACE FUNCTION public.track_shipment_by_code(p_code text)
RETURNS TABLE (
  code text,
  status shipment_status,
  origin text,
  destination text,
  created_at timestamptz,
  pickup_date timestamptz,
  estimated_delivery_date timestamptz,
  actual_delivery_date timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.code,
    s.status,
    COALESCE(ob.city, ob.name) AS origin,
    COALESCE(db.city, db.name) AS destination,
    s.created_at,
    s.pickup_date,
    s.estimated_delivery_date,
    s.actual_delivery_date
  FROM public.shipments s
  LEFT JOIN public.branches ob ON ob.id = s.branch_id
  LEFT JOIN public.branches db ON db.id = s.destination_branch_id
  WHERE s.code ILIKE trim(p_code)
  ORDER BY s.created_at DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.track_shipment_by_code(text) TO anon;
GRANT EXECUTE ON FUNCTION public.track_shipment_by_code(text) TO authenticated;
