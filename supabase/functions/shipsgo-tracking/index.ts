import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

const SHIPSGO_BASE = "https://shipsgo.com/api/v1.1/ContainerService";
const SHIPSGO_EMBED_BASE = "https://embed.shipsgo.com/";

const cleanSecretValue = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const findSecretValue = (
  secrets: Array<{ secret_key: string; secret_value: string }>,
  preferredKeys: string[],
  matchers: RegExp[] = [],
) => {
  for (const key of preferredKeys) {
    const value = cleanSecretValue(secrets.find((secret) => secret.secret_key === key)?.secret_value);
    if (value) return value;
  }

  for (const matcher of matchers) {
    const value = cleanSecretValue(secrets.find((secret) => matcher.test(secret.secret_key))?.secret_value);
    if (value) return value;
  }

  return null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { action, tracking_number, shipping_line, request_id, transport, query } = body;

    const { data: secrets } = await supabase
      .from("api_secrets")
      .select("secret_key, secret_value")
      .or("secret_key.ilike.%SHIPSGO%,category.eq.shipsgo")
      .eq("is_active", true);

    const shipsGoSecrets = (secrets || []) as Array<{ secret_key: string; secret_value: string }>;
    const authCode = findSecretValue(shipsGoSecrets, ["SHIPSGO_AUTH_CODE"], [/SHIPSGO.*AUTH/i]);
    const embedToken = findSecretValue(
      shipsGoSecrets,
      ["SHIPSGO_EMBED_TOKEN", "SHIPSGO_PUBLIC_TOKEN", "SHIPSGO_USER_TOKEN", "SHIPSGO_TOKEN"],
      [/SHIPSGO.*EMBED/i, /SHIPSGO.*TOKEN/i],
    );

    if (action === "create") {
      if (!authCode) {
        return new Response(
          JSON.stringify({ error: "ShipsGo credentials not configured. Add SHIPSGO_AUTH_CODE in Admin -> API Secrets." }),
          { status: 400, headers: jsonHeaders },
        );
      }

      if (!tracking_number) {
        return new Response(JSON.stringify({ error: "tracking_number is required" }), { status: 400, headers: jsonHeaders });
      }

      const formData = new URLSearchParams();
      formData.set("authCode", authCode);
      formData.set("containerNumber", tracking_number);
      formData.set("shippingLine", shipping_line || "OTHERS");

      const response = await fetch(`${SHIPSGO_BASE}/PostShipment`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }

      console.log("ShipsGo create response:", JSON.stringify({ status: response.status, data }));

      return new Response(JSON.stringify({ success: response.ok, data }), {
        status: response.ok ? 200 : 400,
        headers: jsonHeaders,
      });
    }

    if (action === "track") {
      if (!authCode) {
        return new Response(
          JSON.stringify({ error: "ShipsGo credentials not configured. Add SHIPSGO_AUTH_CODE in Admin -> API Secrets." }),
          { status: 400, headers: jsonHeaders },
        );
      }

      if (!tracking_number && !request_id) {
        return new Response(JSON.stringify({ error: "tracking_number or request_id required" }), { status: 400, headers: jsonHeaders });
      }

      const url = new URL(`${SHIPSGO_BASE}/GetContainerInfo`);
      url.searchParams.set("authCode", authCode);
      if (request_id) {
        url.searchParams.set("requestId", request_id);
      } else {
        url.searchParams.set("containerNumber", tracking_number);
      }
      url.searchParams.set("mapPoint", "true");

      const response = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }

      console.log("ShipsGo track response:", JSON.stringify({ status: response.status, ok: response.ok }));

      return new Response(JSON.stringify({ success: response.ok, data }), {
        status: response.ok ? 200 : 400,
        headers: jsonHeaders,
      });
    }

    if (action === "air_track") {
      if (!authCode) {
        return new Response(
          JSON.stringify({ error: "ShipsGo credentials not configured. Add SHIPSGO_AUTH_CODE in Admin -> API Secrets." }),
          { status: 400, headers: jsonHeaders },
        );
      }

      const url = new URL("https://api.shipsgo.com/v2/air/shipments");

      const response = await fetch(url.toString(), {
        headers: {
          "X-Shipsgo-User-Token": authCode,
          Accept: "application/json",
        },
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }

      return new Response(JSON.stringify({ success: response.ok, data }), {
        status: response.ok ? 200 : 400,
        headers: jsonHeaders,
      });
    }

    if (action === "embed") {
      const normalizedTransport = typeof transport === "string" ? transport.trim().toLowerCase() : "";
      const normalizedQuery = typeof query === "string" ? query.trim() : "";

      if (!embedToken) {
        return new Response(
          JSON.stringify({ error: "ShipsGo embed token not configured. Add SHIPSGO_EMBED_TOKEN in Admin -> API Secrets." }),
          { status: 400, headers: jsonHeaders },
        );
      }

      if (!normalizedQuery || !["air", "ocean"].includes(normalizedTransport)) {
        return new Response(
          JSON.stringify({ error: "transport and query are required for embed. Transport must be air or ocean." }),
          { status: 400, headers: jsonHeaders },
        );
      }

      const embedUrl = new URL(SHIPSGO_EMBED_BASE);
      embedUrl.searchParams.set("token", embedToken);
      embedUrl.searchParams.set("tabs", "none");
      embedUrl.searchParams.set("transport", normalizedTransport);
      embedUrl.searchParams.set("query", normalizedQuery);

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            embed_url: embedUrl.toString(),
            transport: normalizedTransport,
            query: normalizedQuery,
          },
        }),
        { status: 200, headers: jsonHeaders },
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use 'create', 'track', 'air_track', or 'embed'" }),
      { status: 400, headers: jsonHeaders },
    );
  } catch (error) {
    console.error("ShipsGo tracking error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown",
      }),
      { status: 500, headers: jsonHeaders },
    );
  }
});
