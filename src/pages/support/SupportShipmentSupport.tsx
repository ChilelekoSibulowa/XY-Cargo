import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, Column } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { useDefaultCurrency } from "@/hooks/useDefaultCurrency";

type Row = { id: string; code: string; status: string; description: string | null; internal_notes: string | null; service_type: string; total_cost: number; customer_name?: string };

const SupportShipmentSupport = () => {
  const { symbol } = useDefaultCurrency();
  const [rows, setRows] = useState<Row[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.from("shipments").select("id, code, status, description, internal_notes, service_type, total_cost, customers(full_name)").not("internal_notes", "is", null).order("created_at", { ascending: false }).then(({ data }) => {
      setRows((data || []).map((d: any) => ({ ...d, customer_name: d.customers?.full_name })));
      setIsLoading(false);
    });
  }, []);

  const columns: Column<Row>[] = [
    { key: "code", label: "Code", render: (r) => <span className="font-mono text-xs">{r.code}</span> },
    { key: "customer_name", label: "Customer", render: (r) => r.customer_name || "-" },
    { key: "description", label: "Item", render: (r) => r.description || "-" },
    { key: "internal_notes", label: "Issue", render: (r) => <span className="max-w-[200px] truncate block">{r.internal_notes}</span> },
    { key: "status", label: "Status", render: (r) => <Badge variant="secondary">{r.status}</Badge> },
    { key: "total_cost", label: "Cost", render: (r) => `${symbol}${r.total_cost.toFixed(0)}` },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Shipment Support"  />
      <DataTable columns={columns} data={rows} isLoading={isLoading} searchPlaceholder="Search shipments..." viewLink={() => "/warehouse/shipments"} />
    </div>
  );
};

export default SupportShipmentSupport;

