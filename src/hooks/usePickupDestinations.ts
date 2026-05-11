import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PickupDestination = {
  id: string;
  name: string;
  requires_details: boolean;
  sort_order: number;
  is_active: boolean;
};

export const usePickupDestinations = () => {
  const [destinations, setDestinations] = useState<PickupDestination[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDestinations = async () => {
    const { data, error } = await supabase
      .from("pickup_destinations")
      .select("id, name, requires_details, sort_order, is_active")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (!error) {
      setDestinations((data || []) as PickupDestination[]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchDestinations();
  }, []);

  const options = useMemo(
    () =>
      destinations.map((dest) => ({
        id: dest.id,
        label: dest.name,
        value: dest.id,
        requires_details: dest.requires_details,
      })),
    [destinations]
  );

  return { destinations, options, isLoading, refresh: fetchDestinations };
};
