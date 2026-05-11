DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cms_pages'
      AND policyname = 'Support staff can manage faq cms page'
  ) THEN
    CREATE POLICY "Support staff can manage faq cms page"
      ON public.cms_pages
      FOR ALL
      TO authenticated
      USING (
        slug = 'faq'
        AND EXISTS (
          SELECT 1
          FROM public.staff_portal_assignments spa
          WHERE spa.user_id = auth.uid()
            AND spa.portal_id = 'support'
        )
      )
      WITH CHECK (
        slug = 'faq'
        AND EXISTS (
          SELECT 1
          FROM public.staff_portal_assignments spa
          WHERE spa.user_id = auth.uid()
            AND spa.portal_id = 'support'
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
      AND tablename = 'cms_pages'
      AND policyname = 'Finance staff can manage home cms page'
  ) THEN
    CREATE POLICY "Finance staff can manage home cms page"
      ON public.cms_pages
      FOR ALL
      TO authenticated
      USING (
        slug = 'home'
        AND EXISTS (
          SELECT 1
          FROM public.staff_portal_assignments spa
          WHERE spa.user_id = auth.uid()
            AND spa.portal_id = 'finance'
        )
      )
      WITH CHECK (
        slug = 'home'
        AND EXISTS (
          SELECT 1
          FROM public.staff_portal_assignments spa
          WHERE spa.user_id = auth.uid()
            AND spa.portal_id = 'finance'
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
      AND tablename = 'shipping_rates'
      AND policyname = 'Public can view active shipping rates'
  ) THEN
    CREATE POLICY "Public can view active shipping rates"
      ON public.shipping_rates
      FOR SELECT
      TO anon
      USING (is_active = true);
  END IF;
END
$$;
