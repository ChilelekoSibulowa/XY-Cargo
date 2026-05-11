import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { buildDeliveryCompletionPayload, getDeliveryRequestStatusLabel } from "@/lib/deliveryRequests";
import { getWarehouseTrackingNumber, resolveTrackingByStatus } from "@/lib/shipmentNotes";
import { toast } from "sonner";
import { notifyParcelDelivered } from "@/lib/notifications";
import { format } from "date-fns";
import { CheckCircle2, XCircle } from "lucide-react";

type ShipmentRow = {
  id: string;
  code: string;
  customer_id: string | null;
  notes: string | null;
  custom_tracking_number: string | null;
  delivery_request_status: string | null;
  delivery_request_requested_at: string | null;
  delivery_request_assigned_at: string | null;
  consolidation_shipments?: { consolidation_id: string }[] | null;
  customer: { full_name: string | null } | null;
  receiver: { full_name: string | null; phone: string | null } | null;
};

const DriverDeliveryUpdates = () => {
  const [shipments, setShipments] = useState<ShipmentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  const fetchShipments = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      setIsLoading(false);
      return;
    }

    const { data: driverRow } = await supabase
      .from("drivers")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!driverRow?.id) {
      toast.error("Driver profile not found.");
      setIsLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("shipments")
      .select(
        "id, code, customer_id, notes, custom_tracking_number, delivery_request_status, delivery_request_requested_at, delivery_request_assigned_at, consolidation_shipments(consolidation_id), customer:customers(full_name), receiver:receivers(full_name, phone)",
      )
      .eq("delivery_request_assigned_driver_id", driverRow.id)
      .not("delivery_request_status", "is", null)
      .order("delivery_request_assigned_at", { ascending: false });

    if (error) {
      toast.error("Failed to load deliveries.");
      setShipments([]);
    } else {
      setShipments((data || []) as ShipmentRow[]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    void fetchShipments();
  }, []);

  const updateDeliveryStatus = async (shipment: ShipmentRow, nextStatus: "successful" | "failed") => {
    setIsUpdating(shipment.id);
    const completionPayload = buildDeliveryCompletionPayload(nextStatus);
    const { error } = await supabase
      .from("shipments")
      .update(completionPayload)
      .eq("id", shipment.id);

    if (error) {
      toast.error("Failed to update delivery status.");
    } else {
      toast.success(nextStatus === "successful" ? "Shipment marked as delivered." : "Shipment marked as failed delivery.");
      setShipments((prev) =>
        prev.map((row) =>
          row.id === shipment.id
            ? {
                ...row,
                delivery_request_status: nextStatus,
              }
            : row,
        ),
      );
      if (shipment.customer_id) {
        const tracking = resolveTrackingByStatus(null, shipment.notes, shipment.custom_tracking_number) || shipment.code;
        notifyParcelDelivered(shipment.customer_id, tracking, shipment.id, nextStatus);
      }
    }
    setIsUpdating(null);
  };

  const columns: Column<ShipmentRow>[] = [
    { key: "code", label: "Shipment" },
    {
      key: "customer",
      label: "Customer",
      render: (item) => item.customer?.full_name || "Customer",
    },
    {
      key: "receiver",
      label: "Receiver",
      render: (item) =>
        `${item.receiver?.full_name || "Receiver"}${item.receiver?.phone ? ` (${item.receiver.phone})` : ""}`,
    },
    {
      key: "status",
      label: "Status",
      render: (item) => (
        <StatusBadge
          status={item.delivery_request_status || "requested"}
          label={getDeliveryRequestStatusLabel(item.delivery_request_status)}
        />
      ),
    },
    {
      key: "assigned_at",
      label: "Assigned",
      render: (item) => format(new Date(item.delivery_request_assigned_at || item.delivery_request_requested_at || Date.now()), "PP"),
    },
    {
      key: "action",
      label: "Action",
      render: (item) => {
        const isAssigned = item.delivery_request_status === "assigned";
        return (
          <div className="flex items-center gap-2 whitespace-nowrap">
            <Button
              size="icon"
              variant="outline"
              disabled={isUpdating === item.id || !isAssigned}
              onClick={() => updateDeliveryStatus(item, "successful")}
              title={isAssigned ? "Mark delivered" : "Already completed"}
            >
              <CheckCircle2 className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="destructive"
              disabled={isUpdating === item.id || !isAssigned}
              onClick={() => updateDeliveryStatus(item, "failed")}
              title="Mark failed delivery"
            >
              <XCircle className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Delivery Updates"
        
      />
      <DataTable
        columns={columns}
        data={shipments}
        isLoading={isLoading}
        searchPlaceholder="Search deliveries..."
      />
    </div>
  );
};

export default DriverDeliveryUpdates;

