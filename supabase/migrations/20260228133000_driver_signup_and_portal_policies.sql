-- Extend public signup to support driver accounts and tighten driver portal access.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requested_role public.app_role := 'customer'::public.app_role;
  v_full_name text := COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), NEW.email);
  v_phone text := COALESCE(NULLIF(BTRIM(NEW.raw_user_meta_data->>'phone'), ''), 'Pending');
  v_customer_code text := 'CUST-' || upper(substr(replace(NEW.id::text, '-', ''), 1, 6));
  v_driver_code text := 'DRV-' || upper(substr(replace(NEW.id::text, '-', ''), 1, 6));
BEGIN
  IF COALESCE(NEW.raw_user_meta_data->>'requested_role', '') = 'agent' THEN
    v_requested_role := 'agent'::public.app_role;
  ELSIF COALESCE(NEW.raw_user_meta_data->>'requested_role', '') = 'driver' THEN
    v_requested_role := 'driver'::public.app_role;
  END IF;

  INSERT INTO public.profiles (user_id, full_name, email, phone)
  VALUES (NEW.id, v_full_name, NEW.email, NULLIF(v_phone, 'Pending'))
  ON CONFLICT (user_id) DO UPDATE
  SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    phone = COALESCE(profiles.phone, EXCLUDED.phone);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_requested_role)
  ON CONFLICT DO NOTHING;

  IF v_requested_role = 'customer'::public.app_role THEN
    INSERT INTO public.customers (user_id, code, full_name, email, phone, is_active)
    SELECT NEW.id, v_customer_code, v_full_name, NEW.email, v_phone, true
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.user_id = NEW.id
    );
  ELSIF v_requested_role = 'driver'::public.app_role THEN
    INSERT INTO public.drivers (user_id, code, full_name, email, phone, is_active)
    SELECT NEW.id, v_driver_code, v_full_name, NEW.email, v_phone, true
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.drivers d
      WHERE d.user_id = NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

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
    JOIN public.shipments s ON s.assigned_driver_id = d.id
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
    JOIN public.shipments s ON s.assigned_driver_id = d.id
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
    JOIN public.shipments s ON s.assigned_driver_id = d.id
    WHERE d.user_id = auth.uid()
      AND s.id = _shipment_id
  );
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'drivers'
      AND policyname = 'Drivers can update their own data'
  ) THEN
    CREATE POLICY "Drivers can update their own data"
      ON public.drivers
      FOR UPDATE
      TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'customers'
      AND policyname = 'Drivers can view customers for assigned shipments'
  ) THEN
    CREATE POLICY "Drivers can view customers for assigned shipments"
      ON public.customers
      FOR SELECT
      TO authenticated
      USING (public.driver_has_assigned_customer(customers.id));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'receivers'
      AND policyname = 'Drivers can view receivers for assigned shipments'
  ) THEN
    CREATE POLICY "Drivers can view receivers for assigned shipments"
      ON public.receivers
      FOR SELECT
      TO authenticated
      USING (public.driver_has_assigned_receiver(receivers.id));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'support_tickets'
      AND policyname = 'Drivers can view their support tickets'
  ) THEN
    CREATE POLICY "Drivers can view their support tickets"
      ON public.support_tickets
      FOR SELECT
      TO authenticated
      USING (created_by = auth.uid());
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'support_tickets'
      AND policyname = 'Drivers can create support tickets'
  ) THEN
    CREATE POLICY "Drivers can create support tickets"
      ON public.support_tickets
      FOR INSERT
      TO authenticated
      WITH CHECK (
        created_by = auth.uid()
        AND (
          shipment_id IS NULL
          OR public.driver_has_assigned_shipment(support_tickets.shipment_id)
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
      AND tablename = 'support_tickets'
      AND policyname = 'Drivers can update their support tickets'
  ) THEN
    CREATE POLICY "Drivers can update their support tickets"
      ON public.support_tickets
      FOR UPDATE
      TO authenticated
      USING (created_by = auth.uid())
      WITH CHECK (created_by = auth.uid());
  END IF;
END
$$;

GRANT SELECT, UPDATE ON TABLE public.drivers TO authenticated;
GRANT SELECT ON TABLE public.customers TO authenticated;
GRANT SELECT ON TABLE public.receivers TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.support_tickets TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_has_assigned_customer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_has_assigned_receiver(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_has_assigned_shipment(uuid) TO authenticated;
