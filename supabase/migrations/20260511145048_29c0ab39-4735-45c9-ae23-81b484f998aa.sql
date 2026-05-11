
-- Repair parcels whose notes mark them as "consolidated" but the column says single,
-- and revert any that were incorrectly auto-pushed into Submitted back to Need Action.
UPDATE public.shipments
SET handling_method = 'consolidated'
WHERE handling_method = 'single'
  AND notes ILIKE '%Handling method: consolidated%';

UPDATE public.shipments
SET status = 'received'
WHERE status = 'requested_pickup'
  AND handling_method = 'consolidated'
  AND id NOT IN (SELECT shipment_id FROM public.consolidation_shipments);
