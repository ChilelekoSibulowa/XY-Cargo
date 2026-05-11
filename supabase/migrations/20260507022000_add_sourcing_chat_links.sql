-- Add sourcing and supplier payment request links to support tickets
ALTER TABLE public.support_tickets 
ADD COLUMN sourcing_request_id UUID REFERENCES public.sourcing_requests(id) ON DELETE CASCADE,
ADD COLUMN supplier_payment_request_id UUID REFERENCES public.supplier_payment_requests(id) ON DELETE CASCADE;

-- Update RLS policies for support_tickets to allow access via sourcing or supplier payment requests
-- (Admins and staff already have full access)

-- Customers can view/create tickets for their own sourcing requests
CREATE POLICY "Customers can manage tickets for their sourcing requests"
ON public.support_tickets
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.sourcing_requests sr
    JOIN public.customers c ON c.id = sr.customer_id
    WHERE sr.id = support_tickets.sourcing_request_id
      AND c.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.sourcing_requests sr
    JOIN public.customers c ON c.id = sr.customer_id
    WHERE sr.id = support_tickets.sourcing_request_id
      AND c.user_id = auth.uid()
  )
);

-- Customers can manage tickets for their supplier payment requests
CREATE POLICY "Customers can manage tickets for their supplier payment requests"
ON public.support_tickets
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.supplier_payment_requests spr
    JOIN public.customers c ON c.id = spr.customer_id
    WHERE spr.id = support_tickets.supplier_payment_request_id
      AND c.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.supplier_payment_requests spr
    JOIN public.customers c ON c.id = spr.customer_id
    WHERE spr.id = support_tickets.supplier_payment_request_id
      AND c.user_id = auth.uid()
  )
);

-- Agents can manage tickets for their customers' sourcing requests
CREATE POLICY "Agents can manage tickets for their customers' sourcing requests"
ON public.support_tickets
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.sourcing_requests sr
    JOIN public.customers c ON c.id = sr.customer_id
    WHERE sr.id = support_tickets.sourcing_request_id
      AND c.agent_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.sourcing_requests sr
    JOIN public.customers c ON c.id = sr.customer_id
    WHERE sr.id = support_tickets.sourcing_request_id
      AND c.agent_id = auth.uid()
  )
);

-- Agents can manage tickets for their customers' supplier payment requests
CREATE POLICY "Agents can manage tickets for their customers' supplier payment requests"
ON public.support_tickets
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.supplier_payment_requests spr
    JOIN public.customers c ON c.id = spr.customer_id
    WHERE spr.id = support_tickets.supplier_payment_request_id
      AND c.agent_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.supplier_payment_requests spr
    JOIN public.customers c ON c.id = spr.customer_id
    WHERE spr.id = support_tickets.supplier_payment_request_id
      AND c.agent_id = auth.uid()
  )
);
