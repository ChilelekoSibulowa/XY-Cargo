import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, Column } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { useDefaultCurrency } from "@/hooks/useDefaultCurrency";
import { toast } from "sonner";
import { getProductType, getShipmentCbmValue, resolveTrackingByStatus } from "@/lib/shipmentNotes";
import { isUnconsolidatedConsolidationParcel } from "@/lib/parcelWorkflow";

type Row = {
  id: string;
  code: string;
  status: string;
  service_type: string;
  total_cost: number;
  shipping_cost: number;
  weight: number;
  cbm: number | null;
  payment_status: string | null;
  payment_method: string | null;
  pickup_date: string | null;
  estimated_delivery_date: string | null;
  custom_tracking_number: string | null;
  notes: string | null;
  description: string | null;
  created_at: string;
  branch_id: string | null;
  customer_name?: string;
  customer_code?: string;
  customer_phone?: string;
  branch_name?: string | null;
  consolidation_id?: string | null;
  handling_method?: string | null;
};

const pendingStatuses = ["saved_pickup", "saved_dropoff", "received", "requested_pickup", "approved"];

const statusLabel: Record<string, string> = {
  saved_pickup: "Created",
  saved_dropoff: "On the way to warehouse",
  received: "Arrived at Warehouse",
  requested_pickup: "Submitted",
  approved: "Ready to ship",
  assigned: "Departed from Warehouse",
  supplied: "In Transit",
  delivered: "Arrived at Warehouse",
  closed: "Collected",
};

const formatServiceType = (type: string) => (type === "air" ? "Air Freight" : "Sea Freight");

const formatPaymentMethod = (method: string | null) => {
  if (!method) return "-";
  const mapping: Record<string, string> = {
    cash: "Cash",
    wallet: "Wallet",
    bank_transfer: "Bank Transfer",
    mobile_money: "Mobile Money",
    lipila: "Lipila",
  };
  return mapping[method] || method;
};

const formatDate = (value: string | null) => (value ? new Date(value).toLocaleDateString() : "-");

const WarehousePendingShipments = () => {
  const { formatAmount } = useDefaultCurrency();
  const [rows, setRows] = useState<Row[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setIsLoading(true);
      try {
        const [shipmentsRes, consolidationsRes] = await Promise.all([
          supabase
            .from("shipments")
            .select(
              "id, code, status, service_type, total_cost, shipping_cost, weight, cbm, payment_status, payment_method, pickup_date, estimated_delivery_date, custom_tracking_number, notes, description, created_at, branch_id, consolidation_id, handling_method, customers(full_name, code, phone)"
            )
            .in("status", pendingStatuses as any)
            .order("created_at", { ascending: false }),
          supabase
            .from("consolidations")
            .select("id, code, status, notes, item_count, total_weight, total_cbm, total_cost, created_at, customer_id, customers(full_name, code, phone)")
            .in("status", ["submitted", "confirmed", "outgoing"] as any)
            .order("created_at", { ascending: false }),
        ]);

        let shipmentsData = shipmentsRes.data;
        let shipmentsError = shipmentsRes.error;

        if (shipmentsError && (shipmentsError.code === "42703" || shipmentsError.message.includes("consolidation_id"))) {
          const fallbackRes = await supabase
            .from("shipments")
            .select(
              "id, code, status, service_type, total_cost, shipping_cost, weight, cbm, payment_status, payment_method, pickup_date, estimated_delivery_date, custom_tracking_number, notes, description, created_at, branch_id, customers(full_name, code, phone)"
            )
            .in("status", pendingStatuses as any)
            .order("created_at", { ascending: false });
          shipmentsData = (fallbackRes.data || []).map(row => ({ ...row, consolidation_id: null }));
          shipmentsError = fallbackRes.error;
        }

        if (shipmentsError) throw shipmentsError;
        const data = shipmentsData;
        const consolidationsData = consolidationsRes.data;

        const branchIds = Array.from(
          new Set((data || []).map((item: any) => item.branch_id).filter(Boolean))
        );
        let branchMap: Record<string, string> = {};
        if (branchIds.length > 0) {
          const { data: branchData } = await supabase
            .from("branches")
            .select("id, name")
            .in("id", branchIds);
          branchMap = (branchData || []).reduce((acc, branch) => {
            acc[branch.id] = branch.name;
            return acc;
          }, {} as Record<string, string>);
        }

        const mappedShipments = ((data || []) as any[])
          .filter((row) => !row.consolidation_id && !isUnconsolidatedConsolidationParcel(row))
          .map((d: any) => ({
            ...d,
            cbm: getShipmentCbmValue(d),
            customer_name: d.customers?.full_name || "-",
            customer_code: d.customers?.code || "-",
            customer_phone: d.customers?.phone || "-",
            branch_name: d.branch_id ? branchMap[d.branch_id] || "-" : "-",
          }));

        const mappedConsolidations = ((consolidationsData || []) as any[]).map((c: any) => {
          const normalizedConsStatus = (c.status || "submitted").toLowerCase();
          const mappedStatus =
            normalizedConsStatus === "submitted" ? "requested_pickup" :
              normalizedConsStatus === "confirmed" ? "approved" :
                normalizedConsStatus === "outgoing" ? "assigned" :
                  normalizedConsStatus;

          return {
            id: c.id,
            code: c.code,
            status: mappedStatus,
            service_type: "Mixed",
            total_cost: c.total_cost || 0,
            shipping_cost: c.total_cost || 0,
            weight: c.total_weight || 0,
            cbm: c.total_cbm || 0,
            payment_status: "pending",
            payment_method: "-",
            pickup_date: null,
            estimated_delivery_date: null,
            custom_tracking_number: null,
            notes: c.notes,
            description: "Consolidated Shipment",
            created_at: c.created_at,
            branch_id: null,
            customer_name: c.customers?.full_name || "-",
            customer_code: c.customers?.code || "-",
            customer_phone: c.customers?.phone || "-",
            branch_name: "-",
          };
        });

        setRows([...mappedConsolidations, ...mappedShipments].sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ));
      } catch (err: any) {
        toast.error(err.message || "Failed to load pending shipments.");
        setRows([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetch();
  }, []);

  const columns: Column<Row>[] = [
    { key: "customer_code", label: "Customer ID", render: (r) => <span className="font-mono text-xs">{r.customer_code}</span> },
    { key: "customer_name", label: "Name", render: (r) => r.customer_name || "-" },
    { key: "status", label: "Status", render: (r) => <Badge variant="secondary">{statusLabel[r.status] || r.status}</Badge> },
    { key: "customer_phone", label: "Mobile No.", render: (r) => r.customer_phone || "-" },
    { key: "branch_name", label: "Branch", render: (r) => r.branch_name || "-" },
    { key: "product_type", label: "Product Type", render: (r) => getProductType(r.notes, r.description) },
    { key: "service_type", label: "Service Type", render: (r) => formatServiceType(r.service_type) },
    { key: "tracking", label: "Tracking No.", render: (r) => <span className="font-mono text-xs">{resolveTrackingByStatus(r.status, r.notes, r.custom_tracking_number) || "Tracking pending"}</span> },
    { key: "weight", label: "WT", render: (r) => `${r.weight}kg` },
    { key: "cbm", label: "Cubic Meters (CBM)", render: (r) => (r.cbm == null ? "-" : r.cbm.toFixed(2)) },
    { key: "shipping_cost", label: "Shipping Cost", render: (r) => formatAmount(r.shipping_cost || 0) },
    { key: "pickup_date", label: "Departure Date", render: (r) => formatDate(r.pickup_date || r.created_at) },
    { key: "payment_method", label: "Payment Method", render: (r) => formatPaymentMethod(r.payment_method) },
    { key: "eta", label: "ETA", render: (r) => formatDate(r.estimated_delivery_date) },
    {
      key: "payment_status", label: "Payment Status", render: (r) => (
        <Badge variant={r.payment_status === "completed" ? "default" : "destructive"}>
          {r.payment_status === "completed" ? "Paid" : "Unpaid"}
        </Badge>
      )
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Pending Shipments" />
      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        searchPlaceholder="Search pending..."
        viewLink={(r) => r.description === "Consolidated Shipment" ? "/warehouse/consolidations" : "/warehouse/shipments"}
      />
    </div>
  );
};

export default WarehousePendingShipments;

