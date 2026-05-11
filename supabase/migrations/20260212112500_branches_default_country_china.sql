-- Ensure warehouses default to China when no country is provided
ALTER TABLE public.branches
  ALTER COLUMN country SET DEFAULT 'China';

UPDATE public.branches
SET country = 'China'
WHERE country IS NULL;
