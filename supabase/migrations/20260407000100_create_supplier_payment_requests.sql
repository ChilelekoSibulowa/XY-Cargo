BEGIN;

CREATE TABLE IF NOT EXISTS public.supplier_payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_code text NOT NULL,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  submitted_by uuid NOT NULL,
  submitted_by_role text NOT NULL DEFAULT 'customer',
  status text NOT NULL DEFAULT 'pending_review',

  -- Supplier Information
  supplier_name text NOT NULL,
  company_name text NOT NULL,
  supplier_country text NOT NULL,
  whatsapp_wechat text NOT NULL,
  supplier_email text,
  supplier_address text,

  -- Payment Method
  payment_method text NOT NULL,

  -- Bank Details (only when payment_method = 'bank_transfer')
  bank_name text,
  bank_country text,
  account_name text,
  swift_code text,
  account_number_iban text,
  branch text,

  -- Payment Details
  currency text NOT NULL,
  amount numeric(14,2) NOT NULL,
  purpose text NOT NULL DEFAULT 'payment_of_goods',
  description text,

  -- Documents
  documents jsonb DEFAULT '[]'::jsonb,

  -- Charges calculated at submission
  exchange_rate numeric(14,6),
  total_payable numeric(14,2),
  payable_currency text DEFAULT 'ZMW',

  -- Declaration
  declaration_accepted boolean NOT NULL DEFAULT false,

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid
);

CREATE INDEX IF NOT EXISTS supplier_payment_requests_customer_id_idx
  ON public.supplier_payment_requests (customer_id);

CREATE INDEX IF NOT EXISTS supplier_payment_requests_submitted_by_idx
  ON public.supplier_payment_requests (submitted_by);

CREATE INDEX IF NOT EXISTS supplier_payment_requests_status_idx
  ON public.supplier_payment_requests (status);

CREATE INDEX IF NOT EXISTS supplier_payment_requests_created_at_idx
  ON public.supplier_payment_requests (created_at);

ALTER TABLE public.supplier_payment_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can view own supplier payment requests"
  ON public.supplier_payment_requests
  FOR SELECT
  TO authenticated
  USING (
    submitted_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = supplier_payment_requests.customer_id
        AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Customers can insert own supplier payment requests"
  ON public.supplier_payment_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (submitted_by = auth.uid());

CREATE POLICY "Customers can delete own pending supplier payment requests"
  ON public.supplier_payment_requests
  FOR DELETE
  TO authenticated
  USING (
    submitted_by = auth.uid()
    AND status IN ('pending_review', 'draft')
  );

CREATE POLICY "Staff can view all supplier payment requests"
  ON public.supplier_payment_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'staff')
    )
  );

CREATE POLICY "Staff can update supplier payment requests"
  ON public.supplier_payment_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'staff')
    )
  );

CREATE POLICY "Staff can delete supplier payment requests"
  ON public.supplier_payment_requests
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'staff')
    )
  );

-- Agents can view requests they submitted
CREATE POLICY "Agents can view own submitted supplier payment requests"
  ON public.supplier_payment_requests
  FOR SELECT
  TO authenticated
  USING (
    submitted_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'agent'
    )
  );

CREATE POLICY "Agents can delete own pending supplier payment requests"
  ON public.supplier_payment_requests
  FOR DELETE
  TO authenticated
  USING (
    submitted_by = auth.uid()
    AND status IN ('pending_review', 'draft')
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'agent'
    )
  );

-- Sequence for generating request codes
CREATE SEQUENCE IF NOT EXISTS supplier_payment_request_seq START 245;

COMMIT;
