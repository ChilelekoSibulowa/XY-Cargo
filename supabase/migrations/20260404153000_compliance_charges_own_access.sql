-- Allow authenticated users to read/write their own compliance charges.
-- Keeps existing admin/staff policies intact.
ALTER TABLE public.compliance_charges ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'compliance_charges'
      AND policyname = 'Users can view own compliance charges'
  ) THEN
    CREATE POLICY "Users can view own compliance charges"
    ON public.compliance_charges
    FOR SELECT
    USING (auth.uid() = entered_by_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'compliance_charges'
      AND policyname = 'Users can insert own compliance charges'
  ) THEN
    CREATE POLICY "Users can insert own compliance charges"
    ON public.compliance_charges
    FOR INSERT
    WITH CHECK (auth.uid() = entered_by_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'compliance_charges'
      AND policyname = 'Users can update own compliance charges'
  ) THEN
    CREATE POLICY "Users can update own compliance charges"
    ON public.compliance_charges
    FOR UPDATE
    USING (auth.uid() = entered_by_id)
    WITH CHECK (auth.uid() = entered_by_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'compliance_charges'
      AND policyname = 'Users can delete own compliance charges'
  ) THEN
    CREATE POLICY "Users can delete own compliance charges"
    ON public.compliance_charges
    FOR DELETE
    USING (auth.uid() = entered_by_id);
  END IF;
END
$$;
