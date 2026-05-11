import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AutomationRequest {
  email: string;
  event: string;
  source: string;
  metadata?: Record<string, unknown>;
}

const toTextOrNull = (value: unknown) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, event, source, metadata } = (await req.json()) as AutomationRequest;
    const normalizedEmail = email.toLowerCase().trim();
    const eventId = crypto.randomUUID();

    // Validate input
    if (!normalizedEmail || !event) {
      return new Response(
        JSON.stringify({ error: "Email and event are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Log the subscription event
    const { error: logError } = await supabase
      .from("marketing_automation_logs")
      .insert({
        email: normalizedEmail,
        event_type: event,
        source,
        payload: metadata || {},
        fb_event_name: event,
        fb_event_id: eventId,
        triggered_at: new Date().toISOString(),
        status: "processed",
      });
    if (metadata && Object.keys(metadata).length > 0) {
      const updatePayload = {
        fbp: toTextOrNull(metadata.fbp),
        fbc: toTextOrNull(metadata.fbc),
        fbclid: toTextOrNull(metadata.fbclid),
        utm_source: toTextOrNull(metadata.utm_source),
        utm_medium: toTextOrNull(metadata.utm_medium),
        utm_campaign: toTextOrNull(metadata.utm_campaign),
        utm_term: toTextOrNull(metadata.utm_term),
        utm_content: toTextOrNull(metadata.utm_content),
        page_url: toTextOrNull(metadata.page_url),
        page_path: toTextOrNull(metadata.page_path),
        referrer: toTextOrNull(metadata.referrer),
        metadata,
        updated_at: new Date().toISOString(),
      };

      await supabase
        .from("marketing_email_subscribers")
        .update(updatePayload)
        .eq("email", normalizedEmail);
    }


    if (logError) {
      console.error("Failed to log automation event:", logError);
    }

    // Send welcome email via SendGrid or similar service
    // This is a placeholder - integrate with your email service
    const emailServiceKey = Deno.env.get("SENDGRID_API_KEY") || "";

    if (event === "newsletter_subscribe" && emailServiceKey) {
      try {
        const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${emailServiceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            personalizations: [
              {
                to: [{ email: normalizedEmail }],
                subject: "Welcome to XY Cargo Newsletter",
              },
            ],
            from: {
              email: "marketing@xycargo.com",
              name: "XY Cargo",
            },
            content: [
              {
                type: "text/html",
                value: `
                  <h1>Welcome to XY Cargo!</h1>
                  <p>Thank you for subscribing to our newsletter.</p>
                  <p>You'll receive the latest shipping tips, rate updates, and exclusive offers.</p>
                  <p>Best regards,<br/>XY Cargo Team</p>
                `,
              },
            ],
          }),
        });

        const providerText = await response.text();
        const providerResponse = {
          status: response.status,
          ok: response.ok,
          body: providerText,
        };

        await supabase
          .from("marketing_automation_logs")
          .update({
            provider_response: providerResponse,
            processed_at: new Date().toISOString(),
            status: response.ok ? "processed" : "failed",
            error_message: response.ok ? null : "Email provider rejected request",
          })
          .eq("fb_event_id", eventId);

        if (!response.ok) {
          console.error("SendGrid error:", providerText);
        }
      } catch (emailError) {
        console.error("Email service error:", emailError);
        await supabase
          .from("marketing_automation_logs")
          .update({
            processed_at: new Date().toISOString(),
            status: "failed",
            error_message: emailError instanceof Error ? emailError.message : "Unknown email provider error",
          })
          .eq("fb_event_id", eventId);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Marketing automation triggered successfully",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
