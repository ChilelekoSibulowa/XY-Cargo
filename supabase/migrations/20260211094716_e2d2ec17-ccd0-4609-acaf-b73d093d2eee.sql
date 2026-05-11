
-- Create support tickets table
CREATE TABLE public.support_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_code TEXT NOT NULL,
  customer_id UUID REFERENCES public.customers(id),
  shipment_id UUID REFERENCES public.shipments(id),
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  assigned_to UUID,
  resolution_notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/Staff can manage support_tickets"
  ON public.support_tickets FOR ALL
  USING (is_admin_or_staff(auth.uid()));

CREATE POLICY "Customers can view their own tickets"
  ON public.support_tickets FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM customers c
    WHERE c.id = support_tickets.customer_id AND c.user_id = auth.uid()
  ));

CREATE POLICY "Customers can create their own tickets"
  ON public.support_tickets FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM customers c
    WHERE c.id = support_tickets.customer_id AND c.user_id = auth.uid()
  ));

CREATE TRIGGER update_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
