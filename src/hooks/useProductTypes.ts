import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ProductType = {
  id: string;
  name: string;
  service_type: "air" | "sea";
  description: string | null;
  sort_order: number | null;
  is_active: boolean | null;
};

export type ProductTypeOption = {
  id: string;
  value: string;
  label: string;
};

export const useProductTypes = () => {
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProductTypes = async () => {
    const { data, error } = await supabase
      .from("product_types")
      .select("id, name, service_type, description, sort_order, is_active")
      .eq("is_active", true)
      .order("service_type", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (!error) {
      setProductTypes((data || []) as ProductType[]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchProductTypes();
  }, []);

  const optionsByService = useMemo(() => {
    const byService: Record<"air" | "sea", ProductTypeOption[]> = {
      air: [],
      sea: [],
    };

    productTypes.forEach((type) => {
      if (type.service_type === "air" || type.service_type === "sea") {
        byService[type.service_type].push({
          id: type.id,
          value: type.name,
          label: type.name,
        });
      }
    });

    return byService;
  }, [productTypes]);

  return { productTypes, isLoading, optionsByService, refresh: fetchProductTypes };
};
