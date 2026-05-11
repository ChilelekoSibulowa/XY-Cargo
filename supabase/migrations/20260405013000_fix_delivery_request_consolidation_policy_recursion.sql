BEGIN;

CREATE OR REPLACE FUNCTION public.driver_has_assigned_consolidation(_consolidation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.drivers d
    JOIN public.shipments s ON s.delivery_request_assigned_driver_id = d.id
    JOIN public.consolidation_shipments cs ON cs.shipment_id = s.id
    WHERE d.user_id = auth.uid()
      AND cs.consolidation_id = _consolidation_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.driver_has_assigned_consolidation(uuid) TO authenticated;

DROP POLICY IF EXISTS "Drivers can view assigned consolidations" ON public.consolidations;

CREATE POLICY "Drivers can view assigned consolidations"
  ON public.consolidations
  FOR SELECT
  TO authenticated
  USING (public.driver_has_assigned_consolidation(public.consolidations.id));

DROP POLICY IF EXISTS "Drivers can update assigned consolidations" ON public.consolidations;

CREATE POLICY "Drivers can update assigned consolidations"
  ON public.consolidations
  FOR UPDATE
  TO authenticated
  USING (public.driver_has_assigned_consolidation(public.consolidations.id))
  WITH CHECK (public.driver_has_assigned_consolidation(public.consolidations.id));

COMMIT;
