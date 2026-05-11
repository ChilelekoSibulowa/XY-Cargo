import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, Column } from "@/components/shared/DataTable";
import { useDefaultCurrency } from "@/hooks/useDefaultCurrency";
import { toast } from "sonner";

type RateRow = {
  id: string;
  name: string;
  service_type: "air" | "sea";
  rate_per_kg: number | null;
  rate_per_cbm: number | null;
  minimum_charge: number | null;
};

const AgentPricing = () => {
  const { formatAmount } = useDefaultCurrency();
  const [rates, setRates] = useState<RateRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadRates = async () => {
      const { data, error } = await supabase
        .from("shipping_rates")
        .select("id, name, service_type, rate_per_kg, rate_per_cbm, minimum_charge")
        .eq("is_active", true)
        .order("name");

      if (error) {
        toast.error("Failed to load shipping rates.");
        setRates([]);
      } else {
        setRates((data || []) as RateRow[]);
      }
      setIsLoading(false);
    };

    loadRates();
  }, []);

  const columns: Column<RateRow>[] = [
    { key: "name", label: "Rate Name" },
    {
      key: "service_type",
      label: "Service",
      render: (item) => (item.service_type === "air" ? "Air" : "Sea"),
    },
    {
      key: "rate_per_kg",
      label: "Rate per kg",
      render: (item) =>
        item.rate_per_kg !== null ? formatAmount(item.rate_per_kg) : "-",
    },
    {
      key: "rate_per_cbm",
      label: "Rate per CBM",
      render: (item) =>
        item.rate_per_cbm !== null ? formatAmount(item.rate_per_cbm) : "-",
    },
    {
      key: "minimum_charge",
      label: "Minimum Charge",
      render: (item) =>
        item.minimum_charge !== null ? formatAmount(item.minimum_charge) : "-",
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Agent Pricing"
        
      />

      <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
        Rates are shown for reference. Contact operations for agent-specific pricing updates.
      </div>

      <DataTable
        columns={columns}
        data={rates}
        isLoading={isLoading}
        searchPlaceholder="Search rates..."
      />
    </div>
  );
};

export default AgentPricing;

