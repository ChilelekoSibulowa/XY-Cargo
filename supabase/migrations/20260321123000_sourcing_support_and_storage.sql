-- Support responses and file uploads for sourcing workflows.

ALTER TABLE public.sourcing_requests
  ADD COLUMN IF NOT EXISTS support_response_message text,
  ADD COLUMN IF NOT EXISTS support_response_at timestamptz,
  ADD COLUMN IF NOT EXISTS support_responded_by uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sourcing_requests'
      AND policyname = 'Admin staff can view sourcing requests'
  ) THEN
    CREATE POLICY "Admin staff can view sourcing requests"
      ON public.sourcing_requests
      FOR SELECT
      TO authenticated
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
      AND tablename = 'sourcing_requests'
      AND policyname = 'Admin staff can update sourcing requests'
  ) THEN
    CREATE POLICY "Admin staff can update sourcing requests"
      ON public.sourcing_requests
      FOR UPDATE
      TO authenticated
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
      AND tablename = 'sourcing_request_photos'
      AND policyname = 'Agents can manage sourcing request photos for their customers'
  ) THEN
    CREATE POLICY "Agents can manage sourcing request photos for their customers"
      ON public.sourcing_request_photos
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.sourcing_requests sr
          JOIN public.customers c ON c.id = sr.customer_id
          WHERE sr.id = sourcing_request_photos.request_id
            AND c.agent_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.sourcing_requests sr
          JOIN public.customers c ON c.id = sr.customer_id
          WHERE sr.id = sourcing_request_photos.request_id
            AND c.agent_id = auth.uid()
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
      AND tablename = 'sourcing_request_photos'
      AND policyname = 'Admin staff can view sourcing request photos'
  ) THEN
    CREATE POLICY "Admin staff can view sourcing request photos"
      ON public.sourcing_request_photos
      FOR SELECT
      TO authenticated
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
      AND tablename = 'sourcing_quotes'
      AND policyname = 'Admin staff can view sourcing quotes'
  ) THEN
    CREATE POLICY "Admin staff can view sourcing quotes"
      ON public.sourcing_quotes
      FOR SELECT
      TO authenticated
      USING (public.is_admin_or_staff(auth.uid()));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'sourcing-attachments') THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('sourcing-attachments', 'sourcing-attachments', true);
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
      AND policyname = 'Sourcing attachments are readable'
  ) THEN
    CREATE POLICY "Sourcing attachments are readable"
      ON storage.objects
      FOR SELECT
      USING (bucket_id = 'sourcing-attachments');
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
      AND policyname = 'Authenticated users can upload sourcing attachments'
  ) THEN
    CREATE POLICY "Authenticated users can upload sourcing attachments"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'sourcing-attachments');
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
      AND policyname = 'Owners can update sourcing attachments'
  ) THEN
    CREATE POLICY "Owners can update sourcing attachments"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'sourcing-attachments'
        AND (owner = auth.uid() OR public.is_admin_or_staff(auth.uid()))
      )
      WITH CHECK (
        bucket_id = 'sourcing-attachments'
        AND (owner = auth.uid() OR public.is_admin_or_staff(auth.uid()))
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
      AND policyname = 'Owners can delete sourcing attachments'
  ) THEN
    CREATE POLICY "Owners can delete sourcing attachments"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'sourcing-attachments'
        AND (owner = auth.uid() OR public.is_admin_or_staff(auth.uid()))
      );
  END IF;
END
$$;
