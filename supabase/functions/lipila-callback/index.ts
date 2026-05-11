import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function verifySignature(payload: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const expectedHex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return signature === expectedHex;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Read raw body for signature verification
    const rawBody = await req.text();

    // Verify webhook signature
    const { data: secretData } = await supabase
      .from("api_secrets")
      .select("secret_value")
      .eq("secret_key", "LIPILA_CALLBACK_SECRET")
      .eq("is_active", true)
      .maybeSingle();

    if (secretData?.secret_value) {
      const signature = req.headers.get("x-lipila-signature") || "";
      const valid = await verifySignature(rawBody, signature, secretData.secret_value);
      if (!valid) {
        console.error("Lipila callback: invalid signature");
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      // Allow callbacks when secret is not configured (log warning)
      console.warn("Lipila callback: LIPILA_CALLBACK_SECRET not configured, skipping signature verification");
    }

    const body = JSON.parse(rawBody);
    console.log("Lipila callback received (verified):", JSON.stringify(body));

    // Extract payment reference from callback
    const reference =
      body.reference ||
      body.external_id ||
      body.externalId ||
      body.payment_reference ||
      body.transactionReference ||
      body.merchantReference;
    const rawStatus = body.status || body.transactionStatus || body.paymentStatus;
    const status = typeof rawStatus === "string" ? rawStatus.toLowerCase() : "";
    const transactionId =
      body.transaction_id ||
      body.transactionId ||
      body.id ||
      body.transactionReference;

    if (!reference) {
      return new Response(
        JSON.stringify({ error: "Missing payment reference" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find payment by code
    const { data: payment, error: findError } = await supabase
      .from("payments")
      .select("*")
      .eq("code", reference)
      .maybeSingle();

    if (findError || !payment) {
      console.error("Payment not found:", reference);
      return new Response(
        JSON.stringify({ error: "Payment not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Map Lipila status to our status
    let newStatus = "pending";
    if (status === "successful" || status === "success" || status === "completed" || status === "paid") {
      newStatus = "completed";
    } else if (status === "failed" || status === "cancelled" || status === "rejected") {
      newStatus = "failed";
    } else if (status === "pending" || status === "processing") {
      newStatus = "processing";
    }

    const wasCompleted = payment.status === "completed";
    const existingCallbackData =
      payment.callback_data && typeof payment.callback_data === "object" ? payment.callback_data : {};

    // Update payment record
    const { error: updateError } = await supabase
      .from("payments")
      .update({
        status: newStatus,
        provider_reference: transactionId || payment.provider_reference,
        callback_data: {
          ...existingCallbackData,
          callback: body,
        },
      })
      .eq("id", payment.id);

    if (updateError) {
      console.error("Failed to update payment:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update payment" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Apply side effects once per successful payment.
    if (newStatus === "completed" && !wasCompleted && payment.shipment_id) {
      // 1. Fetch current shipment and associated invoice details
      const [{ data: shipment }, { data: invoice }] = await Promise.all([
        supabase
          .from("shipments")
          .select("total_cost, shipping_cost, paid_amount")
          .eq("id", payment.shipment_id)
          .single(),
        supabase
          .from("invoices")
          .select("id, amount, status")
          .eq("shipment_id", payment.shipment_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (shipment) {
        // 2. Cleanup other pending/processing payments for this same shipment
        // to avoid double payment or UI clutter.
        await supabase
          .from("payments")
          .delete()
          .eq("shipment_id", payment.shipment_id)
          .neq("id", payment.id)
          .in("status", ["pending", "processing"]);

        // 3. Calculate new paid amount and billing total (aligned with financePortal.ts)
        const newPaidAmount = (shipment.paid_amount || 0) + payment.amount;
        
        // Priority: Invoice Amount > Shipping Cost > Total Cost
        const explicitInvoiceAmount = Number(invoice?.amount || 0);
        const shippingFee = Number(shipment.shipping_cost || 0);
        const totalCost = Number(shipment.total_cost || 0);
        
        const invoiceTotal = explicitInvoiceAmount > 0 
          ? explicitInvoiceAmount 
          : (shippingFee > 0 ? shippingFee : totalCost);

        const isFullyPaid = newPaidAmount >= invoiceTotal;
        const paymentStatus = isFullyPaid ? "completed" : "partial";

        // 4. Update shipment payment status
        await supabase
          .from("shipments")
          .update({
            paid_amount: newPaidAmount,
            payment_status: paymentStatus,
          })
          .eq("id", payment.shipment_id);

        // 5. Update invoice status if fully paid
        if (isFullyPaid && invoice && invoice.status !== "paid") {
          await supabase
            .from("invoices")
            .update({ status: "paid" })
            .eq("id", invoice.id);
        }
      }

      // 6. Create transaction record
      await supabase.from("transactions").insert({
        code: `TXN-${Date.now()}`,
        amount: payment.amount,
        customer_id: payment.customer_id,
        shipment_id: payment.shipment_id,
        transaction_type: "payment",
        payment_method: "lipila",
        status: "completed",
        notes: `Lipila payment ${reference}`,
      });
    }

    if (newStatus === "completed" && !wasCompleted && !payment.shipment_id && payment.customer_id) {
      const { data: customer } = await supabase
        .from("customers")
        .select("wallet_balance")
        .eq("id", payment.customer_id)
        .maybeSingle();

      if (customer) {
        const nextWalletBalance = (customer.wallet_balance || 0) + payment.amount;

        await supabase
          .from("customers")
          .update({ wallet_balance: nextWalletBalance })
          .eq("id", payment.customer_id);
      }

      await supabase.from("transactions").insert({
        code: `TXN-${Date.now()}`,
        amount: payment.amount,
        customer_id: payment.customer_id,
        shipment_id: null,
        transaction_type: "wallet_topup",
        payment_method: "lipila",
        status: "completed",
        notes: `Lipila wallet top-up ${reference}`,
      });
    }

    const walletOwnerType = existingCallbackData?.request?.wallet_owner_type;
    const walletUserId = existingCallbackData?.request?.wallet_user_id;

    if (
      newStatus === "completed" &&
      !wasCompleted &&
      !payment.shipment_id &&
      !payment.customer_id &&
      walletOwnerType === "agent" &&
      typeof walletUserId === "string" &&
      walletUserId
    ) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("wallet_balance")
        .eq("user_id", walletUserId)
        .maybeSingle();

      const nextWalletBalance = Number(profile?.wallet_balance || 0) + Number(payment.amount || 0);

      await supabase
        .from("profiles")
        .update({ wallet_balance: nextWalletBalance })
        .eq("user_id", walletUserId);

      await supabase.from("transactions").insert({
        code: `TXN-${Date.now()}`,
        amount: payment.amount,
        customer_id: null,
        shipment_id: null,
        transaction_type: "wallet_topup",
        payment_method: "lipila",
        status: "completed",
        created_by: walletUserId,
        notes: `Agent wallet top-up ${reference}`,
      });
    }

    return new Response(
      JSON.stringify({ success: true, status: newStatus }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Lipila callback error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
