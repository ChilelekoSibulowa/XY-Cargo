CREATE OR REPLACE FUNCTION public.notify_shipment_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_user_id uuid;
  v_customer_name text;
  v_customer_email text;
  v_customer_phone text;
  v_customer_tracking text;
  v_warehouse_tracking text;
  v_transition text;
  v_message text;
  v_is_consolidated boolean;
BEGIN
  SELECT
    c.user_id,
    COALESCE(p.full_name, c.full_name),
    COALESCE(p.email, c.email),
    COALESCE(p.phone, c.phone)
  INTO
    v_customer_user_id, v_customer_name, v_customer_email, v_customer_phone
  FROM public.customers c
  LEFT JOIN public.profiles p ON p.user_id = c.user_id
  WHERE c.id = NEW.customer_id;

  v_customer_name := COALESCE(v_customer_name, 'Customer');
  v_customer_tracking := COALESCE(NEW.custom_tracking_number, NEW.code);
  v_warehouse_tracking := COALESCE(public.extract_note_value(NEW.notes, 'Warehouse Tracking Number'), NEW.code);

  SELECT EXISTS (
    SELECT 1 FROM public.consolidation_shipments WHERE shipment_id = NEW.id
  ) INTO v_is_consolidated;

  v_transition := NULL;

  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status) THEN
    -- IMPORTANT: A brand-new parcel inserted at 'saved_pickup' (Created) must NOT fire the
    -- "on the way to the origin warehouse" message. That message only belongs to the
    -- actual Created -> Incoming transition. The app sends a separate "successfully created"
    -- message for fresh INSERTs at Created.
    IF (TG_OP = 'INSERT' AND NEW.status = 'saved_dropoff')
       OR (TG_OP = 'UPDATE' AND OLD.status = 'saved_pickup' AND NEW.status = 'saved_dropoff') THEN
      v_transition := 'created_to_incoming';
    ELSIF (TG_OP = 'INSERT' AND NEW.status = 'received')
       OR (TG_OP = 'UPDATE' AND OLD.status = 'saved_dropoff' AND NEW.status = 'received' AND NEW.handling_method <> 'single') THEN
      v_transition := 'incoming_to_need_action';
    ELSIF (TG_OP = 'INSERT' AND NEW.status = 'requested_pickup')
       OR (TG_OP = 'UPDATE' AND OLD.status IN ('saved_dropoff', 'received') AND NEW.status = 'requested_pickup' AND NEW.handling_method = 'single') THEN
      v_transition := 'incoming_to_submitted';
    ELSIF (TG_OP = 'INSERT' AND NEW.status = 'approved')
       OR (TG_OP = 'UPDATE' AND OLD.status = 'requested_pickup' AND NEW.status = 'approved') THEN
      v_transition := 'submitted_to_confirm';
    ELSIF (TG_OP = 'INSERT' AND NEW.status = 'assigned')
       OR (TG_OP = 'UPDATE' AND OLD.status = 'approved' AND NEW.status = 'assigned') THEN
      v_transition := 'confirm_to_outgoing';
    ELSIF (TG_OP = 'INSERT' AND NEW.status = 'supplied')
       OR (TG_OP = 'UPDATE' AND OLD.status = 'assigned' AND NEW.status = 'supplied') THEN
      v_transition := 'outgoing_to_transit';
    ELSIF (TG_OP = 'INSERT' AND NEW.status = 'delivered')
       OR (TG_OP = 'UPDATE' AND OLD.status = 'supplied' AND NEW.status = 'delivered') THEN
      v_transition := 'transit_to_ready';
    ELSIF (TG_OP = 'INSERT' AND NEW.status = 'closed')
       OR (TG_OP = 'UPDATE' AND OLD.status = 'delivered' AND NEW.status = 'closed') THEN
      v_transition := 'ready_to_collected';
    END IF;
  END IF;

  IF v_transition IS NOT NULL AND NOT v_is_consolidated THEN
    v_message := public.get_unified_notification_message(
      v_transition,
      v_customer_name,
      CASE
        WHEN v_transition IN ('created_to_incoming', 'incoming_to_need_action', 'incoming_to_submitted') THEN COALESCE(v_customer_tracking, NEW.code)
        ELSE COALESCE(v_warehouse_tracking, NEW.code)
      END
    );

    IF v_message IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, notification_type, reference_id, metadata)
      VALUES (
        v_customer_user_id,
        'Shipment Update',
        v_message,
        'shipment',
        NEW.id,
        jsonb_build_object('email', v_customer_email, 'phone', v_customer_phone, 'channels', jsonb_build_array('sms', 'email', 'push', 'bell'))
      );
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
    IF NEW.payment_status = 'unpaid' AND OLD.status = 'closed' THEN
      v_transition := 'collected_to_unpaid';
    ELSIF NEW.payment_status = 'completed' THEN
      v_transition := 'unpaid_to_paid';
    ELSE
      v_transition := NULL;
    END IF;

    IF v_transition IS NOT NULL THEN
      v_message := public.get_unified_notification_message(v_transition, v_customer_name);
      IF v_message IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, notification_type, reference_id, metadata)
        VALUES (
          v_customer_user_id,
          'Payment Update',
          v_message,
          'payment',
          NEW.id,
          jsonb_build_object('email', v_customer_email, 'phone', v_customer_phone, 'channels', jsonb_build_array('sms', 'email', 'push', 'bell'))
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;