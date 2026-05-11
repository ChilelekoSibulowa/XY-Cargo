BEGIN;

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
        OR (v_old_status = 'arrived' AND v_new_status = 'collected')
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

COMMIT;
