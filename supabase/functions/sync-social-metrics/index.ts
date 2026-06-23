// Supabase Edge Function: sync social media metrics from Meta Graph API
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
  userAccessToken: string;
  pageId: string;
  instagramAccountId: string;
  missing: string[];
}

async function loadMetaCredentials(supabase: any): Promise<MetaCredentials> {
  let pageAccessToken = Deno.env.get("META_PAGE_ACCESS_TOKEN") ?? "";
  let pageId = Deno.env.get("META_PAGE_ID") ?? "";
  let instagramAccountId = Deno.env.get("META_INSTAGRAM_ACCOUNT_ID") ?? "";

  // Prefer api_secrets table values over env vars
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

  // Keep the original user token for Ads API (needs user token, not page token)
  const userAccessToken = pageAccessToken;

  // If we have a user token and a page ID, exchange for a real Page Access Token
  if (pageAccessToken && pageId) {
    try {
      const exchangeUrl = `${GRAPH_API}/${pageId}?fields=access_token&access_token=${pageAccessToken}`;
      console.log("Exchanging user token for page token...");
      const exchangeRes = await fetch(exchangeUrl);
      const exchangeData = await exchangeRes.json();
      if (exchangeData.access_token) {
        console.log("Successfully obtained Page Access Token");
        pageAccessToken = exchangeData.access_token;
      } else {
        console.warn("Could not exchange for page token:", JSON.stringify(exchangeData));
      }
    } catch (e) {
      console.warn("Token exchange failed:", e);
    }
  }

  const missing = [
    !pageAccessToken ? "META_PAGE_ACCESS_TOKEN" : null,
    !pageId ? "META_PAGE_ID" : null,
  ].filter(Boolean) as string[];

  return { pageAccessToken, userAccessToken, pageId, instagramAccountId, missing };
}

interface PlatformMetrics {
  platform: string;
  followers: number;
  views: number;
  likes: number;
  reach: number;
  leads: number;
  engagements: number;
  clicks: number;
  engagement_rate: number;
  growth_rate: number;
}

async function fetchFacebookMetrics(pageId: string, accessToken: string): Promise<PlatformMetrics | null> {
  if (!pageId || !accessToken) return null;

  try {
    // Get page info (followers / fan count)
    const pageUrl = `${GRAPH_API}/${pageId}?fields=followers_count,fan_count,name,category&access_token=${accessToken}`;
    console.log("Fetching FB page:", `${GRAPH_API}/${pageId}?fields=followers_count,fan_count,name,category`);
    const pageRes = await fetch(pageUrl);
    const pageData = await pageRes.json();
    console.log("FB page response:", JSON.stringify(pageData));
    if (pageData.error) {
      console.error("Facebook API error:", pageData.error.message);
      return null;
    }
    const followers = pageData.followers_count || pageData.fan_count || 0;

    // Get page insights using non-deprecated metrics (v21+)
    // page_media_view replaces page_impressions; page_follows replaces page_fans
    const insightsUrl = `${GRAPH_API}/${pageId}/insights?metric=page_media_view,page_post_engagements,page_follows&period=days_28&access_token=${accessToken}`;
    const insightsRes = await fetch(insightsUrl);
    const insightsData = await insightsRes.json();
    console.log("FB insights response:", JSON.stringify(insightsData).substring(0, 800));

    let reach = 0;
    let engagements = 0;
    let views = 0;
    let newFollows = 0;

    if (insightsData.data && Array.isArray(insightsData.data)) {
      const insights = insightsData.data;
      const getInsightValue = (name: string): number => {
        const metric = insights.find((m: any) => m.name === name);
        if (!metric?.values?.length) return 0;
        return metric.values[metric.values.length - 1]?.value || 0;
      };

      views = getInsightValue("page_media_view");
      reach = views; // media views approximate reach
      engagements = getInsightValue("page_post_engagements");
      newFollows = getInsightValue("page_follows");
    } else {
      console.warn("FB insights returned no data array, trying individual metrics...");
      // Fallback: try fetching metrics one by one
      for (const metric of ["page_post_engagements", "page_media_view", "page_follows"]) {
        try {
          const singleUrl = `${GRAPH_API}/${pageId}/insights/${metric}?period=days_28&access_token=${accessToken}`;
          const singleRes = await fetch(singleUrl);
          const singleData = await singleRes.json();
          if (singleData.data?.[0]?.values?.length) {
            const val = singleData.data[0].values[singleData.data[0].values.length - 1]?.value || 0;
            if (metric === "page_post_engagements") engagements = val;
            if (metric === "page_media_view") { views = val; reach = val; }
            if (metric === "page_follows") newFollows = val;
          }
        } catch (e) {
          console.warn(`Failed to fetch ${metric}:`, e);
        }
      }
    }

    // Also try to get page_total_media_view_unique for unique reach
    try {
      const reachUrl = `${GRAPH_API}/${pageId}/insights/page_total_media_view_unique?period=days_28&access_token=${accessToken}`;
      const reachRes = await fetch(reachUrl);
      const reachData = await reachRes.json();
      if (reachData.data?.[0]?.values?.length) {
        const uniqueReach = reachData.data[0].values[reachData.data[0].values.length - 1]?.value || 0;
        if (uniqueReach > 0) reach = uniqueReach;
      }
    } catch (_) { /* ignore */ }

    const engagement_rate = reach > 0 ? (engagements / reach) * 100 : (followers > 0 ? (engagements / followers) * 100 : 0);
    const growth_rate = followers > 0 ? (newFollows / followers) * 100 : 0;

    return {
      platform: "Facebook",
      followers,
      views,
      likes: engagements > 0 ? Math.round(engagements * 0.6) : 0,
      reach,
      leads: 0,
      engagements,
      clicks: engagements > 0 ? Math.round(engagements * 0.15) : 0,
      engagement_rate: Math.round(engagement_rate * 100) / 100,
      growth_rate: Math.round(growth_rate * 100) / 100,
    };
  } catch (error) {
    console.error("Facebook metrics error:", error);
    return null;
  }
}

async function fetchInstagramMetrics(igAccountId: string, accessToken: string): Promise<PlatformMetrics | null> {
  if (!igAccountId || !accessToken) return null;

  try {
    // Get IG account info
    const accountRes = await fetch(
      `${GRAPH_API}/${igAccountId}?fields=followers_count,media_count&access_token=${accessToken}`
    );
    const accountData = await accountRes.json();
    const followers = accountData.followers_count || 0;

    // Get IG insights
    const insightsRes = await fetch(
      `${GRAPH_API}/${igAccountId}/insights?metric=impressions,reach,accounts_engaged,profile_views&period=days_28&metric_type=total_value&access_token=${accessToken}`
    );
    const insightsData = await insightsRes.json();
    const insights = insightsData.data || [];

    const getInsightValue = (name: string): number => {
      const metric = insights.find((m: any) => m.name === name);
      if (metric?.total_value?.value) return metric.total_value.value;
      if (!metric?.values?.length) return 0;
      return metric.values[metric.values.length - 1]?.value || 0;
    };

    const reach = getInsightValue("reach");
    const impressions = getInsightValue("impressions");
    const engagements = getInsightValue("accounts_engaged");
    const profileViews = getInsightValue("profile_views");

    const engagement_rate = reach > 0 ? (engagements / reach) * 100 : 0;

    return {
      platform: "Instagram",
      followers,
      views: impressions,
      likes: Math.round(engagements * 0.7),
      reach,
      leads: 0,
      engagements,
      clicks: profileViews,
      engagement_rate: Math.round(engagement_rate * 100) / 100,
      growth_rate: 0,
    };
  } catch (error) {
    console.error("Instagram metrics error:", error);
    return null;
  }
}

async function fetchMetaCampaigns(accessToken: string): Promise<any[]> {
  const campaigns: any[] = [];
  try {
    // Discover ad accounts from the user token
    const accountsRes = await fetch(`${GRAPH_API}/me/adaccounts?fields=id,name,account_status&access_token=${accessToken}`);
    const accountsData = await accountsRes.json();
    console.log("Ad accounts response:", JSON.stringify(accountsData).substring(0, 500));

    if (!accountsData.data || accountsData.data.length === 0) {
      console.warn("No ad accounts found for this token");
      return [];
    }

    for (const account of accountsData.data) {
      if (account.account_status !== 1) continue; // Only active accounts
      const adAccountId = account.id; // format: act_XXXXX

      // Fetch campaigns with insights
      const campaignsUrl = `${GRAPH_API}/${adAccountId}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time&filtering=[{"field":"effective_status","operator":"IN","value":["ACTIVE","PAUSED"]}]&limit=50&access_token=${accessToken}`;
      const campaignsRes = await fetch(campaignsUrl);
      const campaignsData = await campaignsRes.json();
      console.log(`Campaigns for ${adAccountId}:`, JSON.stringify(campaignsData).substring(0, 800));

      if (!campaignsData.data) continue;

      for (const campaign of campaignsData.data) {
        // Fetch insights for each campaign (last 28 days)
        let spend = 0, reach = 0, impressions = 0, clicks = 0, leads = 0, engagements = 0, pageLikes = 0;
        try {
          const insightsUrl = `${GRAPH_API}/${campaign.id}/insights?fields=spend,reach,impressions,clicks,actions&date_preset=last_28d&access_token=${accessToken}`;
          const insightsRes = await fetch(insightsUrl);
          const insightsData = await insightsRes.json();
          if (insightsData.data?.[0]) {
            const d = insightsData.data[0];
            spend = parseFloat(d.spend || "0");
            reach = parseInt(d.reach || "0", 10);
            impressions = parseInt(d.impressions || "0", 10);
            clicks = parseInt(d.clicks || "0", 10);
            if (d.actions && Array.isArray(d.actions)) {
              for (const action of d.actions) {
                if (action.action_type === "lead") leads += parseInt(action.value || "0", 10);
                if (action.action_type === "post_engagement") engagements += parseInt(action.value || "0", 10);
                if (action.action_type === "like") pageLikes += parseInt(action.value || "0", 10);
                if (action.action_type === "page_engagement") engagements += parseInt(action.value || "0", 10);
              }
            }
          }
        } catch (e) {
          console.warn(`Failed to fetch insights for campaign ${campaign.id}:`, e);
        }

        const budget = campaign.lifetime_budget
          ? parseFloat(campaign.lifetime_budget) / 100
          : campaign.daily_budget
            ? (parseFloat(campaign.daily_budget) / 100) * 28
            : 0;

        campaigns.push({
          meta_campaign_id: campaign.id,
          name: campaign.name,
          channel: "Facebook / Instagram",
          platform: "Meta",
          data_source: "meta",
          status: campaign.status === "ACTIVE" ? "active" : campaign.status === "PAUSED" ? "paused" : "completed",
          budget,
          spend,
          leads,
          revenue_attributed: 0,
          views: impressions,
          viewers: reach,
          engagements,
          reach,
          page_likes: pageLikes,
          link_clicks: clicks,
          start_date: campaign.start_time ? campaign.start_time.split("T")[0] : null,
          end_date: campaign.stop_time ? campaign.stop_time.split("T")[0] : null,
          notes: `Meta Campaign ID: ${campaign.id}`,
        });
      }
    }
  } catch (error) {
    console.error("Campaign fetch error:", error);
  }
  return campaigns;
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

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { pageAccessToken: META_PAGE_ACCESS_TOKEN, userAccessToken, pageId: META_PAGE_ID, instagramAccountId: META_INSTAGRAM_ACCOUNT_ID, missing } =
    await loadMetaCredentials(adminClient);

  if (missing.length > 0) {
    return new Response(JSON.stringify({
      success: false,
      error: `${missing.join(", ")} not configured. Add active Meta credentials in Settings -> API Secrets.`,
      missing,
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = adminClient;
  const today = new Date().toISOString().split("T")[0];
  const results: string[] = [];

  // Fetch social metrics and campaigns in parallel
  const [fbMetrics, igMetrics, metaCampaigns] = await Promise.all([
    fetchFacebookMetrics(META_PAGE_ID, META_PAGE_ACCESS_TOKEN),
    fetchInstagramMetrics(META_INSTAGRAM_ACCOUNT_ID, META_PAGE_ACCESS_TOKEN),
    fetchMetaCampaigns(userAccessToken),
  ]);

  for (const metrics of [fbMetrics, igMetrics]) {
    if (!metrics) continue;

    const { error } = await supabase
      .from("marketing_social_metrics")
      .upsert(
        {
          platform: metrics.platform,
          followers: metrics.followers,
          views: metrics.views,
          likes: metrics.likes,
          reach: metrics.reach,
          leads: metrics.leads,
          engagements: metrics.engagements,
          clicks: metrics.clicks,
          engagement_rate: metrics.engagement_rate,
          growth_rate: metrics.growth_rate,
          recorded_at: today,
        },
        { onConflict: "platform,recorded_at", ignoreDuplicates: false }
      );

    if (error) {
      const { error: insertError } = await supabase
        .from("marketing_social_metrics")
        .insert({
          platform: metrics.platform,
          followers: metrics.followers,
          views: metrics.views,
          likes: metrics.likes,
          reach: metrics.reach,
          leads: metrics.leads,
          engagements: metrics.engagements,
          clicks: metrics.clicks,
          engagement_rate: metrics.engagement_rate,
          growth_rate: metrics.growth_rate,
          recorded_at: today,
        });

      if (insertError) {
        results.push(`${metrics.platform}: error - ${insertError.message}`);
        continue;
      }
    }

    results.push(`${metrics.platform}: synced (${metrics.followers} followers, ${metrics.reach} reach, ${metrics.engagements} engagements)`);
  }

  // Sync campaigns to marketing_campaigns table
  if (metaCampaigns.length > 0) {
    for (const campaign of metaCampaigns) {
      let { data: existing } = await supabase
        .from("marketing_campaigns")
        .select("id")
        .eq("meta_campaign_id", campaign.meta_campaign_id)
        .limit(1);

      if (!existing || existing.length === 0) {
        const fallback = await supabase
          .from("marketing_campaigns")
          .select("id")
          .eq("name", campaign.name)
          .eq("channel", campaign.channel)
          .limit(1);
        existing = fallback.data;
      }

      if (existing && existing.length > 0) {
        // Update existing campaign
        const { error } = await supabase
          .from("marketing_campaigns")
          .update({
            status: campaign.status,
            platform: campaign.platform,
            data_source: "meta",
            meta_campaign_id: campaign.meta_campaign_id,
            budget: campaign.budget,
            spend: campaign.spend,
            leads: campaign.leads,
            views: campaign.views,
            viewers: campaign.viewers,
            engagements: campaign.engagements,
            reach: campaign.reach,
            page_likes: campaign.page_likes,
            link_clicks: campaign.link_clicks,
            start_date: campaign.start_date,
            end_date: campaign.end_date,
            notes: campaign.notes,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing[0].id);

        if (error) {
          results.push(`Campaign "${campaign.name}": update error - ${error.message}`);
        } else {
          results.push(`Campaign "${campaign.name}": updated`);
        }
      } else {
        // Insert new campaign
        const { error } = await supabase
          .from("marketing_campaigns")
          .insert(campaign);

        if (error) {
          results.push(`Campaign "${campaign.name}": insert error - ${error.message}`);
        } else {
          results.push(`Campaign "${campaign.name}": created`);
        }
      }
    }
    results.push(`Campaigns: synced ${metaCampaigns.length} from Meta Ads`);
  } else {
    results.push("Campaigns: no ad campaigns found (ensure token has ads_read permission)");
  }

  if (results.length === 0) {
    results.push("No platforms configured. Set META_PAGE_ID and META_PAGE_ACCESS_TOKEN.");
  }

  return new Response(JSON.stringify({ success: true, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
