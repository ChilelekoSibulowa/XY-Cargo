-- Customer consolidation workflow permissions + notifications

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'consolidations'
      AND policyname = 'Customers can create their consolidations'
  ) THEN
    CREATE POLICY "Customers can create their consolidations"
      ON public.consolidations
      FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.customers c
          WHERE c.id = consolidations.customer_id
            AND c.user_id = auth.uid()
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
      AND tablename = 'consolidations'
      AND policyname = 'Customers can update their consolidations'
  ) THEN
    CREATE POLICY "Customers can update their consolidations"
      ON public.consolidations
      FOR UPDATE TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.customers c
          WHERE c.id = consolidations.customer_id
            AND c.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.customers c
          WHERE c.id = consolidations.customer_id
            AND c.user_id = auth.uid()
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
      AND tablename = 'consolidation_shipments'
      AND policyname = 'Customers can create consolidation shipments'
  ) THEN
    CREATE POLICY "Customers can create consolidation shipments"
      ON public.consolidation_shipments
      FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.consolidations con
          JOIN public.customers cust ON cust.id = con.customer_id
          JOIN public.shipments s ON s.id = consolidation_shipments.shipment_id
          WHERE con.id = consolidation_shipments.consolidation_id
            AND cust.user_id = auth.uid()
            AND s.customer_id = cust.id
        )
      );
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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS consolidation_status_notify ON public.consolidations;

CREATE TRIGGER consolidation_status_notify
AFTER INSERT OR UPDATE OF status ON public.consolidations
FOR EACH ROW
EXECUTE FUNCTION public.notify_consolidation_status_change();
