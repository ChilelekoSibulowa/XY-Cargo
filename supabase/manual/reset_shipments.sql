-- One-time manual reset: clear all shipment workflow data.
-- Run this in Supabase SQL Editor when you want a clean shipment state.
-- Do NOT run in production unless you intentionally want to wipe shipment data.

BEGIN;

-- Break non-cascading references to shipments.
DO $$
BEGIN
  IF to_regclass('public.transactions') IS NOT NULL THEN
    EXECUTE 'UPDATE public.transactions SET shipment_id = NULL WHERE shipment_id IS NOT NULL';
  END IF;

  IF to_regclass('public.payments') IS NOT NULL THEN
    EXECUTE 'UPDATE public.payments SET shipment_id = NULL WHERE shipment_id IS NOT NULL';
  END IF;

  IF to_regclass('public.support_tickets') IS NOT NULL THEN
    EXECUTE 'UPDATE public.support_tickets SET shipment_id = NULL WHERE shipment_id IS NOT NULL';
  END IF;
END
$$;

-- Remove consolidation groups first.
DO $$
BEGIN
  IF to_regclass('public.consolidation_shipments') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.consolidation_shipments';
  END IF;

  IF to_regclass('public.consolidations') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.consolidations';
  END IF;
END
$$;

-- Remove shipment-related link rows.
DO $$
BEGIN
  IF to_regclass('public.manifest_shipments') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.manifest_shipments';
  END IF;

  IF to_regclass('public.mission_shipments') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.mission_shipments';
  END IF;

  IF to_regclass('public.inspection_uploads') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.inspection_uploads';
  END IF;
END
$$;

-- Remove all shipments.
DELETE FROM public.shipments;

-- Optional cleanup: clear shipment/consolidation notifications.
DELETE FROM public.notifications
WHERE notification_type IN ('shipment', 'payment')
   OR notification_type = 'route:/warehouse/consolidation'
   OR notification_type LIKE 'route:/customer/shipments%'
   OR notification_type = 'route:/customer/payments';

COMMIT;

-- Verification
SELECT COUNT(*) AS remaining_shipments FROM public.shipments;
SELECT COUNT(*) AS remaining_consolidations FROM public.consolidations;
