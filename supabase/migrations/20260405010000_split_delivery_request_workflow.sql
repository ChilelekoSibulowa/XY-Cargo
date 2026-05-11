BEGIN;

ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS delivery_request_status text,
  ADD COLUMN IF NOT EXISTS delivery_request_assigned_driver_id uuid REFERENCES public.drivers(id),
  ADD COLUMN IF NOT EXISTS delivery_request_assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_request_completed_at timestamptz;

ALTER TABLE public.consolidations
  ADD COLUMN IF NOT EXISTS delivery_request_status text,
  ADD COLUMN IF NOT EXISTS delivery_request_assigned_driver_id uuid REFERENCES public.drivers(id),
  ADD COLUMN IF NOT EXISTS delivery_request_assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_request_completed_at timestamptz;

ALTER TABLE public.shipments
  DROP CONSTRAINT IF EXISTS shipments_delivery_request_status_check;

ALTER TABLE public.shipments
  ADD CONSTRAINT shipments_delivery_request_status_check
  CHECK (
    delivery_request_status IS NULL
    OR delivery_request_status IN ('requested', 'assigned', 'successful', 'failed')
  );

ALTER TABLE public.consolidations
  DROP CONSTRAINT IF EXISTS consolidations_delivery_request_status_check;

ALTER TABLE public.consolidations
  ADD CONSTRAINT consolidations_delivery_request_status_check
  CHECK (
    delivery_request_status IS NULL
    OR delivery_request_status IN ('requested', 'assigned', 'successful', 'failed')
  );

CREATE INDEX IF NOT EXISTS shipments_delivery_request_status_idx
  ON public.shipments (delivery_request_status);

CREATE INDEX IF NOT EXISTS shipments_delivery_request_assigned_driver_id_idx
  ON public.shipments (delivery_request_assigned_driver_id);

CREATE INDEX IF NOT EXISTS consolidations_delivery_request_status_idx
  ON public.consolidations (delivery_request_status);

CREATE INDEX IF NOT EXISTS consolidations_delivery_request_assigned_driver_id_idx
  ON public.consolidations (delivery_request_assigned_driver_id);

CREATE OR REPLACE FUNCTION public.driver_has_assigned_customer(_customer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.drivers d
    JOIN public.shipments s
      ON s.assigned_driver_id = d.id
      OR s.delivery_request_assigned_driver_id = d.id
    WHERE d.user_id = auth.uid()
      AND s.customer_id = _customer_id
  );
$$;

CREATE OR REPLACE FUNCTION public.driver_has_assigned_receiver(_receiver_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.drivers d
    JOIN public.shipments s
      ON s.assigned_driver_id = d.id
      OR s.delivery_request_assigned_driver_id = d.id
    WHERE d.user_id = auth.uid()
      AND s.receiver_id = _receiver_id
  );
$$;

CREATE OR REPLACE FUNCTION public.driver_has_assigned_shipment(_shipment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.drivers d
    JOIN public.shipments s
      ON s.assigned_driver_id = d.id
      OR s.delivery_request_assigned_driver_id = d.id
    WHERE d.user_id = auth.uid()
      AND s.id = _shipment_id
  );
$$;

CREATE OR REPLACE FUNCTION public.driver_has_assigned_consolidation(_consolidation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.drivers d
    JOIN public.shipments s ON s.delivery_request_assigned_driver_id = d.id
    JOIN public.consolidation_shipments cs ON cs.shipment_id = s.id
    WHERE d.user_id = auth.uid()
      AND cs.consolidation_id = _consolidation_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.driver_has_assigned_customer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_has_assigned_receiver(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_has_assigned_shipment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_has_assigned_consolidation(uuid) TO authenticated;

DROP POLICY IF EXISTS "Drivers can view assigned shipments" ON public.shipments;

CREATE POLICY "Drivers can view assigned shipments"
  ON public.shipments
  FOR SELECT
  TO authenticated
  USING (public.driver_has_assigned_shipment(public.shipments.id));

DROP POLICY IF EXISTS "Drivers can update assigned shipments" ON public.shipments;

CREATE POLICY "Drivers can update assigned shipments"
  ON public.shipments
  FOR UPDATE
  TO authenticated
  USING (public.driver_has_assigned_shipment(public.shipments.id))
  WITH CHECK (public.driver_has_assigned_shipment(public.shipments.id));

DROP POLICY IF EXISTS "Drivers can view assigned consolidations" ON public.consolidations;

CREATE POLICY "Drivers can view assigned consolidations"
  ON public.consolidations
  FOR SELECT
  TO authenticated
  USING (public.driver_has_assigned_consolidation(public.consolidations.id));

DROP POLICY IF EXISTS "Drivers can update assigned consolidations" ON public.consolidations;

CREATE POLICY "Drivers can update assigned consolidations"
  ON public.consolidations
  FOR UPDATE
  TO authenticated
  USING (public.driver_has_assigned_consolidation(public.consolidations.id))
  WITH CHECK (public.driver_has_assigned_consolidation(public.consolidations.id));

CREATE OR REPLACE FUNCTION public.can_manage_driver_workflow(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'driver'::public.app_role);
$$;

CREATE OR REPLACE FUNCTION public.enforce_shipment_workflow_permissions()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_role text := auth.role();
  v_is_customer_owner boolean := false;
  v_is_agent_for_customer boolean := false;
  v_can_warehouse boolean := false;
  v_can_finance boolean := false;
  v_can_driver boolean := false;
BEGIN
  IF v_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.status NOT IN (
    'saved_pickup',
    'saved_dropoff',
    'received',
    'requested_pickup',
    'approved',
    'assigned',
    'supplied',
    'delivered',
    'returned',
    'returned_stock',
    'returned_delivered',
    'closed'
  ) THEN
    RAISE EXCEPTION 'Status % is not part of the approved workflow.', NEW.status;
  END IF;

  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.customers c
    WHERE c.id = NEW.customer_id
      AND c.user_id = v_user_id
  ) INTO v_is_customer_owner;

  SELECT EXISTS (
    SELECT 1
    FROM public.customers c
    WHERE c.id = NEW.customer_id
      AND c.agent_id = v_user_id
  ) INTO v_is_agent_for_customer;

  v_can_warehouse := public.can_manage_warehouse_workflow(v_user_id);
  v_can_finance := public.can_manage_finance_workflow(v_user_id);
  v_can_driver := public.can_manage_driver_workflow(v_user_id);

  IF TG_OP = 'INSERT' THEN
    IF NOT (v_is_customer_owner OR v_is_agent_for_customer OR v_can_warehouse) THEN
      RAISE EXCEPTION 'You do not have permission to create shipments.';
    END IF;

    IF (v_is_customer_owner OR v_is_agent_for_customer) AND NEW.status <> 'saved_pickup' THEN
      RAISE EXCEPTION 'Customers and agents can only create shipments in Created status.';
    END IF;

    IF NEW.payment_status IS NOT NULL
      AND NEW.payment_status <> 'pending'
      AND NOT v_can_finance
    THEN
      RAISE EXCEPTION 'Only finance portal users can set payment status.';
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF v_is_customer_owner OR v_is_agent_for_customer THEN
      IF NOT (
        (OLD.status = 'approved' AND NEW.status = 'assigned')
        OR (OLD.status = 'received' AND NEW.status = 'requested_pickup')
      ) THEN
        RAISE EXCEPTION 'Customers and agents can only submit consolidation (Need Action -> Submitted) or approve shipping (Confirm Shipment -> Outgoing Parcels).';
      END IF;
    ELSIF v_can_warehouse THEN
      IF NOT (
        (OLD.status = 'saved_pickup' AND NEW.status = 'saved_dropoff')
        OR (OLD.status = 'saved_dropoff' AND NEW.status = 'received')
        OR (OLD.status = 'received' AND NEW.status = 'requested_pickup')
        OR (OLD.status = 'requested_pickup' AND NEW.status = 'approved')
        OR (OLD.status = 'approved' AND NEW.status = 'assigned')
        OR (OLD.status = 'assigned' AND NEW.status = 'supplied')
        OR (OLD.status = 'supplied' AND NEW.status = 'delivered')
        OR (OLD.status = 'delivered' AND NEW.status = 'closed')
      ) THEN
        RAISE EXCEPTION 'Warehouse transition % -> % is not allowed.', OLD.status, NEW.status;
      END IF;
    ELSIF v_can_driver THEN
      IF NOT (
        (OLD.status = 'assigned' AND NEW.status = 'delivered')
        OR (OLD.status = 'assigned' AND NEW.status = 'returned')
        OR (OLD.status = 'supplied' AND NEW.status = 'delivered')
        OR (OLD.status = 'supplied' AND NEW.status = 'returned')
      ) THEN
        RAISE EXCEPTION 'Driver transition % -> % is not allowed.', OLD.status, NEW.status;
      END IF;
    ELSE
      RAISE EXCEPTION 'You do not have permission to change shipment movement status.';
    END IF;
  END IF;

  IF (
    NEW.payment_status IS DISTINCT FROM OLD.payment_status
    OR COALESCE(NEW.paid_amount, 0) IS DISTINCT FROM COALESCE(OLD.paid_amount, 0)
  ) AND NOT v_can_finance THEN
    RAISE EXCEPTION 'Only finance portal users can update payment status and paid amount.';
  END IF;

  IF NEW.status = 'closed' AND COALESCE(NEW.payment_status, 'pending') <> 'completed' THEN
    RAISE EXCEPTION 'Shipment cannot be marked Collected before payment is completed.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_consolidation_workflow_permissions()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_role text := auth.role();
  v_old_status text;
  v_new_status text;
  v_is_customer_owner boolean := false;
  v_is_agent_for_customer boolean := false;
  v_can_warehouse boolean := false;
  v_can_finance boolean := false;
  v_can_driver boolean := false;
  v_detail_changed boolean := false;
  v_unpaid_count integer := 0;
  v_allow_detail_bypass boolean :=
    COALESCE(current_setting('app.bypass_consolidation_detail_guard', true), '') = 'on';
BEGIN
  IF v_role = 'service_role' THEN
    NEW.status := public.normalize_consolidation_status_value(NEW.status);
    RETURN NEW;
  END IF;

  v_new_status := public.normalize_consolidation_status_value(NEW.status);
  NEW.status := v_new_status;

  IF v_new_status NOT IN ('submitted', 'confirmed', 'outgoing', 'in_transit', 'arrived', 'collected') THEN
    RAISE EXCEPTION 'Consolidation status % is not part of the approved workflow.', NEW.status;
  END IF;

  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.customers c
    WHERE c.id = NEW.customer_id
      AND c.user_id = v_user_id
  ) INTO v_is_customer_owner;

  SELECT EXISTS (
    SELECT 1
    FROM public.customers c
    WHERE c.id = NEW.customer_id
      AND c.agent_id = v_user_id
  ) INTO v_is_agent_for_customer;

  v_can_warehouse := public.can_manage_warehouse_workflow(v_user_id);
  v_can_finance := public.can_manage_finance_workflow(v_user_id);
  v_can_driver := public.can_manage_driver_workflow(v_user_id);

  IF TG_OP = 'INSERT' THEN
    IF NOT (v_is_customer_owner OR v_is_agent_for_customer OR v_can_warehouse) THEN
      RAISE EXCEPTION 'You do not have permission to create consolidation requests.';
    END IF;

    IF (v_is_customer_owner OR v_is_agent_for_customer) AND v_new_status <> 'submitted' THEN
      RAISE EXCEPTION 'Customers and agents can only create consolidation requests in Submitted status.';
    END IF;

    RETURN NEW;
  END IF;

  v_old_status := public.normalize_consolidation_status_value(OLD.status);

  v_detail_changed := (
    NEW.item_count IS DISTINCT FROM OLD.item_count
    OR NEW.total_weight IS DISTINCT FROM OLD.total_weight
    OR NEW.total_cbm IS DISTINCT FROM OLD.total_cbm
    OR NEW.total_cost IS DISTINCT FROM OLD.total_cost
  );

  IF v_detail_changed AND NOT (v_can_warehouse OR v_allow_detail_bypass) THEN
    RAISE EXCEPTION 'Only warehouse users can update consolidation item count, weight, and cost.';
  END IF;

  IF v_new_status IS DISTINCT FROM v_old_status THEN
    IF v_is_customer_owner OR v_is_agent_for_customer THEN
      IF NOT (v_old_status = 'confirmed' AND v_new_status = 'outgoing') THEN
        RAISE EXCEPTION 'Customers and agents can only move consolidation from Confirm Shipment to Outgoing Parcels.';
      END IF;
    ELSIF v_can_warehouse THEN
      IF NOT (
        (v_old_status = 'submitted' AND v_new_status = 'confirmed')
        OR (v_old_status = 'outgoing' AND v_new_status = 'in_transit')
        OR (v_old_status = 'in_transit' AND v_new_status = 'arrived')
      ) THEN
        RAISE EXCEPTION 'Warehouse consolidation transition % -> % is not allowed.', v_old_status, v_new_status;
      END IF;
    ELSIF v_can_driver THEN
      IF NOT (
        (v_old_status = 'outgoing' AND v_new_status = 'arrived')
        OR (v_old_status = 'in_transit' AND v_new_status = 'arrived')
      ) THEN
        RAISE EXCEPTION 'Driver consolidation transition % -> % is not allowed.', v_old_status, v_new_status;
      END IF;
    ELSIF v_can_finance THEN
      IF NOT (v_old_status = 'arrived' AND v_new_status = 'collected') THEN
        RAISE EXCEPTION 'Finance can only complete collection from Arrived -> Collected.';
      END IF;
    ELSE
      RAISE EXCEPTION 'You do not have permission to update consolidation movement status.';
    END IF;
  END IF;

  IF v_new_status = 'collected' THEN
    SELECT COUNT(*)
    INTO v_unpaid_count
    FROM public.consolidation_shipments cs
    JOIN public.shipments s ON s.id = cs.shipment_id
    WHERE cs.consolidation_id = NEW.id
      AND COALESCE(s.payment_status, 'pending') <> 'completed';

    IF v_unpaid_count > 0 THEN
      RAISE EXCEPTION 'Consolidation cannot be marked Collected before all linked shipments are paid.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

UPDATE public.shipments
SET
  delivery_request_requested_at = COALESCE(delivery_request_requested_at, updated_at, created_at),
  delivery_request_status = CASE
    WHEN status IN ('requested_pickup', 'approved') THEN 'requested'
    WHEN status IN ('assigned', 'supplied') THEN 'assigned'
    WHEN status IN ('returned', 'returned_stock', 'returned_delivered') THEN 'failed'
    WHEN status IN ('delivered', 'closed') THEN COALESCE(delivery_request_status, 'successful')
    ELSE delivery_request_status
  END,
  delivery_request_assigned_driver_id = COALESCE(delivery_request_assigned_driver_id, assigned_driver_id),
  delivery_request_assigned_at = CASE
    WHEN assigned_driver_id IS NOT NULL THEN COALESCE(delivery_request_assigned_at, updated_at, delivery_request_requested_at, created_at)
    ELSE delivery_request_assigned_at
  END,
  delivery_request_completed_at = CASE
    WHEN status IN ('delivered', 'closed') THEN COALESCE(delivery_request_completed_at, actual_delivery_date, updated_at, delivery_request_requested_at, created_at)
    WHEN status IN ('returned', 'returned_stock', 'returned_delivered') THEN COALESCE(delivery_request_completed_at, updated_at, delivery_request_requested_at, created_at)
    ELSE delivery_request_completed_at
  END,
  assigned_driver_id = NULL,
  status = CASE
    WHEN status IN ('requested_pickup', 'approved', 'assigned', 'supplied', 'returned', 'returned_stock', 'returned_delivered', 'closed')
      THEN 'delivered'::public.shipment_status
    ELSE status
  END
WHERE delivery_request_requested_by_role IS NOT NULL;

UPDATE public.consolidations
SET
  delivery_request_requested_at = COALESCE(delivery_request_requested_at, updated_at, created_at),
  delivery_request_status = CASE public.normalize_consolidation_status_value(status)
    WHEN 'submitted' THEN 'requested'
    WHEN 'confirmed' THEN 'requested'
    WHEN 'outgoing' THEN 'assigned'
    WHEN 'in_transit' THEN 'assigned'
    WHEN 'arrived' THEN COALESCE(delivery_request_status, 'successful')
    WHEN 'collected' THEN COALESCE(delivery_request_status, 'successful')
    ELSE delivery_request_status
  END,
  delivery_request_assigned_at = CASE
    WHEN delivery_request_assigned_driver_id IS NOT NULL THEN COALESCE(delivery_request_assigned_at, updated_at, delivery_request_requested_at, created_at)
    ELSE delivery_request_assigned_at
  END,
  delivery_request_completed_at = CASE
    WHEN public.normalize_consolidation_status_value(status) IN ('arrived', 'collected')
      THEN COALESCE(delivery_request_completed_at, updated_at, delivery_request_requested_at, created_at)
    ELSE delivery_request_completed_at
  END,
  status = 'arrived'
WHERE delivery_request_requested_by_role IS NOT NULL;

WITH child_request_context AS (
  SELECT
    cs.consolidation_id,
    MIN(s.delivery_request_requested_at) AS requested_at,
    MIN(s.delivery_request_requested_by_role) FILTER (WHERE s.delivery_request_requested_by_role IS NOT NULL) AS requested_by_role,
    (
      array_agg(
        s.delivery_request_requested_by_user_id
        ORDER BY s.delivery_request_requested_at NULLS LAST, s.created_at NULLS LAST, s.id
      ) FILTER (WHERE s.delivery_request_requested_by_user_id IS NOT NULL)
    )[1] AS requested_by_user_id,
    (
      array_agg(
        s.delivery_request_assigned_driver_id
        ORDER BY s.delivery_request_assigned_at DESC NULLS LAST, s.updated_at DESC NULLS LAST, s.id DESC
      ) FILTER (WHERE s.delivery_request_assigned_driver_id IS NOT NULL)
    )[1] AS assigned_driver_id,
    MIN(s.delivery_request_assigned_at) FILTER (WHERE s.delivery_request_assigned_at IS NOT NULL) AS assigned_at,
    MAX(s.delivery_request_completed_at) FILTER (WHERE s.delivery_request_completed_at IS NOT NULL) AS completed_at,
    CASE
      WHEN BOOL_OR(s.delivery_request_status = 'assigned') THEN 'assigned'
      WHEN BOOL_OR(s.delivery_request_status = 'requested') THEN 'requested'
      WHEN BOOL_OR(s.delivery_request_status = 'failed') THEN 'failed'
      WHEN BOOL_OR(s.delivery_request_status = 'successful') THEN 'successful'
      ELSE NULL
    END AS request_status
  FROM public.consolidation_shipments cs
  JOIN public.shipments s ON s.id = cs.shipment_id
  WHERE s.delivery_request_status IS NOT NULL
  GROUP BY cs.consolidation_id
)
UPDATE public.consolidations c
SET
  delivery_request_requested_at = COALESCE(c.delivery_request_requested_at, crc.requested_at),
  delivery_request_requested_by_role = COALESCE(c.delivery_request_requested_by_role, crc.requested_by_role),
  delivery_request_requested_by_user_id = COALESCE(c.delivery_request_requested_by_user_id, crc.requested_by_user_id),
  delivery_request_status = COALESCE(c.delivery_request_status, crc.request_status),
  delivery_request_assigned_driver_id = COALESCE(c.delivery_request_assigned_driver_id, crc.assigned_driver_id),
  delivery_request_assigned_at = COALESCE(c.delivery_request_assigned_at, crc.assigned_at),
  delivery_request_completed_at = COALESCE(c.delivery_request_completed_at, crc.completed_at),
  status = 'arrived'
FROM child_request_context crc
WHERE c.id = crc.consolidation_id;

COMMIT;
