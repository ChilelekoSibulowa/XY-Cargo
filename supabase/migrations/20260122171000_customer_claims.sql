-- Customer claims table for insurance/refund requests
CREATE TABLE IF NOT EXISTS public.customer_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) NOT NULL,
  shipment_code TEXT,
  description TEXT NOT NULL,
  status TEXT DEFAULT 'submitted',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.customer_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can view their claims"
  ON public.customer_claims
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = customer_id
        AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Customers can create claims"
  ON public.customer_claims
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = customer_id
        AND c.user_id = auth.uid()
    )
  );
