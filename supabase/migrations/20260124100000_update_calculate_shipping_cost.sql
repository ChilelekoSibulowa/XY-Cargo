-- Update shipping cost calculation to match weight-only air and CBM-only sea pricing

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
AS $$
DECLARE
    v_cbm DECIMAL;
    v_cost DECIMAL;
BEGIN
    IF p_service_type = 'air' THEN
        v_cost := p_weight * COALESCE(p_rate_per_kg, 0);
    ELSE -- sea
        v_cbm := (p_length * p_width * p_height) / 1000000.0;
        v_cost := v_cbm * COALESCE(p_rate_per_cbm, 0);
    END IF;

    RETURN v_cost;
END;
$$;
