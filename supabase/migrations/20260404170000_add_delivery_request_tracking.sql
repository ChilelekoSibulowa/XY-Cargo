BEGIN;

ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS delivery_request_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_request_requested_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS delivery_request_requested_by_role text;

ALTER TABLE public.consolidations
  ADD COLUMN IF NOT EXISTS delivery_request_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_request_requested_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS delivery_request_requested_by_role text;

ALTER TABLE public.shipments
  DROP CONSTRAINT IF EXISTS shipments_delivery_request_requested_by_role_check;

ALTER TABLE public.shipments
  ADD CONSTRAINT shipments_delivery_request_requested_by_role_check
  CHECK (
    delivery_request_requested_by_role IS NULL
    OR delivery_request_requested_by_role IN ('customer', 'agent')
  );

ALTER TABLE public.consolidations
  DROP CONSTRAINT IF EXISTS consolidations_delivery_request_requested_by_role_check;

ALTER TABLE public.consolidations
  ADD CONSTRAINT consolidations_delivery_request_requested_by_role_check
  CHECK (
    delivery_request_requested_by_role IS NULL
    OR delivery_request_requested_by_role IN ('customer', 'agent')
  );

CREATE INDEX IF NOT EXISTS shipments_delivery_request_requested_at_idx
  ON public.shipments (delivery_request_requested_at);

CREATE INDEX IF NOT EXISTS consolidations_delivery_request_requested_at_idx
  ON public.consolidations (delivery_request_requested_at);

COMMIT;