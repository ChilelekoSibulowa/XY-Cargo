-- Inspection uploads for warehouse proof documents

CREATE TABLE IF NOT EXISTS public.inspection_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID REFERENCES public.shipments(id) ON DELETE CASCADE NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.inspection_uploads ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'inspection_uploads'
      AND policyname = 'Admin/Staff can manage inspection uploads'
  ) THEN
    CREATE POLICY "Admin/Staff can manage inspection uploads"
      ON public.inspection_uploads
      FOR ALL
      USING (public.is_admin_or_staff(auth.uid()));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'inspections') THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('inspections', 'inspections', false);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'admin staff can upload inspections'
  ) THEN
    CREATE POLICY "admin staff can upload inspections"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'inspections'
        AND public.is_admin_or_staff(auth.uid())
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'admin staff can update inspections'
  ) THEN
    CREATE POLICY "admin staff can update inspections"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'inspections'
        AND public.is_admin_or_staff(auth.uid())
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'admin staff can read inspections'
  ) THEN
    CREATE POLICY "admin staff can read inspections"
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'inspections'
        AND public.is_admin_or_staff(auth.uid())
      );
  END IF;
END
$$;
