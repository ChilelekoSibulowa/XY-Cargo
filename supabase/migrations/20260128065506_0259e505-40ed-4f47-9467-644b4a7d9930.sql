-- Create api_secrets table for storing encrypted API keys
CREATE TABLE public.api_secrets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    secret_key text NOT NULL UNIQUE,
    secret_value text NOT NULL,
    description text,
    category text DEFAULT 'general',
    is_active boolean DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.api_secrets ENABLE ROW LEVEL SECURITY;

-- Only admins can manage API secrets
CREATE POLICY "Admin can manage api_secrets"
ON public.api_secrets
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create payments table for tracking payment transactions
CREATE TABLE public.payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL UNIQUE,
    customer_id uuid REFERENCES public.customers(id),
    shipment_id uuid REFERENCES public.shipments(id),
    amount numeric NOT NULL,
    currency text DEFAULT 'ZMW',
    payment_provider text NOT NULL,
    provider_reference text,
    phone_number text,
    status text DEFAULT 'pending',
    callback_data jsonb,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Admin/Staff can manage payments
CREATE POLICY "Admin/Staff can manage payments"
ON public.payments
FOR ALL
USING (is_admin_or_staff(auth.uid()));

-- Customers can view their own payments
CREATE POLICY "Customers can view their payments"
ON public.payments
FOR SELECT
USING (EXISTS (
    SELECT 1 FROM customers c
    WHERE c.id = payments.customer_id AND c.user_id = auth.uid()
));

-- Create sms_logs table for tracking SMS messages
CREATE TABLE public.sms_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_phone text NOT NULL,
    message text NOT NULL,
    provider text DEFAULT 'zamtel',
    status text DEFAULT 'pending',
    provider_response jsonb,
    reference_type text,
    reference_id uuid,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

-- Admin/Staff can manage SMS logs
CREATE POLICY "Admin/Staff can manage sms_logs"
ON public.sms_logs
FOR ALL
USING (is_admin_or_staff(auth.uid()));

-- Create triggers for updated_at
CREATE TRIGGER update_api_secrets_updated_at
BEFORE UPDATE ON public.api_secrets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payments_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();