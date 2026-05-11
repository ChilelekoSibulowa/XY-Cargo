// Supabase Edge Function: publish a social media post to Facebook/Instagram via Meta Graph API
// Reads credentials from api_secrets table (with env var fallback)
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const GRAPH_API = "https://graph.facebook.com/v21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MetaCredentials {
  pageAccessToken: string;
  pageId: string;
  instagramAccountId: string;
}

async function loadMetaCredentials(supabase: any): Promise<MetaCredentials> {
  let pageAccessToken = Deno.env.get("META_PAGE_ACCESS_TOKEN") ?? "";
  let pageId = Deno.env.get("META_PAGE_ID") ?? "";
  let instagramAccountId = Deno.env.get("META_INSTAGRAM_ACCOUNT_ID") ?? "";

  const { data: rows } = await supabase
    .from("api_secrets")
    .select("secret_key, secret_value")
    .in("secret_key", ["META_PAGE_ACCESS_TOKEN", "META_PAGE_ID", "META_INSTAGRAM_ACCOUNT_ID"])
    .eq("is_active", true);

  if (rows && rows.length > 0) {
    for (const row of rows) {
      const val = (row.secret_value || "").trim();
      if (!val) continue;
      if (row.secret_key === "META_PAGE_ACCESS_TOKEN") pageAccessToken = val;
      if (row.secret_key === "META_PAGE_ID") pageId = val;
      if (row.secret_key === "META_INSTAGRAM_ACCOUNT_ID") instagramAccountId = val;
    }
  }

  return { pageAccessToken, pageId, instagramAccountId };
}

async function publishToFacebook(
  pageId: string,
  accessToken: string,
  message: string,
  link?: string,
): Promise<{ id: string } | { error: string }> {
  const params = new URLSearchParams({ message, access_token: accessToken });
  if (link) params.set("link", link);

  const res = await fetch(`${GRAPH_API}/${pageId}/feed`, {
    method: "POST",
    body: params,
  });
  const data = await res.json();
  if (data.error) return { error: data.error.message || "Facebook API error" };
  return { id: data.id };
}

async function publishToInstagram(
  igAccountId: string,
  accessToken: string,
  caption: string,
  imageUrl?: string,
): Promise<{ id: string } | { error: string }> {
  if (!imageUrl) {
    return { error: "Instagram requires an image URL to publish. Provide an image_url in the post." };
  }

  // Step 1: Create media container
  const containerParams = new URLSearchParams({
    image_url: imageUrl,
    caption,
    access_token: accessToken,
  });
  const containerRes = await fetch(`${GRAPH_API}/${igAccountId}/media`, {
    method: "POST",
    body: containerParams,
  });
  const containerData = await containerRes.json();
  if (containerData.error) return { error: containerData.error.message || "Instagram container error" };

  const creationId = containerData.id;
  if (!creationId) return { error: "Failed to get Instagram media container ID" };

  // Step 2: Publish the container
  const publishParams = new URLSearchParams({
    creation_id: creationId,
    access_token: accessToken,
  });
  const publishRes = await fetch(`${GRAPH_API}/${igAccountId}/media_publish`, {
    method: "POST",
    body: publishParams,
  });
  const publishData = await publishRes.json();
  if (publishData.error) return { error: publishData.error.message || "Instagram publish error" };
  return { id: publishData.id };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: "Missing Supabase env vars." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const creds = await loadMetaCredentials(supabase);

  if (!creds.pageAccessToken) {
    return new Response(
      JSON.stringify({ error: "META_PAGE_ACCESS_TOKEN not configured. Add it in Settings → API Secrets." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let body: {
    post_id: string;
    platform: string;
    content: string;
    link?: string;
    image_url?: string;
  };

  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { post_id, platform, content, link, image_url } = body;

  if (!post_id || !platform || !content) {
    return new Response(JSON.stringify({ error: "post_id, platform, and content are required." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: string[] = [];
  let success = false;

  if (platform === "Facebook") {
    if (!creds.pageId) {
      return new Response(
        JSON.stringify({ error: "META_PAGE_ID not configured. Add it in Settings → API Secrets." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const result = await publishToFacebook(creds.pageId, creds.pageAccessToken, content, link);
    if ("error" in result) {
      results.push(`Facebook: ${result.error}`);
    } else {
      results.push(`Facebook: published (ID: ${result.id})`);
      success = true;
    }
  } else if (platform === "Instagram") {
    if (!creds.instagramAccountId) {
      return new Response(
        JSON.stringify({ error: "META_INSTAGRAM_ACCOUNT_ID not configured. Add it in Settings → API Secrets." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const result = await publishToInstagram(creds.instagramAccountId, creds.pageAccessToken, content, image_url);
    if ("error" in result) {
      results.push(`Instagram: ${result.error}`);
    } else {
      results.push(`Instagram: published (ID: ${result.id})`);
      success = true;
    }
  } else {
    return new Response(
      JSON.stringify({ error: `Publishing to ${platform} is not supported. Only Facebook and Instagram are available via Meta API.` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Update the post status to "posted" if successful
  if (success) {
    await supabase
      .from("marketing_social_posts")
      .update({ status: "posted" })
      .eq("id", post_id);
  }

  return new Response(JSON.stringify({ success, results }), {
    status: success ? 200 : 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
