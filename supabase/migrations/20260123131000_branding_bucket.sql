-- Storage bucket and policies for branding assets

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'branding') THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('branding', 'branding', true);
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
      AND policyname = 'authenticated can upload branding'
  ) THEN
    CREATE POLICY "authenticated can upload branding"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'branding');
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
      AND policyname = 'authenticated can update branding'
  ) THEN
    CREATE POLICY "authenticated can update branding"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (bucket_id = 'branding');
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
      AND policyname = 'public can read branding'
  ) THEN
    CREATE POLICY "public can read branding"
      ON storage.objects
      FOR SELECT
      USING (bucket_id = 'branding');
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
      AND policyname = 'anon can upload branding logo'
  ) THEN
    CREATE POLICY "anon can upload branding logo"
      ON storage.objects
      FOR INSERT
      TO anon
      WITH CHECK (bucket_id = 'branding' AND name = 'logo/logo.png');
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
      AND policyname = 'anon can update branding logo'
  ) THEN
    CREATE POLICY "anon can update branding logo"
      ON storage.objects
      FOR UPDATE
      TO anon
      USING (bucket_id = 'branding' AND name = 'logo/logo.png');
  END IF;
END
$$;
