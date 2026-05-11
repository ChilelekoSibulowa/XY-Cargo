-- Create a dedicated storage bucket for supplier payment request documents
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'supplier-documents') THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('supplier-documents', 'supplier-documents', true);
  END IF;
END
$$;

-- Public read access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Supplier documents are readable'
  ) THEN
    CREATE POLICY "Supplier documents are readable"
      ON storage.objects
      FOR SELECT
      USING (bucket_id = 'supplier-documents');
  END IF;
END
$$;

-- Authenticated users can upload supplier documents
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Authenticated users can upload supplier documents'
  ) THEN
    CREATE POLICY "Authenticated users can upload supplier documents"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'supplier-documents');
  END IF;
END
$$;

-- Owners and staff can update supplier documents
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Owners can update supplier documents'
  ) THEN
    CREATE POLICY "Owners can update supplier documents"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'supplier-documents'
        AND (owner = auth.uid() OR public.is_admin_or_staff(auth.uid()))
      )
      WITH CHECK (
        bucket_id = 'supplier-documents'
        AND (owner = auth.uid() OR public.is_admin_or_staff(auth.uid()))
      );
  END IF;
END
$$;

-- Owners and staff can delete supplier documents
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Owners can delete supplier documents'
  ) THEN
    CREATE POLICY "Owners can delete supplier documents"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'supplier-documents'
        AND (owner = auth.uid() OR public.is_admin_or_staff(auth.uid()))
      );
  END IF;
END
$$;
