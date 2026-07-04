-- Migration: Insert ShipsGo Embed Token for live tracking iframe
-- Token: 6f57787d-cb66-46d0-a6cd-3b930b506078

INSERT INTO public.api_secrets (secret_key, secret_value, description, category, is_active)
VALUES (
  'SHIPSGO_EMBED_TOKEN',
  '6f57787d-cb66-46d0-a6cd-3b930b506078',
  'ShipsGo embed token used for the iframe map on shipment tracking pages',
  'tracking',
  true
)
ON CONFLICT (secret_key) DO UPDATE
  SET secret_value = EXCLUDED.secret_value,
      description  = EXCLUDED.description,
      category     = EXCLUDED.category,
      is_active    = EXCLUDED.is_active;
