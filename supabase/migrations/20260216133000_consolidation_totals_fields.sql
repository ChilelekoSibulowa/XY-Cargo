-- Consolidation totals: item count, weight, cost + customer notifications for detail updates

ALTER TABLE public.consolidations
ADD COLUMN IF NOT EXISTS item_count INTEGER,
ADD COLUMN IF NOT EXISTS total_weight DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS total_cost DECIMAL(12,2);

WITH consolidation_totals AS (
  SELECT
    cs.consolidation_id,
    COUNT(*)::INTEGER AS item_count,
    COALESCE(SUM(COALESCE(s.weight, 0)), 0)::DECIMAL(12,2) AS total_weight,
    COALESCE(SUM(COALESCE(s.total_cost, s.shipping_cost, 0)), 0)::DECIMAL(12,2) AS total_cost
  FROM public.consolidation_shipments cs
  JOIN public.shipments s ON s.id = cs.shipment_id
  GROUP BY cs.consolidation_id
)
UPDATE public.consolidations c
SET
  item_count = COALESCE(c.item_count, t.item_count),
  total_weight = COALESCE(c.total_weight, t.total_weight),
  total_cost = COALESCE(c.total_cost, t.total_cost)
FROM consolidation_totals t
WHERE c.id = t.consolidation_id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'consolidations_item_count_nonnegative'
  ) THEN
    ALTER TABLE public.consolidations
      ADD CONSTRAINT consolidations_item_count_nonnegative
      CHECK (item_count IS NULL OR item_count >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'consolidations_total_weight_nonnegative'
  ) THEN
    ALTER TABLE public.consolidations
      ADD CONSTRAINT consolidations_total_weight_nonnegative
      CHECK (total_weight IS NULL OR total_weight >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'consolidations_total_cost_nonnegative'
  ) THEN
    ALTER TABLE public.consolidations
      ADD CONSTRAINT consolidations_total_cost_nonnegative
      CHECK (total_cost IS NULL OR total_cost >= 0);
  END IF;
END
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
        'Consolidation submitted',
        'Your consolidation request ' || NEW.code || ' has been submitted to warehouse.',
        'route:/customer/shipments',
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
    v_status := lower(trim(NEW.status));

    IF v_status IN ('pending', 'requested', 'submitted') THEN
      v_title := 'Consolidation submitted';
      v_message := 'Consolidation ' || NEW.code || ' is submitted.';
    ELSIF v_status IN ('processed', 'completed', 'confirmed') THEN
      v_title := 'Consolidation confirmed';
      v_message := 'Consolidation ' || NEW.code || ' is confirmed. You can now ship it.';
    ELSIF v_status IN ('outgoing', 'assigned') THEN
      v_title := 'Consolidation outgoing';
      v_message := 'Consolidation ' || NEW.code || ' is now outgoing.';
    ELSIF v_status IN ('in_transit', 'intransit', 'supplied') THEN
      v_title := 'Consolidation in transit';
      v_message := 'Consolidation ' || NEW.code || ' is in transit.';
    ELSIF v_status IN ('arrived', 'delivered') THEN
      v_title := 'Consolidation arrived';
      v_message := 'Consolidation ' || NEW.code || ' has arrived.';
    ELSIF v_status IN ('collected', 'closed') THEN
      v_title := 'Consolidation collected';
      v_message := 'Consolidation ' || NEW.code || ' has been collected and closed.';
    ELSE
      v_title := NULL;
      v_message := NULL;
    END IF;

    IF v_customer_user_id IS NOT NULL AND v_title IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, notification_type, reference_id)
      VALUES (
        v_customer_user_id,
        v_title,
        v_message,
        'route:/customer/shipments',
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
      'route:/customer/shipments',
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
