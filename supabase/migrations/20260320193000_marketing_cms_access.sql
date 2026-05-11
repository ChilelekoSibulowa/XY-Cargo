DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cms_pages'
      AND policyname = 'Marketing staff can manage marketing cms pages'
  ) THEN
    CREATE POLICY "Marketing staff can manage marketing cms pages"
      ON public.cms_pages
      FOR ALL
      TO authenticated
      USING (
        slug IN ('blog', 'podcast', 'gallery')
        AND EXISTS (
          SELECT 1
          FROM public.staff_portal_assignments spa
          WHERE spa.user_id = auth.uid()
            AND spa.portal_id = 'marketing'
        )
      )
      WITH CHECK (
        slug IN ('blog', 'podcast', 'gallery')
        AND EXISTS (
          SELECT 1
          FROM public.staff_portal_assignments spa
          WHERE spa.user_id = auth.uid()
            AND spa.portal_id = 'marketing'
        )
      );
  END IF;
END
$$;
