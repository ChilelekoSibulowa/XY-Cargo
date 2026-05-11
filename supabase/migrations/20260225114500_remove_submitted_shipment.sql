-- Allow customers to remove a single submitted parcel safely.
-- This removes only the selected submitted item and keeps consolidation totals in sync.

CREATE OR REPLACE FUNCTION public.remove_submitted_shipment(p_shipment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_customer_id uuid;
  v_consolidation_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT s.customer_id
  INTO v_customer_id
  FROM public.shipments s
  JOIN public.customers c ON c.id = s.customer_id
  WHERE s.id = p_shipment_id
    AND s.status = 'requested_pickup'
    AND c.user_id = v_user_id
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Submitted shipment not found or access denied.';
  END IF;

  FOR v_consolidation_id IN
    SELECT DISTINCT cs.consolidation_id
    FROM public.consolidation_shipments cs
    WHERE cs.shipment_id = p_shipment_id
  LOOP
    DELETE FROM public.consolidation_shipments
    WHERE consolidation_id = v_consolidation_id
      AND shipment_id = p_shipment_id;

    IF NOT EXISTS (
      SELECT 1
      FROM public.consolidation_shipments remaining
      WHERE remaining.consolidation_id = v_consolidation_id
    ) THEN
      DELETE FROM public.consolidations
      WHERE id = v_consolidation_id;
    ELSE
      UPDATE public.consolidations con
      SET
        item_count = calc.item_count,
        total_weight = calc.total_weight,
        total_cbm = calc.total_cbm,
        total_cost = calc.total_cost
      FROM (
        SELECT
          cs.consolidation_id,
          COUNT(*)::integer AS item_count,
          COALESCE(SUM(COALESCE(s.weight, 0)), 0) AS total_weight,
          COALESCE(SUM(COALESCE(s.cbm, 0)), 0) AS total_cbm,
          COALESCE(SUM(COALESCE(s.total_cost, 0)), 0) AS total_cost
        FROM public.consolidation_shipments cs
        JOIN public.shipments s ON s.id = cs.shipment_id
        WHERE cs.consolidation_id = v_consolidation_id
        GROUP BY cs.consolidation_id
      ) calc
      WHERE con.id = calc.consolidation_id;
    END IF;
  END LOOP;

  DELETE FROM public.shipments s
  WHERE s.id = p_shipment_id
    AND s.customer_id = v_customer_id
    AND s.status = 'requested_pickup';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submitted shipment could not be removed.';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_submitted_shipment(uuid) TO authenticated;