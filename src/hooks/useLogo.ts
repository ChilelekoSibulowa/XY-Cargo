import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import logoImage from "@/assets/logo.png";

const FALLBACK_LOGO = logoImage;

let cachedLogoUrl: string | null = null;
let logoPromise: Promise<string> | null = null;

export const fetchLogo = async (): Promise<string> => {
  if (cachedLogoUrl) return cachedLogoUrl;
  
  const { data } = await supabase
    .from("system_settings")
    .select("setting_value")
    .eq("setting_key", "company_logo_url")
    .maybeSingle();
  
  cachedLogoUrl = data?.setting_value || FALLBACK_LOGO;
  return cachedLogoUrl;
};

export const useLogo = () => {
  const [logoUrl, setLogoUrl] = useState<string>(cachedLogoUrl || FALLBACK_LOGO);
  const [isLoading, setIsLoading] = useState(!cachedLogoUrl);

  useEffect(() => {
    if (cachedLogoUrl) {
      setLogoUrl(cachedLogoUrl);
      setIsLoading(false);
      return;
    }

    if (!logoPromise) {
      logoPromise = fetchLogo();
    }

    logoPromise.then((url) => {
      setLogoUrl(url);
      setIsLoading(false);
    });
  }, []);

  return { logoUrl, isLoading, fallbackUrl: FALLBACK_LOGO };
};

export const clearLogoCache = () => {
  cachedLogoUrl = null;
  logoPromise = null;
};
