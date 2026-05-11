BEGIN;

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
  v_allow_submitted_removal boolean :=
    COALESCE(current_setting('app.allow_submitted_removal', true), '') = 'on';
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
        OR (
          v_allow_submitted_removal
          AND OLD.status = 'requested_pickup'
          AND NEW.status = 'received'
        )
      ) THEN
        RAISE EXCEPTION 'Customers and agents can only submit consolidation (Need Action -> Submitted), remove submitted items back to Need Action, or approve shipping (Confirm Shipment -> Outgoing Parcels).';
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

CREATE OR REPLACE FUNCTION public.delete_shipment_record_internal(_shipment_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shipment record;
  v_consolidation_id uuid;
  v_invoice_ids uuid[];
BEGIN
  SELECT
    s.id,
    s.code,
    s.custom_tracking_number,
    s.customer_id
  INTO v_shipment
  FROM public.shipments s
  WHERE s.id = _shipment_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  SELECT ARRAY(
    SELECT i.id
    FROM public.invoices i
    WHERE i.shipment_id = _shipment_id
  ) INTO v_invoice_ids;

  IF COALESCE(array_length(v_invoice_ids, 1), 0) > 0 THEN
    DELETE FROM public.credit_notes
    WHERE invoice_id = ANY(v_invoice_ids);
  END IF;

  DELETE FROM public.invoices
  WHERE shipment_id = _shipment_id;

  DELETE FROM public.support_tickets
  WHERE shipment_id = _shipment_id;

  DELETE FROM public.customer_claims
  WHERE customer_id = v_shipment.customer_id
    AND shipment_code IN (
      v_shipment.code,
      COALESCE(v_shipment.custom_tracking_number, v_shipment.code)
    );

  DELETE FROM public.transactions
  WHERE shipment_id = _shipment_id;

  DELETE FROM public.payments
  WHERE shipment_id = _shipment_id;

  DELETE FROM public.notifications
  WHERE reference_id = _shipment_id;

  FOR v_consolidation_id IN
    SELECT DISTINCT cs.consolidation_id
    FROM public.consolidation_shipments cs
    WHERE cs.shipment_id = _shipment_id
  LOOP
    DELETE FROM public.consolidation_shipments
    WHERE consolidation_id = v_consolidation_id
      AND shipment_id = _shipment_id;

    IF EXISTS (
      SELECT 1
      FROM public.consolidation_shipments remaining
      WHERE remaining.consolidation_id = v_consolidation_id
    ) THEN
      PERFORM public.recalculate_consolidation_totals(v_consolidation_id);

      IF to_regprocedure('public.sync_consolidation_delivery_request_state(uuid)') IS NOT NULL THEN
        PERFORM public.sync_consolidation_delivery_request_state(v_consolidation_id);
      END IF;
    ELSE
      DELETE FROM public.notifications
      WHERE reference_id = v_consolidation_id;

      DELETE FROM public.consolidations
      WHERE id = v_consolidation_id;
    END IF;
  END LOOP;

  DELETE FROM public.shipments
  WHERE id = _shipment_id;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_submitted_shipment(p_shipment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_customer_id uuid;
  v_consolidation_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT s.customer_id
  INTO v_customer_id
  FROM public.shipments s
  JOIN public.customers c ON c.id = s.customer_id
  WHERE s.id = p_shipment_id
    AND s.status = 'requested_pickup'
    AND (
      c.user_id = v_user_id
      OR c.agent_id = v_user_id
    )
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Submitted shipment not found or access denied.';
  END IF;

  PERFORM set_config('app.allow_submitted_removal', 'on', true);

  FOR v_consolidation_id IN
    SELECT DISTINCT cs.consolidation_id
    FROM public.consolidation_shipments cs
    WHERE cs.shipment_id = p_shipment_id
  LOOP
    DELETE FROM public.consolidation_shipments
    WHERE consolidation_id = v_consolidation_id
      AND shipment_id = p_shipment_id;

    IF EXISTS (
      SELECT 1
      FROM public.consolidation_shipments remaining
      WHERE remaining.consolidation_id = v_consolidation_id
    ) THEN
      PERFORM public.recalculate_consolidation_totals(v_consolidation_id);

      IF to_regprocedure('public.sync_consolidation_delivery_request_state(uuid)') IS NOT NULL THEN
        PERFORM public.sync_consolidation_delivery_request_state(v_consolidation_id);
      END IF;
    ELSE
      DELETE FROM public.notifications
      WHERE reference_id = v_consolidation_id;

      DELETE FROM public.consolidations
      WHERE id = v_consolidation_id;
    END IF;
  END LOOP;

  UPDATE public.shipments s
  SET
    status = 'received'::public.shipment_status,
    notes = (
      SELECT NULLIF(string_agg(cleaned.part, ' | ' ORDER BY cleaned.ord), '')
      FROM (
        SELECT note_parts.ord, note_parts.part
        FROM (
          SELECT raw.ord, btrim(raw.part) AS part
          FROM unnest(string_to_array(COALESCE(s.notes, ''), '|')) WITH ORDINALITY AS raw(part, ord)
        ) AS note_parts
        WHERE note_parts.part <> ''
          AND lower(btrim(split_part(note_parts.part, ':', 1))) <> 'consolidation'
      ) AS cleaned
    )
  WHERE s.id = p_shipment_id
    AND s.customer_id = v_customer_id
    AND s.status = 'requested_pickup';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submitted shipment could not be returned to Need Action.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.replace_consolidation_shipments(
  p_consolidation_id uuid,
  p_shipment_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_customer_id uuid;
  v_consolidation_code text;
  v_can_manage boolean := false;
  v_existing_consolidation_ids uuid[] := ARRAY[]::uuid[];
  v_existing_consolidation_id uuid;
  v_clean_shipment_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF p_consolidation_id IS NULL THEN
    RAISE EXCEPTION 'Consolidation id is required.';
  END IF;

  SELECT ARRAY(
    SELECT DISTINCT shipment_id
    FROM unnest(COALESCE(p_shipment_ids, ARRAY[]::uuid[])) AS shipment_id
    WHERE shipment_id IS NOT NULL
  )
  INTO v_clean_shipment_ids;

  IF COALESCE(array_length(v_clean_shipment_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'At least one shipment is required.';
  END IF;

  SELECT c.customer_id, c.code
  INTO v_customer_id, v_consolidation_code
  FROM public.consolidations c
  WHERE c.id = p_consolidation_id
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Consolidation not found.';
  END IF;

  SELECT
    public.is_admin_or_staff(v_user_id)
    OR public.can_manage_warehouse_workflow(v_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.customers cust
      WHERE cust.id = v_customer_id
        AND cust.user_id = v_user_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.customers cust
      WHERE cust.id = v_customer_id
        AND cust.agent_id = v_user_id
    )
  INTO v_can_manage;

  IF NOT v_can_manage THEN
    RAISE EXCEPTION 'You do not have permission to update this consolidation.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(v_clean_shipment_ids) AS shipment_id
    LEFT JOIN public.shipments s ON s.id = shipment_id
    WHERE s.id IS NULL
  ) THEN
    RAISE EXCEPTION 'One or more shipments do not exist.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.shipments s
    WHERE s.id = ANY(v_clean_shipment_ids)
      AND s.customer_id IS DISTINCT FROM v_customer_id
  ) THEN
    RAISE EXCEPTION 'All shipments must belong to the consolidation customer.';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT cs.consolidation_id), ARRAY[]::uuid[])
  INTO v_existing_consolidation_ids
  FROM public.consolidation_shipments cs
  WHERE cs.shipment_id = ANY(v_clean_shipment_ids)
    AND cs.consolidation_id <> p_consolidation_id;

  DELETE FROM public.consolidation_shipments
  WHERE shipment_id = ANY(v_clean_shipment_ids)
    AND consolidation_id <> p_consolidation_id;

  INSERT INTO public.consolidation_shipments (consolidation_id, shipment_id)
  SELECT p_consolidation_id, shipment_id
  FROM unnest(v_clean_shipment_ids) AS shipment_id
  ON CONFLICT (consolidation_id, shipment_id) DO NOTHING;

  UPDATE public.shipments AS s
  SET
    status = 'requested_pickup'::public.shipment_status,
    notes = CASE
      WHEN v_consolidation_code IS NULL OR btrim(v_consolidation_code) = '' THEN s.notes
      ELSE (
        SELECT string_agg(cleaned.part, ' | ' ORDER BY cleaned.ord)
        FROM (
          SELECT existing.ord, existing.part
          FROM (
            SELECT raw.ord, btrim(raw.part) AS part
            FROM unnest(string_to_array(COALESCE(s.notes, ''), '|')) WITH ORDINALITY AS raw(part, ord)
          ) AS existing
          WHERE existing.part <> ''
            AND lower(btrim(split_part(existing.part, ':', 1))) <> 'consolidation'

          UNION ALL

          SELECT
            COALESCE((
              SELECT max(raw2.ord)
              FROM unnest(string_to_array(COALESCE(s.notes, ''), '|')) WITH ORDINALITY AS raw2(part, ord)
            ), 0) + 1,
            'Consolidation: ' || v_consolidation_code
        ) AS cleaned
      )
    END
  WHERE s.id = ANY(v_clean_shipment_ids)
    AND s.status = 'received';

  PERFORM public.recalculate_consolidation_totals(p_consolidation_id);

  IF to_regprocedure('public.sync_consolidation_delivery_request_state(uuid)') IS NOT NULL THEN
    PERFORM public.sync_consolidation_delivery_request_state(p_consolidation_id);
  END IF;

  FOREACH v_existing_consolidation_id IN ARRAY v_existing_consolidation_ids LOOP
    PERFORM public.recalculate_consolidation_totals(v_existing_consolidation_id);

    IF to_regprocedure('public.sync_consolidation_delivery_request_state(uuid)') IS NOT NULL THEN
      PERFORM public.sync_consolidation_delivery_request_state(v_existing_consolidation_id);
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.replace_consolidation_shipments(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_submitted_shipment(uuid) TO authenticated;

COMMIT;
