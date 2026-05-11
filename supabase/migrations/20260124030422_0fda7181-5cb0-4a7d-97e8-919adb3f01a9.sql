-- Create shipment_team table for team assignments
CREATE TABLE public.shipment_team (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    role_label TEXT NOT NULL,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.shipment_team ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admin/Staff can manage shipment_team" 
ON public.shipment_team 
FOR ALL 
USING (is_admin_or_staff(auth.uid()));

CREATE POLICY "Users can view their own team assignments" 
ON public.shipment_team 
FOR SELECT 
USING (user_id = auth.uid());

-- Create storage bucket for system assets (logos, etc.)
INSERT INTO storage.buckets (id, name, public)
VALUES ('system-assets', 'system-assets', true);

-- Create policy for public access to system assets
CREATE POLICY "System assets are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'system-assets');

-- Create policy for admin to upload system assets
CREATE POLICY "Admins can upload system assets" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'system-assets' AND has_role(auth.uid(), 'admin'));

-- Create policy for admin to update system assets
CREATE POLICY "Admins can update system assets" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'system-assets' AND has_role(auth.uid(), 'admin'));

-- Create policy for admin to delete system assets
CREATE POLICY "Admins can delete system assets" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'system-assets' AND has_role(auth.uid(), 'admin'));