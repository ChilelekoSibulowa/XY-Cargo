BEGIN;

-- Normalize existing duplicates so we can enforce one row per day/path/source.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY view_date, page_path, traffic_source
      ORDER BY updated_at DESC, created_at DESC, id DESC
    ) AS rn
  FROM public.marketing_page_analytics
)
DELETE FROM public.marketing_page_analytics m
USING ranked r
WHERE m.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS marketing_page_analytics_daily_unique_idx
  ON public.marketing_page_analytics (view_date, page_path, traffic_source);

CREATE OR REPLACE FUNCTION public.record_marketing_page_view(
  p_page_path text,
  p_traffic_source text DEFAULT 'direct',
  p_is_landing_page boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_page_path text;
  v_source text;
BEGIN
  v_page_path := btrim(COALESCE(p_page_path, ''));
  IF v_page_path = '' THEN
    RETURN;
  END IF;

  v_source := lower(btrim(COALESCE(p_traffic_source, '')));
  IF v_source = '' THEN
    v_source := 'direct';
  END IF;

  INSERT INTO public.marketing_page_analytics (
    page_path,
    view_date,
    views,
    traffic_source,
    is_landing_page
  )
  VALUES (
    v_page_path,
    CURRENT_DATE,
    1,
    v_source,
    COALESCE(p_is_landing_page, false)
  )
  ON CONFLICT (view_date, page_path, traffic_source)
  DO UPDATE
  SET
    views = public.marketing_page_analytics.views + 1,
    is_landing_page = public.marketing_page_analytics.is_landing_page OR EXCLUDED.is_landing_page,
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.record_marketing_page_view(text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_marketing_page_view(text, text, boolean) TO anon;
GRANT EXECUTE ON FUNCTION public.record_marketing_page_view(text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_marketing_page_view(text, text, boolean) TO service_role;

COMMIT;
