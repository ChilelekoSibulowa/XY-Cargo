import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type WalletPaymentRequest = {
  customer_id?: string;
  shipment_id?: string;
  amount?: number;
  payer_type?: "customer" | "agent";
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: "Missing required env vars." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = (await req.json()) as WalletPaymentRequest;
    const amount = Number(payload.amount || 0);
    const payerType = payload.payer_type === "agent" ? "agent" : "customer";

    if (!payload.customer_id || !payload.shipment_id || !Number.isFinite(amount) || amount <= 0) {
      return new Response(JSON.stringify({ error: "customer_id, shipment_id, and a valid amount are required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [
      { data: customer, error: customerError },
      { data: shipment, error: shipmentError },
      { data: invoice },
      { data: roles },
      { data: profile, error: profileError },
    ] =
      await Promise.all([
        supabaseAdmin
          .from("customers")
          .select("id, user_id, agent_id, wallet_balance")
          .eq("id", payload.customer_id)
          .maybeSingle(),
        supabaseAdmin
          .from("shipments")
          .select("id, customer_id, total_cost, shipping_cost, paid_amount, payment_status")
          .eq("id", payload.shipment_id)
          .maybeSingle(),
        supabaseAdmin
          .from("invoices")
          .select("amount")
          .eq("shipment_id", payload.shipment_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabaseAdmin.from("user_roles").select("role").eq("user_id", user.id),
        supabaseAdmin
          .from("profiles")
          .select("user_id, wallet_balance")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

    if (customerError || !customer) {
      return new Response(JSON.stringify({ error: "Customer not found." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (shipmentError || !shipment || shipment.customer_id !== customer.id) {
      return new Response(JSON.stringify({ error: "Shipment not found for this customer." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerRoles = new Set((roles || []).map((row) => row.role));
    const isPrivilegedOperator =
      callerRoles.has("admin") ||
      callerRoles.has("staff") ||
      callerRoles.has("branch_manager");
    const hasAccess =
      customer.user_id === user.id ||
      customer.agent_id === user.id ||
      isPrivilegedOperator;

    if (!hasAccess) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const explicitInvoiceAmount = Number(invoice?.amount || 0);
    const shippingFee = Number(shipment.shipping_cost || 0);
    const totalCost = explicitInvoiceAmount > 0 
      ? explicitInvoiceAmount 
      : (shippingFee > 0 ? shippingFee : Number(shipment.total_cost || 0));
    const paidAmount = Number(shipment.paid_amount || 0);
    const outstanding = Math.max(totalCost - paidAmount, 0);
    const walletBalance =
      payerType === "agent"
        ? Number(profile?.wallet_balance || 0)
        : Number(customer.wallet_balance || 0);

    if (payerType === "agent" && (profileError || !profile)) {
      return new Response(JSON.stringify({ error: "Agent wallet profile not found." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (payerType === "agent" && customer.agent_id !== user.id && !isPrivilegedOperator) {
      return new Response(JSON.stringify({ error: "Only the assigned agent can use the agent wallet for this client." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (outstanding <= 0) {
      return new Response(JSON.stringify({ error: "This shipment is already fully paid." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (amount > outstanding) {
      return new Response(JSON.stringify({ error: "Amount exceeds the outstanding balance." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (amount > walletBalance) {
      return new Response(JSON.stringify({ error: "Insufficient wallet balance." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const paymentCode = `PAY-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const nextWalletBalance = walletBalance - amount;
    const nextPaidAmount = paidAmount + amount;
    const nextPaymentStatus = nextPaidAmount >= totalCost ? "completed" : "partial";

    const { error: paymentInsertError } = await supabaseAdmin.from("payments").insert({
      code: paymentCode,
      amount,
      customer_id: customer.id,
      shipment_id: shipment.id,
      payment_provider: payerType === "agent" ? "agent_wallet" : "wallet",
      status: "completed",
      currency: "ZMW",
      phone_number: null,
    });

    if (paymentInsertError) {
      return new Response(JSON.stringify({ error: paymentInsertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await Promise.all([
      supabaseAdmin
        .from(payerType === "agent" ? "profiles" : "customers")
        .update({ wallet_balance: nextWalletBalance })
        .eq(payerType === "agent" ? "user_id" : "id", payerType === "agent" ? user.id : customer.id),
      supabaseAdmin
        .from("shipments")
        .update({
          paid_amount: nextPaidAmount,
          payment_status: nextPaymentStatus,
        })
        .eq("id", shipment.id),
      supabaseAdmin
        .from("payments")
        .delete()
        .eq("shipment_id", shipment.id)
        .neq("code", paymentCode)
        .in("status", ["pending", "processing"]),
      nextPaymentStatus === "completed" 
        ? supabaseAdmin.from("invoices").update({ status: "paid" }).eq("shipment_id", shipment.id)
        : Promise.resolve(),
      supabaseAdmin.from("transactions").insert({
        code: `TXN-${Date.now()}`,
        amount,
        customer_id: customer.id,
        shipment_id: shipment.id,
        transaction_type: "wallet_deduction",
        payment_method: payerType === "agent" ? "agent_wallet" : "wallet",
        status: "completed",
        created_by: user.id,
        notes: `${payerType === "agent" ? "Agent wallet" : "Wallet"} payment ${paymentCode}`,
      }),
    ]);

    return new Response(
      JSON.stringify({
        success: true,
        payment_code: paymentCode,
        wallet_balance: nextWalletBalance,
        outstanding_balance: Math.max(totalCost - nextPaidAmount, 0),
        payment_status: nextPaymentStatus,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
