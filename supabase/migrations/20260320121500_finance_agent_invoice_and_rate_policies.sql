DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'shipping_rates'
      AND policyname = 'Admin can manage rates'
  ) THEN
    DROP POLICY "Admin can manage rates" ON public.shipping_rates;
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
      AND policyname = 'Admin/Staff can manage rates'
  ) THEN
    CREATE POLICY "Admin/Staff can manage rates"
      ON public.shipping_rates
      FOR ALL
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
      AND tablename = 'invoices'
      AND policyname = 'Agents can view invoices for their customers'
  ) THEN
    CREATE POLICY "Agents can view invoices for their customers"
      ON public.invoices
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.customers c
          WHERE c.id = invoices.customer_id
            AND c.agent_id = auth.uid()
        )
      );
  END IF;
END
$$;
