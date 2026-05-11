-- Sourcing requests for customers
CREATE TABLE IF NOT EXISTS public.sourcing_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  description TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  budget DECIMAL(12,2) NULL,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sourcing_requests_customer_idx
  ON public.sourcing_requests(customer_id, created_at);

ALTER TABLE public.sourcing_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sourcing_requests'
      AND policyname = 'Customers can manage their sourcing requests'
  ) THEN
    CREATE POLICY "Customers can manage their sourcing requests"
      ON public.sourcing_requests
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.customers c
          WHERE c.id = sourcing_requests.customer_id
            AND c.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.customers c
          WHERE c.id = sourcing_requests.customer_id
            AND c.user_id = auth.uid()
        )
      );
  END IF;
END
$$;

DROP TRIGGER IF EXISTS update_sourcing_requests_updated_at ON public.sourcing_requests;

CREATE TRIGGER update_sourcing_requests_updated_at
  BEFORE UPDATE ON public.sourcing_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Sourcing request photos (store URLs)
CREATE TABLE IF NOT EXISTS public.sourcing_request_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.sourcing_requests(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sourcing_request_photos_request_idx
  ON public.sourcing_request_photos(request_id);

ALTER TABLE public.sourcing_request_photos ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sourcing_request_photos'
      AND policyname = 'Customers can manage sourcing request photos'
  ) THEN
    CREATE POLICY "Customers can manage sourcing request photos"
      ON public.sourcing_request_photos
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.sourcing_requests r
          JOIN public.customers c ON c.id = r.customer_id
          WHERE r.id = sourcing_request_photos.request_id
            AND c.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.sourcing_requests r
          JOIN public.customers c ON c.id = r.customer_id
          WHERE r.id = sourcing_request_photos.request_id
            AND c.user_id = auth.uid()
        )
      );
  END IF;
END
$$;

-- Supplier quotes for sourcing requests
CREATE TABLE IF NOT EXISTS public.sourcing_quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.sourcing_requests(id) ON DELETE CASCADE,
  supplier_name TEXT NOT NULL,
  quote_amount DECIMAL(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sourcing_quotes_request_idx
  ON public.sourcing_quotes(request_id);

ALTER TABLE public.sourcing_quotes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sourcing_quotes'
      AND policyname = 'Customers can view their sourcing quotes'
  ) THEN
    CREATE POLICY "Customers can view their sourcing quotes"
      ON public.sourcing_quotes
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.sourcing_requests r
          JOIN public.customers c ON c.id = r.customer_id
          WHERE r.id = sourcing_quotes.request_id
            AND c.user_id = auth.uid()
        )
      );
  END IF;
END
$$;
