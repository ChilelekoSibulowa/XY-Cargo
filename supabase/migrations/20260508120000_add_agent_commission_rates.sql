-- Migration to add agent commission rates to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS commission_rate_kg NUMERIC DEFAULT 0.5,
ADD COLUMN IF NOT EXISTS commission_rate_cbm NUMERIC DEFAULT 10.0;

-- Update existing agents to have the default rates if not set
-- (Though DEFAULT already handles this for new rows and NULLs if we were inserting,
-- but for existing rows it will be set to 0.5 and 10.0 automatically)

COMMENT ON COLUMN public.profiles.commission_rate_kg IS 'Agent commission rate per Kilogram (KG) in USD';
COMMENT ON COLUMN public.profiles.commission_rate_cbm IS 'Agent commission rate per Cubic Meter (CBM) in USD';
