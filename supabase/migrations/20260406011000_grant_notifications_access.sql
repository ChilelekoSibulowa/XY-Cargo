BEGIN;

GRANT SELECT, UPDATE ON TABLE public.notifications TO authenticated;

COMMIT;