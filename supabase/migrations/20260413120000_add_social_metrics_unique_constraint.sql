-- Add unique constraint on marketing_social_metrics(platform, recorded_at)
-- so the edge function upsert with onConflict works correctly and avoids duplicate rows.
CREATE UNIQUE INDEX IF NOT EXISTS marketing_social_metrics_platform_recorded_at_key
  ON marketing_social_metrics (platform, recorded_at);
