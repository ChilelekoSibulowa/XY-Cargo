
ALTER TABLE public.shipments ALTER COLUMN shipping_cost DROP NOT NULL;
ALTER TABLE public.shipments ALTER COLUMN total_cost DROP NOT NULL;

UPDATE public.shipments
SET shipping_cost = NULL,
    total_cost = NULL
WHERE status IN ('saved_pickup', 'saved_dropoff', 'received', 'requested_pickup');
