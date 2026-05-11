-- CMS pages table for public site content
CREATE TABLE IF NOT EXISTS public.cms_pages (
  slug TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.cms_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view cms pages" ON public.cms_pages
  FOR SELECT USING (true);

CREATE POLICY "Admin can manage cms pages" ON public.cms_pages
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_cms_pages_updated_at
  BEFORE UPDATE ON public.cms_pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
