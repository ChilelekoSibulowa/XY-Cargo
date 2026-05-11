-- Fix function search path mutable warnings
CREATE OR REPLACE FUNCTION public.generate_code(prefix TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_code TEXT;
BEGIN
    new_code := prefix || '-' || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 8));
    RETURN new_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_shipping_cost(
    p_service_type service_type,
    p_weight DECIMAL,
    p_length DECIMAL,
    p_width DECIMAL,
    p_height DECIMAL,
    p_rate_per_kg DECIMAL,
    p_rate_per_cbm DECIMAL,
    p_minimum_charge DECIMAL DEFAULT 50
)
RETURNS DECIMAL
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cbm DECIMAL;
    v_billable_cbm DECIMAL;
    v_cost DECIMAL;
BEGIN
    IF p_service_type = 'air' THEN
        v_cost := p_weight * COALESCE(p_rate_per_kg, 0);
    ELSE -- sea
        v_cbm := (p_length * p_width * p_height) / 1000000.0;
        v_billable_cbm := GREATEST(v_cbm, 0.1);
        v_cost := GREATEST(v_billable_cbm * COALESCE(p_rate_per_cbm, 0), COALESCE(p_minimum_charge, 50));
    END IF;
    
    RETURN v_cost;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;