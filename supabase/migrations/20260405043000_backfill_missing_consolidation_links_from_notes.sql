BEGIN;

WITH shipment_consolidation_codes AS (
  SELECT
    s.id AS shipment_id,
    trim((regexp_match(s.notes, 'Consolidation:\s*([^|]+)', 'i'))[1]) AS consolidation_code
  FROM public.shipments s
  WHERE s.notes ~* 'Consolidation:\s*([^|]+)'
),
matched_links AS (
  SELECT
    scc.shipment_id,
    c.id AS consolidation_id
  FROM shipment_consolidation_codes scc
  JOIN public.consolidations c
    ON lower(c.code) = lower(scc.consolidation_code)
)
INSERT INTO public.consolidation_shipments (consolidation_id, shipment_id)
SELECT ml.consolidation_id, ml.shipment_id
FROM matched_links ml
LEFT JOIN public.consolidation_shipments cs
  ON cs.consolidation_id = ml.consolidation_id
 AND cs.shipment_id = ml.shipment_id
WHERE cs.id IS NULL;

UPDATE public.shipments s
SET notes = CASE
  WHEN c.code IS NULL OR btrim(c.code) = '' THEN s.notes
  WHEN s.notes IS NULL OR btrim(s.notes) = '' THEN 'Consolidation: ' || c.code
  WHEN s.notes ~* '(^|\\|)\\s*Consolidation\\s*:' THEN regexp_replace(
    s.notes,
    '(^|\\|)\\s*Consolidation\\s*:\\s*[^|]+',
    E'\\1 Consolidation: ' || c.code,
    'i'
  )
  ELSE s.notes || ' | Consolidation: ' || c.code
END
FROM public.consolidation_shipments cs
JOIN public.consolidations c
  ON c.id = cs.consolidation_id
WHERE s.id = cs.shipment_id;

WITH consolidation_targets AS (
  SELECT
    cs.shipment_id,
    CASE public.normalize_consolidation_status_value(c.status)
      WHEN 'submitted' THEN 'requested_pickup'::public.shipment_status
      WHEN 'confirmed' THEN 'approved'::public.shipment_status
      WHEN 'outgoing' THEN 'assigned'::public.shipment_status
      WHEN 'in_transit' THEN 'supplied'::public.shipment_status
      WHEN 'arrived' THEN 'delivered'::public.shipment_status
      WHEN 'collected' THEN 'closed'::public.shipment_status
      ELSE NULL
    END AS target_status
  FROM public.consolidation_shipments cs
  JOIN public.consolidations c ON c.id = cs.consolidation_id
)
UPDATE public.shipments s
SET status = ct.target_status
FROM consolidation_targets ct
WHERE s.id = ct.shipment_id
  AND ct.target_status IS NOT NULL
  AND s.status IS DISTINCT FROM ct.target_status;

COMMIT;
