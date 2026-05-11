-- Admin/staff access for customer claims

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'customer_claims'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'customer_claims'
        AND policyname = 'Admin/Staff can view claims'
    ) THEN
      CREATE POLICY "Admin/Staff can view claims"
        ON public.customer_claims
        FOR SELECT
        USING (public.is_admin_or_staff(auth.uid()));
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'customer_claims'
        AND policyname = 'Admin/Staff can update claims'
    ) THEN
      CREATE POLICY "Admin/Staff can update claims"
        ON public.customer_claims
        FOR UPDATE
        USING (public.is_admin_or_staff(auth.uid()));
    END IF;
  END IF;
END
$$;
