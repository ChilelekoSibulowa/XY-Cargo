BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'consolidations'
      AND policyname = 'Drivers can view assigned consolidations'
  ) THEN
    CREATE POLICY "Drivers can view assigned consolidations"
      ON public.consolidations
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.consolidation_shipments cs
          JOIN public.shipments s ON s.id = cs.shipment_id
          JOIN public.drivers d ON d.id = s.assigned_driver_id
          WHERE cs.consolidation_id = consolidations.id
            AND d.user_id = auth.uid()
        )
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'consolidations'
      AND policyname = 'Drivers can update assigned consolidations'
  ) THEN
    CREATE POLICY "Drivers can update assigned consolidations"
      ON public.consolidations
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.consolidation_shipments cs
          JOIN public.shipments s ON s.id = cs.shipment_id
          JOIN public.drivers d ON d.id = s.assigned_driver_id
          WHERE cs.consolidation_id = consolidations.id
            AND d.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.consolidation_shipments cs
          JOIN public.shipments s ON s.id = cs.shipment_id
          JOIN public.drivers d ON d.id = s.assigned_driver_id
          WHERE cs.consolidation_id = consolidations.id
            AND d.user_id = auth.uid()
        )
      );
  END IF;
END
$$;

COMMIT;
