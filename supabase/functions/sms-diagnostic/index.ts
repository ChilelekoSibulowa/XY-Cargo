import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    let apiKey = Deno.env.get("ZAMTEL_SMS_API_KEY")?.trim();
    let senderId = Deno.env.get("ZAMTEL_SMS_SENDER_ID")?.trim();
    if (!apiKey) {
      const { data } = await supabase.from("api_secrets").select("secret_key,secret_value").in("secret_key", ["ZAMTEL_SMS_API_KEY","ZAMTEL_SMS_SENDER_ID"]).eq("is_active", true);
      apiKey = (data as any[])?.find(r => r.secret_key === "ZAMTEL_SMS_API_KEY")?.secret_value?.trim();
      senderId = senderId || (data as any[])?.find(r => r.secret_key === "ZAMTEL_SMS_SENDER_ID")?.secret_value?.trim();
    }
    if (!apiKey) return new Response(JSON.stringify({ error: "no api key" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const out: Record<string, unknown> = { senderIdConfigured: senderId, apiKeyLen: apiKey.length };

    // List sender IDs
    const sidResp = await fetch(`https://bulksms.zamtel.co.zm/api/v2.1/action/list/api_key/${encodeURIComponent(apiKey)}/senderIds`);
    out.senderIds = await sidResp.text();

    // Balance
    const balResp = await fetch(`https://bulksms.zamtel.co.zm/api/v2.1/action/account/api_key/${encodeURIComponent(apiKey)}/balance`);
    out.balance = await balResp.text();

    // Account info
    const accResp = await fetch(`https://bulksms.zamtel.co.zm/api/v2.1/action/account/api_key/${encodeURIComponent(apiKey)}`);
    out.account = await accResp.text();

    return new Response(JSON.stringify(out, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
