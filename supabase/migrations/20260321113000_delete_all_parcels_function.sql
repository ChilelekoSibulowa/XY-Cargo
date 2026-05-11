-- Bulk-delete all parcel records and linked shipment data across all portals.

CREATE OR REPLACE FUNCTION public.delete_all_parcel_records()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_shipment_id uuid;
  v_deleted_count integer := 0;
  v_shipment_ids uuid[] := ARRAY[]::uuid[];
  v_consolidation_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF v_user_id IS NOT NULL
     AND NOT public.can_manage_warehouse_workflow(v_user_id) THEN
    RAISE EXCEPTION 'Only admin and warehouse users can delete all parcels.';
  END IF;

  SELECT COALESCE(array_agg(s.id), ARRAY[]::uuid[])
  INTO v_shipment_ids
  FROM public.shipments s;

  SELECT COALESCE(array_agg(c.id), ARRAY[]::uuid[])
  INTO v_consolidation_ids
  FROM public.consolidations c;

  FOREACH v_shipment_id IN ARRAY v_shipment_ids
  LOOP
    IF public.delete_shipment_record_internal(v_shipment_id) THEN
      v_deleted_count := v_deleted_count + 1;
    END IF;
  END LOOP;

  IF COALESCE(array_length(v_shipment_ids, 1), 0) > 0 THEN
    DELETE FROM public.notifications
    WHERE reference_id = ANY(v_shipment_ids);
  END IF;

  IF COALESCE(array_length(v_consolidation_ids, 1), 0) > 0 THEN
    DELETE FROM public.notifications
    WHERE reference_id = ANY(v_consolidation_ids);
  END IF;

  DELETE FROM public.consolidations c
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.consolidation_shipments cs
    WHERE cs.consolidation_id = c.id
  );

  RETURN v_deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_all_parcel_records() TO authenticated;
