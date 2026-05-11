-- Create cms_pages table for content management
CREATE TABLE public.cms_pages (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cms_pages ENABLE ROW LEVEL SECURITY;

-- Admin can manage CMS pages
CREATE POLICY "Admin can manage cms_pages" 
ON public.cms_pages 
FOR ALL 
USING (has_role(auth.uid(), 'admin'));

-- Anyone can view CMS pages (public site content)
CREATE POLICY "Anyone can view cms_pages" 
ON public.cms_pages 
FOR SELECT 
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_cms_pages_updated_at
BEFORE UPDATE ON public.cms_pages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();