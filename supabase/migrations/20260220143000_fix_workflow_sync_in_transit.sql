-- Fix workflow sync conflicts for outgoing -> in transit and keep status progression reliable.

CREATE OR REPLACE FUNCTION public.enforce_shipment_workflow_permissions()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_role text := auth.role();
  v_is_customer_owner boolean := false;
  v_is_agent boolean := false;
  v_can_warehouse boolean := false;
  v_can_finance boolean := false;
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

  v_is_agent := public.has_role(v_user_id, 'agent'::public.app_role);
  v_can_warehouse := public.can_manage_warehouse_workflow(v_user_id);
  v_can_finance := public.can_manage_finance_workflow(v_user_id);

  IF TG_OP = 'INSERT' THEN
    IF NOT (v_is_customer_owner OR v_is_agent OR v_can_warehouse) THEN
      RAISE EXCEPTION 'You do not have permission to create shipments.';
    END IF;

    IF (v_is_customer_owner OR v_is_agent) AND NEW.status <> 'saved_pickup' THEN
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
    IF v_is_customer_owner THEN
      IF NOT (
        (OLD.status = 'approved' AND NEW.status = 'assigned')
        OR (OLD.status = 'received' AND NEW.status = 'requested_pickup')
      ) THEN
        RAISE EXCEPTION 'Customers can only submit consolidation (Need Action -> Submitted) or approve shipping (Confirm Shipment -> Outgoing Parcels).';
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

CREATE OR REPLACE FUNCTION public.sync_consolidation_shipments_to_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_status text := public.normalize_consolidation_status_value(NEW.status);
  v_target_status public.shipment_status;
BEGIN
  v_target_status := CASE v_status
    WHEN 'submitted' THEN 'requested_pickup'::public.shipment_status
    WHEN 'confirmed' THEN 'approved'::public.shipment_status
    WHEN 'outgoing' THEN 'assigned'::public.shipment_status
    WHEN 'in_transit' THEN 'supplied'::public.shipment_status
    WHEN 'arrived' THEN 'delivered'::public.shipment_status
    WHEN 'collected' THEN 'closed'::public.shipment_status
    ELSE NULL
  END;

  IF v_target_status IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_target_status IN ('requested_pickup', 'approved', 'assigned', 'supplied', 'delivered', 'closed') THEN
    UPDATE public.shipments s
    SET status = 'requested_pickup'
    FROM public.consolidation_shipments cs
    WHERE cs.consolidation_id = NEW.id
      AND s.id = cs.shipment_id
      AND s.status = 'received';
  END IF;

  IF v_target_status IN ('approved', 'assigned', 'supplied', 'delivered', 'closed') THEN
    UPDATE public.shipments s
    SET status = 'approved'
    FROM public.consolidation_shipments cs
    WHERE cs.consolidation_id = NEW.id
      AND s.id = cs.shipment_id
      AND s.status = 'requested_pickup';
  END IF;

  IF v_target_status IN ('assigned', 'supplied', 'delivered', 'closed') THEN
    UPDATE public.shipments s
    SET status = 'assigned'
    FROM public.consolidation_shipments cs
    WHERE cs.consolidation_id = NEW.id
      AND s.id = cs.shipment_id
      AND s.status = 'approved';
  END IF;

  IF v_target_status IN ('supplied', 'delivered', 'closed') THEN
    UPDATE public.shipments s
    SET status = 'supplied'
    FROM public.consolidation_shipments cs
    WHERE cs.consolidation_id = NEW.id
      AND s.id = cs.shipment_id
      AND s.status = 'assigned';
  END IF;

  IF v_target_status IN ('delivered', 'closed') THEN
    UPDATE public.shipments s
    SET status = 'delivered'
    FROM public.consolidation_shipments cs
    WHERE cs.consolidation_id = NEW.id
      AND s.id = cs.shipment_id
      AND s.status = 'supplied';
  END IF;

  IF v_target_status = 'closed' THEN
    UPDATE public.shipments s
    SET status = 'closed'
    FROM public.consolidation_shipments cs
    WHERE cs.consolidation_id = NEW.id
      AND s.id = cs.shipment_id
      AND s.status = 'delivered';
  END IF;

  RETURN NEW;
END;
$$;
