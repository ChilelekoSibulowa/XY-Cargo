import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

interface NotificationRequest {
  notification_id?: string;
  customer_id?: string;
  user_id?: string;
  event_type?: string;
  title: string;
  message: string;
  email?: string;
  phone?: string;
  customer_name?: string;
  sms_message?: string;
  email_subject?: string;
  email_body?: string;
  reference_id?: string;
  notification_type?: string;
  channels?: ("sms" | "email" | "bell")[];
}

const cleanValue = (v: unknown) => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
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
  if (e164.startsWith("+260")) return e164.slice(1);
  return e164.replace(/^\+/, "");
};

const normalizeToken = (value: string) => value.replace(/[^a-z0-9]/gi, "").toLowerCase();
const brandSenderAliases = ["xycargo", "xycargozambia", "xycargozm"];
const isBrandSenderId = (senderId: string) => brandSenderAliases.includes(normalizeToken(senderId));

const getProviderMessage = (payload: any, rawText: string) => {
  const direct = typeof payload?.responseText === "string"
    ? payload.responseText
    : typeof payload?.message === "string"
      ? payload.message
      : null;
  return direct || rawText || null;
};

const providerAcceptedSms = (response: Response, payload: any, messageText: string | null) => {
  if (!payload && /<!doctype html|<html[\s>]/i.test(messageText || "")) {
    return false;
  }
  
  const code = typeof payload?.code === "string" ? payload.code.toLowerCase() : null;
  const status = typeof payload?.status === "string" ? payload.status.toLowerCase() : null;
  const flag = payload?.success;
  const norm = (messageText || "").toLowerCase();
  
  const isExplicitError = flag === false || 
    code === "error" || code === "failed" || 
    status === "error" || status === "failed" || 
    /error|invalid|failed|denied|insufficient|unauthori[sz]ed|not found|missing/i.test(norm);
    
  if (isExplicitError) return false;

  const isExplicitSuccess = flag === true || 
    code === "ok" || code === "success" || 
    status === "ok" || status === "success" || 
    /queued for delivery|successfully sent|successfully send|message sent|sms\(es\) have been queued/i.test(messageText || "");
    
  if (isExplicitSuccess) return true;

  // Fallback to HTTP status if no explicit markers found
  return response.ok;
};

const parseSmsResponse = async (response: Response) => {
  const rawText = await response.text();
  let payload: any = null;
  try {
    payload = JSON.parse(rawText);
  } catch {
    payload = null;
  }
  const messageText = getProviderMessage(payload, rawText);
  return { rawText, payload, messageText, ok: providerAcceptedSms(response, payload, messageText) };
};

const resolveSmsCredentials = async (supabase: any) => {
  const envApiKey = cleanValue(Deno.env.get("ZAMTEL_SMS_API_KEY"));
  const envSenderId = cleanValue(Deno.env.get("ZAMTEL_SMS_SENDER_ID"));
  if (envApiKey) {
    return { apiKey: envApiKey, senderId: envSenderId || "XYCargo" };
  }

  const { data: standardRows } = await supabase
    .from("api_secrets")
    .select("secret_key, secret_value, category, description")
    .in("secret_key", ["ZAMTEL_SMS_API_KEY", "ZAMTEL_SMS_SENDER_ID"])
    .eq("is_active", true);

  const standard = (standardRows || []) as any[];
  const apiKey = cleanValue(standard.find((row) => row.secret_key === "ZAMTEL_SMS_API_KEY")?.secret_value);
  const senderId = cleanValue(standard.find((row) => row.secret_key === "ZAMTEL_SMS_SENDER_ID")?.secret_value) || "XYCargo";
  if (apiKey) return { apiKey, senderId };

  const { data: smsRows } = await supabase
    .from("api_secrets")
    .select("secret_key, secret_value, category, description")
    .or("category.eq.sms,secret_key.ilike.%sms%,secret_key.ilike.%zamtel%,description.ilike.%sms%,description.ilike.%zamtel%")
    .eq("is_active", true);

  const candidates = (smsRows || []) as any[];
  const apiRow = candidates.find((row) => /api.?key|token/i.test(`${row.secret_key} ${row.description || ""}`))
    || candidates.find((row) => isBrandSenderId(String(row.secret_key || "")) && cleanValue(row.secret_value)?.length && cleanValue(row.secret_value)!.length >= 16)
    || candidates.find((row) => cleanValue(row.secret_value)?.length && cleanValue(row.secret_value)!.length >= 16);
  const senderRow = candidates.find((row) => String(row.secret_key || "") === "ZAMTEL_SMS_SENDER_ID")
    || candidates.find((row) => /sender/i.test(String(row.secret_key || "")) && isBrandSenderId(String(row.secret_value || "")))
    || candidates.find((row) => isBrandSenderId(String(row.secret_key || "")));
  const fallbackApiKey = cleanValue(apiRow?.secret_value);
  const fallbackSenderId = senderId || (isBrandSenderId(String(senderRow?.secret_value || ""))
    ? cleanValue(senderRow?.secret_value)
    : isBrandSenderId(String(senderRow?.secret_key || ""))
      ? String(senderRow.secret_key)
      : "XYCargo");

  return fallbackApiKey ? { apiKey: fallbackApiKey, senderId: fallbackSenderId } : null;
};

const escapeHtml = (v: string) =>
  v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const buildNotificationEmail = (
  companyName: string,
  title: string,
  message: string,
) => `
<div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6; max-width: 560px; margin: 0 auto;">
  <div style="background: #111827; color: #ffffff; padding: 20px 24px; border-radius: 8px 8px 0 0;">
    <h2 style="margin: 0; font-size: 18px;">${escapeHtml(companyName)}</h2>
  </div>
  <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <h3 style="margin: 0 0 12px 0; font-size: 16px;">${escapeHtml(title)}</h3>
    <p style="margin: 0 0 16px 0; color: #374151;">${escapeHtml(message)}</p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
    <p style="font-size: 12px; color: #9ca3af; margin: 0;">&copy; ${new Date().getFullYear()} ${escapeHtml(companyName)}. All rights reserved.</p>
  </div>
</div>`;

const logDelivery = async (
  supabase: any,
  notificationId: string | undefined,
  channel: string,
  status: string,
  errorMessage: string | null = null,
  providerResponse: any = null,
) => {
  if (!notificationId) return;
  try {
    await supabase.from("notification_delivery_logs").insert({
      notification_id: notificationId,
      channel,
      status,
      error_message: errorMessage,
      provider_response: providerResponse,
    });
  } catch (err) {
    console.error(`Failed to log delivery for ${channel}:`, err);
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body: NotificationRequest = await req.json();
    const {
      title,
      message,
      channels = ["sms", "email", "bell"],
    } = body;
    const event_type = cleanValue(body.event_type)
      || cleanValue(body.notification_type)
      || (body.reference_id ? `notification_${body.reference_id}` : "notification_dispatch");

    if (!title || !message) {
      return new Response(
        JSON.stringify({
          error: "title and message are required",
        }),
        { status: 400, headers: jsonHeaders },
      );
    }

    // Resolve customer details
    let customerPhone: string | null = null;
    let customerEmail: string | null = null;
    let customerName: string | null = null;
    let targetUserId: string | null = body.user_id || null;

    // Database triggers already resolve contact details from the registered
    // customer/profile record and pass them through notification metadata.
    customerPhone = cleanValue(body.phone);
    customerEmail = cleanValue(body.email);
    customerName = cleanValue(body.customer_name);

    // Prioritize finding customer info via user_id if customer_id is missing
    if (!body.customer_id && targetUserId) {
      const { data: cust } = await supabase
        .from("customers")
        .select("id, phone, email, full_name")
        .eq("user_id", targetUserId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (cust) {
        customerPhone = cust.phone;
        customerEmail = cust.email;
        customerName = cust.full_name;
      }
    }

    if (body.customer_id) {
      const { data: cust } = await supabase
        .from("customers")
        .select("phone, email, full_name, user_id")
        .eq("id", body.customer_id)
        .maybeSingle();

      if (cust) {
        customerPhone = customerPhone || cust.phone;
        customerEmail = customerEmail || cust.email;
        customerName = customerName || cust.full_name;
        targetUserId = targetUserId || cust.user_id;
      }
    }

    // Fallback to profiles if still no contact info
    if (!customerPhone && !customerEmail && targetUserId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, phone, full_name")
        .eq("user_id", targetUserId)
        .maybeSingle();

      if (profile) {
        customerEmail = profile.email;
        customerPhone = profile.phone;
        customerName = customerName || profile.full_name;
      }
    }

    const results: Record<string, any> = {};

    // Prevent duplicates: ONLY check if we are NOT being called by the DB trigger
    // If the DB trigger is calling us, it won't pass 'notification_id' or similar bypass
    // But a safer way is to check if there is an OLDER duplicate, not including the current one if it exists.
    if (body.reference_id && title && message) {
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("reference_id", body.reference_id)
        .eq("title", title)
        .eq("message", message)
        .lt('created_at', new Date(Date.now() - 2000).toISOString()) // Only skip if it's at least 2 seconds old
        .limit(1);

      if (existing && existing.length > 0) {
        return new Response(
          JSON.stringify({
            success: true,
            results: { skipped: true, reason: "Duplicate notification" },
          }),
          { status: 200, headers: jsonHeaders },
        );
      }
    }

    // 1. Insert bell notification
    if (channels.includes("bell") && targetUserId) {
      if (body.notification_id) {
        await logDelivery(supabase, body.notification_id, "bell", "sent");
        results.bell = { success: true, existing_notification: true };
      } else {
        const { error: bellError } = await supabase.from("notifications").insert({
          user_id: targetUserId,
          title,
          message,
          notification_type: body.notification_type || event_type,
          reference_id: body.reference_id || null,
          is_read: false,
        });
        results.bell = bellError
          ? { error: bellError.message }
          : { success: true };
      }
    }

    // 2. Send SMS via Zamtel
    if (channels.includes("sms") && customerPhone) {
      try {
        const smsText = body.sms_message || message;
        const zamtelPhone = normalizeForZamtel(customerPhone);

        if (zamtelPhone) {
          const credentials = await resolveSmsCredentials(supabase);

          if (credentials) {
            const { apiKey, senderId } = credentials;
            const baseUrl = `https://bulksms.zamtel.co.zm/api/v2.1/action/send/api_key/${encodeURIComponent(apiKey)}`;
            const queryParams = new URLSearchParams({
              contacts: zamtelPhone,
              senderId: senderId,
              message: smsText.trim()
            });
            
            const fullUrl = `${baseUrl}?${queryParams.toString()}`;
            
            let smsResp = await fetch(fullUrl, {
              method: "POST",
              headers: { Accept: "application/json, text/plain, */*" },
            });
            let smsResult = await parseSmsResponse(smsResp);

            // Fallback to path segments if query params failed
            if (!smsResult.ok) {
              const pathUrl = `${baseUrl}/contacts/${encodeURIComponent(zamtelPhone)}/senderId/${encodeURIComponent(senderId)}/message/${encodeURIComponent(smsText.trim())}`;
              smsResp = await fetch(pathUrl, {
                method: "POST",
                headers: { Accept: "application/json, text/plain, */*" },
              });
              smsResult = await parseSmsResponse(smsResp);
            }

            await supabase.from("sms_logs").insert({
              recipient_phone: zamtelPhone,
              message: smsText,
              provider: "xy_cargo",
              status: smsResult.ok ? "sent" : "failed",
              provider_response: {
                status: smsResp.status,
                message: smsResult.messageText,
                request_method: "POST",
                payload: smsResult.payload,
                raw_text: smsResult.rawText,
              },
              reference_type: event_type,
              reference_id: body.reference_id || null,
            });

            await logDelivery(supabase, body.notification_id, "sms", smsResult.ok ? "sent" : "failed", smsResult.ok ? null : smsResult.messageText || "SMS provider error", smsResult.payload);
            results.sms = { success: smsResult.ok, phone: zamtelPhone };
          } else {
            await logDelivery(supabase, body.notification_id, "sms", "skipped", "No SMS API key configured");
            results.sms = {
              skipped: true,
              reason: "No SMS API key configured",
            };
          }
        }
      } catch (smsErr) {
        console.error("SMS error:", smsErr);
        await logDelivery(supabase, body.notification_id, "sms", "failed", smsErr instanceof Error ? smsErr.message : "SMS failed");
        results.sms = {
          error: smsErr instanceof Error ? smsErr.message : "SMS failed",
        };
      }
    }

    // 3. Send Email via Resend
    if (channels.includes("email") && customerEmail) {
      try {
        const resendApiKey = cleanValue(Deno.env.get("RESEND_API_KEY"));
        let apiKey = resendApiKey;

        if (!apiKey) {
          const { data: rows } = await supabase
            .from("api_secrets")
            .select("secret_value")
            .eq("secret_key", "RESEND_API_KEY")
            .eq("is_active", true)
            .limit(1);
          apiKey = cleanValue((rows as any[])?.[0]?.secret_value);
        }

        if (apiKey) {
          const emailSubject = body.email_subject || title;
          const emailHtml =
            body.email_body ||
            buildNotificationEmail("XY Cargo Zambia", title, message);

          const emailResp = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "XY Cargo Zambia <no-reply@xycargozm.com>",
              to: [customerEmail],
              subject: emailSubject,
              html: emailHtml,
            }),
          });

          await logDelivery(supabase, body.notification_id, "email", emailResp.ok ? "sent" : "failed", emailResp.ok ? null : "Resend API error");
          results.email = { success: emailResp.ok, email: customerEmail };
        } else {
          await logDelivery(supabase, body.notification_id, "email", "skipped", "No Resend API key configured");
          results.email = { skipped: true, reason: "No Resend API key" };
        }
      } catch (emailErr) {
        console.error("Email error:", emailErr);
        await logDelivery(supabase, body.notification_id, "email", "failed", emailErr instanceof Error ? emailErr.message : "Email failed");
        results.email = {
          error: emailErr instanceof Error ? emailErr.message : "Email failed",
        };
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (error) {
    console.error("send-notification error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal error",
      }),
      { status: 500, headers: jsonHeaders },
    );
  }
});
