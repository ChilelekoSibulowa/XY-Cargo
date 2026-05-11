BEGIN;

ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS collected_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS collected_by TEXT;

ALTER TABLE public.consolidations
  ADD COLUMN IF NOT EXISTS collected_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS collected_by TEXT;

WITH shipment_backfill AS (
  SELECT
    s.id,
    NULLIF(BTRIM((regexp_match(COALESCE(s.notes, ''), '(?i)Collected by\s*:\s*([^|]+)'))[1]), '') AS note_collected_by,
    NULLIF(BTRIM((regexp_match(COALESCE(s.notes, ''), '(?i)Collected at\s*:\s*([^|]+)'))[1]), '') AS note_collected_at,
    NULLIF(BTRIM(CONCAT_WS(' - ', r.full_name, r.phone)), '') AS receiver_collected_by
  FROM public.shipments s
  LEFT JOIN public.receivers r ON r.id = s.receiver_id
)
UPDATE public.shipments s
SET
  collected_by = COALESCE(
    s.collected_by,
    shipment_backfill.note_collected_by,
    shipment_backfill.receiver_collected_by
  ),
  collected_at = COALESCE(
    s.collected_at,
    CASE
      WHEN shipment_backfill.note_collected_at ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN shipment_backfill.note_collected_at::timestamptz
      ELSE NULL
    END,
    CASE WHEN s.status = 'closed' THEN s.updated_at ELSE NULL END
  )
FROM shipment_backfill
WHERE s.id = shipment_backfill.id
  AND (
    s.collected_by IS NULL
    OR s.collected_at IS NULL
  );

WITH consolidation_backfill AS (
  SELECT
    c.id,
    NULLIF(BTRIM((regexp_match(COALESCE(c.notes, ''), '(?i)Collected by\s*:\s*([^|]+)'))[1]), '') AS note_collected_by,
    NULLIF(BTRIM((regexp_match(COALESCE(c.notes, ''), '(?i)Collected at\s*:\s*([^|]+)'))[1]), '') AS note_collected_at,
    CASE
      WHEN COUNT(DISTINCT child_values.child_collected_by) FILTER (WHERE child_values.child_collected_by IS NOT NULL) = 1
        THEN MIN(child_values.child_collected_by) FILTER (WHERE child_values.child_collected_by IS NOT NULL)
      WHEN COUNT(DISTINCT child_values.child_collected_by) FILTER (WHERE child_values.child_collected_by IS NOT NULL) > 1
        THEN 'Multiple Receivers'
      ELSE NULL
    END AS child_collected_by,
    MAX(s.collected_at) AS child_collected_at
  FROM public.consolidations c
  LEFT JOIN public.consolidation_shipments cs ON cs.consolidation_id = c.id
  LEFT JOIN public.shipments s ON s.id = cs.shipment_id
  LEFT JOIN public.receivers r ON r.id = s.receiver_id
  LEFT JOIN LATERAL (
    SELECT COALESCE(
      NULLIF(BTRIM(s.collected_by), ''),
      NULLIF(BTRIM((regexp_match(COALESCE(s.notes, ''), '(?i)Collected by\s*:\s*([^|]+)'))[1]), ''),
      NULLIF(BTRIM(CONCAT_WS(' - ', r.full_name, r.phone)), '')
    ) AS child_collected_by
  ) AS child_values ON TRUE
  GROUP BY c.id
)
UPDATE public.consolidations c
SET
  collected_by = COALESCE(
    c.collected_by,
    consolidation_backfill.note_collected_by,
    consolidation_backfill.child_collected_by
  ),
  collected_at = COALESCE(
    c.collected_at,
    CASE
      WHEN consolidation_backfill.note_collected_at ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN consolidation_backfill.note_collected_at::timestamptz
      ELSE NULL
    END,
    consolidation_backfill.child_collected_at,
    CASE
      WHEN public.normalize_consolidation_status_value(c.status) = 'collected' THEN c.updated_at
      ELSE NULL
    END
  )
FROM consolidation_backfill
WHERE c.id = consolidation_backfill.id
  AND (
    c.collected_by IS NULL
    OR c.collected_at IS NULL
  );

COMMIT;
