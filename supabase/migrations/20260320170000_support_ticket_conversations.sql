-- Support ticket conversations, attachments, and notification routing

CREATE TABLE IF NOT EXISTS public.support_ticket_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_user_id UUID,
  sender_role TEXT NOT NULL DEFAULT 'customer',
  sender_name TEXT,
  message TEXT NOT NULL DEFAULT '',
  attachment_url TEXT,
  attachment_name TEXT,
  attachment_type TEXT,
  is_internal BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT support_ticket_messages_has_content CHECK (
    NULLIF(BTRIM(message), '') IS NOT NULL
    OR attachment_url IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS support_ticket_messages_ticket_idx
  ON public.support_ticket_messages(ticket_id, created_at);

CREATE INDEX IF NOT EXISTS support_ticket_messages_sender_idx
  ON public.support_ticket_messages(sender_user_id, created_at DESC);

ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'support_ticket_messages'
      AND policyname = 'Admin/Staff can manage support ticket messages'
  ) THEN
    CREATE POLICY "Admin/Staff can manage support ticket messages"
      ON public.support_ticket_messages
      FOR ALL
      TO authenticated
      USING (public.is_admin_or_staff(auth.uid()))
      WITH CHECK (public.is_admin_or_staff(auth.uid()));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'support_ticket_messages'
      AND policyname = 'Customers can view messages for their own tickets'
  ) THEN
    CREATE POLICY "Customers can view messages for their own tickets"
      ON public.support_ticket_messages
      FOR SELECT
      TO authenticated
      USING (
        NOT is_internal
        AND EXISTS (
          SELECT 1
          FROM public.support_tickets st
          JOIN public.customers c ON c.id = st.customer_id
          WHERE st.id = support_ticket_messages.ticket_id
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
      AND tablename = 'support_ticket_messages'
      AND policyname = 'Customers can create messages for their own tickets'
  ) THEN
    CREATE POLICY "Customers can create messages for their own tickets"
      ON public.support_ticket_messages
      FOR INSERT
      TO authenticated
      WITH CHECK (
        NOT is_internal
        AND sender_user_id = auth.uid()
        AND EXISTS (
          SELECT 1
          FROM public.support_tickets st
          JOIN public.customers c ON c.id = st.customer_id
          WHERE st.id = support_ticket_messages.ticket_id
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
      AND tablename = 'support_ticket_messages'
      AND policyname = 'Agents can view messages for their customer tickets'
  ) THEN
    CREATE POLICY "Agents can view messages for their customer tickets"
      ON public.support_ticket_messages
      FOR SELECT
      TO authenticated
      USING (
        NOT is_internal
        AND EXISTS (
          SELECT 1
          FROM public.support_tickets st
          LEFT JOIN public.customers c ON c.id = st.customer_id
          WHERE st.id = support_ticket_messages.ticket_id
            AND (
              st.created_by = auth.uid()
              OR c.agent_id = auth.uid()
            )
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
      AND tablename = 'support_ticket_messages'
      AND policyname = 'Agents can create messages for their customer tickets'
  ) THEN
    CREATE POLICY "Agents can create messages for their customer tickets"
      ON public.support_ticket_messages
      FOR INSERT
      TO authenticated
      WITH CHECK (
        NOT is_internal
        AND sender_user_id = auth.uid()
        AND EXISTS (
          SELECT 1
          FROM public.support_tickets st
          LEFT JOIN public.customers c ON c.id = st.customer_id
          WHERE st.id = support_ticket_messages.ticket_id
            AND (
              st.created_by = auth.uid()
              OR c.agent_id = auth.uid()
            )
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
      AND tablename = 'support_ticket_messages'
      AND policyname = 'Drivers can view messages for their own tickets'
  ) THEN
    CREATE POLICY "Drivers can view messages for their own tickets"
      ON public.support_ticket_messages
      FOR SELECT
      TO authenticated
      USING (
        NOT is_internal
        AND EXISTS (
          SELECT 1
          FROM public.support_tickets st
          WHERE st.id = support_ticket_messages.ticket_id
            AND st.created_by = auth.uid()
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
      AND tablename = 'support_ticket_messages'
      AND policyname = 'Drivers can create messages for their own tickets'
  ) THEN
    CREATE POLICY "Drivers can create messages for their own tickets"
      ON public.support_ticket_messages
      FOR INSERT
      TO authenticated
      WITH CHECK (
        NOT is_internal
        AND sender_user_id = auth.uid()
        AND EXISTS (
          SELECT 1
          FROM public.support_tickets st
          WHERE st.id = support_ticket_messages.ticket_id
            AND st.created_by = auth.uid()
        )
      );
  END IF;
END
$$;

GRANT SELECT, INSERT ON TABLE public.support_ticket_messages TO authenticated;

CREATE OR REPLACE FUNCTION public.support_department_portal_id(_department text)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT CASE lower(COALESCE(NULLIF(BTRIM(_department), ''), 'support'))
    WHEN 'support' THEN 'support'
    WHEN 'finance' THEN 'finance'
    WHEN 'warehouse' THEN 'warehouse'
    WHEN 'operations' THEN 'warehouse'
    WHEN 'compliance' THEN 'compliance'
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.insert_support_ticket_department_notifications(
  _ticket_id uuid,
  _department text,
  _title text,
  _message text,
  _exclude_user_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_department text := lower(COALESCE(NULLIF(BTRIM(_department), ''), 'support'));
  v_portal text := public.support_department_portal_id(v_department);
BEGIN
  IF v_department = 'management' THEN
    INSERT INTO public.notifications (user_id, title, message, notification_type, reference_id)
    SELECT DISTINCT ur.user_id, _title, _message, 'support_ticket', _ticket_id
    FROM public.user_roles ur
    WHERE ur.role = 'admin'
      AND (_exclude_user_id IS NULL OR ur.user_id <> _exclude_user_id);
    RETURN;
  END IF;

  INSERT INTO public.notifications (user_id, title, message, notification_type, reference_id)
  SELECT DISTINCT recipients.user_id, _title, _message, 'support_ticket', _ticket_id
  FROM (
    SELECT spa.user_id
    FROM public.staff_portal_assignments spa
    WHERE spa.portal_id = COALESCE(v_portal, 'support')

    UNION

    SELECT ur.user_id
    FROM public.user_roles ur
    WHERE ur.role = 'admin'
  ) recipients
  WHERE recipients.user_id IS NOT NULL
    AND (_exclude_user_id IS NULL OR recipients.user_id <> _exclude_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.insert_support_ticket_requester_notifications(
  _ticket_id uuid,
  _title text,
  _message text,
  _exclude_user_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, message, notification_type, reference_id)
  SELECT DISTINCT recipients.user_id, _title, _message, 'support_ticket', _ticket_id
  FROM (
    SELECT c.user_id
    FROM public.support_tickets st
    JOIN public.customers c ON c.id = st.customer_id
    WHERE st.id = _ticket_id
      AND c.user_id IS NOT NULL

    UNION

    SELECT st.created_by
    FROM public.support_tickets st
    WHERE st.id = _ticket_id
      AND st.created_by IS NOT NULL
      AND NOT public.is_admin_or_staff(st.created_by)
  ) recipients
  WHERE recipients.user_id IS NOT NULL
    AND (_exclude_user_id IS NULL OR recipients.user_id <> _exclude_user_id);
END;
$$;

INSERT INTO public.support_ticket_messages (
  ticket_id,
  sender_user_id,
  sender_role,
  sender_name,
  message,
  is_internal,
  created_at
)
SELECT
  st.id,
  st.created_by,
  COALESCE(
    (
      SELECT ur.role::text
      FROM public.user_roles ur
      WHERE ur.user_id = st.created_by
      ORDER BY CASE ur.role
        WHEN 'customer' THEN 0
        WHEN 'agent' THEN 1
        WHEN 'driver' THEN 2
        WHEN 'staff' THEN 3
        WHEN 'admin' THEN 4
        ELSE 5
      END
      LIMIT 1
    ),
    CASE
      WHEN st.customer_id IS NOT NULL THEN 'customer'
      ELSE 'support'
    END
  ),
  COALESCE(
    (
      SELECT p.full_name
      FROM public.profiles p
      WHERE p.user_id = st.created_by
      LIMIT 1
    ),
    (
      SELECT c.full_name
      FROM public.customers c
      WHERE c.id = st.customer_id
      LIMIT 1
    ),
    'Support'
  ),
  st.description,
  false,
  st.created_at
FROM public.support_tickets st
WHERE NULLIF(BTRIM(st.description), '') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.support_ticket_messages stm
    WHERE stm.ticket_id = st.id
  );

INSERT INTO public.support_ticket_messages (
  ticket_id,
  sender_user_id,
  sender_role,
  sender_name,
  message,
  is_internal,
  created_at
)
SELECT
  st.id,
  st.assigned_to,
  COALESCE(
    (
      SELECT ur.role::text
      FROM public.user_roles ur
      WHERE ur.user_id = st.assigned_to
      ORDER BY CASE ur.role
        WHEN 'staff' THEN 0
        WHEN 'admin' THEN 1
        ELSE 2
      END
      LIMIT 1
    ),
    'staff'
  ),
  COALESCE(
    (
      SELECT p.full_name
      FROM public.profiles p
      WHERE p.user_id = st.assigned_to
      LIMIT 1
    ),
    'Support'
  ),
  st.resolution_notes,
  false,
  COALESCE(st.updated_at, st.created_at)
FROM public.support_tickets st
WHERE NULLIF(BTRIM(st.resolution_notes), '') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.support_ticket_messages stm
    WHERE stm.ticket_id = st.id
      AND stm.message = st.resolution_notes
      AND stm.sender_user_id IS NOT DISTINCT FROM st.assigned_to
  );

CREATE OR REPLACE FUNCTION public.sync_support_ticket_from_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_is_staff boolean := false;
BEGIN
  IF NEW.sender_user_id IS NOT NULL THEN
    v_sender_is_staff := public.is_admin_or_staff(NEW.sender_user_id);
  END IF;

  UPDATE public.support_tickets
  SET
    updated_at = NEW.created_at,
    resolution_notes = CASE
      WHEN NOT NEW.is_internal AND v_sender_is_staff THEN NULLIF(NEW.message, '')
      ELSE resolution_notes
    END,
    status = CASE
      WHEN NEW.is_internal THEN status
      WHEN v_sender_is_staff AND status = 'open' THEN 'in_progress'
      WHEN NOT v_sender_is_staff AND status IN ('resolved', 'closed') THEN 'open'
      ELSE status
    END,
    assigned_to = CASE
      WHEN v_sender_is_staff AND assigned_to IS NULL AND NEW.sender_user_id IS NOT NULL THEN NEW.sender_user_id
      ELSE assigned_to
    END
  WHERE id = NEW.ticket_id;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_support_ticket_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket public.support_tickets%ROWTYPE;
  v_sender_is_staff boolean := false;
  v_department text;
BEGIN
  SELECT *
  INTO v_ticket
  FROM public.support_tickets
  WHERE id = NEW.ticket_id;

  IF NOT FOUND OR NEW.is_internal THEN
    RETURN NEW;
  END IF;

  IF NEW.sender_user_id IS NOT NULL THEN
    v_sender_is_staff := public.is_admin_or_staff(NEW.sender_user_id);
  END IF;

  IF v_sender_is_staff THEN
    PERFORM public.insert_support_ticket_requester_notifications(
      NEW.ticket_id,
      'Support team responded',
      'The support team has responded to ticket ' || v_ticket.ticket_code || '.',
      NEW.sender_user_id
    );
  ELSE
    IF v_ticket.assigned_to IS NOT NULL
       AND (NEW.sender_user_id IS NULL OR v_ticket.assigned_to <> NEW.sender_user_id) THEN
      INSERT INTO public.notifications (user_id, title, message, notification_type, reference_id)
      VALUES (
        v_ticket.assigned_to,
        'Ticket reply received',
        'There is a new reply on ticket ' || v_ticket.ticket_code || '.',
        'support_ticket',
        NEW.ticket_id
      );
    ELSE
      v_department := COALESCE(NULLIF(BTRIM(v_ticket.escalated_to_department), ''), 'support');
      PERFORM public.insert_support_ticket_department_notifications(
        NEW.ticket_id,
        v_department,
        'Ticket reply received',
        'There is a new reply on ticket ' || v_ticket.ticket_code || '.',
        NEW.sender_user_id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_support_ticket_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_department text := COALESCE(NULLIF(BTRIM(NEW.escalated_to_department), ''), 'support');
BEGIN
  PERFORM public.insert_support_ticket_department_notifications(
    NEW.id,
    v_department,
    'New support ticket',
    'Ticket ' || NEW.ticket_code || ' has been created and is waiting for action.',
    NEW.created_by
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_support_ticket_routing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
     AND NEW.assigned_to IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, notification_type, reference_id)
    VALUES (
      NEW.assigned_to,
      'Support ticket assigned',
      'Ticket ' || NEW.ticket_code || ' has been assigned to you.',
      'support_ticket',
      NEW.id
    );
  END IF;

  IF NEW.escalated_to_department IS DISTINCT FROM OLD.escalated_to_department
     AND NEW.escalated_to_department IS NOT NULL THEN
    PERFORM public.insert_support_ticket_department_notifications(
      NEW.id,
      NEW.escalated_to_department,
      'Support ticket routed',
      'Ticket ' || NEW.ticket_code || ' has been routed to the ' || initcap(replace(NEW.escalated_to_department, '_', ' ')) || ' queue.',
      NEW.assigned_to
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_support_ticket_from_message ON public.support_ticket_messages;
CREATE TRIGGER sync_support_ticket_from_message
AFTER INSERT ON public.support_ticket_messages
FOR EACH ROW
EXECUTE FUNCTION public.sync_support_ticket_from_message();

DROP TRIGGER IF EXISTS notify_support_ticket_message ON public.support_ticket_messages;
CREATE TRIGGER notify_support_ticket_message
AFTER INSERT ON public.support_ticket_messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_support_ticket_message();

DROP TRIGGER IF EXISTS notify_support_ticket_created ON public.support_tickets;
CREATE TRIGGER notify_support_ticket_created
AFTER INSERT ON public.support_tickets
FOR EACH ROW
EXECUTE FUNCTION public.notify_support_ticket_created();

DROP TRIGGER IF EXISTS notify_support_ticket_routing ON public.support_tickets;
CREATE TRIGGER notify_support_ticket_routing
AFTER UPDATE OF assigned_to, escalated_to_department ON public.support_tickets
FOR EACH ROW
EXECUTE FUNCTION public.notify_support_ticket_routing();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'support-attachments') THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('support-attachments', 'support-attachments', true);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Support attachments are readable'
  ) THEN
    CREATE POLICY "Support attachments are readable"
      ON storage.objects
      FOR SELECT
      USING (bucket_id = 'support-attachments');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Authenticated users can upload support attachments'
  ) THEN
    CREATE POLICY "Authenticated users can upload support attachments"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'support-attachments');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Owners can update support attachments'
  ) THEN
    CREATE POLICY "Owners can update support attachments"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'support-attachments'
        AND (owner = auth.uid() OR public.is_admin_or_staff(auth.uid()))
      )
      WITH CHECK (
        bucket_id = 'support-attachments'
        AND (owner = auth.uid() OR public.is_admin_or_staff(auth.uid()))
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Owners can delete support attachments'
  ) THEN
    CREATE POLICY "Owners can delete support attachments"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'support-attachments'
        AND (owner = auth.uid() OR public.is_admin_or_staff(auth.uid()))
      );
  END IF;
END
$$;
