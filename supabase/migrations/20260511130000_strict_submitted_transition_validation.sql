-- Migration: Strict Submitted -> Confirm Shipment Transition Validation
-- Fixes:
--   1. Consolidation check queries junction table (consolidation_shipments), not consolidation_id column.
--   2. Only Shipping Fee is required (Weight and CBM are NOT required).
--   3. Blocks only when status is actually transitioning INTO requested_pickup.

-- 1. Update enforce_shipment_workflow_permissions
CREATE OR REPLACE FUNCTION public.enforce_shipment_workflow_permissions()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_role text := auth.role();
  v_is_customer_owner boolean := false;
  v_can_warehouse boolean := false;
  v_can_finance boolean := false;
  v_allow_removal boolean := COALESCE(current_setting('app.allow_submitted_removal', true), '') = 'on';
BEGIN
  IF v_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.status NOT IN (
    'saved_pickup', 'saved_dropoff', 'received', 'requested_pickup',
    'approved', 'assigned', 'supplied', 'delivered', 'closed'
  ) THEN
    RAISE EXCEPTION 'Status % is not part of the approved workflow.', NEW.status;
  END IF;

  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id = NEW.customer_id
      AND (c.user_id = v_user_id OR c.agent_id = v_user_id)
  ) INTO v_is_customer_owner;

  v_can_warehouse := public.can_manage_warehouse_workflow(v_user_id);
  v_can_finance   := public.can_manage_finance_workflow(v_user_id);

  -- INSERT rules
  IF TG_OP = 'INSERT' THEN
    IF NOT (v_is_customer_owner OR v_can_warehouse) THEN
      RAISE EXCEPTION 'You do not have permission to create shipments.';
    END IF;
    IF v_is_customer_owner AND NEW.status <> 'saved_pickup' THEN
      RAISE EXCEPTION 'Customers and agents can only create shipments in Created status.';
    END IF;
    RETURN NEW;
  END IF;

  -- Status transition rules (only when status actually changes)
  IF NEW.status IS DISTINCT FROM OLD.status THEN

    -- Consolidation guard: block unconsolidated 'consolidated' items entering Submitted.
    -- Checks both column and notes (for legacy data)
    IF NEW.status = 'requested_pickup' AND (
      NEW.handling_method = 'consolidated' 
      OR NEW.handling_method = 'consolidation'
      OR NEW.notes ~* 'Handling method:\s*(consolidated|consolidation)'
    ) THEN
      IF NEW.consolidation_id IS NULL AND NOT EXISTS (
        SELECT 1 FROM public.consolidation_shipments WHERE shipment_id = NEW.id
      ) THEN
        RAISE EXCEPTION 'Consolidation parcels must be consolidated before entering the Submitted stage.';
      END IF;
    END IF;

    -- Submitted -> Confirm Shipment: ONLY Shipping Fee is required (Weight and CBM are optional)
    IF NEW.status = 'approved' AND OLD.status = 'requested_pickup' THEN
      IF NEW.shipping_cost IS NULL OR NEW.shipping_cost <= 0 THEN
        RAISE EXCEPTION 'Shipping Fee is required before moving to Confirm Shipment.';
      END IF;
    END IF;

    -- Allow removal bypass (Submitted -> Need Action)
    IF v_allow_removal AND OLD.status = 'requested_pickup' AND NEW.status = 'received' THEN
      RETURN NEW;
    END IF;

    IF v_is_customer_owner THEN
      IF NOT (
        (OLD.status = 'approved'  AND NEW.status = 'assigned')
        OR (OLD.status = 'received' AND NEW.status = 'requested_pickup')
      ) THEN
        RAISE EXCEPTION 'Customers can only submit (Need Action -> Submitted) or approve shipping (Confirm -> Outgoing).';
      END IF;
    ELSIF v_can_warehouse THEN
      IF NOT (
        (OLD.status = 'saved_pickup'       AND NEW.status = 'saved_dropoff')
        OR (OLD.status = 'saved_dropoff'   AND NEW.status = 'received')
        OR (OLD.status = 'received'        AND NEW.status = 'requested_pickup')
        OR (OLD.status = 'requested_pickup' AND NEW.status = 'approved')
        OR (OLD.status = 'assigned'        AND NEW.status = 'supplied')
        OR (OLD.status = 'supplied'        AND NEW.status = 'delivered')
        OR (OLD.status = 'saved_dropoff'   AND NEW.status = 'requested_pickup' AND (
          COALESCE(NEW.handling_method, 'single') = 'single'
          AND NOT (NEW.notes ~* 'Handling method:\s*(consolidated|consolidation)')
        ))
      ) THEN
        RAISE EXCEPTION 'Warehouse transition % -> % is not allowed.', OLD.status, NEW.status;
      END IF;
    ELSIF NOT v_can_finance THEN
      RAISE EXCEPTION 'You do not have permission to change shipment movement status.';
    END IF;
  END IF;

  -- Finance / Payment rules
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

-- 2. Update enforce_consolidation_workflow_permissions
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
  v_can_warehouse boolean := false;
  v_can_finance boolean := false;
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
    SELECT 1 FROM public.customers c
    WHERE c.id = NEW.customer_id
      AND (c.user_id = v_user_id OR c.agent_id = v_user_id)
  ) INTO v_is_customer_owner;

  v_can_warehouse := public.can_manage_warehouse_workflow(v_user_id);
  v_can_finance   := public.can_manage_finance_workflow(v_user_id);

  IF TG_OP = 'INSERT' THEN
    IF NOT (v_is_customer_owner OR v_can_warehouse) THEN
      RAISE EXCEPTION 'You do not have permission to create consolidation requests.';
    END IF;
    IF v_is_customer_owner AND v_new_status <> 'submitted' THEN
      RAISE EXCEPTION 'Customers can only create consolidation requests in Submitted status.';
    END IF;
    RETURN NEW;
  END IF;

  v_old_status := public.normalize_consolidation_status_value(OLD.status);

  -- Submitted -> Confirmed: ONLY Total Shipping Fee is required (Weight and CBM are optional)
  IF v_new_status = 'confirmed' AND v_old_status = 'submitted' THEN
    IF NEW.total_cost IS NULL OR NEW.total_cost <= 0 THEN
      RAISE EXCEPTION 'Total Shipping Fee is required before moving to Confirm Shipment.';
    END IF;
  END IF;

  v_detail_changed := (
    NEW.item_count   IS DISTINCT FROM OLD.item_count
    OR NEW.total_weight IS DISTINCT FROM OLD.total_weight
    OR NEW.total_cbm    IS DISTINCT FROM OLD.total_cbm
    OR NEW.total_cost   IS DISTINCT FROM OLD.total_cost
  );

  IF v_detail_changed AND NOT (v_can_warehouse OR v_allow_detail_bypass) THEN
    RAISE EXCEPTION 'Only warehouse users can update consolidation details.';
  END IF;

  IF v_new_status IS DISTINCT FROM v_old_status THEN
    IF v_is_customer_owner THEN
      IF NOT (v_old_status = 'confirmed' AND v_new_status = 'outgoing') THEN
        RAISE EXCEPTION 'Customers can only move consolidation from Confirm Shipment to Outgoing Parcels.';
      END IF;
    ELSIF v_can_warehouse THEN
      IF NOT (
        (v_old_status = 'submitted'  AND v_new_status = 'confirmed')
        OR (v_old_status = 'outgoing'  AND v_new_status = 'in_transit')
        OR (v_old_status = 'in_transit' AND v_new_status = 'arrived')
      ) THEN
        RAISE EXCEPTION 'Warehouse consolidation transition % -> % is not allowed.', v_old_status, v_new_status;
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
    SELECT COUNT(*) INTO v_unpaid_count
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
