-- Allow admin/staff to create shipments for customers

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'shipments'
      AND policyname = 'Admin/Staff can insert shipments'
  ) THEN
    CREATE POLICY "Admin/Staff can insert shipments"
      ON public.shipments
      FOR INSERT
      WITH CHECK (public.is_admin_or_staff(auth.uid()));
  END IF;
END
$$;
