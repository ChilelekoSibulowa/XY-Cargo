-- Consolidation summary fields needed by warehouse edit flow and customer tracking.

ALTER TABLE public.consolidations
ADD COLUMN IF NOT EXISTS total_cbm DECIMAL(12,4),
ADD COLUMN IF NOT EXISTS tracking_code TEXT;

WITH consolidation_totals AS (
  SELECT
    cs.consolidation_id,
    COALESCE(SUM(COALESCE(s.cbm, 0)), 0)::DECIMAL(12,4) AS total_cbm
  FROM public.consolidation_shipments cs
  JOIN public.shipments s ON s.id = cs.shipment_id
  GROUP BY cs.consolidation_id
)
UPDATE public.consolidations c
SET total_cbm = COALESCE(c.total_cbm, t.total_cbm)
FROM consolidation_totals t
WHERE c.id = t.consolidation_id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'consolidations_total_cbm_nonnegative'
  ) THEN
    ALTER TABLE public.consolidations
      ADD CONSTRAINT consolidations_total_cbm_nonnegative
      CHECK (total_cbm IS NULL OR total_cbm >= 0);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS consolidations_tracking_code_idx
  ON public.consolidations(tracking_code);
