-- Fix missing timestamps for product_types
ALTER TABLE public.product_types
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();

ALTER TABLE public.product_types
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();

UPDATE public.product_types
SET created_at = now()
WHERE created_at IS NULL;

UPDATE public.product_types
SET updated_at = now()
WHERE updated_at IS NULL;

DROP TRIGGER IF EXISTS update_product_types_updated_at ON public.product_types;

CREATE TRIGGER update_product_types_updated_at
  BEFORE UPDATE ON public.product_types
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
