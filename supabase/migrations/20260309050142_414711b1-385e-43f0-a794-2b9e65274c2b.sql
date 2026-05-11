
-- Add escalation columns to support_tickets
ALTER TABLE public.support_tickets 
  ADD COLUMN IF NOT EXISTS escalated_to_department text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS escalated_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS escalated_by uuid DEFAULT NULL;
