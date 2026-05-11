ALTER TABLE public.marketing_page_analytics
ADD COLUMN IF NOT EXISTS session_duration INTEGER NOT NULL DEFAULT 0;
