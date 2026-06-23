-- Ensure warehouse users can load active driver options for delivery assignment.
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'drivers'
      AND policyname = 'Warehouse users can view active drivers'
  ) THEN
    CREATE POLICY "Warehouse users can view active drivers"
    ON public.drivers
    FOR SELECT
    TO authenticated
    USING (
      COALESCE(is_active, true) = true
      AND public.can_manage_warehouse_workflow(auth.uid())
    );
  END IF;
END
$$;

GRANT SELECT ON TABLE public.drivers TO authenticated;

-- Ensure Compliance Portal users can load queue and charge dropdown/table data.
ALTER TABLE public.manual_customs_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_charges ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'manual_customs_records'
      AND policyname = 'Compliance portal users can view manual customs records'
  ) THEN
    CREATE POLICY "Compliance portal users can view manual customs records"
    ON public.manual_customs_records
    FOR SELECT
    TO authenticated
    USING (
      public.is_admin_or_staff(auth.uid())
      OR public.has_portal_access(auth.uid(), 'compliance')
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
      AND tablename = 'manual_customs_records'
      AND policyname = 'Compliance portal users can manage manual customs records'
  ) THEN
    CREATE POLICY "Compliance portal users can manage manual customs records"
    ON public.manual_customs_records
    FOR ALL
    TO authenticated
    USING (
      public.is_admin_or_staff(auth.uid())
      OR public.has_portal_access(auth.uid(), 'compliance')
    )
    WITH CHECK (
      public.is_admin_or_staff(auth.uid())
      OR public.has_portal_access(auth.uid(), 'compliance')
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
      AND tablename = 'compliance_charges'
      AND policyname = 'Compliance portal users can view compliance charges'
  ) THEN
    CREATE POLICY "Compliance portal users can view compliance charges"
    ON public.compliance_charges
    FOR SELECT
    TO authenticated
    USING (
      public.is_admin_or_staff(auth.uid())
      OR public.has_portal_access(auth.uid(), 'compliance')
      OR auth.uid() = entered_by_id
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
      AND tablename = 'compliance_charges'
      AND policyname = 'Compliance portal users can manage compliance charges'
  ) THEN
    CREATE POLICY "Compliance portal users can manage compliance charges"
    ON public.compliance_charges
    FOR ALL
    TO authenticated
    USING (
      public.is_admin_or_staff(auth.uid())
      OR public.has_portal_access(auth.uid(), 'compliance')
      OR auth.uid() = entered_by_id
    )
    WITH CHECK (
      public.is_admin_or_staff(auth.uid())
      OR public.has_portal_access(auth.uid(), 'compliance')
      OR auth.uid() = entered_by_id
    );
  END IF;
END
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.manual_customs_records TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.compliance_charges TO authenticated;
