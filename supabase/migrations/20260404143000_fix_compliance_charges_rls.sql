-- Ensure compliance_charges has explicit RLS policies for Compliance/Admin staff.
ALTER TABLE public.compliance_charges ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'compliance_charges'
      AND policyname = 'Admin/Staff can view compliance charges'
  ) THEN
    CREATE POLICY "Admin/Staff can view compliance charges"
    ON public.compliance_charges
    FOR SELECT
    USING (public.is_admin_or_staff(auth.uid()));
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
      AND policyname = 'Admin/Staff can insert compliance charges'
  ) THEN
    CREATE POLICY "Admin/Staff can insert compliance charges"
    ON public.compliance_charges
    FOR INSERT
    WITH CHECK (public.is_admin_or_staff(auth.uid()));
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
      AND policyname = 'Admin/Staff can update compliance charges'
  ) THEN
    CREATE POLICY "Admin/Staff can update compliance charges"
    ON public.compliance_charges
    FOR UPDATE
    USING (public.is_admin_or_staff(auth.uid()))
    WITH CHECK (public.is_admin_or_staff(auth.uid()));
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
      AND policyname = 'Admin/Staff can delete compliance charges'
  ) THEN
    CREATE POLICY "Admin/Staff can delete compliance charges"
    ON public.compliance_charges
    FOR DELETE
    USING (public.is_admin_or_staff(auth.uid()));
  END IF;
END
$$;
