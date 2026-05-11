BEGIN;

-- Backfill analytics rows that were stored as generic sources so dashboards can show exact platforms.
UPDATE public.marketing_page_analytics
SET traffic_source = lower(
  split_part(
    split_part(page_path, 'utm_source=', 2),
    '&',
    1
  )
)
WHERE (
    traffic_source IS NULL
    OR btrim(traffic_source) = ''
    OR lower(btrim(traffic_source)) IN ('referral', 'direct', 'unknown')
  )
  AND position('utm_source=' in lower(page_path)) > 0;

UPDATE public.marketing_page_analytics
SET traffic_source = 'facebook.com'
WHERE lower(btrim(COALESCE(traffic_source, ''))) = 'referral'
  AND (
    lower(page_path) LIKE '%fbclid=%'
    OR lower(page_path) LIKE '%utm_source=facebook%'
    OR lower(page_path) LIKE '%utm_source=fb%'
  );

UPDATE public.marketing_page_analytics
SET traffic_source = 'linkedin.com'
WHERE lower(btrim(COALESCE(traffic_source, ''))) = 'referral'
  AND (
    lower(page_path) LIKE '%li_fat_id=%'
    OR lower(page_path) LIKE '%utm_source=linkedin%'
  );

UPDATE public.marketing_page_analytics
SET traffic_source = 'google.com'
WHERE lower(btrim(COALESCE(traffic_source, ''))) = 'referral'
  AND (
    lower(page_path) LIKE '%gclid=%'
    OR lower(page_path) LIKE '%utm_source=google%'
  );

UPDATE public.marketing_page_analytics
SET traffic_source = 'bing.com'
WHERE lower(btrim(COALESCE(traffic_source, ''))) = 'referral'
  AND (
    lower(page_path) LIKE '%msclkid=%'
    OR lower(page_path) LIKE '%utm_source=bing%'
  );

COMMIT;
