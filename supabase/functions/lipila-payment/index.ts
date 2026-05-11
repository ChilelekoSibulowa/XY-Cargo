import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PaymentRequest {
  amount: number;
  amount_currency?: string;
  phone_number?: string;
  email?: string;
  customer_id?: string;
  shipment_id?: string;
  description?: string;
  redirect_url?: string;
  currency?: string;
  wallet_owner_type?: "customer" | "agent";
  wallet_user_id?: string;
  payment_method?: "card" | "mobile_money";
  payment_type?: string;
  agent_user_id?: string;
}

type LipilaResponseData = Record<string, unknown>;

type ContactProfile = {
  phone: string | null;
  email: string | null;
  full_name: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  user_id: string | null;
};

type CurrencyRate = {
  code: string;
  exchange_rate: number;
};

const asText = (value: unknown) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
};

const normalizePhone = (value: unknown) => {
  const raw = asText(value);
  if (!raw) return null;

  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("260") && digits.length >= 12) return digits;
  if (digits.startsWith("0") && digits.length === 10) return `260${digits.slice(1)}`;
  if (digits.length === 9) return `260${digits}`;
  return digits;
};

const normalizeCurrencyCode = (value: unknown) => {
  const raw = asText(value);
  return raw ? raw.toUpperCase() : null;
};

const resolveCurrencyRate = (
  currencies: CurrencyRate[],
  targetCode: string,
  defaultCode: string,
) => {
  return (
    currencies.find((currency) => currency.code === targetCode) ||
    currencies.find((currency) => currency.code === defaultCode) ||
    null
  );
};

const convertCurrencyAmount = (
  amount: number,
  fromCode: string,
  toCode: string,
  currencies: CurrencyRate[],
  defaultCode: string,
) => {
  if (fromCode === toCode) {
    return amount;
  }

  const fromCurrency = resolveCurrencyRate(currencies, fromCode, defaultCode);
  const toCurrency = resolveCurrencyRate(currencies, toCode, defaultCode);

  if (!fromCurrency || !toCurrency) {
    throw new Error(`Missing currency conversion rate for ${fromCode} or ${toCode}.`);
  }

  if (fromCurrency.exchange_rate <= 0 || toCurrency.exchange_rate <= 0) {
    throw new Error(`Invalid currency conversion rate for ${fromCode} or ${toCode}.`);
  }

  const amountInBaseCurrency = amount / fromCurrency.exchange_rate;
  return amountInBaseCurrency * toCurrency.exchange_rate;
};

const parseResponseBody = async (response: Response) => {
  const raw = await response.text();
  if (!raw) return {} as LipilaResponseData;

  try {
    return JSON.parse(raw) as LipilaResponseData;
  } catch {
    return { raw };
  }
};

const extractCheckoutUrl = (payload: LipilaResponseData) =>
  asText(payload.cardRedirectionUrl) ||
  asText(payload.checkout_url) ||
  asText(payload.payment_url) ||
  asText(payload.redirect_url) ||
  asText(payload.return_url) ||
  asText(payload.authorization_url) ||
  asText(payload.url) ||
  asText(payload.link) ||
  null;

const buildCustomerName = (value: string | null | undefined) => {
  const trimmed = asText(value) || "XY Cargo Customer";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  const firstName = parts[0] || "XY";
  const lastName = parts.slice(1).join(" ") || "Cargo";
  return { firstName, lastName };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: secretRows, error: secretError } = await supabase
      .from("api_secrets")
      .select("secret_key, secret_value")
      .in("secret_key", ["LIPILA_API_KEY", "LIPILA_BASE_URL"])
      .eq("is_active", true);

    if (secretError) {
      return new Response(
        JSON.stringify({ error: "Failed to read payment gateway settings", details: secretError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const apiKey = secretRows?.find((row) => row.secret_key === "LIPILA_API_KEY")?.secret_value || "";
    const configuredBaseUrl = secretRows?.find((row) => row.secret_key === "LIPILA_BASE_URL")?.secret_value || "";
    const lipilaBaseUrl = (configuredBaseUrl.trim() || "https://blz.lipila.io").replace(/\/+$/, "");

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Lipila API key not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = (await req.json()) as PaymentRequest;
    const amount = Number(body.amount || 0);

    if (!Number.isFinite(amount) || amount <= 0) {
      return new Response(
        JSON.stringify({ error: "A valid amount is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: currencyRows, error: currencyError } = await supabase
      .from("currencies")
      .select("code, exchange_rate, is_default")
      .eq("is_active", true);

    if (currencyError) {
      return new Response(
        JSON.stringify({ error: "Failed to load currency conversion settings", details: currencyError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const defaultCurrencyCode =
      normalizeCurrencyCode(currencyRows?.find((row) => row.is_default)?.code) || "USD";
    const currencies: CurrencyRate[] = ((currencyRows || []) as Array<{
      code: string;
      exchange_rate: number | null;
    }>)
      .map((row) => ({
        code: normalizeCurrencyCode(row.code) || "",
        exchange_rate: Number(row.exchange_rate || 0),
      }))
      .filter((row) => Boolean(row.code));

    if (!currencies.some((row) => row.code === defaultCurrencyCode)) {
      currencies.push({ code: defaultCurrencyCode, exchange_rate: 1 });
    }

    // Determine payment method: card (default) or mobile_money
    const paymentMethod = body.payment_method === "mobile_money" ? "mobile_money" : "card";

    let customerRecord: ContactProfile | null = null;
    let profileRecord: {
      phone: string | null;
      email: string | null;
      full_name: string | null;
      address: string | null;
    } | null = null;

    if (body.customer_id) {
      const { data, error } = await supabase
        .from("customers")
        .select("phone, email, full_name, address, city, country, user_id")
        .eq("id", body.customer_id)
        .maybeSingle();

      if (error) {
        return new Response(
          JSON.stringify({ error: "Failed to load customer payment profile", details: error.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      customerRecord = data
        ? {
            phone: data.phone,
            email: data.email,
            full_name: data.full_name,
            address: data.address,
            city: data.city,
            country: data.country,
            user_id: data.user_id,
          }
        : null;
    }

    const profileUserId =
      body.wallet_owner_type === "agent"
        ? asText(body.wallet_user_id) || asText(body.agent_user_id)
        : customerRecord?.user_id || asText(body.agent_user_id);

    if (profileUserId) {
      const { data } = await supabase
        .from("profiles")
        .select("phone, email, full_name, address")
        .eq("user_id", profileUserId)
        .maybeSingle();

      profileRecord = data
        ? {
            phone: data.phone,
            email: data.email,
            full_name: data.full_name,
            address: data.address,
          }
        : null;
    }

    let authMetadataPhone: string | null = null;
    if (profileUserId) {
      const { data: authUserData, error: authUserError } = await supabase.auth.admin.getUserById(profileUserId);
      if (authUserError) {
        console.warn("Lipila payment auth user lookup failed:", authUserError.message);
      }
      authMetadataPhone =
        asText(authUserData?.user?.user_metadata?.phone) ||
        asText(authUserData?.user?.phone) ||
        null;
    }

    let historicalPhone: string | null = null;
    if (body.customer_id) {
      const { data } = await supabase
        .from("payments")
        .select("phone_number")
        .eq("customer_id", body.customer_id)
        .not("phone_number", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      historicalPhone = data?.phone_number || null;
    }

    const phoneNumber =
      normalizePhone(body.phone_number) ||
      normalizePhone(customerRecord?.phone) ||
      normalizePhone(profileRecord?.phone) ||
      normalizePhone(authMetadataPhone) ||
      normalizePhone(historicalPhone);

    if (!phoneNumber) {
      return new Response(
        JSON.stringify({
          error: "A saved phone number is required on the profile to open Lipila checkout.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const email =
      asText(body.email) ||
      asText(customerRecord?.email) ||
      asText(profileRecord?.email) ||
      `payment-${Date.now()}@xycargo.local`;
    const fullName = asText(customerRecord?.full_name) || asText(profileRecord?.full_name);
    const address = asText(customerRecord?.address) || asText(profileRecord?.address) || "Lusaka";
    const city = asText(customerRecord?.city) || "Lusaka";
    const country = asText(customerRecord?.country) || "ZM";
    const zip = "10101";
    const internalCurrency = normalizeCurrencyCode(body.amount_currency) || defaultCurrencyCode;
    const gatewayCurrency = normalizeCurrencyCode(body.currency) || "ZMW";
    const description = asText(body.description) || (body.shipment_id ? "Shipment payment" : "Wallet top-up");
    const paymentCode = `PAY-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const normalizedInternalAmount = Number(amount.toFixed(2));

    let normalizedGatewayAmount: number;
    try {
      normalizedGatewayAmount = Number(
        convertCurrencyAmount(
          normalizedInternalAmount,
          internalCurrency,
          gatewayCurrency,
          currencies,
          defaultCurrencyCode,
        ).toFixed(2),
      );
    } catch (conversionError) {
      const message =
        conversionError instanceof Error
          ? conversionError.message
          : "Unable to convert the payment amount.";

      return new Response(
        JSON.stringify({ error: message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!Number.isFinite(normalizedGatewayAmount) || normalizedGatewayAmount <= 0) {
      return new Response(
        JSON.stringify({ error: "Unable to convert the payment amount to a valid ZMW total." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        code: paymentCode,
        amount: normalizedInternalAmount,
        phone_number: phoneNumber,
        customer_id: body.customer_id || null,
        shipment_id: body.shipment_id || null,
        payment_provider: "lipila",
        status: "pending",
        currency: internalCurrency,
        payment_type: body.payment_type || null,
        description: body.description || null,
        payment_method: body.payment_method || null,
        callback_data: {
          internal_amount: normalizedInternalAmount,
          internal_currency: internalCurrency,
          gateway_amount: normalizedGatewayAmount,
          gateway_currency: gatewayCurrency,
          agent_user_id: body.agent_user_id || null,
          payment_type: body.payment_type || null,
          description: body.description || null,
          payment_method: body.payment_method || null,
        },
      })
      .select()
      .single();

    if (paymentError) {
      return new Response(
        JSON.stringify({ error: "Failed to create payment record", details: paymentError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const callbackUrl = `${supabaseUrl}/functions/v1/lipila-callback`;
    const origin = asText(req.headers.get("origin")) || "";
    const fallbackRedirect = origin ? `${origin}/customer/payments?payment_code=${paymentCode}` : undefined;
    const redirectUrl = asText(body.redirect_url) || fallbackRedirect || callbackUrl;
    const { firstName, lastName } = buildCustomerName(fullName);

    const narration = `${description} ${paymentCode}`.trim();

    const callbackMeta = {
      wallet_owner_type: body.wallet_owner_type || (body.customer_id ? "customer" : null),
      wallet_user_id: body.wallet_user_id || null,
      agent_user_id: body.agent_user_id || null,
      payment_type: body.payment_type || null,
      description: body.description || null,
      payment_method: body.payment_method || null,
      internal_amount: normalizedInternalAmount,
      internal_currency: internalCurrency,
      gateway_amount: normalizedGatewayAmount,
      gateway_currency: gatewayCurrency,
    };

    const lipilaHeaders: Record<string, string> = {
      accept: "application/json",
      "x-api-key": apiKey,
      "Content-Type": "application/json",
      callbackUrl,
    };

    let lipilaEndpoint: string;
    let lipilaPayload: Record<string, unknown>;

    if (paymentMethod === "mobile_money") {
      // Mobile Money Collections endpoint per Lipila docs
      lipilaEndpoint = `${lipilaBaseUrl}/api/v1/collections/mobile-money`;
      lipilaPayload = {
        referenceId: paymentCode,
        amount: normalizedGatewayAmount,
        narration,
        accountNumber: phoneNumber,
        currency: gatewayCurrency,
        email,
      };
    } else {
      // Card Collections endpoint per Lipila docs (nested structure)
      lipilaEndpoint = `${lipilaBaseUrl}/api/v1/collections/card`;
      lipilaPayload = {
        customerInfo: {
          firstName,
          lastName,
          phoneNumber,
          city,
          country,
          address,
          zip,
          email,
        },
        collectionRequest: {
          referenceId: paymentCode,
          amount: normalizedGatewayAmount,
          narration,
          accountNumber: phoneNumber,
          currency: gatewayCurrency,
          backUrl: redirectUrl,
          redirectUrl,
        },
      };
    }

    console.log(
      `Lipila ${paymentMethod} request to ${lipilaEndpoint}:`,
      JSON.stringify({
        internalAmount: normalizedInternalAmount,
        internalCurrency,
        gatewayAmount: normalizedGatewayAmount,
        gatewayCurrency,
        payload: lipilaPayload,
      }),
    );

    let lipilaResponse = await fetch(lipilaEndpoint, {
      method: "POST",
      headers: lipilaHeaders,
      body: JSON.stringify(lipilaPayload),
    });

    let lipilaData = await parseResponseBody(lipilaResponse);
    console.log(`Lipila ${paymentMethod} response (${lipilaResponse.status}):`, JSON.stringify(lipilaData));

    const checkoutUrl = extractCheckoutUrl(lipilaData);
    const providerReference =
      asText(lipilaData.identifier) ||
      asText(lipilaData.transactionReference) ||
      asText(lipilaData.transactionId) ||
      asText(lipilaData.transaction_id) ||
      asText(lipilaData.id) ||
      asText(lipilaData.referenceId) ||
      asText(lipilaData.reference);

    // For mobile money, success means the prompt was sent (no redirect URL needed)
    const isMomoSuccess = paymentMethod === "mobile_money" && lipilaResponse.ok;
    const isCardSuccess = paymentMethod === "card" && lipilaResponse.ok && checkoutUrl;

    if (!isMomoSuccess && !isCardSuccess) {
      await supabase
        .from("payments")
        .update({
          status: "failed",
          callback_data: {
            payment_type: body.payment_type || null,
            wallet_owner_type: callbackMeta.wallet_owner_type,
            agent_user_id: body.agent_user_id || null,
            description: body.description || null,
            payment_method: body.payment_method || null,
            request: { ...lipilaPayload, ...callbackMeta },
            response: lipilaData,
            status: lipilaResponse.status,
          },
        })
        .eq("id", payment.id);

      const errorMsg =
        asText(lipilaData.message) ||
        asText(lipilaData.error) ||
        asText(lipilaData.details) ||
        "Payment initiation failed";

      return new Response(
        JSON.stringify({
          error: errorMsg,
          details: lipilaData,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Determine the status based on the Lipila response
    const lipilaStatus = asText(lipilaData.status)?.toLowerCase();
    let paymentStatus = "processing";
    if (lipilaStatus === "successful" || lipilaStatus === "success" || lipilaStatus === "completed") {
      paymentStatus = "completed";
    }

    await supabase
      .from("payments")
      .update({
        provider_reference: providerReference,
        status: paymentStatus,
        callback_data: {
          payment_type: body.payment_type || null,
          wallet_owner_type: callbackMeta.wallet_owner_type,
          agent_user_id: body.agent_user_id || null,
          description: body.description || null,
          payment_method: body.payment_method || null,
          request: { ...lipilaPayload, ...callbackMeta },
          response: lipilaData,
        },
      })
      .eq("id", payment.id);

    return new Response(
      JSON.stringify({
        success: true,
        payment_code: paymentCode,
        payment_id: payment.id,
        payment_method: paymentMethod,
        message:
          paymentMethod === "mobile_money"
            ? "A payment prompt has been sent to your phone. Enter your PIN to complete the payment."
            : "Payment initiated. Complete the payment on the Lipila page.",
        provider_reference: providerReference,
        charged_amount: normalizedGatewayAmount,
        charged_currency: gatewayCurrency,
        checkout_url: checkoutUrl || null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Lipila payment error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Internal server error", details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
