import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

const GA_MEASUREMENT_ID = "G-84Z3B4TFLK";
const PREVIEW_PLATFORM_TOKEN = ["lo", "vable"].join("");
const PREVIEW_HOST_PARTS = [
  `${PREVIEW_PLATFORM_TOKEN}.app`,
  `${PREVIEW_PLATFORM_TOKEN}.dev`,
  `${PREVIEW_PLATFORM_TOKEN}project.com`,
];

const isPreviewBuilderHost = (host: string) => {
  const normalized = host.toLowerCase();
  return PREVIEW_HOST_PARTS.some((part) => normalized.includes(part));
};

const isPreviewBuilderTraffic = () => {
  if (isPreviewBuilderHost(window.location.hostname)) return true;
  if (!document.referrer) return false;

  try {
    return isPreviewBuilderHost(new URL(document.referrer).hostname);
  } catch {
    return document.referrer.toLowerCase().includes(PREVIEW_PLATFORM_TOKEN);
  }
};

const getTrafficSource = () => {
  const params = new URLSearchParams(window.location.search);
  const utmSource = (params.get("utm_source") || "").trim().toLowerCase();
  if (utmSource) return utmSource;

  const referrer = (document.referrer || "").trim();
  if (!referrer) return "direct";

  try {
    const refHost = new URL(referrer).hostname.toLowerCase();
    if (refHost.startsWith("www.")) {
      return refHost.slice(4);
    }
    return refHost;
  } catch {
    return "referral";
  }
};

const isBlockedMarketingAnalyticsTraffic = (pagePath: string, trafficSource: string) =>
  pagePath.toLowerCase().includes(PREVIEW_PLATFORM_TOKEN) || trafficSource.toLowerCase().includes(PREVIEW_PLATFORM_TOKEN);

const recordPageViewDirect = async (pagePath: string, trafficSource: string, isLandingPage: boolean) => {
  if (isBlockedMarketingAnalyticsTraffic(pagePath, trafficSource)) return;

  const viewDate = new Date().toISOString().slice(0, 10);

  const existingRes = await supabase
    .from("marketing_page_analytics")
    .select("id, views")
    .eq("view_date", viewDate)
    .eq("page_path", pagePath)
    .eq("traffic_source", trafficSource)
    .maybeSingle();

  if (existingRes.error) {
    console.error("[GoogleAnalytics] Failed to read analytics row:", existingRes.error.message);
    return;
  }

  if (existingRes.data?.id) {
    const nextViews = Number(existingRes.data.views || 0) + 1;
    const updateRes = await supabase
      .from("marketing_page_analytics")
      .update({ views: nextViews, is_landing_page: isLandingPage || false })
      .eq("id", existingRes.data.id);

    if (updateRes.error) {
      console.error("[GoogleAnalytics] Failed to update analytics row:", updateRes.error.message);
    }
    return;
  }

  const insertRes = await supabase.from("marketing_page_analytics").insert({
    page_path: pagePath,
    view_date: viewDate,
    views: 1,
    traffic_source: trafficSource,
    is_landing_page: isLandingPage,
  });

  if (insertRes.error) {
    console.error("[GoogleAnalytics] Failed to insert analytics row:", insertRes.error.message);
  }
};

const recordPageView = async (pagePath: string, trafficSource: string, isLandingPage: boolean) => {
  if (isBlockedMarketingAnalyticsTraffic(pagePath, trafficSource)) return;

  const rpcRes = await supabase.rpc("record_marketing_page_view" as any, {
    p_page_path: pagePath,
    p_traffic_source: trafficSource,
    p_is_landing_page: isLandingPage,
  });

  if (!rpcRes.error) return;

  const rpcMessage = rpcRes.error.message || "Unknown RPC error";
  console.warn("[GoogleAnalytics] RPC failed, falling back to direct table write:", rpcMessage);
  await recordPageViewDirect(pagePath, trafficSource, isLandingPage);
};

export const GoogleAnalytics = () => {
  const location = useLocation();
  const lastTrackedPathRef = useRef<string | null>(null);

  // Track page views on route change
  useEffect(() => {
    const pagePath = `${location.pathname}${location.search}`;
    if (lastTrackedPathRef.current === pagePath) return;
    if (isPreviewBuilderTraffic()) {
      lastTrackedPathRef.current = pagePath;
      return;
    }

    const trafficSource = getTrafficSource();
    const isLandingPage = location.pathname === "/";
    void recordPageView(pagePath, trafficSource, isLandingPage);

    if (window.gtag && lastTrackedPathRef.current !== null) {
      window.gtag("config", GA_MEASUREMENT_ID, {
        page_path: pagePath,
      });
    }

    lastTrackedPathRef.current = pagePath;
  }, [location.pathname, location.search]);

  return null;
};

// Helper function to track custom events
export const trackEvent = (
  eventName: string,
  eventParams?: Record<string, unknown>
) => {
  if (window.gtag) {
    window.gtag("event", eventName, eventParams);
  }
};
