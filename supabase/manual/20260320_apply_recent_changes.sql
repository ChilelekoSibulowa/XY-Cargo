-- Combined SQL for recent portal, support, CMS, finance, marketing, and notification changes.
-- Paste this file into the Supabase SQL Editor and run it once.


-- ============================================================================
-- 20260311121500_add_marketing_session_duration.sql
-- ============================================================================

ALTER TABLE public.marketing_page_analytics
ADD COLUMN IF NOT EXISTS session_duration INTEGER NOT NULL DEFAULT 0;

-- ============================================================================
-- 20260313103000_finance_expenses_and_card_method.sql
-- ============================================================================

ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'visa_credit_card';

CREATE TABLE IF NOT EXISTS public.finance_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expense_type TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  approved_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS finance_expenses_code_key
  ON public.finance_expenses(code);

CREATE INDEX IF NOT EXISTS finance_expenses_expense_date_idx
  ON public.finance_expenses(expense_date DESC);

CREATE INDEX IF NOT EXISTS finance_expenses_type_idx
  ON public.finance_expenses(expense_type, expense_date DESC);

ALTER TABLE public.finance_expenses ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'finance_expenses'
      AND policyname = 'Admin/Staff can manage finance expenses'
  ) THEN
    CREATE POLICY "Admin/Staff can manage finance expenses"
      ON public.finance_expenses
      FOR ALL
      USING (public.is_admin_or_staff(auth.uid()))
      WITH CHECK (public.is_admin_or_staff(auth.uid()));
  END IF;
END
$$;

DROP TRIGGER IF EXISTS update_finance_expenses_updated_at ON public.finance_expenses;
CREATE TRIGGER update_finance_expenses_updated_at
  BEFORE UPDATE ON public.finance_expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 20260320121500_finance_agent_invoice_and_rate_policies.sql
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'shipping_rates'
      AND policyname = 'Admin can manage rates'
  ) THEN
    DROP POLICY "Admin can manage rates" ON public.shipping_rates;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'shipping_rates'
      AND policyname = 'Admin/Staff can manage rates'
  ) THEN
    CREATE POLICY "Admin/Staff can manage rates"
      ON public.shipping_rates
      FOR ALL
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
      AND tablename = 'invoices'
      AND policyname = 'Agents can view invoices for their customers'
  ) THEN
    CREATE POLICY "Agents can view invoices for their customers"
      ON public.invoices
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.customers c
          WHERE c.id = invoices.customer_id
            AND c.agent_id = auth.uid()
        )
      );
  END IF;
END
$$;

-- ============================================================================
-- 20260320170000_support_ticket_conversations.sql
-- ============================================================================

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

-- ============================================================================
-- 20260320193000_marketing_cms_access.sql
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cms_pages'
      AND policyname = 'Marketing staff can manage marketing cms pages'
  ) THEN
    CREATE POLICY "Marketing staff can manage marketing cms pages"
      ON public.cms_pages
      FOR ALL
      TO authenticated
      USING (
        slug IN ('blog', 'podcast', 'gallery')
        AND EXISTS (
          SELECT 1
          FROM public.staff_portal_assignments spa
          WHERE spa.user_id = auth.uid()
            AND spa.portal_id = 'marketing'
        )
      )
      WITH CHECK (
        slug IN ('blog', 'podcast', 'gallery')
        AND EXISTS (
          SELECT 1
          FROM public.staff_portal_assignments spa
          WHERE spa.user_id = auth.uid()
            AND spa.portal_id = 'marketing'
        )
      );
  END IF;
END
$$;

-- ============================================================================
-- 20260320211500_notification_workflow_coverage.sql
-- ============================================================================

-- Expand cross-portal notifications and keep bell payloads actionable

CREATE OR REPLACE FUNCTION public.insert_route_notification(
  _user_id uuid,
  _title text,
  _message text,
  _route text,
  _reference_id uuid DEFAULT NULL,
  _exclude_user_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _user_id IS NULL
     OR NULLIF(BTRIM(COALESCE(_title, '')), '') IS NULL
     OR NULLIF(BTRIM(COALESCE(_message, '')), '') IS NULL
     OR (_exclude_user_id IS NOT NULL AND _user_id = _exclude_user_id) THEN
    RETURN;
  END IF;

  INSERT INTO public.notifications (user_id, title, message, notification_type, reference_id)
  VALUES (
    _user_id,
    _title,
    _message,
    COALESCE(NULLIF(BTRIM(_route), ''), 'notification'),
    _reference_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.insert_portal_route_notifications(
  _portal_id text,
  _title text,
  _message text,
  _route text,
  _reference_id uuid DEFAULT NULL,
  _exclude_user_id uuid DEFAULT NULL,
  _include_admins boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NULLIF(BTRIM(COALESCE(_title, '')), '') IS NULL
     OR NULLIF(BTRIM(COALESCE(_message, '')), '') IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.notifications (user_id, title, message, notification_type, reference_id)
  SELECT DISTINCT recipients.user_id, _title, _message, COALESCE(NULLIF(BTRIM(_route), ''), 'notification'), _reference_id
  FROM (
    SELECT spa.user_id
    FROM public.staff_portal_assignments spa
    WHERE spa.portal_id = _portal_id

    UNION

    SELECT ur.user_id
    FROM public.user_roles ur
    WHERE _include_admins
      AND ur.role = 'admin'
  ) AS recipients
  WHERE recipients.user_id IS NOT NULL
    AND (_exclude_user_id IS NULL OR recipients.user_id <> _exclude_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.insert_customer_agent_route_notifications(
  _customer_id uuid,
  _title text,
  _message text,
  _customer_route text,
  _agent_route text,
  _reference_id uuid DEFAULT NULL,
  _exclude_user_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_user_id uuid;
  v_agent_user_id uuid;
BEGIN
  SELECT c.user_id, c.agent_id
  INTO v_customer_user_id, v_agent_user_id
  FROM public.customers c
  WHERE c.id = _customer_id;

  PERFORM public.insert_route_notification(
    v_customer_user_id,
    _title,
    _message,
    _customer_route,
    _reference_id,
    _exclude_user_id
  );

  PERFORM public.insert_route_notification(
    v_agent_user_id,
    _title,
    _message,
    _agent_route,
    _reference_id,
    _exclude_user_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.insert_driver_route_notification(
  _driver_id uuid,
  _title text,
  _message text,
  _route text,
  _reference_id uuid DEFAULT NULL,
  _exclude_user_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver_user_id uuid;
BEGIN
  SELECT d.user_id
  INTO v_driver_user_id
  FROM public.drivers d
  WHERE d.id = _driver_id;

  PERFORM public.insert_route_notification(
    v_driver_user_id,
    _title,
    _message,
    _route,
    _reference_id,
    _exclude_user_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_invoice_notification_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text;
  v_message text;
  v_shipment_ref text;
BEGIN
  SELECT COALESCE(NULLIF(BTRIM(s.custom_tracking_number), ''), s.code)
  INTO v_shipment_ref
  FROM public.shipments s
  WHERE s.id = NEW.shipment_id;

  v_shipment_ref := COALESCE(v_shipment_ref, NEW.code);

  IF TG_OP = 'INSERT' THEN
    CASE lower(COALESCE(NEW.status, 'draft'))
      WHEN 'sent' THEN
        v_title := 'New invoice available';
        v_message := 'Invoice ' || NEW.code || ' for shipment ' || v_shipment_ref || ' is ready for payment.';
      WHEN 'approved' THEN
        v_title := 'Invoice approved';
        v_message := 'Invoice ' || NEW.code || ' for shipment ' || v_shipment_ref || ' has been approved.';
      WHEN 'paid' THEN
        v_title := 'Invoice settled';
        v_message := 'Invoice ' || NEW.code || ' for shipment ' || v_shipment_ref || ' is fully paid.';
      ELSE
        RETURN NEW;
    END CASE;
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    CASE lower(COALESCE(NEW.status, 'draft'))
      WHEN 'sent' THEN
        v_title := 'New invoice available';
        v_message := 'Invoice ' || NEW.code || ' for shipment ' || v_shipment_ref || ' is ready for payment.';
      WHEN 'approved' THEN
        v_title := 'Invoice approved';
        v_message := 'Invoice ' || NEW.code || ' for shipment ' || v_shipment_ref || ' has been approved.';
      WHEN 'paid' THEN
        v_title := 'Invoice settled';
        v_message := 'Invoice ' || NEW.code || ' for shipment ' || v_shipment_ref || ' is fully paid.';
      ELSE
        RETURN NEW;
    END CASE;
  ELSIF (
    NEW.amount IS DISTINCT FROM OLD.amount
    OR NEW.due_date IS DISTINCT FROM OLD.due_date
    OR NEW.notes IS DISTINCT FROM OLD.notes
  ) AND lower(COALESCE(NEW.status, 'draft')) IN ('sent', 'approved', 'paid') THEN
    v_title := 'Invoice updated';
    v_message := 'Invoice ' || NEW.code || ' for shipment ' || v_shipment_ref || ' was updated by finance.';
  ELSE
    RETURN NEW;
  END IF;

  PERFORM public.insert_customer_agent_route_notifications(
    NEW.customer_id,
    v_title,
    v_message,
    'route:/customer/payments',
    'route:/agent/payments',
    NEW.id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invoice_notification_events ON public.invoices;
CREATE TRIGGER invoice_notification_events
AFTER INSERT OR UPDATE OF status, amount, due_date, notes ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.notify_invoice_notification_events();

CREATE OR REPLACE FUNCTION public.notify_credit_note_notification_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text;
  v_message text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_title := 'Credit note issued';
    v_message := 'Credit note ' || NEW.code || ' has been issued for your account.';
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    v_title := 'Credit note updated';
    v_message := 'Credit note ' || NEW.code || ' is now marked as ' || COALESCE(NEW.status, 'pending') || '.';
  ELSIF NEW.amount IS DISTINCT FROM OLD.amount OR NEW.reason IS DISTINCT FROM OLD.reason THEN
    v_title := 'Credit note updated';
    v_message := 'Credit note ' || NEW.code || ' has been updated by finance.';
  ELSE
    RETURN NEW;
  END IF;

  PERFORM public.insert_customer_agent_route_notifications(
    NEW.customer_id,
    v_title,
    v_message,
    'route:/customer/payments',
    'route:/agent/payments',
    NEW.id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS credit_note_notification_events ON public.credit_notes;
CREATE TRIGGER credit_note_notification_events
AFTER INSERT OR UPDATE OF status, amount, reason ON public.credit_notes
FOR EACH ROW
EXECUTE FUNCTION public.notify_credit_note_notification_events();

CREATE OR REPLACE FUNCTION public.notify_payment_notification_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text;
  v_message text;
  v_shipment_ref text;
  v_is_manual_entry boolean := COALESCE(NEW.callback_data ->> 'manual_entry', 'false') = 'true';
BEGIN
  IF v_is_manual_entry THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(BTRIM(s.custom_tracking_number), ''), s.code)
  INTO v_shipment_ref
  FROM public.shipments s
  WHERE s.id = NEW.shipment_id;

  v_shipment_ref := COALESCE(v_shipment_ref, NEW.code);

  IF TG_OP = 'INSERT' THEN
    CASE lower(COALESCE(NEW.status, 'pending'))
      WHEN 'pending', 'processing' THEN
        v_title := 'New payment initiated';
        v_message := 'Payment ' || NEW.code || ' for shipment ' || v_shipment_ref || ' needs review.';
      WHEN 'completed' THEN
        v_title := 'Payment completed';
        v_message := 'Payment ' || NEW.code || ' for shipment ' || v_shipment_ref || ' completed successfully.';
      WHEN 'failed' THEN
        v_title := 'Payment failed';
        v_message := 'Payment ' || NEW.code || ' for shipment ' || v_shipment_ref || ' failed.';
      ELSE
        RETURN NEW;
    END CASE;
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    CASE lower(COALESCE(NEW.status, 'pending'))
      WHEN 'completed' THEN
        v_title := 'Payment completed';
        v_message := 'Payment ' || NEW.code || ' for shipment ' || v_shipment_ref || ' completed successfully.';
      WHEN 'failed' THEN
        v_title := 'Payment failed';
        v_message := 'Payment ' || NEW.code || ' for shipment ' || v_shipment_ref || ' failed.';
      ELSE
        RETURN NEW;
    END CASE;
  ELSE
    RETURN NEW;
  END IF;

  PERFORM public.insert_portal_route_notifications(
    'finance',
    v_title,
    v_message,
    'route:/finance/payments',
    NEW.id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payment_notification_events ON public.payments;
CREATE TRIGGER payment_notification_events
AFTER INSERT OR UPDATE OF status, callback_data, provider_reference ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.notify_payment_notification_events();

CREATE OR REPLACE FUNCTION public.notify_customer_claim_notification_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text;
  v_message text;
  v_shipment_ref text := COALESCE(NULLIF(BTRIM(NEW.shipment_code), ''), 'unspecified shipment');
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_title := 'New customer claim';
    v_message := 'A new claim was submitted for ' || v_shipment_ref || '.';

    PERFORM public.insert_portal_route_notifications(
      'support',
      v_title,
      v_message,
      'route:/support/claims',
      NEW.id,
      NULL,
      true
    );

    PERFORM public.insert_portal_route_notifications(
      'finance',
      v_title,
      v_message,
      'route:/finance/claims',
      NEW.id,
      NULL,
      false
    );

    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_title := 'Claim status updated';
    v_message := 'Your claim for ' || v_shipment_ref || ' is now ' || COALESCE(NEW.status, 'submitted') || '.';

    PERFORM public.insert_customer_agent_route_notifications(
      NEW.customer_id,
      v_title,
      v_message,
      'route:/customer/claims',
      'route:/agent/shipments?tab=claim',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS customer_claim_notification_events ON public.customer_claims;
CREATE TRIGGER customer_claim_notification_events
AFTER INSERT OR UPDATE OF status ON public.customer_claims
FOR EACH ROW
EXECUTE FUNCTION public.notify_customer_claim_notification_events();

CREATE OR REPLACE FUNCTION public.notify_agent_shipment_notification_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent_user_id uuid;
  v_customer_name text;
  v_title text;
  v_message text;
  v_route text;
BEGIN
  SELECT c.agent_id, COALESCE(NULLIF(BTRIM(c.full_name), ''), c.code, 'Client')
  INTO v_agent_user_id, v_customer_name
  FROM public.customers c
  WHERE c.id = NEW.customer_id;

  IF v_agent_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    CASE NEW.status
      WHEN 'saved_dropoff' THEN
        v_title := 'Incoming client parcel';
        v_message := 'Parcel ' || NEW.code || ' for ' || v_customer_name || ' is incoming to the warehouse.';
        v_route := 'route:/agent/shipments?tab=incoming';
      WHEN 'received' THEN
        v_title := 'Client parcel needs action';
        v_message := 'Parcel ' || NEW.code || ' for ' || v_customer_name || ' is ready for review.';
        v_route := 'route:/agent/shipments?tab=need_action';
      WHEN 'requested_pickup' THEN
        v_title := 'Client parcel submitted';
        v_message := 'Parcel ' || NEW.code || ' for ' || v_customer_name || ' has been submitted.';
        v_route := 'route:/agent/shipments?tab=submitted';
      WHEN 'approved' THEN
        v_title := 'Client shipment confirmed';
        v_message := 'Shipment ' || NEW.code || ' for ' || v_customer_name || ' is ready to send out.';
        v_route := 'route:/agent/shipments?tab=confirm';
      WHEN 'assigned' THEN
        v_title := 'Client shipment sent out';
        v_message := 'Shipment ' || NEW.code || ' for ' || v_customer_name || ' has left the warehouse.';
        v_route := 'route:/agent/shipments?tab=outgoing';
      WHEN 'supplied' THEN
        v_title := 'Client shipment in transit';
        v_message := 'Shipment ' || NEW.code || ' for ' || v_customer_name || ' is in transit.';
        v_route := 'route:/agent/shipments?tab=in_transit';
      WHEN 'delivered' THEN
        v_title := 'Client shipment arrived';
        v_message := 'Shipment ' || NEW.code || ' for ' || v_customer_name || ' has arrived.';
        v_route := 'route:/agent/shipments?tab=arrived';
      WHEN 'closed' THEN
        v_title := 'Client shipment collected';
        v_message := 'Shipment ' || NEW.code || ' for ' || v_customer_name || ' has been collected.';
        v_route := 'route:/agent/shipments?tab=collected';
      WHEN 'returned' THEN
        v_title := 'Client parcel issue';
        v_message := 'Shipment ' || NEW.code || ' for ' || v_customer_name || ' has a delivery issue.';
        v_route := 'route:/agent/shipments?tab=problem';
      WHEN 'returned_stock' THEN
        v_title := 'Client parcel issue';
        v_message := 'Shipment ' || NEW.code || ' for ' || v_customer_name || ' was returned to stock.';
        v_route := 'route:/agent/shipments?tab=problem';
      WHEN 'returned_delivered' THEN
        v_title := 'Client parcel issue';
        v_message := 'Shipment ' || NEW.code || ' for ' || v_customer_name || ' was returned after delivery.';
        v_route := 'route:/agent/shipments?tab=problem';
      ELSE
        v_title := NULL;
        v_message := NULL;
        v_route := NULL;
    END CASE;

    IF v_title IS NOT NULL THEN
      PERFORM public.insert_route_notification(
        v_agent_user_id,
        v_title,
        v_message,
        v_route,
        NEW.id
      );
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
    CASE lower(COALESCE(NEW.payment_status, 'pending'))
      WHEN 'completed' THEN
        v_title := 'Client payment completed';
        v_message := 'Payment for shipment ' || NEW.code || ' is now complete.';
      WHEN 'partial' THEN
        v_title := 'Client payment partially settled';
        v_message := 'Shipment ' || NEW.code || ' now has a partial payment recorded.';
      WHEN 'failed' THEN
        v_title := 'Client payment failed';
        v_message := 'Payment for shipment ' || NEW.code || ' failed and needs attention.';
      ELSE
        v_title := NULL;
        v_message := NULL;
    END CASE;

    IF v_title IS NOT NULL THEN
      PERFORM public.insert_route_notification(
        v_agent_user_id,
        v_title,
        v_message,
        'route:/agent/payments',
        NEW.id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS agent_shipment_notification_events ON public.shipments;
CREATE TRIGGER agent_shipment_notification_events
AFTER INSERT OR UPDATE OF status, payment_status ON public.shipments
FOR EACH ROW
EXECUTE FUNCTION public.notify_agent_shipment_notification_events();

CREATE OR REPLACE FUNCTION public.notify_driver_shipment_notification_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text;
  v_message text;
BEGIN
  IF NEW.assigned_driver_id IS NOT NULL
     AND (
       TG_OP = 'INSERT'
       OR NEW.assigned_driver_id IS DISTINCT FROM OLD.assigned_driver_id
     ) THEN
    PERFORM public.insert_driver_route_notification(
      NEW.assigned_driver_id,
      'New delivery assigned',
      'Shipment ' || NEW.code || ' has been assigned to you.',
      'route:/driver/deliveries',
      NEW.id
    );
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.assigned_driver_id IS NOT NULL
     AND NEW.status IS DISTINCT FROM OLD.status THEN
    CASE NEW.status
      WHEN 'supplied' THEN
        v_title := 'Delivery in transit';
        v_message := 'Shipment ' || NEW.code || ' is now in transit.';
      WHEN 'delivered' THEN
        v_title := 'Delivery arrived';
        v_message := 'Shipment ' || NEW.code || ' is marked as arrived.';
      WHEN 'closed' THEN
        v_title := 'Delivery closed';
        v_message := 'Shipment ' || NEW.code || ' has been collected and closed.';
      WHEN 'returned' THEN
        v_title := 'Delivery issue';
        v_message := 'Shipment ' || NEW.code || ' has been marked as returned.';
      WHEN 'returned_stock' THEN
        v_title := 'Delivery issue';
        v_message := 'Shipment ' || NEW.code || ' was returned to stock.';
      WHEN 'returned_delivered' THEN
        v_title := 'Delivery issue';
        v_message := 'Shipment ' || NEW.code || ' was returned after delivery.';
      ELSE
        v_title := NULL;
        v_message := NULL;
    END CASE;

    IF v_title IS NOT NULL THEN
      PERFORM public.insert_driver_route_notification(
        NEW.assigned_driver_id,
        v_title,
        v_message,
        'route:/driver/deliveries',
        NEW.id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS driver_shipment_notification_events ON public.shipments;
CREATE TRIGGER driver_shipment_notification_events
AFTER INSERT OR UPDATE OF assigned_driver_id, status ON public.shipments
FOR EACH ROW
EXECUTE FUNCTION public.notify_driver_shipment_notification_events();

-- ============================================================================
-- 20260320233000_workflow_billing_tracking_cleanup.sql
-- ============================================================================

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
