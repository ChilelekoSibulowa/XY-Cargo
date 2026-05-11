BEGIN;

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

UPDATE public.shipments s
SET status = 'requested_pickup'
WHERE s.status = 'received'
  AND COALESCE(s.notes, '') ~* 'Handling method:\s*single'
  AND NOT EXISTS (
    SELECT 1
    FROM public.consolidation_shipments cs
    WHERE cs.shipment_id = s.id
  );

UPDATE public.shipments s
SET status = 'received'
WHERE s.status IN ('requested_pickup', 'approved')
  AND COALESCE(s.notes, '') ~* 'Handling method:\s*consolidated'
  AND NOT EXISTS (
    SELECT 1
    FROM public.consolidation_shipments cs
    WHERE cs.shipment_id = s.id
  );

COMMIT;
