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
