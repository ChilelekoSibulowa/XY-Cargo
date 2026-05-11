declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: (...args: unknown[]) => void;
  }
}

export const META_PIXEL_ID = "1451366953138931";

const getCookie = (name: string) => {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
};

export const getAttributionData = () => {
  const params = new URLSearchParams(window.location.search);
  const fbclid = params.get("fbclid");
  const nowSeconds = Math.floor(Date.now() / 1000);
  const fbp = getCookie("_fbp") || null;

  let fbc = getCookie("_fbc");
  if (!fbc && fbclid) {
    fbc = `fb.1.${nowSeconds}.${fbclid}`;
  }

  return {
    fbp,
    fbc,
    fbclid,
    utm_source: params.get("utm_source") || null,
    utm_medium: params.get("utm_medium") || null,
    utm_campaign: params.get("utm_campaign") || null,
    utm_term: params.get("utm_term") || null,
    utm_content: params.get("utm_content") || null,
    page_path: `${window.location.pathname}${window.location.search}`,
    page_url: window.location.href,
    referrer: document.referrer || null,
  };
};

export const trackMetaEvent = (eventName: string, payload?: Record<string, unknown>) => {
  if (!window.fbq) return;
  if (payload && Object.keys(payload).length > 0) {
    window.fbq("track", eventName, payload);
    return;
  }
  window.fbq("track", eventName);
};
