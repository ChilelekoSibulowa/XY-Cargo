-- Add a reusable wallet balance field to profiles so agent-owned wallets
-- can be funded and used without changing the shipment workflow.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS wallet_balance numeric(15,2) NOT NULL DEFAULT 0;

UPDATE public.profiles
SET wallet_balance = COALESCE(wallet_balance, 0)
WHERE wallet_balance IS NULL;
