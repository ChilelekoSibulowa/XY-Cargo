-- Allow agents to view and create operational records for their client portfolio.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'payments'
      AND policyname = 'Agents can view payments for their customers'
  ) THEN
    CREATE POLICY "Agents can view payments for their customers"
      ON public.payments
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.customers c
          WHERE c.id = payments.customer_id
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
      AND tablename = 'support_tickets'
      AND policyname = 'Agents can view support tickets for their customers'
  ) THEN
    CREATE POLICY "Agents can view support tickets for their customers"
      ON public.support_tickets
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.customers c
          WHERE c.id = support_tickets.customer_id
            AND c.agent_id = auth.uid()
        )
        OR support_tickets.created_by = auth.uid()
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
      AND tablename = 'support_tickets'
      AND policyname = 'Agents can create support tickets for their customers'
  ) THEN
    CREATE POLICY "Agents can create support tickets for their customers"
      ON public.support_tickets
      FOR INSERT
      TO authenticated
      WITH CHECK (
        created_by = auth.uid()
        AND (
          customer_id IS NULL
          OR EXISTS (
            SELECT 1
            FROM public.customers c
            WHERE c.id = support_tickets.customer_id
              AND c.agent_id = auth.uid()
          )
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
      AND tablename = 'sourcing_requests'
      AND policyname = 'Agents can view sourcing requests for their customers'
  ) THEN
    CREATE POLICY "Agents can view sourcing requests for their customers"
      ON public.sourcing_requests
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.customers c
          WHERE c.id = sourcing_requests.customer_id
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
      AND tablename = 'sourcing_requests'
      AND policyname = 'Agents can create sourcing requests for their customers'
  ) THEN
    CREATE POLICY "Agents can create sourcing requests for their customers"
      ON public.sourcing_requests
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.customers c
          WHERE c.id = sourcing_requests.customer_id
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
      AND tablename = 'sourcing_requests'
      AND policyname = 'Agents can update sourcing requests for their customers'
  ) THEN
    CREATE POLICY "Agents can update sourcing requests for their customers"
      ON public.sourcing_requests
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.customers c
          WHERE c.id = sourcing_requests.customer_id
            AND c.agent_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.customers c
          WHERE c.id = sourcing_requests.customer_id
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
      AND tablename = 'sourcing_quotes'
      AND policyname = 'Agents can view sourcing quotes for their customers'
  ) THEN
    CREATE POLICY "Agents can view sourcing quotes for their customers"
      ON public.sourcing_quotes
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.sourcing_requests sr
          JOIN public.customers c ON c.id = sr.customer_id
          WHERE sr.id = sourcing_quotes.request_id
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
      AND policyname = 'Agents can view sourcing request photos for their customers'
  ) THEN
    CREATE POLICY "Agents can view sourcing request photos for their customers"
      ON public.sourcing_request_photos
      FOR SELECT
      TO authenticated
      USING (
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
