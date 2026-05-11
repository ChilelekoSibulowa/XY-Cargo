BEGIN;

CREATE OR REPLACE FUNCTION public.sync_consolidation_delivery_request_state(_consolidation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requested_at timestamptz;
  v_requested_by_role text;
  v_requested_by_user_id uuid;
  v_assigned_driver_id uuid;
  v_assigned_at timestamptz;
  v_completed_at timestamptz;
  v_request_status text;
BEGIN
  SELECT
    MIN(s.delivery_request_requested_at) FILTER (WHERE s.delivery_request_requested_at IS NOT NULL),
    MIN(s.delivery_request_requested_by_role) FILTER (WHERE s.delivery_request_requested_by_role IS NOT NULL),
    (
      array_agg(
        s.delivery_request_requested_by_user_id
        ORDER BY s.delivery_request_requested_at NULLS LAST, s.created_at NULLS LAST, s.id
      ) FILTER (WHERE s.delivery_request_requested_by_user_id IS NOT NULL)
    )[1],
    (
      array_agg(
        s.delivery_request_assigned_driver_id
        ORDER BY s.delivery_request_assigned_at DESC NULLS LAST, s.updated_at DESC NULLS LAST, s.id DESC
      ) FILTER (WHERE s.delivery_request_assigned_driver_id IS NOT NULL)
    )[1],
    MIN(s.delivery_request_assigned_at) FILTER (WHERE s.delivery_request_assigned_at IS NOT NULL),
    MAX(s.delivery_request_completed_at) FILTER (WHERE s.delivery_request_completed_at IS NOT NULL),
    CASE
      WHEN BOOL_OR(s.delivery_request_status = 'assigned') THEN 'assigned'
      WHEN BOOL_OR(s.delivery_request_status = 'requested') THEN 'requested'
      WHEN BOOL_OR(s.delivery_request_status = 'failed') THEN 'failed'
      WHEN BOOL_OR(s.delivery_request_status = 'successful') THEN 'successful'
      ELSE NULL
    END
  INTO
    v_requested_at,
    v_requested_by_role,
    v_requested_by_user_id,
    v_assigned_driver_id,
    v_assigned_at,
    v_completed_at,
    v_request_status
  FROM public.consolidation_shipments cs
  JOIN public.shipments s ON s.id = cs.shipment_id
  WHERE cs.consolidation_id = _consolidation_id
    AND s.delivery_request_status IS NOT NULL;

  UPDATE public.consolidations
  SET
    delivery_request_requested_at = v_requested_at,
    delivery_request_requested_by_role = v_requested_by_role,
    delivery_request_requested_by_user_id = v_requested_by_user_id,
    delivery_request_status = v_request_status,
    delivery_request_assigned_driver_id = v_assigned_driver_id,
    delivery_request_assigned_at = v_assigned_at,
    delivery_request_completed_at = v_completed_at
  WHERE id = _consolidation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_delivery_request_consolidations_from_shipment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shipment_id uuid := COALESCE(NEW.id, OLD.id);
  v_consolidation_id uuid;
BEGIN
  FOR v_consolidation_id IN
    SELECT DISTINCT cs.consolidation_id
    FROM public.consolidation_shipments cs
    WHERE cs.shipment_id = v_shipment_id
  LOOP
    PERFORM public.sync_consolidation_delivery_request_state(v_consolidation_id);
  END LOOP;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS shipments_delivery_request_sync_consolidations ON public.shipments;

CREATE TRIGGER shipments_delivery_request_sync_consolidations
AFTER INSERT OR UPDATE OF
  delivery_request_status,
  delivery_request_requested_at,
  delivery_request_requested_by_role,
  delivery_request_requested_by_user_id,
  delivery_request_assigned_driver_id,
  delivery_request_assigned_at,
  delivery_request_completed_at
ON public.shipments
FOR EACH ROW
EXECUTE FUNCTION public.sync_delivery_request_consolidations_from_shipment();

CREATE OR REPLACE FUNCTION public.sync_delivery_request_consolidations_from_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_consolidation_delivery_request_state(
    COALESCE(NEW.consolidation_id, OLD.consolidation_id)
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS consolidation_shipments_delivery_request_sync ON public.consolidation_shipments;

CREATE TRIGGER consolidation_shipments_delivery_request_sync
AFTER INSERT OR UPDATE OR DELETE
ON public.consolidation_shipments
FOR EACH ROW
EXECUTE FUNCTION public.sync_delivery_request_consolidations_from_link();

DO $$
DECLARE
  v_consolidation record;
BEGIN
  FOR v_consolidation IN
    SELECT id
    FROM public.consolidations
  LOOP
    PERFORM public.sync_consolidation_delivery_request_state(v_consolidation.id);
  END LOOP;
END
$$;

COMMIT;
