import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { notifyPaymentReceived } from "@/lib/notifications";
import { format } from "date-fns";
import { useDefaultCurrency } from "@/hooks/useDefaultCurrency";
import { getShipmentInvoiceTotal } from "@/lib/financePortal";
import { getWarehouseTrackingNumber, resolveTrackingByStatus } from "@/lib/shipmentNotes";
import { CheckCircle2 } from "lucide-react";

type ShipmentRow = {
  id: string;
  code: string;
  status: string | null;
  notes: string | null;
  payment_status: string | null;
  total_cost: number | null;
  shipping_cost: number | null;
  created_at: string;
  customer_id: string | null;
  customer: { full_name: string | null; code: string | null } | null;
};

const FinanceCodSettlements = () => {
  const { formatAmount } = useDefaultCurrency();
  const [shipments, setShipments] = useState<ShipmentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  const fetchShipments = async () => {
    const { data, error } = await supabase
      .from("shipments")
      .select("id, code, status, notes, payment_status, total_cost, shipping_cost, created_at, customer_id, customer:customers(full_name, code)")
      .eq("payment_method", "cash")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load COD shipments.");
      setShipments([]);
    } else {
      setShipments((data || []) as ShipmentRow[]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchShipments();
  }, []);

  const markSettled = async (id: string) => {
    setIsUpdating(id);
    const { error } = await supabase
      .from("shipments")
      .update({ payment_status: "completed" })
      .eq("id", id);

    if (error) {
      toast.error("Failed to settle COD payment.");
    } else {
      toast.success("COD payment marked as completed.");
      const settledShipment = shipments.find((s) => s.id === id);
      if (settledShipment?.customer_id) {
        const amount = getShipmentInvoiceTotal(settledShipment);
        const warehouseTracking = resolveTrackingByStatus(settledShipment.status, settledShipment.notes || null, null);
        notifyPaymentReceived(settledShipment.customer_id, String(amount), warehouseTracking);
      }
      setShipments((prev) =>
        prev.map((row) => (row.id === id ? { ...row, payment_status: "completed" } : row)),
      );
    }
    setIsUpdating(null);
  };

  const columns: Column<ShipmentRow>[] = [
    { key: "code", label: "Shipment" },
    {
      key: "customer",
      label: "Customer",
      render: (item) =>
        item.customer?.full_name
          ? `${item.customer.full_name}${item.customer.code ? ` (${item.customer.code})` : ""}`
          : item.customer?.code || "Customer",
    },
    {
      key: "total_cost",
      label: "Amount",
      align: "center",
      render: (item) => formatAmount(getShipmentInvoiceTotal(item)),
    },
    {
      key: "payment_status",
      label: "Status",
      render: (item) => (
        <StatusBadge status={item.payment_status || "pending"} label={item.payment_status || "pending"} />
      ),
    },
    {
      key: "created_at",
      label: "Date",
      render: (item) => format(new Date(item.created_at), "PP"),
    },
    {
      key: "action",
      label: "Action",
      render: (item) => (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 p-0"
          disabled={isUpdating === item.id || item.payment_status === "completed"}
          onClick={() => markSettled(item.id)}
          title={item.payment_status === "completed" ? "Already settled" : "Mark settled"}
        >
          <CheckCircle2 className="h-4 w-4 text-green-600" />
        </Button>
      ),
    },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="COD Settlements"
        
      />
      <DataTable
        columns={columns}
        data={shipments}
        isLoading={isLoading}
        searchPlaceholder="Search COD shipments..."
      />
    </div>
  );
};

export default FinanceCodSettlements;

