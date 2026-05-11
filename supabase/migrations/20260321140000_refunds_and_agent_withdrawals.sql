-- Refund workflow fields and agent withdrawal requests.

ALTER TABLE public.customer_claims
  ADD COLUMN IF NOT EXISTS shipment_id uuid REFERENCES public.shipments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS request_type text NOT NULL DEFAULT 'refund',
  ADD COLUMN IF NOT EXISTS requested_amount numeric(15,2),
  ADD COLUMN IF NOT EXISTS requested_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS requested_by_role text,
  ADD COLUMN IF NOT EXISTS finance_response_message text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.customer_claims cc
SET shipment_id = s.id
FROM public.shipments s
WHERE cc.shipment_id IS NULL
  AND cc.customer_id = s.customer_id
  AND cc.shipment_code IS NOT NULL
  AND (
    lower(s.code) = lower(cc.shipment_code)
    OR lower(COALESCE(s.custom_tracking_number, '')) = lower(cc.shipment_code)
  );

UPDATE public.customer_claims cc
SET requested_amount = COALESCE(s.shipping_cost, s.total_cost, 0)
FROM public.shipments s
WHERE cc.shipment_id = s.id
  AND cc.requested_amount IS NULL;

UPDATE public.customer_claims
SET requested_by_role = COALESCE(requested_by_role, 'customer'),
    request_type = COALESCE(NULLIF(BTRIM(request_type), ''), 'refund'),
    updated_at = COALESCE(updated_at, created_at, now())
WHERE requested_by_role IS NULL
   OR request_type IS NULL
   OR updated_at IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_customer_claims_updated_at'
  ) THEN
    CREATE TRIGGER update_customer_claims_updated_at
    BEFORE UPDATE ON public.customer_claims
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'customer_claims'
      AND policyname = 'Agents can view refund requests for their customers'
  ) THEN
    CREATE POLICY "Agents can view refund requests for their customers"
      ON public.customer_claims
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.customers c
          WHERE c.id = customer_claims.customer_id
            AND c.agent_id = auth.uid()
        )
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'customer_claims'
      AND policyname = 'Agents can create refund requests for their customers'
  ) THEN
    CREATE POLICY "Agents can create refund requests for their customers"
      ON public.customer_claims
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.customers c
          WHERE c.id = customer_claims.customer_id
            AND c.agent_id = auth.uid()
        )
      );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.agent_withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(15,2) NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'requested',
  payout_method text,
  payout_destination text,
  request_notes text,
  finance_message text,
  approved_at timestamptz,
  approved_by uuid,
  paid_at timestamptz,
  paid_by uuid,
  payout_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_withdrawal_requests_agent_user_id
  ON public.agent_withdrawal_requests(agent_user_id);

CREATE INDEX IF NOT EXISTS idx_agent_withdrawal_requests_status
  ON public.agent_withdrawal_requests(status);

ALTER TABLE public.agent_withdrawal_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'agent_withdrawal_requests'
      AND policyname = 'Agents can view their withdrawal requests'
  ) THEN
    CREATE POLICY "Agents can view their withdrawal requests"
      ON public.agent_withdrawal_requests
      FOR SELECT
      TO authenticated
      USING (agent_user_id = auth.uid());
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'agent_withdrawal_requests'
      AND policyname = 'Agents can create their withdrawal requests'
  ) THEN
    CREATE POLICY "Agents can create their withdrawal requests"
      ON public.agent_withdrawal_requests
      FOR INSERT
      TO authenticated
      WITH CHECK (agent_user_id = auth.uid());
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'agent_withdrawal_requests'
      AND policyname = 'Admin staff can manage withdrawal requests'
  ) THEN
    CREATE POLICY "Admin staff can manage withdrawal requests"
      ON public.agent_withdrawal_requests
      FOR ALL
      TO authenticated
      USING (public.is_admin_or_staff(auth.uid()))
      WITH CHECK (public.is_admin_or_staff(auth.uid()));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_agent_withdrawal_requests_updated_at'
  ) THEN
    CREATE TRIGGER update_agent_withdrawal_requests_updated_at
    BEFORE UPDATE ON public.agent_withdrawal_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.notify_customer_claim_notification_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text;
  v_message text;
  v_shipment_ref text := COALESCE(NULLIF(BTRIM(NEW.shipment_code), ''), 'unspecified shipment');
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_title := 'New refund request';
    v_message := 'A new refund request was submitted for ' || v_shipment_ref || '.';

    PERFORM public.insert_portal_route_notifications(
      'support',
      v_title,
      v_message,
      'route:/support/claims',
      NEW.id,
      NULL,
      true
    );

    PERFORM public.insert_portal_route_notifications(
      'finance',
      v_title,
      v_message,
      'route:/finance/claims',
      NEW.id,
      NULL,
      false
    );

    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_title := 'Refund request updated';
    v_message := 'Your refund request for ' || v_shipment_ref || ' is now ' || COALESCE(NEW.status, 'submitted') || '.';

    PERFORM public.insert_customer_agent_route_notifications(
      NEW.customer_id,
      v_title,
      v_message,
      'route:/customer/refunds',
      'route:/agent/refunds',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;
