-- Update the site footer address list to include the new Lusaka and Ndola branches
UPDATE public.cms_pages
SET data = jsonb_set(
  data,
  '{footer,supportItems}',
  '["Lusaka HQ: De la motte Zambia Ltd Building, Plot 26592, Kafue Road, Lusaka, Zambia, 10101", "Copperbelt Office: Real masters complex, shinde street corner of kabelenga road", "Lusaka Customer Care: +260 211220012", "Copperbelt Customer Care: 0958 977 051", "WhatsApp Support: +260 95 8977049 / +260 95 8977051", "Email Support: Support@xycargozm.com"]'::jsonb,
  true
)
WHERE slug = 'site';

-- Update the topbar address to the new Lusaka branch location
UPDATE public.cms_pages
SET data = jsonb_set(
  data,
  '{topBar,address}',
  '"De la motte Zambia Ltd Building, Plot 26592, Kafue Road, Lusaka, Zambia, 10101"'::jsonb,
  true
)
WHERE slug = 'site';

-- Update the support introduction address and contact details to list both corporate branch locations clearly
UPDATE public.cms_pages
SET data = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        data,
        '{intro,address}',
        '"Lusaka HQ:\nDe la motte Zambia Ltd Building, Plot 26592, Kafue Road, Lusaka, Zambia, 10101\n\nCopperbelt Office:\nReal masters complex, shinde street corner of kabelenga road"'::jsonb,
        true
      ),
      '{intro,phone}',
      '"Lusaka Customer Care: +260 211220012\nCopperbelt Customer Care: 0958 977 051"'::jsonb,
      true
    ),
    '{intro,whatsapp}',
    '"WhatsApp Support: +260 95 8977049 / +260 95 8977051"'::jsonb,
    true
  ),
  '{intro,whatsappUrl}',
  '"https://wa.me/260958977049"'::jsonb,
  true
)
WHERE slug = 'support';

-- Update site topbar email to Support@xycargozm.com
UPDATE public.cms_pages
SET data = jsonb_set(
  data,
  '{topBar,email}',
  '"Support@xycargozm.com"'::jsonb,
  true
)
WHERE slug = 'site';

-- Update support intro email to Support@xycargozm.com
UPDATE public.cms_pages
SET data = jsonb_set(
  data,
  '{intro,email}',
  '"Support@xycargozm.com"'::jsonb,
  true
)
WHERE slug = 'support';
