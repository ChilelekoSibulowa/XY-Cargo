-- Ensure Compliance Queue records are visible/manageable to admin and staff users.
ALTER TABLE public.manual_customs_records ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'manual_customs_records'
      AND policyname = 'Admin/Staff can view manual customs records'
  ) THEN
    CREATE POLICY "Admin/Staff can view manual customs records"
    ON public.manual_customs_records
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
      AND tablename = 'manual_customs_records'
      AND policyname = 'Admin/Staff can insert manual customs records'
  ) THEN
    CREATE POLICY "Admin/Staff can insert manual customs records"
    ON public.manual_customs_records
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
      AND tablename = 'manual_customs_records'
      AND policyname = 'Admin/Staff can update manual customs records'
  ) THEN
    CREATE POLICY "Admin/Staff can update manual customs records"
    ON public.manual_customs_records
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
      AND tablename = 'manual_customs_records'
      AND policyname = 'Admin/Staff can delete manual customs records'
  ) THEN
    CREATE POLICY "Admin/Staff can delete manual customs records"
    ON public.manual_customs_records
    FOR DELETE
    USING (public.is_admin_or_staff(auth.uid()));
  END IF;
END
$$;
