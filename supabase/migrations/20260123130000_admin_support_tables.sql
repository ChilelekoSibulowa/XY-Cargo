-- Admin support tables for shipment team and audit logs

CREATE TABLE IF NOT EXISTS public.shipment_team (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role_label TEXT NOT NULL,
  branch_id UUID REFERENCES public.branches(id),
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.shipment_team ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/Staff can manage shipment team"
  ON public.shipment_team
  FOR ALL
  USING (public.is_admin_or_staff(auth.uid()));

CREATE POLICY "Admin/Staff can view audit logs"
  ON public.audit_logs
  FOR SELECT
  USING (public.is_admin_or_staff(auth.uid()));
