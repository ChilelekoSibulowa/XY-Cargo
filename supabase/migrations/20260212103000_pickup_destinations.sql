-- Pickup destinations for customer/agent shipment forms
CREATE TABLE IF NOT EXISTS public.pickup_destinations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  requires_details BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS pickup_destinations_name_key
  ON public.pickup_destinations(name);

CREATE INDEX IF NOT EXISTS pickup_destinations_active_idx
  ON public.pickup_destinations(is_active);

CREATE INDEX IF NOT EXISTS pickup_destinations_sort_idx
  ON public.pickup_destinations(sort_order, name);

ALTER TABLE public.pickup_destinations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'pickup_destinations'
      AND policyname = 'Anyone authenticated can view pickup destinations'
  ) THEN
    CREATE POLICY "Anyone authenticated can view pickup destinations"
      ON public.pickup_destinations
      FOR SELECT TO authenticated
      USING (is_active = true);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'pickup_destinations'
      AND policyname = 'Admin/Staff can manage pickup destinations'
  ) THEN
    CREATE POLICY "Admin/Staff can manage pickup destinations"
      ON public.pickup_destinations
      FOR ALL
      USING (public.is_admin_or_staff(auth.uid()));
  END IF;
END
$$;

DROP TRIGGER IF EXISTS update_pickup_destinations_updated_at ON public.pickup_destinations;

CREATE TRIGGER update_pickup_destinations_updated_at
  BEFORE UPDATE ON public.pickup_destinations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.pickup_destinations (name, requires_details, sort_order, is_active)
VALUES
  ('Lusaka Warehouse', false, 10, true),
  ('Ndola Warehouse', false, 20, true),
  ('Kitwe Warehouse', false, 30, true),
  ('Other', true, 999, true)
ON CONFLICT (name) DO NOTHING;
