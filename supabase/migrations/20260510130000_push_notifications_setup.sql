-- Create push_subscriptions table for Web Push
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'push_subscriptions' AND policyname = 'Users can manage their own subscriptions'
    ) THEN
        CREATE POLICY "Users can manage their own subscriptions" ON public.push_subscriptions
            FOR ALL USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'push_subscriptions' AND policyname = 'Admin/Staff can view subscriptions'
    ) THEN
        CREATE POLICY "Admin/Staff can view subscriptions" ON public.push_subscriptions
            FOR SELECT USING (public.is_admin_or_staff(auth.uid()));
    END IF;
END
$$;

-- Index for faster lookup
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);

-- Insert VAPID keys into api_secrets if not already there
INSERT INTO public.api_secrets (secret_key, secret_value, category, description)
VALUES 
('VAPID_PUBLIC_KEY', 'BE7ZS4Fa4y71f1xrOp_zO9jKC6y-Hmpmf2zCs6vNAeaILDqITR9rCYiahT_dk_IDuZz9iblH_8NcaSbNXcC1If4', 'push', 'Web Push Public Key'),
('VAPID_PRIVATE_KEY', 'S1CjCTfXMThmE1-BnB2D18cGbu3FSrJRBfAnvqs7s0k', 'push', 'Web Push Private Key')
ON CONFLICT (secret_key) DO UPDATE 
SET secret_value = EXCLUDED.secret_value,
    category = EXCLUDED.category,
    description = EXCLUDED.description;

