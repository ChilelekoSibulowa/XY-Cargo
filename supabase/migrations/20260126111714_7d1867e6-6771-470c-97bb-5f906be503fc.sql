-- Create track_shipment_by_code function for public tracking
DROP FUNCTION IF EXISTS public.track_shipment_by_code(text);

CREATE OR REPLACE FUNCTION public.track_shipment_by_code(p_code text)
RETURNS TABLE (
  code text,
  status text,
  origin text,
  destination text,
  created_at timestamptz,
  pickup_date timestamptz,
  estimated_delivery_date timestamptz,
  actual_delivery_date timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.code,
    s.status::text,
    ob.name as origin,
    db.name as destination,
    s.created_at,
    s.pickup_date,
    s.estimated_delivery_date,
    s.actual_delivery_date
  FROM shipments s
  LEFT JOIN branches ob ON ob.id = s.branch_id
  LEFT JOIN branches db ON db.id = s.destination_branch_id
  WHERE s.code = p_code;
END;
$$;

-- Fix RLS: Allow customers to insert their own customer record during registration
CREATE POLICY "Users can insert their own customer record"
ON public.customers
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Fix RLS: Allow customers to update their own record
CREATE POLICY "Customers can update their own data"
ON public.customers
FOR UPDATE
USING (user_id = auth.uid());

-- Fix RLS: Allow customers to create shipments for themselves
CREATE POLICY "Customers can create their own shipments"
ON public.shipments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM customers c
    WHERE c.id = shipments.customer_id
    AND c.user_id = auth.uid()
  )
);

-- Fix RLS: Allow customers to update their own shipments
CREATE POLICY "Customers can update their own shipments"
ON public.shipments
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM customers c
    WHERE c.id = shipments.customer_id
    AND c.user_id = auth.uid()
  )
);

-- Allow customers to create their own receivers
CREATE POLICY "Customers can create their own receivers"
ON public.receivers
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM customers c
    WHERE c.id = receivers.customer_id
    AND c.user_id = auth.uid()
  )
);

-- Allow customers to update their own receivers
CREATE POLICY "Customers can update their own receivers"
ON public.receivers
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM customers c
    WHERE c.id = receivers.customer_id
    AND c.user_id = auth.uid()
  )
);
