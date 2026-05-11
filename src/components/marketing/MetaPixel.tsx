import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { META_PIXEL_ID, getAttributionData, trackMetaEvent } from "@/lib/metaPixel";

/**
 * Meta Pixel (Facebook Pixel) Tracker
 * Loads the Facebook tracking pixel for marketing analytics
 * Only initializes once per session
 */
export const MetaPixel = () => {
  const location = useLocation();
  const hasTrackedInitialViewRef = useRef(false);

  useEffect(() => {
    if (!window.fbq) {
      (function (f: Window & typeof globalThis, b: Document, e: string, v: string, n?: any, t?: any, s?: any) {
        if (f.fbq) return;
        n = f.fbq = function (...args: unknown[]) {
          if (n.callMethod) {
            n.callMethod.apply(n, args);
          } else {
            n.queue.push(args);
          }
        };
        if (!f._fbq) f._fbq = n;
        n.push = n;
        n.loaded = true;
        n.version = "2.0";
        n.queue = [];
        s = b.getElementsByTagName(e)[0];
        if (!s?.parentNode) {
          return;
        }
        t = b.createElement(e);
        t.async = true;
        t.src = v;
        s.parentNode.insertBefore(t, s);
      })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");

      window.fbq("init", META_PIXEL_ID);
    }

    const attribution = getAttributionData();
    trackMetaEvent("PageView", {
      page_path: attribution.page_path,
      page_url: attribution.page_url,
      utm_source: attribution.utm_source ?? undefined,
      utm_campaign: attribution.utm_campaign ?? undefined,
      utm_medium: attribution.utm_medium ?? undefined,
    });

    if (!hasTrackedInitialViewRef.current) {
      trackMetaEvent("ViewContent", {
        content_name: "Marketing Site",
        content_category: "website",
      });
      hasTrackedInitialViewRef.current = true;
    }
  }, [location.pathname, location.search]);

  return null; // This component doesn't render anything
};

export default MetaPixel;
