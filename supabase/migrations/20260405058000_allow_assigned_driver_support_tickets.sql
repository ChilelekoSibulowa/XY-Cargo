BEGIN;

DROP POLICY IF EXISTS "Drivers can view their support tickets" ON public.support_tickets;
CREATE POLICY "Drivers can view their support tickets"
  ON public.support_tickets
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
    OR assigned_to = auth.uid()
  );

DROP POLICY IF EXISTS "Drivers can update their support tickets" ON public.support_tickets;
CREATE POLICY "Drivers can update their support tickets"
  ON public.support_tickets
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Drivers can view messages for their own tickets" ON public.support_ticket_messages;
CREATE POLICY "Drivers can view messages for their own tickets"
  ON public.support_ticket_messages
  FOR SELECT
  TO authenticated
  USING (
    NOT is_internal
    AND EXISTS (
      SELECT 1
      FROM public.support_tickets st
      WHERE st.id = public.support_ticket_messages.ticket_id
        AND (
          st.created_by = auth.uid()
          OR st.assigned_to = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "Drivers can create messages for their own tickets" ON public.support_ticket_messages;
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
      WHERE st.id = public.support_ticket_messages.ticket_id
        AND (
          st.created_by = auth.uid()
          OR st.assigned_to = auth.uid()
        )
    )
  );

COMMIT;
