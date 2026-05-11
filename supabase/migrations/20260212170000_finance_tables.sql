-- Finance tables: invoices, credit notes, client-specific pricing
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  shipment_id UUID REFERENCES public.shipments(id) ON DELETE SET NULL,
  amount DECIMAL(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  due_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS invoices_code_key ON public.invoices(code);
CREATE INDEX IF NOT EXISTS invoices_customer_status_idx ON public.invoices(customer_id, status, created_at);
CREATE INDEX IF NOT EXISTS invoices_status_idx ON public.invoices(status, created_at);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'invoices'
      AND policyname = 'Customers can view their invoices'
  ) THEN
    CREATE POLICY "Customers can view their invoices"
      ON public.invoices
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.customers c
          WHERE c.id = invoices.customer_id
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
      AND tablename = 'invoices'
      AND policyname = 'Admin/Staff can manage invoices'
  ) THEN
    CREATE POLICY "Admin/Staff can manage invoices"
      ON public.invoices
      FOR ALL
      USING (public.is_admin_or_staff(auth.uid()))
      WITH CHECK (public.is_admin_or_staff(auth.uid()));
  END IF;
END
$$;

DROP TRIGGER IF EXISTS update_invoices_updated_at ON public.invoices;
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Credit notes for refunds/adjustments
CREATE TABLE IF NOT EXISTS public.credit_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  amount DECIMAL(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS credit_notes_code_key ON public.credit_notes(code);
CREATE INDEX IF NOT EXISTS credit_notes_customer_idx ON public.credit_notes(customer_id, status, created_at);

ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'credit_notes'
      AND policyname = 'Customers can view their credit notes'
  ) THEN
    CREATE POLICY "Customers can view their credit notes"
      ON public.credit_notes
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.customers c
          WHERE c.id = credit_notes.customer_id
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
      AND tablename = 'credit_notes'
      AND policyname = 'Admin/Staff can manage credit notes'
  ) THEN
    CREATE POLICY "Admin/Staff can manage credit notes"
      ON public.credit_notes
      FOR ALL
      USING (public.is_admin_or_staff(auth.uid()))
      WITH CHECK (public.is_admin_or_staff(auth.uid()));
  END IF;
END
$$;

DROP TRIGGER IF EXISTS update_credit_notes_updated_at ON public.credit_notes;
CREATE TRIGGER update_credit_notes_updated_at
  BEFORE UPDATE ON public.credit_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Client-specific pricing
CREATE TABLE IF NOT EXISTS public.client_pricing (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  service_type public.service_type NOT NULL,
  rate_per_kg DECIMAL(12,2),
  rate_per_cbm DECIMAL(12,2),
  minimum_charge DECIMAL(12,2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS client_pricing_customer_service_key
  ON public.client_pricing(customer_id, service_type);
CREATE INDEX IF NOT EXISTS client_pricing_active_idx
  ON public.client_pricing(is_active);

ALTER TABLE public.client_pricing ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'client_pricing'
      AND policyname = 'Customers can view their pricing'
  ) THEN
    CREATE POLICY "Customers can view their pricing"
      ON public.client_pricing
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.customers c
          WHERE c.id = client_pricing.customer_id
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
      AND tablename = 'client_pricing'
      AND policyname = 'Admin/Staff can manage client pricing'
  ) THEN
    CREATE POLICY "Admin/Staff can manage client pricing"
      ON public.client_pricing
      FOR ALL
      USING (public.is_admin_or_staff(auth.uid()))
      WITH CHECK (public.is_admin_or_staff(auth.uid()));
  END IF;
END
$$;

DROP TRIGGER IF EXISTS update_client_pricing_updated_at ON public.client_pricing;
CREATE TRIGGER update_client_pricing_updated_at
  BEFORE UPDATE ON public.client_pricing
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
