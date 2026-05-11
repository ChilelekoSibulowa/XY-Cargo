import { useEffect, useState } from "react";
import { hasSupabaseEnv, supabase } from "@/integrations/supabase/client";
import { mergeCmsContent } from "@/lib/cmsContent";

export const useCmsPage = <T,>(slug: string, fallback: T) => {
  const [data, setData] = useState<T>(fallback);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    if (!hasSupabaseEnv) {
      setIsLoading(false);
      return () => {
        isMounted = false;
      };
    }

    const fetchData = async () => {
      const { data: cmsRow } = await supabase
        .from("cms_pages")
        .select("data")
        .eq("slug", slug)
        .maybeSingle();

      if (cmsRow?.data && isMounted) {
        setData(mergeCmsContent(fallback, cmsRow.data));
      }
      if (isMounted) {
        setIsLoading(false);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [slug]);

  return { data, isLoading };
};
