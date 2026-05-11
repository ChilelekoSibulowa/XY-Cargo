-- Allow drivers to update their assigned shipments and missions

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'shipments'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'shipments'
        AND policyname = 'Drivers can update assigned shipments'
    ) THEN
      CREATE POLICY "Drivers can update assigned shipments"
        ON public.shipments
        FOR UPDATE
        USING (
          EXISTS (
            SELECT 1
            FROM public.drivers d
            WHERE d.id = assigned_driver_id
              AND d.user_id = auth.uid()
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1
            FROM public.drivers d
            WHERE d.id = assigned_driver_id
              AND d.user_id = auth.uid()
          )
        );
    END IF;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'missions'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'missions'
        AND policyname = 'Drivers can update their missions'
    ) THEN
      CREATE POLICY "Drivers can update their missions"
        ON public.missions
        FOR UPDATE
        USING (
          EXISTS (
            SELECT 1
            FROM public.drivers d
            WHERE d.id = driver_id
              AND d.user_id = auth.uid()
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1
            FROM public.drivers d
            WHERE d.id = driver_id
              AND d.user_id = auth.uid()
          )
        );
    END IF;
  END IF;
END
$$;
