-- Ensure customers can read consolidation links for service-type and item breakdown rendering.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'consolidations'
      AND policyname = 'Customers can view their consolidations'
  ) THEN
    CREATE POLICY "Customers can view their consolidations"
      ON public.consolidations
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.customers c
          WHERE c.id = consolidations.customer_id
            AND c.user_id = auth.uid()
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
      AND tablename = 'consolidation_shipments'
      AND policyname = 'Customers can view consolidation shipments'
  ) THEN
    CREATE POLICY "Customers can view consolidation shipments"
      ON public.consolidation_shipments
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.consolidations con
          JOIN public.customers cust ON cust.id = con.customer_id
          WHERE con.id = consolidation_shipments.consolidation_id
            AND cust.user_id = auth.uid()
        )
      );
  END IF;
END
$$;

GRANT SELECT ON TABLE public.consolidations TO authenticated;
GRANT SELECT ON TABLE public.consolidation_shipments TO authenticated;
