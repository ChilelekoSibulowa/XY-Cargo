BEGIN;

DROP TABLE IF EXISTS public.push_subscriptions;

DELETE FROM public.api_secrets
WHERE secret_key IN ('VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY');

COMMIT;
