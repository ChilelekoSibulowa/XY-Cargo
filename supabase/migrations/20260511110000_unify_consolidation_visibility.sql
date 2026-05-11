-- Migration to add consolidation_id to shipments for unified display
-- This makes filtering consolidated items much faster and more reliable than parsing notes.

ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS consolidation_id UUID REFERENCES public.consolidations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS shipments_consolidation_id_idx ON public.shipments(consolidation_id);

-- Backfill consolidation_id from the link table
UPDATE public.shipments s
SET consolidation_id = cs.consolidation_id
FROM public.consolidation_shipments cs
WHERE s.id = cs.shipment_id
AND s.consolidation_id IS NULL;

-- Backfill from notes if links are missing but note exists
UPDATE public.shipments s
SET consolidation_id = c.id
FROM public.consolidations c
WHERE s.consolidation_id IS NULL
  AND s.notes ~* ('Consolidation:\s*' || c.code)
  AND s.customer_id = c.customer_id;

-- Update replace_consolidation_shipments to maintain the new column
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
  v_consolidation_code text;
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

  SELECT c.customer_id, c.code
  INTO v_customer_id, v_consolidation_code
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

  -- Remove old links and reset consolidation_id
  UPDATE public.shipments SET consolidation_id = NULL WHERE consolidation_id = p_consolidation_id;
  DELETE FROM public.consolidation_shipments WHERE consolidation_id = p_consolidation_id;

  -- Create new links and update consolidation_id
  INSERT INTO public.consolidation_shipments (consolidation_id, shipment_id)
  SELECT p_consolidation_id, shipment_id
  FROM unnest(v_clean_shipment_ids) AS shipment_id
  ON CONFLICT (consolidation_id, shipment_id) DO NOTHING;

  UPDATE public.shipments AS s
  SET
    consolidation_id = p_consolidation_id,
    status = 'requested_pickup'::public.shipment_status,
    notes = CASE
      WHEN v_consolidation_code IS NULL OR btrim(v_consolidation_code) = '' THEN s.notes
      ELSE (
        SELECT string_agg(cleaned.part, ' | ' ORDER BY cleaned.ord)
        FROM (
          SELECT existing.ord, existing.part
          FROM (
            SELECT raw.ord, btrim(raw.part) AS part
            FROM unnest(string_to_array(COALESCE(s.notes, ''), '|')) WITH ORDINALITY AS raw(part, ord)
          ) AS existing
          WHERE existing.part <> ''
            AND lower(btrim(split_part(existing.part, ':', 1))) <> 'consolidation'

          UNION ALL

          SELECT
            COALESCE((
              SELECT max(raw2.ord)
              FROM unnest(string_to_array(COALESCE(s.notes, ''), '|')) WITH ORDINALITY AS raw2(part, ord)
            ), 0) + 1,
            'Consolidation: ' || v_consolidation_code
        ) AS cleaned
      )
    END
  WHERE s.id = ANY(v_clean_shipment_ids)
    AND s.status = 'received';

  PERFORM public.recalculate_consolidation_totals(p_consolidation_id);
END;
$$;

-- Update remove_submitted_shipment to clear consolidation_id
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
    AND (
      c.user_id = v_user_id
      OR c.agent_id = v_user_id
    )
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Submitted shipment not found or access denied.';
  END IF;

  PERFORM set_config('app.allow_submitted_removal', 'on', true);

  -- Recalculate totals for the parent consolidation if it was part of one
  SELECT s.consolidation_id INTO v_consolidation_id FROM public.shipments s WHERE s.id = p_shipment_id;
  
  -- Remove from link table and clear the column
  DELETE FROM public.consolidation_shipments WHERE shipment_id = p_shipment_id;
  UPDATE public.shipments SET consolidation_id = NULL WHERE id = p_shipment_id;

  UPDATE public.shipments s
  SET
    status = 'received'::public.shipment_status,
    notes = (
      SELECT NULLIF(string_agg(cleaned.part, ' | ' ORDER BY cleaned.ord), '')
      FROM (
        SELECT note_parts.ord, note_parts.part
        FROM (
          SELECT raw.ord, btrim(raw.part) AS part
          FROM unnest(string_to_array(COALESCE(s.notes, ''), '|')) WITH ORDINALITY AS raw(part, ord)
        ) AS note_parts
        WHERE note_parts.part <> ''
          AND lower(btrim(split_part(note_parts.part, ':', 1))) <> 'consolidation'
      ) AS cleaned
    )
  WHERE s.id = p_shipment_id
    AND s.customer_id = v_customer_id
    AND s.status = 'requested_pickup';

  IF v_consolidation_id IS NOT NULL THEN
    PERFORM public.recalculate_consolidation_totals(v_consolidation_id);
  END IF;
END;
$$;
