BEGIN;

WITH parent_request_context AS (
  SELECT
    cs.shipment_id,
    c.delivery_request_status,
    c.delivery_request_requested_at,
    c.delivery_request_requested_by_role,
    c.delivery_request_requested_by_user_id,
    c.delivery_request_assigned_driver_id,
    c.delivery_request_assigned_at,
    c.delivery_request_completed_at
  FROM public.consolidation_shipments cs
  JOIN public.consolidations c ON c.id = cs.consolidation_id
  WHERE c.delivery_request_status IS NOT NULL
)
UPDATE public.shipments s
SET
  delivery_request_status = COALESCE(s.delivery_request_status, pr.delivery_request_status),
  delivery_request_requested_at = COALESCE(s.delivery_request_requested_at, pr.delivery_request_requested_at),
  delivery_request_requested_by_role = COALESCE(s.delivery_request_requested_by_role, pr.delivery_request_requested_by_role),
  delivery_request_requested_by_user_id = COALESCE(s.delivery_request_requested_by_user_id, pr.delivery_request_requested_by_user_id),
  delivery_request_assigned_driver_id = COALESCE(s.delivery_request_assigned_driver_id, pr.delivery_request_assigned_driver_id),
  delivery_request_assigned_at = COALESCE(s.delivery_request_assigned_at, pr.delivery_request_assigned_at),
  delivery_request_completed_at = COALESCE(s.delivery_request_completed_at, pr.delivery_request_completed_at)
FROM parent_request_context pr
WHERE s.id = pr.shipment_id
  AND (
    s.delivery_request_status IS NULL
    OR s.delivery_request_requested_at IS NULL
    OR (pr.delivery_request_requested_by_role IS NOT NULL AND s.delivery_request_requested_by_role IS NULL)
    OR (pr.delivery_request_requested_by_user_id IS NOT NULL AND s.delivery_request_requested_by_user_id IS NULL)
    OR (pr.delivery_request_assigned_driver_id IS NOT NULL AND s.delivery_request_assigned_driver_id IS NULL)
    OR (pr.delivery_request_assigned_at IS NOT NULL AND s.delivery_request_assigned_at IS NULL)
    OR (pr.delivery_request_completed_at IS NOT NULL AND s.delivery_request_completed_at IS NULL)
  );

COMMIT;
