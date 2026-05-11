-- Marketing portal data tables

CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  channel TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  budget DECIMAL(12,2) NOT NULL DEFAULT 0,
  spend DECIMAL(12,2) NOT NULL DEFAULT 0,
  leads INTEGER NOT NULL DEFAULT 0,
  revenue_attributed DECIMAL(12,2) NOT NULL DEFAULT 0,
  start_date DATE,
  end_date DATE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marketing_campaigns_status_idx
  ON public.marketing_campaigns(status);
CREATE INDEX IF NOT EXISTS marketing_campaigns_channel_idx
  ON public.marketing_campaigns(channel);

ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'marketing_campaigns'
      AND policyname = 'Admin/Staff can manage marketing campaigns'
  ) THEN
    CREATE POLICY "Admin/Staff can manage marketing campaigns"
      ON public.marketing_campaigns
      FOR ALL
      USING (public.is_admin_or_staff(auth.uid()))
      WITH CHECK (public.is_admin_or_staff(auth.uid()));
  END IF;
END
$$;

DROP TRIGGER IF EXISTS update_marketing_campaigns_updated_at ON public.marketing_campaigns;
CREATE TRIGGER update_marketing_campaigns_updated_at
  BEFORE UPDATE ON public.marketing_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.marketing_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  source TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  assigned_to UUID REFERENCES auth.users(id),
  follow_up_status TEXT NOT NULL DEFAULT 'pending',
  deal_value DECIMAL(12,2) NOT NULL DEFAULT 0,
  sales_feedback TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marketing_leads_status_idx
  ON public.marketing_leads(status);
CREATE INDEX IF NOT EXISTS marketing_leads_source_idx
  ON public.marketing_leads(source);

ALTER TABLE public.marketing_leads ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'marketing_leads'
      AND policyname = 'Admin/Staff can manage marketing leads'
  ) THEN
    CREATE POLICY "Admin/Staff can manage marketing leads"
      ON public.marketing_leads
      FOR ALL
      USING (public.is_admin_or_staff(auth.uid()))
      WITH CHECK (public.is_admin_or_staff(auth.uid()));
  END IF;
END
$$;

DROP TRIGGER IF EXISTS update_marketing_leads_updated_at ON public.marketing_leads;
CREATE TRIGGER update_marketing_leads_updated_at
  BEFORE UPDATE ON public.marketing_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.marketing_page_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_path TEXT NOT NULL,
  view_date DATE NOT NULL DEFAULT CURRENT_DATE,
  views INTEGER NOT NULL DEFAULT 0,
  bounce_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  traffic_source TEXT NOT NULL DEFAULT 'Direct',
  seo_rank INTEGER,
  is_landing_page BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marketing_page_analytics_date_idx
  ON public.marketing_page_analytics(view_date);
CREATE INDEX IF NOT EXISTS marketing_page_analytics_page_idx
  ON public.marketing_page_analytics(page_path);

ALTER TABLE public.marketing_page_analytics ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'marketing_page_analytics'
      AND policyname = 'Admin/Staff can manage marketing analytics'
  ) THEN
    CREATE POLICY "Admin/Staff can manage marketing analytics"
      ON public.marketing_page_analytics
      FOR ALL
      USING (public.is_admin_or_staff(auth.uid()))
      WITH CHECK (public.is_admin_or_staff(auth.uid()));
  END IF;
END
$$;

DROP TRIGGER IF EXISTS update_marketing_page_analytics_updated_at ON public.marketing_page_analytics;
CREATE TRIGGER update_marketing_page_analytics_updated_at
  BEFORE UPDATE ON public.marketing_page_analytics
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.marketing_promotions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  promotion_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  budget DECIMAL(12,2) NOT NULL DEFAULT 0,
  revenue_attributed DECIMAL(12,2) NOT NULL DEFAULT 0,
  start_date DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marketing_promotions_type_idx
  ON public.marketing_promotions(promotion_type);

ALTER TABLE public.marketing_promotions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'marketing_promotions'
      AND policyname = 'Admin/Staff can manage marketing promotions'
  ) THEN
    CREATE POLICY "Admin/Staff can manage marketing promotions"
      ON public.marketing_promotions
      FOR ALL
      USING (public.is_admin_or_staff(auth.uid()))
      WITH CHECK (public.is_admin_or_staff(auth.uid()));
  END IF;
END
$$;

DROP TRIGGER IF EXISTS update_marketing_promotions_updated_at ON public.marketing_promotions;
CREATE TRIGGER update_marketing_promotions_updated_at
  BEFORE UPDATE ON public.marketing_promotions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.marketing_promotions (name, promotion_type, status)
VALUES
  ('China Sourcing Campaigns', 'sourcing', 'active'),
  ('Air Freight Campaigns', 'air', 'active'),
  ('Sea Freight Campaigns', 'sea', 'active'),
  ('Door-to-Door Campaigns', 'door_to_door', 'active'),
  ('Seasonal Promotions', 'seasonal', 'active')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.marketing_social_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  platform TEXT NOT NULL,
  content TEXT NOT NULL,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'draft',
  engagement_count INTEGER NOT NULL DEFAULT 0,
  inquiry_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_social_posts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'marketing_social_posts'
      AND policyname = 'Admin/Staff can manage social posts'
  ) THEN
    CREATE POLICY "Admin/Staff can manage social posts"
      ON public.marketing_social_posts
      FOR ALL
      USING (public.is_admin_or_staff(auth.uid()))
      WITH CHECK (public.is_admin_or_staff(auth.uid()));
  END IF;
END
$$;

DROP TRIGGER IF EXISTS update_marketing_social_posts_updated_at ON public.marketing_social_posts;
CREATE TRIGGER update_marketing_social_posts_updated_at
  BEFORE UPDATE ON public.marketing_social_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.marketing_influencer_collaborations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  platform TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_influencer_collaborations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'marketing_influencer_collaborations'
      AND policyname = 'Admin/Staff can manage influencers'
  ) THEN
    CREATE POLICY "Admin/Staff can manage influencers"
      ON public.marketing_influencer_collaborations
      FOR ALL
      USING (public.is_admin_or_staff(auth.uid()))
      WITH CHECK (public.is_admin_or_staff(auth.uid()));
  END IF;
END
$$;

DROP TRIGGER IF EXISTS update_marketing_influencer_collaborations_updated_at ON public.marketing_influencer_collaborations;
CREATE TRIGGER update_marketing_influencer_collaborations_updated_at
  BEFORE UPDATE ON public.marketing_influencer_collaborations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.marketing_social_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  platform TEXT NOT NULL,
  followers INTEGER NOT NULL DEFAULT 0,
  engagement_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  growth_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  recorded_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_social_metrics ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'marketing_social_metrics'
      AND policyname = 'Admin/Staff can manage social metrics'
  ) THEN
    CREATE POLICY "Admin/Staff can manage social metrics"
      ON public.marketing_social_metrics
      FOR ALL
      USING (public.is_admin_or_staff(auth.uid()))
      WITH CHECK (public.is_admin_or_staff(auth.uid()));
  END IF;
END
$$;

DROP TRIGGER IF EXISTS update_marketing_social_metrics_updated_at ON public.marketing_social_metrics;
CREATE TRIGGER update_marketing_social_metrics_updated_at
  BEFORE UPDATE ON public.marketing_social_metrics
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.marketing_email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  open_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  click_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_email_templates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'marketing_email_templates'
      AND policyname = 'Admin/Staff can manage email templates'
  ) THEN
    CREATE POLICY "Admin/Staff can manage email templates"
      ON public.marketing_email_templates
      FOR ALL
      USING (public.is_admin_or_staff(auth.uid()))
      WITH CHECK (public.is_admin_or_staff(auth.uid()));
  END IF;
END
$$;

DROP TRIGGER IF EXISTS update_marketing_email_templates_updated_at ON public.marketing_email_templates;
CREATE TRIGGER update_marketing_email_templates_updated_at
  BEFORE UPDATE ON public.marketing_email_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.marketing_email_sequences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  step_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_email_sequences ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'marketing_email_sequences'
      AND policyname = 'Admin/Staff can manage email sequences'
  ) THEN
    CREATE POLICY "Admin/Staff can manage email sequences"
      ON public.marketing_email_sequences
      FOR ALL
      USING (public.is_admin_or_staff(auth.uid()))
      WITH CHECK (public.is_admin_or_staff(auth.uid()));
  END IF;
END
$$;

DROP TRIGGER IF EXISTS update_marketing_email_sequences_updated_at ON public.marketing_email_sequences;
CREATE TRIGGER update_marketing_email_sequences_updated_at
  BEFORE UPDATE ON public.marketing_email_sequences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.marketing_newsletter_subscribers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'subscribed',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_newsletter_subscribers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'marketing_newsletter_subscribers'
      AND policyname = 'Admin/Staff can manage subscribers'
  ) THEN
    CREATE POLICY "Admin/Staff can manage subscribers"
      ON public.marketing_newsletter_subscribers
      FOR ALL
      USING (public.is_admin_or_staff(auth.uid()))
      WITH CHECK (public.is_admin_or_staff(auth.uid()));
  END IF;
END
$$;

DROP TRIGGER IF EXISTS update_marketing_newsletter_subscribers_updated_at ON public.marketing_newsletter_subscribers;
CREATE TRIGGER update_marketing_newsletter_subscribers_updated_at
  BEFORE UPDATE ON public.marketing_newsletter_subscribers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
