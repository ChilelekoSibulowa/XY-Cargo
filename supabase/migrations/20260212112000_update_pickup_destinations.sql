-- Normalize pickup destinations to Zambia locations
DO $$
BEGIN
  INSERT INTO public.pickup_destinations (name, requires_details, sort_order, is_active)
  VALUES
    ('Lusaka', false, 10, true),
    ('Ndola', false, 20, true),
    ('Kitwe', false, 30, true),
    ('Other', true, 999, true)
  ON CONFLICT (name) DO UPDATE
    SET requires_details = EXCLUDED.requires_details,
        sort_order = EXCLUDED.sort_order,
        is_active = EXCLUDED.is_active;

  DELETE FROM public.pickup_destinations
  WHERE name IN ('Lusaka Warehouse', 'Ndola Warehouse', 'Kitwe Warehouse');
END
$$;
