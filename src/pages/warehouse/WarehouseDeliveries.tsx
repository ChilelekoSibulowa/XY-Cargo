import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, Column } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getProductType, getWarehouseTrackingNumber, resolveTrackingByStatus } from "@/lib/shipmentNotes";

type Row = {
  id: string;
  code: string;
  status: string;
  service_type: string;
  payment_status: string | null;
  created_at: string;
  custom_tracking_number: string | null;
  notes: string | null;
  description: string | null;
  customer_name?: string;
  customer_code?: string;
  customer_phone?: string;
  customer_email?: string | null;
  customer_country?: string | null;
  customer_city?: string | null;
};

const WarehouseDeliveries = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data, error } = await supabase
        .from("shipments")
        .select(
          "id, code, status, service_type, payment_status, created_at, custom_tracking_number, notes, description, customers(full_name, code, phone, email, country, city)"
        )
        .in("status", ["delivered", "closed"])
        .order("created_at", { ascending: false });

      if (error) {
        toast.error("Failed to load deliveries.");
        setRows([]);
        setIsLoading(false);
        return;
      }

      const mapped = (data || []).map((d: any) => ({
        ...d,
        customer_name: d.customers?.full_name || "-",
        customer_code: d.customers?.code || "-",
        customer_phone: d.customers?.phone || "-",
        customer_email: d.customers?.email || "-",
        customer_country: d.customers?.country || "-",
        customer_city: d.customers?.city || "-",
      }));

      setRows(mapped);
      setIsLoading(false);
    };
    fetch();
  }, []);

  const columns: Column<Row>[] = [
    { key: "customer_code", label: "Customer ID", render: (r) => <span className="font-mono text-xs">{r.customer_code}</span> },
    { key: "customer_name", label: "Name", render: (r) => r.customer_name || "-" },
    { key: "customer_phone", label: "Mobile No.", render: (r) => r.customer_phone || "-" },
    { key: "customer_email", label: "Email", render: (r) => r.customer_email || "-" },
    { key: "customer_country", label: "Country", render: (r) => r.customer_country || "-" },
    { key: "customer_city", label: "City", render: (r) => r.customer_city || "-" },
    { key: "product_type", label: "Product Type", render: (r) => getProductType(r.notes, r.description) },
    { key: "tracking", label: "Tracking No.", render: (r) => <span className="font-mono text-xs">{resolveTrackingByStatus(r.status, r.notes, r.custom_tracking_number) || "Tracking pending"}</span> },
    { key: "payment_status", label: "Payment Status", render: (r) => (
        <Badge variant={r.payment_status === "completed" ? "default" : "destructive"}>
          {r.payment_status === "completed" ? "Paid" : "Unpaid"}
        </Badge>
      ) },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Deliveries"  />
      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        searchPlaceholder="Search deliveries..."
        viewLink={() => "/warehouse/shipments"}
      />
    </div>
  );
};

export default WarehouseDeliveries;

