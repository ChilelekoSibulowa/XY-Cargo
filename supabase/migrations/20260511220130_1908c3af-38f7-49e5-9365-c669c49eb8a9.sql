-- Customer deduplication + uniqueness migration

-- Helper: list of (table, fk_column) we need to repoint
-- We'll do them inline since DO blocks with EXECUTE work fine

DO $$
DECLARE
  rec RECORD;
  canonical_id UUID;
  dup_id UUID;
  fk_tables TEXT[] := ARRAY[
    'client_pricing','consolidations','credit_notes','customer_claims',
    'customer_team_members','delivery_requests','invoices','payments',
    'receivers','shipments','sourcing_requests','supplier_payment_requests',
    'support_chats','support_tickets','transactions'
  ];
  tbl TEXT;
BEGIN
  -- ============================================================
  -- Pass 1: dedupe by user_id (one customer per auth user)
  -- ============================================================
  FOR rec IN
    SELECT user_id
    FROM public.customers
    WHERE user_id IS NOT NULL
    GROUP BY user_id
    HAVING COUNT(*) > 1
  LOOP
    -- Choose canonical: prefer one with real phone + branch_id, else real phone, else oldest
    SELECT id INTO canonical_id
    FROM public.customers
    WHERE user_id = rec.user_id
    ORDER BY
      (phone IS NOT NULL AND phone <> '' AND phone <> 'Pending' AND branch_id IS NOT NULL) DESC,
      (phone IS NOT NULL AND phone <> '' AND phone <> 'Pending') DESC,
      created_at ASC
    LIMIT 1;

    -- For each duplicate, repoint FKs then delete
    FOR dup_id IN
      SELECT id FROM public.customers
      WHERE user_id = rec.user_id AND id <> canonical_id
    LOOP
      FOREACH tbl IN ARRAY fk_tables LOOP
        EXECUTE format('UPDATE public.%I SET customer_id = %L WHERE customer_id = %L', tbl, canonical_id, dup_id);
      END LOOP;
      DELETE FROM public.customers WHERE id = dup_id;
    END LOOP;
  END LOOP;

  -- ============================================================
  -- Pass 2: dedupe by lower(email) for rows that share an email
  -- (covers cases where the same person had multiple user_ids or NULL user_id)
  -- ============================================================
  FOR rec IN
    SELECT lower(email) AS norm_email
    FROM public.customers
    WHERE email IS NOT NULL AND email <> ''
    GROUP BY lower(email)
    HAVING COUNT(*) > 1
  LOOP
    SELECT id INTO canonical_id
    FROM public.customers
    WHERE lower(email) = rec.norm_email
    ORDER BY
      (user_id IS NOT NULL) DESC,
      (phone IS NOT NULL AND phone <> '' AND phone <> 'Pending' AND branch_id IS NOT NULL) DESC,
      (phone IS NOT NULL AND phone <> '' AND phone <> 'Pending') DESC,
      created_at ASC
    LIMIT 1;

    FOR dup_id IN
      SELECT id FROM public.customers
      WHERE lower(email) = rec.norm_email AND id <> canonical_id
    LOOP
      FOREACH tbl IN ARRAY fk_tables LOOP
        EXECUTE format('UPDATE public.%I SET customer_id = %L WHERE customer_id = %L', tbl, canonical_id, dup_id);
      END LOOP;
      DELETE FROM public.customers WHERE id = dup_id;
    END LOOP;
  END LOOP;
END $$;

-- ============================================================
-- Add uniqueness guards
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS customers_user_id_unique
  ON public.customers (user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS customers_email_unique
  ON public.customers (lower(email))
  WHERE email IS NOT NULL AND email <> '';
