-- Policies to enable customer self-service portal

-- Customers: allow authenticated users to manage their own customer record
CREATE POLICY "Customers can insert their own customer record"
  ON public.customers
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Customers can update their own customer record"
  ON public.customers
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Receivers: allow customers to manage receivers linked to their customer record
CREATE POLICY "Customers can insert their receivers"
  ON public.receivers
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = customer_id
        AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Customers can update their receivers"
  ON public.receivers
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = customer_id
        AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = customer_id
        AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Customers can delete their receivers"
  ON public.receivers
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = customer_id
        AND c.user_id = auth.uid()
    )
  );

-- Shipments: allow customers to create and update their own shipments
CREATE POLICY "Customers can create shipments"
  ON public.shipments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = customer_id
        AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Customers can update their shipments"
  ON public.shipments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = customer_id
        AND c.user_id = auth.uid()
    )
  );

-- Transactions: allow customers to record their own payments
CREATE POLICY "Customers can create transactions"
  ON public.transactions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = customer_id
        AND c.user_id = auth.uid()
    )
  );
