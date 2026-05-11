BEGIN;

CREATE OR REPLACE FUNCTION public.enforce_single_current_consolidation_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.consolidation_shipments
  WHERE shipment_id = NEW.shipment_id
    AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND consolidation_id <> NEW.consolidation_id;

  RETURN NEW;
END;
$$;

WITH ranked_links AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY shipment_id
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM public.consolidation_shipments
)
DELETE FROM public.consolidation_shipments cs
USING ranked_links rl
WHERE cs.id = rl.id
  AND rl.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS consolidation_shipments_one_current_link_per_shipment_idx
  ON public.consolidation_shipments (shipment_id);

DROP TRIGGER IF EXISTS consolidation_shipments_enforce_single_link ON public.consolidation_shipments;

CREATE TRIGGER consolidation_shipments_enforce_single_link
BEFORE INSERT OR UPDATE OF shipment_id, consolidation_id
ON public.consolidation_shipments
FOR EACH ROW
EXECUTE FUNCTION public.enforce_single_current_consolidation_link();

COMMIT;
