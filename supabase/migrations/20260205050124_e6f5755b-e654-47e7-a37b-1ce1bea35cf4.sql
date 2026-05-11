-- Create consolidations table for grouping multiple shipments
CREATE TABLE public.consolidations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create consolidation_shipments junction table
CREATE TABLE public.consolidation_shipments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  consolidation_id UUID NOT NULL REFERENCES public.consolidations(id) ON DELETE CASCADE,
  shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(consolidation_id, shipment_id)
);

-- Create inspection_uploads table for shipment condition documentation
CREATE TABLE public.inspection_uploads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  notes TEXT,
  inspection_type TEXT NOT NULL DEFAULT 'condition',
  uploaded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.consolidations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consolidation_shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_uploads ENABLE ROW LEVEL SECURITY;

-- RLS policies for consolidations
CREATE POLICY "Admin/Staff can manage consolidations"
ON public.consolidations FOR ALL
USING (is_admin_or_staff(auth.uid()));

CREATE POLICY "Customers can view their consolidations"
ON public.consolidations FOR SELECT
USING (EXISTS (
  SELECT 1 FROM customers c
  WHERE c.id = consolidations.customer_id AND c.user_id = auth.uid()
));

-- RLS policies for consolidation_shipments
CREATE POLICY "Admin/Staff can manage consolidation_shipments"
ON public.consolidation_shipments FOR ALL
USING (is_admin_or_staff(auth.uid()));

-- RLS policies for inspection_uploads
CREATE POLICY "Admin/Staff can manage inspection_uploads"
ON public.inspection_uploads FOR ALL
USING (is_admin_or_staff(auth.uid()));

CREATE POLICY "Customers can view their shipment inspections"
ON public.inspection_uploads FOR SELECT
USING (EXISTS (
  SELECT 1 FROM shipments s
  JOIN customers c ON c.id = s.customer_id
  WHERE s.id = inspection_uploads.shipment_id AND c.user_id = auth.uid()
));

-- Triggers for updated_at
CREATE TRIGGER update_consolidations_updated_at
BEFORE UPDATE ON public.consolidations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();