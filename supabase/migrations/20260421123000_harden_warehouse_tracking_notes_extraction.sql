-- Harden warehouse tracking extraction so lookup works with newline-delimited notes.

CREATE OR REPLACE FUNCTION public.shipment_warehouse_tracking_from_notes(_notes text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(BTRIM((regexp_match(COALESCE(_notes, ''), '(?im)Warehouse\s*Tracking\s*Number\s*(?:No\.?|#)?\s*(?:[:=-]|\s)\s*([^|\r\n;]+)'))[1]), ''),
    NULLIF(BTRIM((regexp_match(COALESCE(_notes, ''), '(?im)Warehouse\s*Tracking\s*(?:No\.?|#)?\s*(?:[:=-]|\s)\s*([^|\r\n;]+)'))[1]), ''),
    NULLIF(BTRIM((regexp_match(COALESCE(_notes, ''), '(?im)Consolidation\s*Tracking\s*Number\s*(?:No\.?|#)?\s*(?:[:=-]|\s)\s*([^|\r\n;]+)'))[1]), ''),
    NULLIF(BTRIM((regexp_match(COALESCE(_notes, ''), '(?im)Consolidation\s*Tracking\s*(?:No\.?|#)?\s*(?:[:=-]|\s)\s*([^|\r\n;]+)'))[1]), ''),
    NULLIF(BTRIM((regexp_match(COALESCE(_notes, ''), '(?im)Tracking\s*Number\s*(?:No\.?|#)?\s*(?:[:=-]|\s)\s*([^|\r\n;]+)'))[1]), ''),
    NULLIF(BTRIM((regexp_match(COALESCE(_notes, ''), '(?im)Tracking\s*No\.?\s*(?:[:=-]|\s)\s*([^|\r\n;]+)'))[1]), '')
  );
$$;

CREATE OR REPLACE FUNCTION public.shipment_airway_bill_from_notes(_notes text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(BTRIM((regexp_match(COALESCE(_notes, ''), '(?im)AWB\s*/\s*BL\s*No\.?\s*(?:[:=-]|\s)\s*([^|\r\n;]+)'))[1]), ''),
    NULLIF(BTRIM((regexp_match(COALESCE(_notes, ''), '(?im)Airway\s*Bill\s*(?:No\.?|#)?\s*(?:[:=-]|\s)\s*([^|\r\n;]+)'))[1]), ''),
    NULLIF(BTRIM((regexp_match(COALESCE(_notes, ''), '(?im)Bill\s*of\s*Lading\s*(?:No\.?|#)?\s*(?:[:=-]|\s)\s*([^|\r\n;]+)'))[1]), '')
  );
$$;

CREATE OR REPLACE FUNCTION public.tracking_lookup_matches(_candidate text, _lookup text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  WITH normalized AS (
    SELECT
      NULLIF(BTRIM(COALESCE(_lookup, '')), '') AS lookup_raw,
      NULLIF(BTRIM(COALESCE(_candidate, '')), '') AS candidate_raw,
      public.normalize_tracking_lookup_text(_lookup) AS lookup_norm,
      public.normalize_tracking_lookup_text(_candidate) AS candidate_norm
  )
  SELECT lookup_raw IS NOT NULL
    AND (
      lower(COALESCE(candidate_raw, '')) = lower(lookup_raw)
      OR (
        candidate_norm IS NOT NULL
        AND lookup_norm IS NOT NULL
        AND (
          candidate_norm = lookup_norm
          OR (char_length(lookup_norm) >= 6 AND position(lookup_norm in candidate_norm) > 0)
          OR (char_length(candidate_norm) >= 6 AND position(candidate_norm in lookup_norm) > 0)
        )
      )
    )
  FROM normalized;
$$;

GRANT EXECUTE ON FUNCTION public.shipment_warehouse_tracking_from_notes(text) TO anon;
GRANT EXECUTE ON FUNCTION public.shipment_warehouse_tracking_from_notes(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shipment_airway_bill_from_notes(text) TO anon;
GRANT EXECUTE ON FUNCTION public.shipment_airway_bill_from_notes(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tracking_lookup_matches(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.tracking_lookup_matches(text, text) TO authenticated;
