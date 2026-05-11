
-- Fix 1: Remove anonymous write policies on branding bucket
DROP POLICY IF EXISTS "anon can upload branding logo" ON storage.objects;
DROP POLICY IF EXISTS "anon can update branding logo" ON storage.objects;

-- Restrict branding uploads to admins only
DROP POLICY IF EXISTS "authenticated can upload branding" ON storage.objects;
DROP POLICY IF EXISTS "authenticated can update branding" ON storage.objects;

CREATE POLICY "admins can upload branding"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'branding' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins can update branding"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'branding' AND public.has_role(auth.uid(), 'admin'));
