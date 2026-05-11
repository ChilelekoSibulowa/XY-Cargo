-- Add company details and MFA flag for customers
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS company_name TEXT,
  ADD COLUMN IF NOT EXISTS company_registration_number TEXT,
  ADD COLUMN IF NOT EXISTS company_email TEXT,
  ADD COLUMN IF NOT EXISTS company_phone TEXT,
  ADD COLUMN IF NOT EXISTS company_address TEXT,
  ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT false;

-- Customer team members
CREATE TABLE IF NOT EXISTS public.customer_team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customer_team_members_customer_idx
  ON public.customer_team_members(customer_id);

ALTER TABLE public.customer_team_members ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'customer_team_members'
      AND policyname = 'Customers can view their team members'
  ) THEN
    CREATE POLICY "Customers can view their team members"
      ON public.customer_team_members
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.customers c
          WHERE c.id = customer_team_members.customer_id
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
      AND tablename = 'customer_team_members'
      AND policyname = 'Customers can manage their team members'
  ) THEN
    CREATE POLICY "Customers can manage their team members"
      ON public.customer_team_members
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.customers c
          WHERE c.id = customer_team_members.customer_id
            AND c.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.customers c
          WHERE c.id = customer_team_members.customer_id
            AND c.user_id = auth.uid()
        )
      );
  END IF;
END
$$;

DROP TRIGGER IF EXISTS update_customer_team_members_updated_at ON public.customer_team_members;

CREATE TRIGGER update_customer_team_members_updated_at
  BEFORE UPDATE ON public.customer_team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
