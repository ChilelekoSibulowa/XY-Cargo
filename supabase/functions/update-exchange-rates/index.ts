// Supabase Edge Function: update exchange rates from OpenExchangeRates
// Requires env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENEXCHANGERATES_APP_ID
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const OPENEXCHANGERATES_APP_ID = Deno.env.get("OPENEXCHANGERATES_APP_ID") ?? "";

const CURRENCY_CODES = ["USD", "ZMW", "CNY"];

serve(async () => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !OPENEXCHANGERATES_APP_ID) {
    return new Response("Missing required env vars.", { status: 500 });
  }

  const apiUrl = `https://openexchangerates.org/api/latest.json?app_id=${OPENEXCHANGERATES_APP_ID}`;
  const res = await fetch(apiUrl);
  if (!res.ok) {
    return new Response(`OpenExchangeRates error: ${res.status}`, { status: 502 });
  }

  const payload = await res.json();
  const rates = payload?.rates ?? {};

  const updates = CURRENCY_CODES.map((code) => {
    const rate = code === "USD" ? 1 : rates[code];
    return {
      code,
      exchange_rate: rate ?? null,
      is_default: code === "USD",
      is_active: true,
    };
  }).filter((row) => row.exchange_rate !== null);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { error } = await supabase
    .from("currencies")
    .upsert(updates, { onConflict: "code" });

  if (error) {
    return new Response(`Supabase error: ${error.message}`, { status: 500 });
  }

  return new Response("Exchange rates updated.", { status: 200 });
});
