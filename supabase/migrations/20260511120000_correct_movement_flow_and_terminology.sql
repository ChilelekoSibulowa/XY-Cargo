-- Correct the shipment movement flow and terminology
-- This migration standardizes terminology (Parcel vs Shipment) and enforces strict consolidation rules.

-- 1. Add handling_method to shipments table for cleaner logic
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'shipments'
        AND COLUMN_NAME = 'handling_method'
    ) THEN
        ALTER TABLE public.shipments ADD COLUMN handling_method TEXT DEFAULT 'single';
    END IF;
END
$$;

-- 2. Backfill handling_method and cleanup invalid states
-- Ensure shipments linked to consolidations are marked as 'consolidated'
UPDATE public.shipments s
SET handling_method = 'consolidated'
FROM public.consolidation_shipments cs
WHERE s.id = cs.shipment_id
  AND (s.handling_method IS DISTINCT FROM 'consolidated' OR s.consolidation_id IS NULL);

-- Backfill from notes
UPDATE public.shipments
SET handling_method = 'consolidated'
WHERE notes ILIKE '%Handling method: consolidated%' 
  AND handling_method IS DISTINCT FROM 'consolidated';

UPDATE public.shipments
SET handling_method = 'single'
WHERE (notes ILIKE '%Handling method: single%' OR handling_method IS NULL) 
  AND consolidation_id IS NULL;

-- Terminology Cleanup: Move orphan consolidated parcels back to Need Action (received)
-- Rule: Unconsolidated parcels with 'consolidated' method cannot stay in Submitted (requested_pickup)
UPDATE public.shipments
SET status = 'received'
WHERE status = 'requested_pickup'
  AND handling_method = 'consolidated'
  AND consolidation_id IS NULL;

-- 3. Update shipment workflow guard to allow skipping Need Action for Single parcels
-- And enforce strict consolidation rules for Consolidated parcels.
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
  v_allow_removal boolean := COALESCE(current_setting('app.allow_submitted_removal', true), '') = 'on';
BEGIN
  -- Service role bypasses all checks
  IF v_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Validate status against allowed workflow statuses
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

  -- If not logged in, we can't check much (usually shouldn't happen via API)
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Identify user roles and ownership
  SELECT EXISTS (
    SELECT 1
    FROM public.customers c
    WHERE c.id = NEW.customer_id
      AND (c.user_id = v_user_id OR c.agent_id = v_user_id)
  ) INTO v_is_customer_owner;

  v_can_warehouse := public.can_manage_warehouse_workflow(v_user_id);
  v_can_finance := public.can_manage_finance_workflow(v_user_id);

  -- 1. Creation rules
  IF TG_OP = 'INSERT' THEN
    IF NOT (v_is_customer_owner OR v_can_warehouse) THEN
      RAISE EXCEPTION 'You do not have permission to create shipments.';
    END IF;

    IF v_is_customer_owner AND NEW.status <> 'saved_pickup' THEN
      RAISE EXCEPTION 'Customers and agents can only create shipments in Created status.';
    END IF;

    RETURN NEW;
  END IF;

  -- 2. Status transition rules
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- Strict Consolidation Rule: Consolidated parcels MUST be in a consolidation before entering Submitted.
    -- Check the junction table because consolidation_id on the shipments row is not always populated.
    IF NEW.status = 'requested_pickup' AND NEW.handling_method = 'consolidated' THEN
      IF NEW.consolidation_id IS NULL AND NOT EXISTS (
        SELECT 1 FROM public.consolidation_shipments WHERE shipment_id = NEW.id
      ) THEN
        RAISE EXCEPTION 'Consolidation parcels must be consolidated before entering the Submitted stage.';
      END IF;
    END IF;

    -- Allow removal bypass (requested_pickup -> received)
    IF v_allow_removal AND OLD.status = 'requested_pickup' AND NEW.status = 'received' THEN
      RETURN NEW;
    END IF;

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
        -- Allow skipping Need Action (received) for single parcels
        OR (OLD.status = 'saved_dropoff' AND NEW.status = 'requested_pickup' AND NEW.handling_method = 'single')
      ) THEN
        RAISE EXCEPTION 'Warehouse transition % -> % is not allowed.', OLD.status, NEW.status;
      END IF;
    ELSIF NOT v_can_finance THEN
      RAISE EXCEPTION 'You do not have permission to change shipment movement status.';
    END IF;
  END IF;

  -- 3. Finance & Payment rules
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

-- 4. Fix remove_submitted_shipment to allow warehouse staff and ensure proper cleanup
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
  v_can_manage boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  -- Find the shipment and its consolidation
  SELECT s.customer_id, s.consolidation_id
  INTO v_customer_id, v_consolidation_id
  FROM public.shipments s
  WHERE s.id = p_shipment_id
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Shipment not found.';
  END IF;

  -- Check permissions: Customer owner, Agent, or Warehouse staff
  SELECT (
    EXISTS (
      SELECT 1 FROM public.customers c 
      WHERE c.id = v_customer_id AND (c.user_id = v_user_id OR c.agent_id = v_user_id)
    )
    OR public.can_manage_warehouse_workflow(v_user_id)
  ) INTO v_can_manage;

  IF NOT v_can_manage THEN
    RAISE EXCEPTION 'Access denied. Only owners, agents, or warehouse staff can remove submitted items.';
  END IF;

  -- Bypass workflow guard for removal
  PERFORM set_config('app.allow_submitted_removal', 'on', true);

  -- Perform removal
  -- 1. Remove from link table
  DELETE FROM public.consolidation_shipments WHERE shipment_id = p_shipment_id;
  
  -- 2. Update shipment record: move back to 'received' (Need Action) and detach
  UPDATE public.shipments s
  SET
    status = 'received'::public.shipment_status,
    consolidation_id = NULL,
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
  WHERE s.id = p_shipment_id;

  -- 3. Recalculate totals for the parent consolidation
  IF v_consolidation_id IS NOT NULL THEN
    PERFORM public.recalculate_consolidation_totals(v_consolidation_id);
  END IF;

  -- Reset bypass
  PERFORM set_config('app.allow_submitted_removal', 'off', true);
END;
$$;

-- 5. Update terminology in notifications
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
  v_type_label text;
BEGIN
  SELECT user_id INTO v_user_id
  FROM public.customers
  WHERE id = NEW.customer_id;

  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Determine Parcel vs Shipment terminology
  -- Terminology Rule: Parcel (Created, Incoming, Need Action) vs Shipment (Submitted onwards)
  v_type_label := CASE 
    WHEN NEW.status IN ('saved_pickup', 'saved_dropoff', 'received') THEN 'parcel'
    ELSE 'shipment'
  END;

  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    CASE NEW.status
      WHEN 'saved_pickup' THEN
        v_title := 'Parcel Created';
        v_message := 'Your parcel ' || NEW.code || ' has been created.';
        v_route := 'route:/customer/shipments?tab=all';
      WHEN 'saved_dropoff' THEN
        v_title := 'Parcel Incoming';
        v_message := 'Your parcel ' || NEW.code || ' is on the way to our warehouse.';
        v_route := 'route:/customer/shipments?tab=incoming';
      WHEN 'received' THEN
        v_title := 'Parcel Arrived (Need Action)';
        v_message := 'Your parcel ' || NEW.code || ' has arrived at the warehouse. Please consolidate it.';
        v_route := 'route:/customer/shipments?tab=need_action';
      WHEN 'requested_pickup' THEN
        v_title := 'Shipment Submitted';
        v_message := 'Your shipment request ' || NEW.code || ' has been submitted.';
        v_route := 'route:/customer/shipments?tab=submitted';
      WHEN 'approved' THEN
        v_title := 'Shipment Confirmed';
        v_message := 'Weight and cost for ' || NEW.code || ' are ready. Please review and ship.';
        v_route := 'route:/customer/shipments?tab=confirm';
      WHEN 'assigned' THEN
        v_title := 'Outgoing Shipment';
        v_message := 'Your shipment ' || NEW.code || ' is being prepared for dispatch.';
        v_route := 'route:/customer/shipments?tab=outgoing';
      WHEN 'supplied' THEN
        v_title := 'Shipment In Transit';
        v_message := 'Your shipment ' || NEW.code || ' is now in transit.';
        v_route := 'route:/customer/shipments?tab=intransit';
      WHEN 'delivered' THEN
        v_title := 'Ready for Collection';
        v_message := 'Your shipment ' || NEW.code || ' is ready for collection.';
        v_route := 'route:/customer/shipments?tab=arrived';
      WHEN 'closed' THEN
        v_title := 'Shipment Collected';
        v_message := 'Collection confirmed for shipment ' || NEW.code || '.';
        v_route := 'route:/customer/shipments?tab=collected';
      ELSE
        v_title := NULL;
    END CASE;

    IF v_title IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, notification_type, reference_id)
      VALUES (v_user_id, v_title, v_message, COALESCE(v_route, 'shipment'), NEW.id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

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
        'Shipment Submitted',
        'Your consolidated shipment ' || NEW.code || ' has been submitted.',
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
        'New Shipment Request',
        'A new consolidated shipment ' || NEW.code || ' was submitted.',
        'route:/warehouse/consolidation',
        NEW.id
      );
    END LOOP;

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    v_status := public.normalize_consolidation_status_value(NEW.status);

    CASE v_status
      WHEN 'submitted' THEN
        v_title := 'Shipment Submitted';
        v_message := 'Consolidated shipment ' || NEW.code || ' is submitted.';
        v_route := 'route:/customer/shipments?tab=submitted';
      WHEN 'confirmed' THEN
        v_title := 'Confirm Shipment';
        v_message := 'Consolidated shipment ' || NEW.code || ' is ready for approval.';
        v_route := 'route:/customer/shipments?tab=confirm';
      WHEN 'outgoing' THEN
        v_title := 'Outgoing Shipment';
        v_message := 'Consolidated shipment ' || NEW.code || ' is now outgoing.';
        v_route := 'route:/customer/shipments?tab=outgoing';
      WHEN 'in_transit' THEN
        v_title := 'Shipment In Transit';
        v_message := 'Consolidated shipment ' || NEW.code || ' is in transit.';
        v_route := 'route:/customer/shipments?tab=intransit';
      WHEN 'arrived' THEN
        v_title := 'Ready for Collection';
        v_message := 'Consolidated shipment ' || NEW.code || ' has arrived.';
        v_route := 'route:/customer/shipments?tab=arrived';
      WHEN 'collected' THEN
        v_title := 'Shipment Collected';
        v_message := 'Consolidated shipment ' || NEW.code || ' has been collected.';
        v_route := 'route:/customer/shipments?tab=collected';
      ELSE
        v_title := NULL;
    END CASE;

    IF v_customer_user_id IS NOT NULL AND v_title IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, notification_type, reference_id)
      VALUES (v_customer_user_id, v_title, v_message, v_route, NEW.id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
