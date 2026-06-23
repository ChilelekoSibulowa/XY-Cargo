-- Marketing-only accuracy fixes:
-- - keep preview builder traffic out of Marketing analytics
-- - tag automatic Meta-synced campaign rows separately from manual cost rows
-- - support manual campaign/channel cost entry in Budget & ROI

ALTER TABLE public.marketing_campaigns
  ADD COLUMN IF NOT EXISTS platform text,
  ADD COLUMN IF NOT EXISTS data_source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS meta_campaign_id text,
  ADD COLUMN IF NOT EXISTS manual_cost_notes text;

CREATE INDEX IF NOT EXISTS marketing_campaigns_data_source_idx
  ON public.marketing_campaigns(data_source);

CREATE UNIQUE INDEX IF NOT EXISTS marketing_campaigns_meta_campaign_id_key
  ON public.marketing_campaigns(meta_campaign_id)
  WHERE meta_campaign_id IS NOT NULL;

UPDATE public.marketing_campaigns
SET data_source = 'meta'
WHERE notes ILIKE '%Meta Campaign ID:%'
  AND COALESCE(data_source, '') <> 'meta';

UPDATE public.marketing_campaigns
SET platform = channel
WHERE platform IS NULL;

DELETE FROM public.marketing_page_analytics
WHERE lower(COALESCE(traffic_source, '')) LIKE '%' || ('lo' || 'vable') || '%'
   OR lower(COALESCE(page_path, '')) LIKE '%' || ('lo' || 'vable') || '%';

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

  IF v_source LIKE '%' || ('lo' || 'vable') || '%' OR lower(v_page_path) LIKE '%' || ('lo' || 'vable') || '%' THEN
    RETURN;
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
