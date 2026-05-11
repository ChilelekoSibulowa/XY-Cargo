-- Product types for service-specific product selection
CREATE TABLE IF NOT EXISTS public.product_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  service_type public.service_type NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS product_types_service_name_key
  ON public.product_types(service_type, name);

CREATE INDEX IF NOT EXISTS product_types_service_active_idx
  ON public.product_types(service_type, is_active);

CREATE INDEX IF NOT EXISTS product_types_sort_idx
  ON public.product_types(service_type, sort_order, name);

ALTER TABLE public.product_types ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'product_types'
      AND policyname = 'Anyone authenticated can view product types'
  ) THEN
    CREATE POLICY "Anyone authenticated can view product types"
      ON public.product_types
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
      AND tablename = 'product_types'
      AND policyname = 'Admin/Staff can manage product types'
  ) THEN
    CREATE POLICY "Admin/Staff can manage product types"
      ON public.product_types
      FOR ALL
      USING (public.is_admin_or_staff(auth.uid()));
  END IF;
END
$$;

CREATE TRIGGER update_product_types_updated_at
  BEFORE UPDATE ON public.product_types
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.product_types (name, service_type, sort_order, is_active)
VALUES
  ('Normal goods', 'air', 10, true),
  ('Wigs', 'air', 20, true),
  ('Wigs and Hair', 'air', 30, true),
  ('Phones', 'air', 40, true),
  ('Mobile Phones', 'air', 50, true),
  ('Battery/Cosmetics/Toner/Medicine', 'air', 60, true),
  ('Laptops & iPads', 'air', 70, true),
  ('General Goods', 'sea', 10, true),
  ('Special Goods', 'sea', 20, true)
ON CONFLICT (service_type, name) DO NOTHING;
