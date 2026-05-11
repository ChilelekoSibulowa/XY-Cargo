-- Consolidation requests for grouping customer parcels

CREATE TABLE IF NOT EXISTS public.consolidations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) NOT NULL,
  status TEXT DEFAULT 'requested',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.consolidation_shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consolidation_id UUID REFERENCES public.consolidations(id) ON DELETE CASCADE NOT NULL,
  shipment_id UUID REFERENCES public.shipments(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE (consolidation_id, shipment_id)
);

ALTER TABLE public.consolidations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consolidation_shipments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'consolidations'
      AND policyname = 'Admin/Staff can manage consolidations'
  ) THEN
    CREATE POLICY "Admin/Staff can manage consolidations"
      ON public.consolidations
      FOR ALL
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
      AND tablename = 'consolidations'
      AND policyname = 'Customers can view their consolidations'
  ) THEN
    CREATE POLICY "Customers can view their consolidations"
      ON public.consolidations
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.customers c
          WHERE c.id = customer_id
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
      AND policyname = 'Admin/Staff can manage consolidation shipments'
  ) THEN
    CREATE POLICY "Admin/Staff can manage consolidation shipments"
      ON public.consolidation_shipments
      FOR ALL
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
      AND tablename = 'consolidation_shipments'
      AND policyname = 'Customers can view consolidation shipments'
  ) THEN
    CREATE POLICY "Customers can view consolidation shipments"
      ON public.consolidation_shipments
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.consolidations c
          JOIN public.customers cust ON cust.id = c.customer_id
          WHERE c.id = consolidation_id
            AND cust.user_id = auth.uid()
        )
      );
  END IF;
END
$$;
