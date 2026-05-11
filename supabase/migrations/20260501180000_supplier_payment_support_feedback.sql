ALTER TABLE public.supplier_payment_requests
  ADD COLUMN IF NOT EXISTS support_response_message text,
  ADD COLUMN IF NOT EXISTS support_response_at timestamptz,
  ADD COLUMN IF NOT EXISTS support_responded_by uuid;
