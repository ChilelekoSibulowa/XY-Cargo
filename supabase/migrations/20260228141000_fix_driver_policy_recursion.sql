-- Fix driver-facing RLS recursion by moving shipment lookups into SECURITY DEFINER helpers.

CREATE OR REPLACE FUNCTION public.driver_has_assigned_customer(_customer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.drivers d
    JOIN public.shipments s ON s.assigned_driver_id = d.id
    WHERE d.user_id = auth.uid()
      AND s.customer_id = _customer_id
  );
$$;

CREATE OR REPLACE FUNCTION public.driver_has_assigned_receiver(_receiver_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.drivers d
    JOIN public.shipments s ON s.assigned_driver_id = d.id
    WHERE d.user_id = auth.uid()
      AND s.receiver_id = _receiver_id
  );
$$;

CREATE OR REPLACE FUNCTION public.driver_has_assigned_shipment(_shipment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.drivers d
    JOIN public.shipments s ON s.assigned_driver_id = d.id
    WHERE d.user_id = auth.uid()
      AND s.id = _shipment_id
  );
$$;

DROP POLICY IF EXISTS "Drivers can view customers for assigned shipments" ON public.customers;

CREATE POLICY "Drivers can view customers for assigned shipments"
  ON public.customers
  FOR SELECT
  TO authenticated
  USING (public.driver_has_assigned_customer(public.customers.id));

DROP POLICY IF EXISTS "Drivers can view receivers for assigned shipments" ON public.receivers;

CREATE POLICY "Drivers can view receivers for assigned shipments"
  ON public.receivers
  FOR SELECT
  TO authenticated
  USING (public.driver_has_assigned_receiver(public.receivers.id));

DROP POLICY IF EXISTS "Drivers can create support tickets" ON public.support_tickets;

CREATE POLICY "Drivers can create support tickets"
  ON public.support_tickets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      shipment_id IS NULL
      OR public.driver_has_assigned_shipment(public.support_tickets.shipment_id)
    )
  );

GRANT EXECUTE ON FUNCTION public.driver_has_assigned_customer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_has_assigned_receiver(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_has_assigned_shipment(uuid) TO authenticated;
