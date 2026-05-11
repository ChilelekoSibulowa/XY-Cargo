BEGIN;

-- Full operational reset.
-- This clears business records so the system can start fresh again.
-- Preserved intentionally:
-- - auth users
-- - public.profiles
-- - public.user_roles
-- - public.customers
-- - public.drivers
-- - public.staff_portal_assignments
-- - public.shipment_team
-- - public.branches
-- - public.system_settings
-- - public.api_secrets
-- - public.cms_pages
-- - lookup/config tables such as currencies, package types, product types, shipping rates

DO $$
DECLARE
  v_tables text;
BEGIN
  SELECT string_agg(format('%I.%I', schemaname, tablename), ', ' ORDER BY tablename)
  INTO v_tables
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename IN (
      'agent_withdrawal_requests',
      'client_pricing',
      'consolidation_shipments',
      'consolidations',
      'credit_notes',
      'customer_claims',
      'customer_team_members',
      'finance_expenses',
      'inspection_uploads',
      'invoices',
      'manifest_shipments',
      'manifests',
      'marketing_campaigns',
      'marketing_email_sequences',
      'marketing_email_templates',
      'marketing_influencer_collaborations',
      'marketing_leads',
      'marketing_newsletter_subscribers',
      'marketing_page_analytics',
      'marketing_promotions',
      'marketing_social_metrics',
      'marketing_social_posts',
      'mission_shipments',
      'missions',
      'notifications',
      'payments',
      'receivers',
      'shipments',
      'sms_logs',
      'sourcing_quotes',
      'sourcing_request_photos',
      'sourcing_requests',
      'support_agent_presence',
      'support_chat_assignments',
      'support_chat_attachments',
      'support_chat_escalations',
      'support_chat_internal_notes',
      'support_chat_messages',
      'support_chats',
      'support_ticket_messages',
      'support_tickets',
      'transactions'
    );

  IF v_tables IS NOT NULL THEN
    EXECUTE 'TRUNCATE TABLE ' || v_tables || ' RESTART IDENTITY CASCADE';
  END IF;
END
$$;

COMMIT;

-- Verification
SELECT 'shipments' AS table_name, COUNT(*) AS remaining_rows FROM public.shipments
UNION ALL
SELECT 'consolidations', COUNT(*) FROM public.consolidations
UNION ALL
SELECT 'customers', COUNT(*) FROM public.customers
UNION ALL
SELECT 'drivers', COUNT(*) FROM public.drivers
UNION ALL
SELECT 'receivers', COUNT(*) FROM public.receivers
UNION ALL
SELECT 'invoices', COUNT(*) FROM public.invoices
UNION ALL
SELECT 'payments', COUNT(*) FROM public.payments
UNION ALL
SELECT 'transactions', COUNT(*) FROM public.transactions
UNION ALL
SELECT 'finance_expenses', COUNT(*) FROM public.finance_expenses
UNION ALL
SELECT 'support_tickets', COUNT(*) FROM public.support_tickets
UNION ALL
SELECT 'sourcing_requests', COUNT(*) FROM public.sourcing_requests
UNION ALL
SELECT 'marketing_leads', COUNT(*) FROM public.marketing_leads;
