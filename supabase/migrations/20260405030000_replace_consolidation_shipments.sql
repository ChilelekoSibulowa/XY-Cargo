BEGIN;

CREATE OR REPLACE FUNCTION public.replace_consolidation_shipments(
  p_consolidation_id uuid,
  p_shipment_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_customer_id uuid;
  v_can_manage boolean := false;
  v_existing_consolidation_ids uuid[] := ARRAY[]::uuid[];
  v_existing_consolidation_id uuid;
  v_clean_shipment_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF p_consolidation_id IS NULL THEN
    RAISE EXCEPTION 'Consolidation id is required.';
  END IF;

  SELECT ARRAY(
    SELECT DISTINCT shipment_id
    FROM unnest(COALESCE(p_shipment_ids, ARRAY[]::uuid[])) AS shipment_id
    WHERE shipment_id IS NOT NULL
  )
  INTO v_clean_shipment_ids;

  IF COALESCE(array_length(v_clean_shipment_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'At least one shipment is required.';
  END IF;

  SELECT c.customer_id
  INTO v_customer_id
  FROM public.consolidations c
  WHERE c.id = p_consolidation_id
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Consolidation not found.';
  END IF;

  SELECT
    public.is_admin_or_staff(v_user_id)
    OR public.can_manage_warehouse_workflow(v_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.customers cust
      WHERE cust.id = v_customer_id
        AND cust.user_id = v_user_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.customers cust
      WHERE cust.id = v_customer_id
        AND cust.agent_id = v_user_id
    )
  INTO v_can_manage;

  IF NOT v_can_manage THEN
    RAISE EXCEPTION 'You do not have permission to update this consolidation.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(v_clean_shipment_ids) AS shipment_id
    LEFT JOIN public.shipments s ON s.id = shipment_id
    WHERE s.id IS NULL
  ) THEN
    RAISE EXCEPTION 'One or more shipments do not exist.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.shipments s
    WHERE s.id = ANY(v_clean_shipment_ids)
      AND s.customer_id IS DISTINCT FROM v_customer_id
  ) THEN
    RAISE EXCEPTION 'All shipments must belong to the consolidation customer.';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT cs.consolidation_id), ARRAY[]::uuid[])
  INTO v_existing_consolidation_ids
  FROM public.consolidation_shipments cs
  WHERE cs.shipment_id = ANY(v_clean_shipment_ids)
    AND cs.consolidation_id <> p_consolidation_id;

  DELETE FROM public.consolidation_shipments
  WHERE shipment_id = ANY(v_clean_shipment_ids)
    AND consolidation_id <> p_consolidation_id;

  INSERT INTO public.consolidation_shipments (consolidation_id, shipment_id)
  SELECT p_consolidation_id, shipment_id
  FROM unnest(v_clean_shipment_ids) AS shipment_id
  ON CONFLICT (consolidation_id, shipment_id) DO NOTHING;

  PERFORM public.recalculate_consolidation_totals(p_consolidation_id);

  IF to_regprocedure('public.sync_consolidation_delivery_request_state(uuid)') IS NOT NULL THEN
    PERFORM public.sync_consolidation_delivery_request_state(p_consolidation_id);
  END IF;

  FOREACH v_existing_consolidation_id IN ARRAY v_existing_consolidation_ids LOOP
    PERFORM public.recalculate_consolidation_totals(v_existing_consolidation_id);

    IF to_regprocedure('public.sync_consolidation_delivery_request_state(uuid)') IS NOT NULL THEN
      PERFORM public.sync_consolidation_delivery_request_state(v_existing_consolidation_id);
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.replace_consolidation_shipments(uuid, uuid[]) TO authenticated;

COMMIT;
