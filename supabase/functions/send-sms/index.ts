import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SmsRequest {
  phone_numbers: string | string[];
  message: string;
  reference_type?: string;
  reference_id?: string;
}

type ProviderPayload = Record<string, unknown> | null;
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
const DEFAULT_BRAND_SENDER_ID = "XY Cargo Zambia";
const BRAND_ALIASES = ["xycargozambia", "xycargo", "xycargozm"];

const sanitizeBranding = (value: string | null, brandName: string = DEFAULT_BRAND_SENDER_ID) =>
  value?.replace(/zamtel/gi, brandName) ?? null;

const normalizeToken = (value: string) => value.replace(/[^a-z0-9]/gi, "").toLowerCase();
const isBrandSenderId = (senderId: string) => BRAND_ALIASES.includes(normalizeToken(senderId));

const getProviderMessage = (payload: ProviderPayload, rawText: string) => {
  const direct =
    typeof payload?.responseText === "string" ? payload.responseText
    : typeof payload?.message === "string" ? payload.message
    : null;
  const nested =
    payload?.errors && typeof payload.errors === "object" && payload.errors !== null
      ? typeof (payload.errors as Record<string, unknown>).responseText === "string"
        ? String((payload.errors as Record<string, unknown>).responseText)
        : typeof (payload.errors as Record<string, unknown>).message === "string"
          ? String((payload.errors as Record<string, unknown>).message)
          : null
      : null;
  return direct || nested || rawText || null;
};

const responseLooksSuccessful = (_response: Response, payload: ProviderPayload, msg: string | null) => {
  const code = typeof payload?.code === "string" ? payload.code.toLowerCase() : null;
  const status = typeof payload?.status === "string" ? payload.status.toLowerCase() : null;
  const flag = payload?.success;
  const norm = msg?.toLowerCase() || "";
  const fail = flag === false || code === "error" || code === "failed" || status === "error" || status === "failed" || /error|invalid|failed|denied|insufficient|unauthori[sz]ed/.test(norm);
  if (fail) return false;
  const ok = flag === true || code === "ok" || code === "success" || status === "ok" || status === "success" || /queued for delivery|successfully sent|successfully send|message sent|sms\(es\) have been queued/i.test(msg || "");
  return ok;
};

const parseProviderResponse = async (response: Response): Promise<{ rawText: string; payload: ProviderPayload }> => {
  let rawText = "";
  let payload: ProviderPayload = null;
  try {
    rawText = await response.text();
    payload = JSON.parse(rawText);
  } catch {
    // not JSON
  }
  return { rawText, payload };
};

const cleanSecretValue = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeSenderId = (value: unknown, fallbackSenderId: string) => {
  const cleaned = cleanSecretValue(value);
  if (cleaned) return cleaned;
  return fallbackSenderId;
};

const normalizePhoneE164 = (phone: string): string | null => {
  const digits = phone.replace(/[^0-9+]/g, "");
  if (!digits || digits.length < 9) return null;
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("0")) return `+260${digits.slice(1)}`;
  if (digits.startsWith("260")) return `+${digits}`;
  return `+${digits}`;
};

const normalizeForZamtel = (phone: string): string | null => {
  const e164 = normalizePhoneE164(phone);
  if (!e164) return null;
  if (e164.startsWith("+260")) return e164.slice(1); // Remove +
  return e164.replace(/^\+/, "");
};

// --- Zamtel sender ID verification ---
async function verifyOrCreateSenderId(apiKey: string, senderId: string, brandSenderId: string) {
  try {
    const listUrl = `https://bulksms.zamtel.co.zm/api/v2.1/action/list/api_key/${encodeURIComponent(apiKey)}/senderIds`;
    const listResp = await fetch(listUrl, { method: "GET", headers: { Accept: "application/json, text/plain, */*" } });
    const { payload: listPayload } = await parseProviderResponse(listResp);

    const senderIds = Array.isArray(listPayload) ? listPayload : (listPayload as any)?.data || [];
    const existing = senderIds.find((s: any) =>
      normalizeToken(String(s.sender_id || s.name || "")) === normalizeToken(senderId)
    );

    if (existing) {
      const statusVal = String(existing.status || "").toLowerCase();
      if (statusVal === "active" || statusVal === "approved") {
        return { ok: true, message: `Sender ID '${senderId}' is active` };
      }
      return { ok: false, message: `Sender ID '${senderId}' exists but status is '${statusVal}'` };
    }

    // Try to create
    const createUrl = `https://bulksms.zamtel.co.zm/api/v2.1/action/create/api_key/${encodeURIComponent(apiKey)}/senderId/${encodeURIComponent(brandSenderId)}`;
    await fetch(createUrl, { method: "GET", headers: { Accept: "application/json, text/plain, */*" } });

    return { ok: true, message: `Sender ID '${brandSenderId}' creation requested` };
  } catch (err) {
    console.error("Sender ID verification error:", err);
    return { ok: true, message: "Could not verify sender ID, proceeding anyway" };
  }
}

// --- Resolve brand sender ID from settings ---
async function resolveBrandSenderId(supabase: any) {
  const { data: settingRows } = await supabase
    .from("api_secrets")
    .select("secret_value")
    .eq("secret_key", "SMS_BRAND_SENDER_ID")
    .eq("is_active", true)
    .limit(1);

  const settingValue = cleanSecretValue((settingRows?.[0] as { secret_value?: unknown } | undefined)?.secret_value);
  return settingValue || DEFAULT_BRAND_SENDER_ID;
}

// --- Resolve Zamtel credentials ---
async function resolveCredentials(supabase: any, brandSenderId: string) {
  const envApiKey = cleanSecretValue(Deno.env.get("ZAMTEL_SMS_API_KEY"));
  const envSenderId = normalizeSenderId(Deno.env.get("ZAMTEL_SMS_SENDER_ID"), brandSenderId);
  if (envApiKey) {
    return { apiKey: envApiKey, senderId: envSenderId };
  }

  const { data: rows } = await supabase
    .from("api_secrets")
    .select("secret_key, secret_value, category, description")
    .in("secret_key", ["ZAMTEL_SMS_API_KEY", "ZAMTEL_SMS_SENDER_ID"])
    .eq("is_active", true);

  const standard = rows as any[];
  if (standard && standard.length > 0) {
    const apiKey = cleanSecretValue(
      standard.find((s: any) => s.secret_key === "ZAMTEL_SMS_API_KEY")?.secret_value,
    );
    const senderId = normalizeSenderId(
      standard.find((s: any) => s.secret_key === "ZAMTEL_SMS_SENDER_ID")?.secret_value,
      brandSenderId,
    );
    if (apiKey) return { apiKey, senderId };
  }

  // Fallback: look for any SMS-related key
  const { data: smsRows } = await supabase
    .from("api_secrets")
    .select("secret_key, secret_value, description")
    .or("category.eq.sms,secret_key.ilike.%sms%,secret_key.ilike.%zamtel%")
    .eq("is_active", true);

  if (smsRows && smsRows.length > 0) {
    if (smsRows.length >= 2) {
      const apiRow = smsRows.find((s: any) => /api.?key|token/i.test(s.description || "") || /api.?key|token/i.test(s.secret_key));
      const senderRow = smsRows.find((s: any) => /sender/i.test(s.description || "") || /sender/i.test(s.secret_key));
      const apiKey = cleanSecretValue(apiRow?.secret_value);
      const senderId = normalizeSenderId(senderRow?.secret_value, brandSenderId);
      if (apiKey) return { apiKey, senderId };
    }

    const row = smsRows[0];
    const apiKey = cleanSecretValue(row.secret_value);
    const senderId = normalizeSenderId(row.secret_key, brandSenderId);
    if (apiKey) {
      return { apiKey, senderId };
    }
  }

  return null;
}

// --- Send via Zamtel ---
const sendViaZamtel = async (apiKey: string, senderId: string, contacts: string[], message: string) => {
  const contactsParam = `[${contacts.join(",")}]`;
  const pathUrl = `https://bulksms.zamtel.co.zm/api/v2.1/action/send/api_key/${encodeURIComponent(apiKey)}/contacts/${encodeURIComponent(contactsParam)}/senderId/${encodeURIComponent(senderId)}/message/${encodeURIComponent(message.trim())}`;

  const smsResponse = await fetch(pathUrl, { method: "POST", headers: { Accept: "application/json, text/plain, */*" } });
  const { rawText, payload } = await parseProviderResponse(smsResponse);
  const messageText = getProviderMessage(payload, rawText);

  return {
    ok: responseLooksSuccessful(smsResponse, payload, messageText),
    status: smsResponse.status,
    payload,
    rawText,
    message: messageText,
    requestUrl: pathUrl,
    requestMethod: "POST" as const,
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // --- Authentication & Authorization ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: jsonHeaders });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: callerError } = await supabase.auth.getUser(token);
    if (callerError || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: jsonHeaders });
    }
    const userId = caller.id;

    // Verify caller has admin or staff role
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const hasPermission = roles?.some((r: any) => ["admin", "staff", "support"].includes(r.role));
    if (!hasPermission) {
      return new Response(JSON.stringify({ error: "Forbidden – insufficient permissions" }), { status: 403, headers: jsonHeaders });
    }

    const body: SmsRequest = await req.json();
    if (!body.phone_numbers || !body.message) {
      return new Response(JSON.stringify({ error: "Phone numbers and message are required" }), { status: 400, headers: jsonHeaders });
    }

    const phoneNumbers = Array.isArray(body.phone_numbers) ? body.phone_numbers : [body.phone_numbers];
    const normalizedPhones = Array.from(
      new Set(phoneNumbers.map((phone) => normalizePhoneE164(String(phone))).filter((phone): phone is string => Boolean(phone))),
    );
    if (normalizedPhones.length === 0) {
      return new Response(JSON.stringify({ error: "No valid phone numbers were provided" }), { status: 400, headers: jsonHeaders });
    }

    const brandSenderId = await resolveBrandSenderId(supabase);
    const zamtelCreds = await resolveCredentials(supabase, brandSenderId);

    if (!zamtelCreds) {
      return new Response(
        JSON.stringify({ error: "SMS credentials not configured. Add ZAMTEL_SMS_API_KEY in Admin → API Secrets." }),
        { status: 400, headers: jsonHeaders },
      );
    }

    const { apiKey, senderId } = zamtelCreds;
    if (!isBrandSenderId(senderId)) {
      console.error(`Invalid sender ID: ${senderId}. Must be a recognised brand alias.`);
      return new Response(
        JSON.stringify({ error: `Bulk SMS sender ID '${senderId}' is not a recognised brand alias. Accepted: ${BRAND_ALIASES.join(", ")}` }),
        { status: 400, headers: jsonHeaders },
      );
    }

    const senderValidation = await verifyOrCreateSenderId(apiKey, senderId, brandSenderId);
    if (!senderValidation.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `${senderValidation.message || "Sender ID is not active"}. Sending is blocked to prevent fallback branding.`,
        }),
        { status: 400, headers: jsonHeaders },
      );
    }

    const zamtelContacts = normalizedPhones
      .map((phone) => normalizeForZamtel(phone))
      .filter((phone): phone is string => Boolean(phone));

    if (zamtelContacts.length === 0) {
      return new Response(JSON.stringify({ error: "No valid recipients for Zamtel format" }), { status: 400, headers: jsonHeaders });
    }

    console.log("Sending branded SMS to:", zamtelContacts, "senderId:", senderId);

    const providerResponse = await sendViaZamtel(apiKey, senderId, zamtelContacts, body.message.trim());
    const providerReturnedHtml = /<!doctype html|<html[\s>]/i.test(providerResponse.rawText || "");
    console.log("SMS provider response:", JSON.stringify({ status: providerResponse.status, ok: providerResponse.ok, method: providerResponse.requestMethod, senderIdUsed: senderId, htmlFallback: providerReturnedHtml, payload: providerResponse.payload }));

    const brandedMessage = sanitizeBranding(
      providerReturnedHtml ? "SMS provider returned a web page instead of an API response" : providerResponse.message,
      brandSenderId,
    );
    const smsAccepted = providerResponse.ok && !providerReturnedHtml;

    const smsLogs = zamtelContacts.map((phone) => ({
      recipient_phone: phone,
      message: body.message,
      provider: "xy_cargo",
      status: smsAccepted ? "sent" : "failed",
      provider_response: {
        status: providerResponse.status,
        message: brandedMessage,
        request_method: providerResponse.requestMethod,
        payload: providerResponse.payload,
        raw_text: providerResponse.rawText,
      },
      reference_type: body.reference_type || null,
      reference_id: body.reference_id || null,
    }));
    await supabase.from("sms_logs").insert(smsLogs);

    if (smsAccepted) {
      return new Response(JSON.stringify({ success: true, provider: "zamtel", channels: ["sms"], message: brandedMessage || `SMS sent successfully from ${brandSenderId}`, recipients: zamtelContacts.length }), { status: 200, headers: jsonHeaders });
    }

    const errorMsg = brandedMessage || "Failed to send SMS";
    return new Response(JSON.stringify({ success: false, provider: "zamtel", channels: ["sms"], error: errorMsg, details: { status: providerResponse.status, request_method: providerResponse.requestMethod, payload: providerResponse.payload, raw_text: providerResponse.rawText } }), { status: 400, headers: jsonHeaders });
  } catch (error) {
    console.error("SMS send error:", error);
    return new Response(JSON.stringify({ error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" }), { status: 500, headers: jsonHeaders });
  }
});
