import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

type Recipient = {
  email: string;
  name?: string | null;
};

type PasswordResetPayload = {
  mode: "password_reset";
  email: string;
  redirectTo?: string;
};

type SendMarketingPayload = {
  mode: "send_marketing";
  subject: string;
  body: string;
  recipients: Recipient[];
};

type SendEmailPayload = PasswordResetPayload | SendMarketingPayload;

type SecretRow = {
  secret_key: string;
  secret_value: string;
};

type SettingRow = {
  setting_key: string;
  setting_value: string | null;
};

const cleanValue = (value: unknown) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

const stripHtml = (value: string) => value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const normalizeEmailBody = (body: string) => {
  const trimmed = body.trim();
  if (!trimmed) return "<p>No message content provided.</p>";
  if (/<[a-z][\s\S]*>/i.test(trimmed)) return trimmed;
  return `<div>${escapeHtml(trimmed).replace(/\n/g, "<br />")}</div>`;
};

const buildPasswordResetHtml = (companyName: string, resetUrl: string, recipientEmail: string) => {
  const brandedLinkText = "https://xycargozm.com/reset-password";
  return `
  <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6; max-width: 560px; margin: 0 auto;">
    <h2 style="margin-bottom: 16px;">Reset your password</h2>
    <p>Hello,</p>
    <p>We received a request to reset the password for <strong>${escapeHtml(recipientEmail)}</strong> on ${escapeHtml(companyName)}.</p>
    <p style="margin: 24px 0;">
      <a href="${resetUrl}" style="display: inline-block; background: #111827; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 8px; font-weight: 600;">Reset Password</a>
    </p>
    <p style="font-size: 13px; color: #6b7280;">If the button does not work, copy and paste the link below into your browser:</p>
    <p><a href="${resetUrl}" style="color: #2563eb; word-break: break-all;">${escapeHtml(brandedLinkText)}</a></p>
    <p style="font-size: 13px; color: #6b7280;">If you did not request this change, you can ignore this email.</p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
    <p style="font-size: 12px; color: #9ca3af;">&copy; ${new Date().getFullYear()} ${escapeHtml(companyName)}. All rights reserved.</p>
  </div>
`;
};

const isAdminOrStaff = async (
  supabaseAdmin: any,
  authHeader: string | null,
) => {
  if (!authHeader) {
    return { allowed: false, error: "Unauthorized", status: 401 };
  }

  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return { allowed: false, error: "Unauthorized", status: 401 };
  }

  const { data: roles, error: roleError } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  if (roleError) {
    return { allowed: false, error: roleError.message, status: 500 };
  }

  const allowed = (roles || []).some((entry: any) =>
    ["admin", "staff", "branch_manager"].includes(String(entry?.role || "")),
  );

  if (!allowed) {
    return { allowed: false, error: "Forbidden", status: 403 };
  }

  return { allowed: true, user };
};

const resolveResendConfig = async (supabaseAdmin: any) => {
  const envApiKey = cleanValue(Deno.env.get("RESEND_API_KEY"));
  const envFromEmail = cleanValue(Deno.env.get("RESEND_FROM_EMAIL"));
  const envFromName = cleanValue(Deno.env.get("RESEND_FROM_NAME"));

  const { data: secretRows } = await supabaseAdmin
    .from("api_secrets")
    .select("secret_key, secret_value")
    .in("secret_key", ["RESEND_API_KEY", "RESEND_FROM_EMAIL", "RESEND_FROM_NAME"])
    .eq("is_active", true);

  const secretMap = new Map(
    ((secretRows || []) as SecretRow[]).map((row) => [row.secret_key, row.secret_value]),
  );

  const { data: settingRows } = await supabaseAdmin
    .from("system_settings")
    .select("setting_key, setting_value")
    .in("setting_key", ["company_name", "company_email"]);

  const settingMap = new Map(
    ((settingRows || []) as SettingRow[]).map((row) => [row.setting_key, row.setting_value]),
  );

  const apiKey = envApiKey || cleanValue(secretMap.get("RESEND_API_KEY"));
  // Until xycargozm.com is verified in Resend, always use the sandbox sender.
  // To use your own domain, verify it at https://resend.com/domains then set
  // RESEND_FROM_EMAIL in api_secrets or Edge Function env vars.
  const fromEmail =
    envFromEmail ||
    cleanValue(secretMap.get("RESEND_FROM_EMAIL")) ||
    "no-reply@xycargozm.com";
  const fromName =
    envFromName ||
    cleanValue(secretMap.get("RESEND_FROM_NAME")) ||
    cleanValue(settingMap.get("company_name")) ||
    "Xy Cargo";

  return {
    apiKey,
    fromEmail,
    fromName,
    companyName: cleanValue(settingMap.get("company_name")) || fromName,
  };
};

const sendViaResend = async (
  apiKey: string,
  payload: {
    from: string;
    to: string[];
    subject: string;
    html: string;
    text?: string;
  },
) => {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const rawText = await response.text();
  let data: unknown = null;
  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    data = rawText;
  }

  if (!response.ok) {
    throw new Error(
      typeof data === "object" && data !== null && "message" in data
        ? String((data as { message?: string }).message)
        : rawText || "Failed to send email via Resend.",
    );
  }

  return data;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Missing Supabase configuration." }), {
        status: 500,
        headers: jsonHeaders,
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const payload = (await req.json()) as SendEmailPayload;
    const config = await resolveResendConfig(supabaseAdmin);

    if (!config.apiKey) {
      return new Response(
        JSON.stringify({
          error: "Resend is not configured. Add RESEND_API_KEY in Edge Function secrets or api_secrets.",
        }),
        { status: 400, headers: jsonHeaders },
      );
    }

    const from = `${config.fromName} <${config.fromEmail}>`;

    if (payload.mode === "password_reset") {
      const email = payload.email.trim().toLowerCase();
      const redirectTo = cleanValue(payload.redirectTo) || "https://xycargozm.com/reset-password";

      if (!email) {
        return new Response(JSON.stringify({ error: "Email is required." }), {
          status: 400,
          headers: jsonHeaders,
        });
      }

      const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo },
      });

      const resetUrl = data?.properties?.action_link;

      if (error || !resetUrl) {
        const message = String(error?.message || "").toLowerCase();
        if (message.includes("user not found") || message.includes("email not found")) {
          return new Response(JSON.stringify({ success: true }), { status: 200, headers: jsonHeaders });
        }

        return new Response(JSON.stringify({ error: error?.message || "Failed to generate password reset link." }), {
          status: 400,
          headers: jsonHeaders,
        });
      }

      await sendViaResend(config.apiKey, {
        from,
        to: [email],
        subject: `Reset your ${config.companyName} password`,
        html: buildPasswordResetHtml(config.companyName, resetUrl, email),
        text: `Reset your ${config.companyName} password by opening this link: ${resetUrl}`,
      });

      return new Response(JSON.stringify({ success: true }), { status: 200, headers: jsonHeaders });
    }

    const permission = await isAdminOrStaff(supabaseAdmin, req.headers.get("Authorization"));
    if (!permission.allowed) {
      return new Response(JSON.stringify({ error: permission.error }), {
        status: permission.status,
        headers: jsonHeaders,
      });
    }

    const subject = payload.subject.trim();
    const normalizedRecipients = payload.recipients
      .map((recipient) => ({
        email: recipient.email.trim().toLowerCase(),
        name: cleanValue(recipient.name) || null,
      }))
      .filter((recipient) => recipient.email);

    if (!subject || !payload.body.trim() || normalizedRecipients.length === 0) {
      return new Response(JSON.stringify({ error: "Subject, body, and at least one recipient are required." }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const html = normalizeEmailBody(payload.body);
    const text = stripHtml(payload.body) || subject;

    await sendViaResend(config.apiKey, {
      from,
      to: normalizedRecipients.map((recipient) => recipient.email),
      subject,
      html,
      text,
    });

    return new Response(
      JSON.stringify({ success: true, sent: normalizedRecipients.length }),
      { status: 200, headers: jsonHeaders },
    );
  } catch (error) {
    console.error("send-email error", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: jsonHeaders },
    );
  }
});