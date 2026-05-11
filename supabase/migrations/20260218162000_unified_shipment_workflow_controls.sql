-- Unified shipment/consolidation workflow, permissions, and tracking behavior

CREATE OR REPLACE FUNCTION public.can_manage_warehouse_workflow(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    public.has_role(_user_id, 'admin'::public.app_role)
    OR public.has_role(_user_id, 'branch_manager'::public.app_role)
    OR (
      public.has_role(_user_id, 'staff'::public.app_role)
      AND public.has_portal_access(_user_id, 'warehouse')
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_finance_workflow(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    public.has_role(_user_id, 'admin'::public.app_role)
    OR (
      public.has_role(_user_id, 'staff'::public.app_role)
      AND public.has_portal_access(_user_id, 'finance')
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.normalize_consolidation_status_value(_status text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN _status IS NULL THEN 'submitted'
    WHEN lower(trim(_status)) IN ('pending', 'requested', 'submitted') THEN 'submitted'
    WHEN lower(trim(_status)) IN ('processed', 'completed', 'confirmed') THEN 'confirmed'
    WHEN lower(trim(_status)) IN ('assigned', 'outgoing') THEN 'outgoing'
    WHEN lower(trim(_status)) IN ('in_transit', 'intransit', 'supplied') THEN 'in_transit'
    WHEN lower(trim(_status)) IN ('arrived', 'delivered') THEN 'arrived'
    WHEN lower(trim(_status)) IN ('collected', 'closed') THEN 'collected'
    ELSE lower(trim(_status))
  END;
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

DROP TRIGGER IF EXISTS shipments_workflow_guard ON public.shipments;

CREATE TRIGGER shipments_workflow_guard
BEFORE INSERT OR UPDATE OF status, payment_status, paid_amount ON public.shipments
FOR EACH ROW
EXECUTE FUNCTION public.enforce_shipment_workflow_permissions();

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
  v_detail_changed boolean := false;
  v_unpaid_count integer := 0;
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
    OR NEW.total_cost IS DISTINCT FROM OLD.total_cost
  );

  IF v_detail_changed AND NOT v_can_warehouse THEN
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
        OR (v_old_status = 'arrived' AND v_new_status = 'collected')
      ) THEN
        RAISE EXCEPTION 'Warehouse consolidation transition % -> % is not allowed.', v_old_status, v_new_status;
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

DROP TRIGGER IF EXISTS consolidations_workflow_guard ON public.consolidations;

CREATE TRIGGER consolidations_workflow_guard
BEFORE INSERT OR UPDATE OF status, item_count, total_weight, total_cost ON public.consolidations
FOR EACH ROW
EXECUTE FUNCTION public.enforce_consolidation_workflow_permissions();

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

  IF v_target_status IS NOT NULL THEN
    UPDATE public.shipments s
    SET status = v_target_status
    FROM public.consolidation_shipments cs
    WHERE cs.consolidation_id = NEW.id
      AND s.id = cs.shipment_id
      AND s.status IS DISTINCT FROM v_target_status;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS consolidations_status_sync_shipments ON public.consolidations;

CREATE TRIGGER consolidations_status_sync_shipments
AFTER UPDATE OF status ON public.consolidations
FOR EACH ROW
EXECUTE FUNCTION public.sync_consolidation_shipments_to_status();

CREATE OR REPLACE FUNCTION public.mark_shipment_submitted_on_consolidation_link()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.shipments
  SET status = 'requested_pickup'
  WHERE id = NEW.shipment_id
    AND status = 'received';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS consolidation_link_mark_submitted ON public.consolidation_shipments;

CREATE TRIGGER consolidation_link_mark_submitted
AFTER INSERT ON public.consolidation_shipments
FOR EACH ROW
EXECUTE FUNCTION public.mark_shipment_submitted_on_consolidation_link();

CREATE OR REPLACE FUNCTION public.notify_shipment_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_title text;
  v_message text;
  v_route text;
BEGIN
  SELECT user_id INTO v_user_id
  FROM public.customers
  WHERE id = NEW.customer_id;

  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    CASE NEW.status
      WHEN 'saved_pickup' THEN
        v_title := 'Created';
        v_message := 'Your shipment has been created.';
        v_route := 'route:/customer/shipments?tab=all';
      WHEN 'saved_dropoff' THEN
        v_title := 'Incoming';
        v_message := 'Your parcel is on the way to the warehouse.';
        v_route := 'route:/customer/shipments?tab=incoming';
      WHEN 'received' THEN
        v_title := 'Need Action';
        v_message := 'Parcel arrived at warehouse. Select products to consolidate.';
        v_route := 'route:/customer/shipments?tab=need_action';
      WHEN 'requested_pickup' THEN
        v_title := 'Submitted';
        v_message := 'Your consolidation request was submitted for warehouse processing.';
        v_route := 'route:/customer/shipments?tab=submitted';
      WHEN 'approved' THEN
        v_title := 'Confirm Shipment';
        v_message := 'Weight and cost are ready. Please review and click Ship.';
        v_route := 'route:/customer/shipments?tab=confirm';
      WHEN 'assigned' THEN
        v_title := 'Outgoing Parcels';
        v_message := 'Shipping has started.';
        v_route := 'route:/customer/shipments?tab=outgoing';
      WHEN 'supplied' THEN
        v_title := 'In Transit';
        v_message := 'Your shipment is in transit.';
        v_route := 'route:/customer/shipments?tab=intransit';
      WHEN 'delivered' THEN
        v_title := 'Arrived';
        v_message := 'Your shipment has arrived.';
        v_route := 'route:/customer/shipments?tab=arrived';
      WHEN 'closed' THEN
        v_title := 'Collected';
        v_message := 'Collection confirmed.';
        v_route := 'route:/customer/shipments?tab=collected';
      ELSE
        v_title := NULL;
        v_message := NULL;
        v_route := NULL;
    END CASE;

    IF v_title IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, notification_type, reference_id)
      VALUES (v_user_id, v_title, v_message, COALESCE(v_route, 'shipment'), NEW.id);
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
    IF NEW.payment_status = 'completed' THEN
      INSERT INTO public.notifications (user_id, title, message, notification_type, reference_id)
      VALUES (
        v_user_id,
        'Payment received',
        'Payment completed for shipment ' || NEW.code || '.',
        'route:/customer/payments',
        NEW.id
      );
    ELSIF NEW.payment_status = 'failed' THEN
      INSERT INTO public.notifications (user_id, title, message, notification_type, reference_id)
      VALUES (
        v_user_id,
        'Payment failed',
        'Payment failed for shipment ' || NEW.code || '. Please retry.',
        'route:/customer/payments',
        NEW.id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shipment_status_notify ON public.shipments;

CREATE TRIGGER shipment_status_notify
AFTER INSERT OR UPDATE OF status, payment_status ON public.shipments
FOR EACH ROW
EXECUTE FUNCTION public.notify_shipment_status_change();

CREATE OR REPLACE FUNCTION public.notify_consolidation_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_user_id uuid;
  v_status text;
  v_title text;
  v_message text;
  v_route text;
  v_staff_user_id uuid;
BEGIN
  SELECT c.user_id INTO v_customer_user_id
  FROM public.customers c
  WHERE c.id = NEW.customer_id;

  IF TG_OP = 'INSERT' THEN
    IF v_customer_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, notification_type, reference_id)
      VALUES (
        v_customer_user_id,
        'Submitted',
        'Your consolidation request ' || NEW.code || ' has been submitted to warehouse.',
        'route:/customer/shipments?tab=submitted',
        NEW.id
      );
    END IF;

    FOR v_staff_user_id IN
      SELECT DISTINCT ur.user_id
      FROM public.user_roles ur
      WHERE ur.role IN ('admin', 'staff', 'branch_manager')
    LOOP
      INSERT INTO public.notifications (user_id, title, message, notification_type, reference_id)
      VALUES (
        v_staff_user_id,
        'New consolidation request',
        'A customer submitted consolidation request ' || NEW.code || '.',
        'route:/warehouse/consolidation',
        NEW.id
      );
    END LOOP;

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    v_status := public.normalize_consolidation_status_value(NEW.status);

    IF v_status = 'submitted' THEN
      v_title := 'Submitted';
      v_message := 'Consolidation ' || NEW.code || ' is submitted.';
      v_route := 'route:/customer/shipments?tab=submitted';
    ELSIF v_status = 'confirmed' THEN
      v_title := 'Confirm Shipment';
      v_message := 'Consolidation ' || NEW.code || ' is ready for your shipping approval.';
      v_route := 'route:/customer/shipments?tab=confirm';
    ELSIF v_status = 'outgoing' THEN
      v_title := 'Outgoing Parcels';
      v_message := 'Consolidation ' || NEW.code || ' is now outgoing.';
      v_route := 'route:/customer/shipments?tab=outgoing';
    ELSIF v_status = 'in_transit' THEN
      v_title := 'In Transit';
      v_message := 'Consolidation ' || NEW.code || ' is in transit.';
      v_route := 'route:/customer/shipments?tab=intransit';
    ELSIF v_status = 'arrived' THEN
      v_title := 'Arrived';
      v_message := 'Consolidation ' || NEW.code || ' has arrived.';
      v_route := 'route:/customer/shipments?tab=arrived';
    ELSIF v_status = 'collected' THEN
      v_title := 'Collected';
      v_message := 'Consolidation ' || NEW.code || ' has been collected.';
      v_route := 'route:/customer/shipments?tab=collected';
    ELSE
      v_title := NULL;
      v_message := NULL;
      v_route := NULL;
    END IF;

    IF v_customer_user_id IS NOT NULL AND v_title IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, notification_type, reference_id)
      VALUES (
        v_customer_user_id,
        v_title,
        v_message,
        COALESCE(v_route, 'route:/customer/shipments'),
        NEW.id
      );
    END IF;
  END IF;

  IF TG_OP = 'UPDATE'
    AND (
      NEW.item_count IS DISTINCT FROM OLD.item_count
      OR NEW.total_weight IS DISTINCT FROM OLD.total_weight
      OR NEW.total_cost IS DISTINCT FROM OLD.total_cost
    )
    AND NEW.status IS NOT DISTINCT FROM OLD.status
    AND v_customer_user_id IS NOT NULL
  THEN
    INSERT INTO public.notifications (user_id, title, message, notification_type, reference_id)
    VALUES (
      v_customer_user_id,
      'Consolidation details updated',
      'Warehouse updated item count, weight, and cost for consolidation ' || NEW.code || '.',
      'route:/customer/shipments?tab=confirm',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS consolidation_status_notify ON public.consolidations;

CREATE TRIGGER consolidation_status_notify
AFTER INSERT OR UPDATE OF status, item_count, total_weight, total_cost ON public.consolidations
FOR EACH ROW
EXECUTE FUNCTION public.notify_consolidation_status_change();

DROP FUNCTION IF EXISTS public.track_shipment_by_code(text);

CREATE OR REPLACE FUNCTION public.track_shipment_by_code(p_code text)
RETURNS TABLE (
  code text,
  status shipment_status,
  origin text,
  destination text,
  created_at timestamptz,
  pickup_date timestamptz,
  estimated_delivery_date timestamptz,
  actual_delivery_date timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH shipment_match AS (
    SELECT
      s.code,
      s.status,
      COALESCE(ob.city, ob.name) AS origin,
      COALESCE(db.city, db.name) AS destination,
      s.created_at,
      s.pickup_date,
      s.estimated_delivery_date,
      s.actual_delivery_date
    FROM public.shipments s
    LEFT JOIN public.branches ob ON ob.id = s.branch_id
    LEFT JOIN public.branches db ON db.id = s.destination_branch_id
    WHERE s.code ILIKE trim(p_code)
       OR COALESCE(s.custom_tracking_number, '') ILIKE trim(p_code)
  ),
  consolidation_match AS (
    SELECT
      c.code,
      CASE public.normalize_consolidation_status_value(c.status)
        WHEN 'submitted' THEN 'requested_pickup'::shipment_status
        WHEN 'confirmed' THEN 'approved'::shipment_status
        WHEN 'outgoing' THEN 'assigned'::shipment_status
        WHEN 'in_transit' THEN 'supplied'::shipment_status
        WHEN 'arrived' THEN 'delivered'::shipment_status
        WHEN 'collected' THEN 'closed'::shipment_status
        ELSE 'requested_pickup'::shipment_status
      END AS status,
      MIN(COALESCE(ob.city, ob.name)) AS origin,
      MIN(COALESCE(db.city, db.name)) AS destination,
      c.created_at,
      MAX(s.pickup_date) AS pickup_date,
      MAX(s.estimated_delivery_date) AS estimated_delivery_date,
      MAX(s.actual_delivery_date) AS actual_delivery_date
    FROM public.consolidations c
    LEFT JOIN public.consolidation_shipments cs ON cs.consolidation_id = c.id
    LEFT JOIN public.shipments s ON s.id = cs.shipment_id
    LEFT JOIN public.branches ob ON ob.id = s.branch_id
    LEFT JOIN public.branches db ON db.id = s.destination_branch_id
    WHERE c.code ILIKE trim(p_code)
    GROUP BY c.id, c.code, c.status, c.created_at
  ),
  combined AS (
    SELECT * FROM shipment_match
    UNION ALL
    SELECT * FROM consolidation_match
  )
  SELECT
    combined.code,
    combined.status,
    combined.origin,
    combined.destination,
    combined.created_at,
    combined.pickup_date,
    combined.estimated_delivery_date,
    combined.actual_delivery_date
  FROM combined
  ORDER BY combined.created_at DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.track_shipment_by_code(text) TO anon;
GRANT EXECUTE ON FUNCTION public.track_shipment_by_code(text) TO authenticated;
