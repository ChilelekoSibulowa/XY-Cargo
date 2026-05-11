-- Fix submitted-item removal, detailed public tracking, warehouse/admin deletion,
-- and inactive customer cleanup.

CREATE OR REPLACE FUNCTION public.recalculate_consolidation_totals(_consolidation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item_count integer := 0;
  v_total_weight numeric := 0;
  v_total_cbm numeric := 0;
  v_total_cost numeric := 0;
BEGIN
  IF _consolidation_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.consolidation_shipments
    WHERE consolidation_id = _consolidation_id
  ) THEN
    DELETE FROM public.consolidations
    WHERE id = _consolidation_id;
    RETURN;
  END IF;

  SELECT
    COUNT(*)::integer,
    COALESCE(SUM(COALESCE(s.weight, 0)), 0),
    COALESCE(SUM(COALESCE(s.cbm, 0)), 0),
    COALESCE(SUM(COALESCE(s.shipping_cost, 0)), 0)
  INTO
    v_item_count,
    v_total_weight,
    v_total_cbm,
    v_total_cost
  FROM public.consolidation_shipments cs
  JOIN public.shipments s ON s.id = cs.shipment_id
  WHERE cs.consolidation_id = _consolidation_id;

  PERFORM set_config('app.bypass_consolidation_detail_guard', 'on', true);

  UPDATE public.consolidations
  SET
    item_count = v_item_count,
    total_weight = v_total_weight,
    total_cbm = v_total_cbm,
    total_cost = v_total_cost,
    updated_at = now()
  WHERE id = _consolidation_id;
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
    SELECT 1
    FROM public.customers c
    WHERE c.id = NEW.customer_id
      AND c.user_id = v_user_id
  ) INTO v_is_customer_owner;

  v_can_warehouse := public.can_manage_warehouse_workflow(v_user_id);
  v_can_finance := public.can_manage_finance_workflow(v_user_id);

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
    IF v_is_customer_owner THEN
      IF NOT (v_old_status = 'confirmed' AND v_new_status = 'outgoing') THEN
        RAISE EXCEPTION 'Customers can only move consolidation from Confirm Shipment to Outgoing Parcels.';
      END IF;
    ELSIF v_can_warehouse THEN
      IF NOT (
        (v_old_status = 'submitted' AND v_new_status = 'confirmed')
        OR (v_old_status = 'outgoing' AND v_new_status = 'in_transit')
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

  FOR v_consolidation_id IN
    SELECT DISTINCT cs.consolidation_id
    FROM public.consolidation_shipments cs
    WHERE cs.shipment_id = _shipment_id
  LOOP
    DELETE FROM public.consolidation_shipments
    WHERE consolidation_id = v_consolidation_id
      AND shipment_id = _shipment_id;

    PERFORM public.recalculate_consolidation_totals(v_consolidation_id);
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
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT s.customer_id
  INTO v_customer_id
  FROM public.shipments s
  JOIN public.customers c ON c.id = s.customer_id
  WHERE s.id = p_shipment_id
    AND (
      s.status = 'requested_pickup'
      OR s.status = 'received'
    )
    AND (
      c.user_id = v_user_id
      OR c.agent_id = v_user_id
    )
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Submitted shipment not found or access denied.';
  END IF;

  IF NOT public.delete_shipment_record_internal(p_shipment_id) THEN
    RAISE EXCEPTION 'Submitted shipment could not be removed.';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_submitted_shipment(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_shipment_record(_shipment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NOT NULL
     AND NOT public.can_manage_warehouse_workflow(v_user_id) THEN
    RAISE EXCEPTION 'Only admin and warehouse users can delete shipments.';
  END IF;

  IF NOT public.delete_shipment_record_internal(_shipment_id) THEN
    RAISE EXCEPTION 'Shipment not found.';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_shipment_record(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_customer_account(_customer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_customer_user_id uuid;
  v_shipment_id uuid;
BEGIN
  IF v_user_id IS NOT NULL
     AND NOT public.can_manage_warehouse_workflow(v_user_id) THEN
    RAISE EXCEPTION 'Only admin and warehouse users can delete customer accounts.';
  END IF;

  SELECT c.user_id
  INTO v_customer_user_id
  FROM public.customers c
  WHERE c.id = _customer_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found.';
  END IF;

  FOR v_shipment_id IN
    SELECT s.id
    FROM public.shipments s
    WHERE s.customer_id = _customer_id
  LOOP
    PERFORM public.delete_shipment_record_internal(v_shipment_id);
  END LOOP;

  DELETE FROM public.support_tickets
  WHERE customer_id = _customer_id;

  DELETE FROM public.customer_claims
  WHERE customer_id = _customer_id;

  DELETE FROM public.transactions
  WHERE customer_id = _customer_id;

  DELETE FROM public.payments
  WHERE customer_id = _customer_id;

  DELETE FROM public.receivers
  WHERE customer_id = _customer_id;

  DELETE FROM public.customers
  WHERE id = _customer_id;

  IF v_customer_user_id IS NOT NULL THEN
    DELETE FROM auth.users
    WHERE id = v_customer_user_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_customer_account(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.customer_last_activity_at(_customer_id uuid)
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT GREATEST(
    COALESCE(c.updated_at, c.created_at, TIMESTAMPTZ 'epoch'),
    COALESCE((
      SELECT MAX(GREATEST(COALESCE(s.updated_at, s.created_at), s.created_at))
      FROM public.shipments s
      WHERE s.customer_id = c.id
    ), TIMESTAMPTZ 'epoch'),
    COALESCE((
      SELECT MAX(GREATEST(COALESCE(i.updated_at, i.created_at), i.created_at))
      FROM public.invoices i
      WHERE i.customer_id = c.id
    ), TIMESTAMPTZ 'epoch'),
    COALESCE((
      SELECT MAX(GREATEST(COALESCE(cn.updated_at, cn.created_at), cn.created_at))
      FROM public.credit_notes cn
      WHERE cn.customer_id = c.id
    ), TIMESTAMPTZ 'epoch'),
    COALESCE((
      SELECT MAX(GREATEST(COALESCE(p.updated_at, p.created_at), p.created_at))
      FROM public.payments p
      WHERE p.customer_id = c.id
    ), TIMESTAMPTZ 'epoch'),
    COALESCE((
      SELECT MAX(t.created_at)
      FROM public.transactions t
      WHERE t.customer_id = c.id
    ), TIMESTAMPTZ 'epoch'),
    COALESCE((
      SELECT MAX(GREATEST(COALESCE(st.updated_at, st.created_at), st.created_at))
      FROM public.support_tickets st
      WHERE st.customer_id = c.id
    ), TIMESTAMPTZ 'epoch'),
    COALESCE((
      SELECT MAX(GREATEST(COALESCE(cc.updated_at, cc.created_at), cc.created_at))
      FROM public.customer_claims cc
      WHERE cc.customer_id = c.id
    ), TIMESTAMPTZ 'epoch'),
    COALESCE((
      SELECT MAX(GREATEST(COALESCE(sr.updated_at, sr.created_at), sr.created_at))
      FROM public.sourcing_requests sr
      WHERE sr.customer_id = c.id
    ), TIMESTAMPTZ 'epoch'),
    COALESCE((
      SELECT MAX(GREATEST(COALESCE(ctm.updated_at, ctm.created_at), ctm.created_at))
      FROM public.customer_team_members ctm
      WHERE ctm.customer_id = c.id
    ), TIMESTAMPTZ 'epoch'),
    COALESCE((
      SELECT GREATEST(
        COALESCE(u.last_sign_in_at, TIMESTAMPTZ 'epoch'),
        COALESCE(u.created_at, TIMESTAMPTZ 'epoch')
      )
      FROM auth.users u
      WHERE u.id = c.user_id
    ), TIMESTAMPTZ 'epoch')
  )
  FROM public.customers c
  WHERE c.id = _customer_id;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_inactive_customer_accounts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_customer_id uuid;
  v_deleted_count integer := 0;
BEGIN
  FOR v_customer_id IN
    SELECT c.id
    FROM public.customers c
    WHERE public.customer_last_activity_at(c.id) < now() - interval '6 months'
  LOOP
    PERFORM public.delete_customer_account(v_customer_id);
    v_deleted_count := v_deleted_count + 1;
  END LOOP;

  RETURN v_deleted_count;
END;
$$;

UPDATE public.invoices i
SET amount = s.shipping_cost
FROM public.shipments s
WHERE i.shipment_id = s.id
  AND s.shipping_cost IS NOT NULL
  AND i.amount IS DISTINCT FROM s.shipping_cost;

DO $$
DECLARE
  v_job_id bigint;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_namespace
    WHERE nspname = 'cron'
  ) THEN
    SELECT jobid
    INTO v_job_id
    FROM cron.job
    WHERE jobname = 'cleanup_inactive_customer_accounts'
    LIMIT 1;

    IF v_job_id IS NOT NULL THEN
      PERFORM cron.unschedule(v_job_id);
    END IF;

    PERFORM cron.schedule(
      'cleanup_inactive_customer_accounts',
      '0 3 * * *',
      $cron$SELECT public.cleanup_inactive_customer_accounts();$cron$
    );
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_function THEN
    NULL;
END
$$;

CREATE OR REPLACE FUNCTION public.shipment_cbm_from_notes(_notes text)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  WITH extracted AS (
    SELECT NULLIF(BTRIM(SUBSTRING(COALESCE(_notes, '') FROM '(?i)CBM:\\s*([^|]+)')), '') AS value
  )
  SELECT CASE
    WHEN value ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN value::numeric
    ELSE NULL
  END
  FROM extracted;
$$;

CREATE OR REPLACE FUNCTION public.track_shipment_details_by_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lookup text := NULLIF(BTRIM(p_code), '');
  v_result jsonb;
BEGIN
  IF v_lookup IS NULL THEN
    RETURN NULL;
  END IF;

  WITH matched_consolidation AS (
    SELECT DISTINCT c.id
    FROM public.consolidations c
    LEFT JOIN public.consolidation_shipments cs ON cs.consolidation_id = c.id
    LEFT JOIN public.shipments s ON s.id = cs.shipment_id
    WHERE lower(c.code) = lower(v_lookup)
       OR lower(COALESCE(c.tracking_code, '')) = lower(v_lookup)
       OR lower(COALESCE(s.code, '')) = lower(v_lookup)
       OR lower(COALESCE(s.custom_tracking_number, '')) = lower(v_lookup)
    ORDER BY c.id DESC
    LIMIT 1
  )
  SELECT jsonb_build_object(
    'kind', 'consolidation',
    'id', c.id,
    'code', c.code,
    'status', public.normalize_consolidation_status_value(c.status),
    'tracking_number', COALESCE(c.tracking_code, c.code),
    'created_at', c.created_at,
    'pickup_date', summary.pickup_date,
    'estimated_delivery_date', summary.estimated_delivery_date,
    'actual_delivery_date', summary.actual_delivery_date,
    'origin', summary.origin,
    'destination', summary.destination,
    'weight', COALESCE(c.total_weight, summary.total_weight, 0),
    'cbm', COALESCE(c.total_cbm, summary.total_cbm, 0),
    'shipping_fee', COALESCE(c.total_cost, summary.total_shipping_fee, 0),
    'item_value', COALESCE(summary.total_item_value, 0),
    'item_count', COALESCE(c.item_count, summary.item_count, 0),
    'status_message', COALESCE(events.latest_message, 'No transit message available yet.'),
    'events', COALESCE(events.event_rows, '[]'::jsonb),
    'items', COALESCE(summary.items, '[]'::jsonb)
  )
  INTO v_result
  FROM matched_consolidation mc
  JOIN public.consolidations c ON c.id = mc.id
  CROSS JOIN LATERAL (
    SELECT
      COUNT(*)::integer AS item_count,
      MIN(s.pickup_date) AS pickup_date,
      MAX(s.estimated_delivery_date) AS estimated_delivery_date,
      MAX(s.actual_delivery_date) AS actual_delivery_date,
      MAX(COALESCE(ob.city, ob.name)) AS origin,
      MAX(COALESCE(db.city, db.name)) AS destination,
      COALESCE(SUM(COALESCE(s.weight, 0)), 0) AS total_weight,
      COALESCE(SUM(COALESCE(public.shipment_cbm_from_notes(s.notes), s.cbm, 0)), 0) AS total_cbm,
      COALESCE(SUM(COALESCE(s.total_cost, 0)), 0) AS total_item_value,
      COALESCE(SUM(COALESCE(s.shipping_cost, 0)), 0) AS total_shipping_fee,
      jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'code', s.code,
          'tracking_number', COALESCE(s.custom_tracking_number, s.code),
          'description', COALESCE(NULLIF(BTRIM(s.description), ''), s.code),
          'service_type', s.service_type,
          'quantity', COALESCE(s.quantity, 1),
          'weight', COALESCE(s.weight, 0),
          'cbm', COALESCE(public.shipment_cbm_from_notes(s.notes), s.cbm, 0),
          'item_value', COALESCE(s.total_cost, 0),
          'shipping_fee', COALESCE(s.shipping_cost, 0),
          'status', s.status
        )
        ORDER BY s.created_at, s.code
      ) AS items
    FROM public.consolidation_shipments cs
    JOIN public.shipments s ON s.id = cs.shipment_id
    LEFT JOIN public.branches ob ON ob.id = s.branch_id
    LEFT JOIN public.branches db ON db.id = s.destination_branch_id
    WHERE cs.consolidation_id = c.id
  ) summary
  CROSS JOIN LATERAL (
    SELECT
      (
        jsonb_agg(
          jsonb_build_object(
            'title', n.title,
            'message', n.message,
            'created_at', n.created_at
          )
          ORDER BY n.created_at
        )
      ) AS event_rows,
      (
        ARRAY_AGG(n.message ORDER BY n.created_at DESC)
      )[1] AS latest_message
    FROM public.notifications n
    WHERE n.reference_id = c.id
  ) events;

  IF v_result IS NOT NULL THEN
    RETURN v_result;
  END IF;

  WITH matched_shipment AS (
    SELECT s.id
    FROM public.shipments s
    WHERE lower(s.code) = lower(v_lookup)
       OR lower(COALESCE(s.custom_tracking_number, '')) = lower(v_lookup)
    ORDER BY s.created_at DESC
    LIMIT 1
  )
  SELECT jsonb_build_object(
    'kind', 'shipment',
    'id', s.id,
    'code', s.code,
    'status', s.status,
    'tracking_number', COALESCE(s.custom_tracking_number, s.code),
    'created_at', s.created_at,
    'pickup_date', s.pickup_date,
    'estimated_delivery_date', s.estimated_delivery_date,
    'actual_delivery_date', s.actual_delivery_date,
    'origin', COALESCE(ob.city, ob.name),
    'destination', COALESCE(db.city, db.name),
    'weight', COALESCE(s.weight, 0),
    'cbm', COALESCE(public.shipment_cbm_from_notes(s.notes), s.cbm, 0),
    'shipping_fee', COALESCE(s.shipping_cost, 0),
    'item_value', COALESCE(s.total_cost, 0),
    'item_count', COALESCE(s.quantity, 1),
    'status_message', COALESCE(events.latest_message, 'No transit message available yet.'),
    'events', COALESCE(events.event_rows, '[]'::jsonb),
    'items', jsonb_build_array(
      jsonb_build_object(
        'id', s.id,
        'code', s.code,
        'tracking_number', COALESCE(s.custom_tracking_number, s.code),
        'description', COALESCE(NULLIF(BTRIM(s.description), ''), s.code),
        'service_type', s.service_type,
        'quantity', COALESCE(s.quantity, 1),
        'weight', COALESCE(s.weight, 0),
        'cbm', COALESCE(public.shipment_cbm_from_notes(s.notes), s.cbm, 0),
        'item_value', COALESCE(s.total_cost, 0),
        'shipping_fee', COALESCE(s.shipping_cost, 0),
        'status', s.status
      )
    )
  )
  INTO v_result
  FROM matched_shipment ms
  JOIN public.shipments s ON s.id = ms.id
  LEFT JOIN public.branches ob ON ob.id = s.branch_id
  LEFT JOIN public.branches db ON db.id = s.destination_branch_id
  CROSS JOIN LATERAL (
    SELECT
      (
        jsonb_agg(
          jsonb_build_object(
            'title', n.title,
            'message', n.message,
            'created_at', n.created_at
          )
          ORDER BY n.created_at
        )
      ) AS event_rows,
      (
        ARRAY_AGG(n.message ORDER BY n.created_at DESC)
      )[1] AS latest_message
    FROM public.notifications n
    WHERE n.reference_id = s.id
  ) events;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.track_shipment_details_by_code(text) TO anon;
GRANT EXECUTE ON FUNCTION public.track_shipment_details_by_code(text) TO authenticated;
