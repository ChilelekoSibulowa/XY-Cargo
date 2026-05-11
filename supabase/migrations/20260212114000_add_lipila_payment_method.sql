-- Add Lipila payment method
ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'lipila';
