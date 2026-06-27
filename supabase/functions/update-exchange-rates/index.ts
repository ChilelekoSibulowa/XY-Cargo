// Supabase Edge Function: update exchange rates from FreeCurrencyApi with OpenERAPI fallback for ZMW
// Requires env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FREECURRENCYAPI_KEY
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CURRENCY_CODES = ["USD", "ZMW", "CNY"];

const CURRENCY_METADATA: Record<string, { name: string; symbol: string }> = {
  USD: { name: "US Dollar", symbol: "$" },
  ZMW: { name: "Zambian Kwacha", symbol: "K" },
  CNY: { name: "Chinese Yuan", symbol: "¥" },
};

serve(async () => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response("Missing required Supabase env vars.", { status: 500 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // 1. Resolve FreeCurrencyApi key
  let apiKey = Deno.env.get("FREECURRENCYAPI_KEY")?.trim();
  if (!apiKey) {
    const { data } = await supabase
      .from("api_secrets")
      .select("secret_value")
      .eq("secret_key", "FREECURRENCYAPI_KEY")
      .eq("is_active", true)
      .limit(1);
    apiKey = (data as any[])?.[0]?.secret_value?.trim();
  }

  if (!apiKey) {
    return new Response("Missing FREECURRENCYAPI_KEY env var or api_secrets entry.", { status: 500 });
  }

  // 2. Fetch rates from FreeCurrencyApi
  const apiUrl = `https://api.freecurrencyapi.com/v1/latest?apikey=${encodeURIComponent(apiKey)}`;
  const res = await fetch(apiUrl);
  if (!res.ok) {
    return new Response(`FreeCurrencyApi error: ${res.status} ${await res.text()}`, { status: 502 });
  }

  const payload = await res.json();
  const rates = payload?.data ?? {};

  // 3. Fallback for ZMW (not supported on FreeCurrencyApi free tier)
  if (!rates["ZMW"]) {
    try {
      console.log("ZMW not found in FreeCurrencyApi. Fetching fallback from Open ER API...");
      const erRes = await fetch("https://open.er-api.com/v6/latest/USD");
      if (erRes.ok) {
        const erPayload = await erRes.json();
        const zmwRate = erPayload?.rates?.ZMW;
        if (zmwRate) {
          rates["ZMW"] = zmwRate;
          console.log(`Successfully fetched fallback ZMW rate: ${zmwRate}`);
        }
      } else {
        console.error(`Open ER API error status: ${erRes.status}`);
      }
    } catch (err) {
      console.error("Failed to fetch fallback ZMW rate:", err);
    }
  }

  // 4. Map updates
  const updates = CURRENCY_CODES.map((code) => {
    const rate = code === "USD" ? 1 : rates[code];
    const meta = CURRENCY_METADATA[code] ?? { name: code, symbol: code };
    return {
      code,
      name: meta.name,
      symbol: meta.symbol,
      exchange_rate: rate ?? null,
      is_default: code === "USD",
      is_active: true,
    };
  }).filter((row) => row.exchange_rate !== null);

  if (updates.length === 0) {
    return new Response("No valid rates retrieved.", { status: 500 });
  }

  // 5. Upsert to Supabase
  const { error } = await supabase
    .from("currencies")
    .upsert(updates, { onConflict: "code" });

  if (error) {
    return new Response(`Supabase database error: ${error.message}`, { status: 500 });
  }

  return new Response(JSON.stringify({ message: "Exchange rates updated successfully.", updates }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
