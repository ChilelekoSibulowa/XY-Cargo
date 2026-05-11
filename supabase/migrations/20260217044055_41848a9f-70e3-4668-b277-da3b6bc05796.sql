
-- Step 1: Add new enum values only
ALTER TYPE public.shipment_status ADD VALUE IF NOT EXISTS 'created';
ALTER TYPE public.shipment_status ADD VALUE IF NOT EXISTS 'incoming';
ALTER TYPE public.shipment_status ADD VALUE IF NOT EXISTS 'need_action';
ALTER TYPE public.shipment_status ADD VALUE IF NOT EXISTS 'submitted';
ALTER TYPE public.shipment_status ADD VALUE IF NOT EXISTS 'confirm_shipment';
ALTER TYPE public.shipment_status ADD VALUE IF NOT EXISTS 'outgoing';
ALTER TYPE public.shipment_status ADD VALUE IF NOT EXISTS 'in_transit';
ALTER TYPE public.shipment_status ADD VALUE IF NOT EXISTS 'arrived';
ALTER TYPE public.shipment_status ADD VALUE IF NOT EXISTS 'collected';

-- Add tracking_code column to consolidations
ALTER TABLE public.consolidations ADD COLUMN IF NOT EXISTS tracking_code text;
