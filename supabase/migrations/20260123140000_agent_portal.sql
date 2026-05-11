-- Agent portal support: role + customer links + policies

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumtypid = 'public.app_role'::regtype
      AND enumlabel = 'agent'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'agent';
  END IF;
END
$$;

ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS customers_agent_id_idx ON public.customers(agent_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'customers'
      AND policyname = 'Agents can view their customers'
  ) THEN
    CREATE POLICY "Agents can view their customers"
      ON public.customers
      FOR SELECT
      USING (agent_id = auth.uid());
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'customers'
      AND policyname = 'Agents can insert customers'
  ) THEN
    CREATE POLICY "Agents can insert customers"
      ON public.customers
      FOR INSERT
      WITH CHECK (agent_id = auth.uid());
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'customers'
      AND policyname = 'Agents can update their customers'
  ) THEN
    CREATE POLICY "Agents can update their customers"
      ON public.customers
      FOR UPDATE
      USING (agent_id = auth.uid())
      WITH CHECK (agent_id = auth.uid());
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'shipments'
      AND policyname = 'Agents can view shipments'
  ) THEN
    CREATE POLICY "Agents can view shipments"
      ON public.shipments
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.customers c
          WHERE c.id = customer_id
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
      AND tablename = 'shipments'
      AND policyname = 'Agents can create shipments'
  ) THEN
    CREATE POLICY "Agents can create shipments"
      ON public.shipments
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.customers c
          WHERE c.id = customer_id
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
      AND tablename = 'receivers'
      AND policyname = 'Agents can view receivers'
  ) THEN
    CREATE POLICY "Agents can view receivers"
      ON public.receivers
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.customers c
          WHERE c.id = customer_id
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
      AND tablename = 'receivers'
      AND policyname = 'Agents can create receivers'
  ) THEN
    CREATE POLICY "Agents can create receivers"
      ON public.receivers
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.customers c
          WHERE c.id = customer_id
            AND c.agent_id = auth.uid()
        )
      );
  END IF;
END
$$;
