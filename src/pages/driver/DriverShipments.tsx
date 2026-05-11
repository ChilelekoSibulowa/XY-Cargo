import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Eye, Loader2, XCircle } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, Column } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useDefaultCurrency } from "@/hooks/useDefaultCurrency";
import { buildDeliveryCompletionPayload } from "@/lib/deliveryRequests";
import { getWarehouseTrackingNumber, resolveTrackingByStatus } from "@/lib/shipmentNotes";
import { toast } from "sonner";
import {
  DRIVER_DELIVERY_TABS,
  DriverDelivery,
  DriverDeliveryTabKey,
  fetchDriverDeliveries,
  formatDriverServiceType,
  formatDriverStatus,
  getCurrentDriverContext,
  getDriverAwbNumber,
  getDriverProductType,
  getDriverReceivers,
  getDriverReceiverLocation,
  isAssignedDelivery,
  isFailedDelivery,
  isSuccessfulDelivery,
} from "@/lib/driverPortal";

const DriverShipments = () => {
  const { formatAmount } = useDefaultCurrency();
  const [searchParams, setSearchParams] = useSearchParams();
  const [deliveries, setDeliveries] = useState<DriverDelivery[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const activeTab = (searchParams.get("tab") as DriverDeliveryTabKey) ?? "assigned";
  const setActiveTab = (tab: DriverDeliveryTabKey) => setSearchParams({ tab }, { replace: true });
  const [isUpdatingDeliveryKey, setIsUpdatingDeliveryKey] = useState<string | null>(null);
  const [viewDelivery, setViewDelivery] = useState<DriverDelivery | null>(null);

  const formatDateTime = (value: string | null | undefined) => {
    if (!value) return "-";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return format(parsed, "dd MMM yyyy, HH:mm");
  };

  const loadDeliveries = useCallback(async () => {
    try {
      const { driver } = await getCurrentDriverContext();
      if (!driver?.id) {
        setDeliveries([]);
        setIsLoading(false);
        return;
      }

      const rows = await fetchDriverDeliveries(driver.id, 300);
      setDeliveries(rows);
    } catch (error: any) {
      toast.error(error?.message || "Failed to load deliveries.");
      setDeliveries([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDeliveries();

    let channel: any;
    const setupSubscription = async () => {
      const { driver } = await getCurrentDriverContext();
      if (!driver?.id) return;

      channel = supabase
        .channel(`driver-deliveries-${driver.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "shipments",
            filter: `delivery_request_assigned_driver_id=eq.${driver.id}`,
          },
          () => {
            void loadDeliveries();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "consolidations",
            filter: `delivery_request_assigned_driver_id=eq.${driver.id}`,
          },
          () => {
            void loadDeliveries();
          }
        )
        .subscribe();
    };

    void setupSubscription();

    return () => {
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [loadDeliveries]);

  const deliveriesByTab = useMemo<Record<DriverDeliveryTabKey, DriverDelivery[]>>(
    () => ({
      assigned: deliveries.filter((delivery) => isAssignedDelivery(delivery.status)),
      all: deliveries,
      successful: deliveries.filter((delivery) => isSuccessfulDelivery(delivery.status)),
      failed: deliveries.filter((delivery) => isFailedDelivery(delivery.status)),
    }),
    [deliveries],
  );

  const historyRows = useMemo(
    () => deliveries.filter((delivery) => isSuccessfulDelivery(delivery.status) || isFailedDelivery(delivery.status)),
    [deliveries],
  );

  const updateDeliveryStatus = async (row: DriverDelivery, nextStatus: "successful" | "failed") => {
    const shipmentIds = row.child_shipment_ids && row.child_shipment_ids.length > 0 ? row.child_shipment_ids : [row.id];
    const completionPayload = buildDeliveryCompletionPayload(nextStatus);
    const completionTime = completionPayload.delivery_request_completed_at;

    setIsUpdatingDeliveryKey(row.id);

    const { error } = await supabase
      .from("shipments")
      .update(completionPayload)
      .in("id", shipmentIds);

    if (error) {
      toast.error(error.message || "Failed to update delivery status.");
      setIsUpdatingDeliveryKey(null);
      return;
    }


    setDeliveries((prev) =>
      prev.map((delivery) => {
        const targetIds = delivery.child_shipment_ids && delivery.child_shipment_ids.length > 0
          ? delivery.child_shipment_ids
          : [delivery.id];
        const overlaps = targetIds.some((id) => shipmentIds.includes(id));
        if (!overlaps) return delivery;
        return {
          ...delivery,
          status: nextStatus,
          updated_at: completionTime,
          delivery_request_completed_at: completionTime,
        };
      }),
    );

    toast.success(nextStatus === "successful" ? "Delivery marked as successful." : "Delivery marked as failed.");

    if (row.customer_id) {
      const { notifyParcelDelivered } = await import("@/lib/notifications");
      notifyParcelDelivered(row.customer_id, row.custom_tracking_number, row.id, nextStatus);
    }

    setIsUpdatingDeliveryKey(null);
    setActiveTab(nextStatus === "successful" ? "successful" : "failed");
  };

  const renderReceiverDetails = (row: DriverDelivery) => {
    const receivers = getDriverReceivers(row);

    if (receivers.length === 0) {
      return (
        <div className="space-y-1">
          <p className="font-medium">Receiver</p>
          <p className="text-xs text-muted-foreground">No phone</p>
          <p className="text-xs text-muted-foreground">-</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {receivers.map((receiver, index) => (
          <div key={`${receiver.id || "receiver"}-${index}`} className="space-y-1">
            <p className="font-medium">{receiver.full_name || "Receiver"}</p>
            <p className="text-xs text-muted-foreground">{receiver.phone || "No phone"}</p>
            <p className="text-xs text-muted-foreground">{getDriverReceiverLocation({ receiver })}</p>
          </div>
        ))}
      </div>
    );
  };

  const columns: Column<DriverDelivery>[] = [
    {
      key: "service_type",
      label: "Service Type",
      render: (row) => <Badge variant="outline">{formatDriverServiceType(row.service_type)}</Badge>,
    },
    {
      key: "product_type",
      label: "Product Type",
      render: (row) => (row.row_type === "consolidation" ? (getDriverProductType(row) !== "-" ? getDriverProductType(row) : "Mixed Products") : getDriverProductType(row)),
    },
    {
      key: "cost",
      label: "Cost",
      render: (row) => formatAmount(Number(row.total_cost || 0)),
    },
    {
      key: "tracking",
      label: "Tracking No.",
      render: (row) => row.custom_tracking_number || "-",
    },
    {
      key: "receiver",
      label: "Receiver Details",
      render: renderReceiverDetails,
    },
    {
      key: "awb",
      label: "AWB/BL No.",
      render: (row) => getDriverAwbNumber(row),
    },
    {
      key: "weight",
      label: "Weight",
      render: (row) => `${Number(row.weight || 0).toFixed(2)} kg`,
    },
    {
      key: "cbm",
      label: "Cubic Meter (CBM)",
      render: (row) => `${Number(row.cbm || 0).toFixed(4)} CBM`,
    },
    {
      key: "shipping_fee",
      label: "Shipping Fee",
      render: (row) => formatAmount(Number(row.shipping_cost || 0)),
    },
    {
      key: "status",
      label: "Status",
      render: (row) => <Badge variant={row.status === "assigned" ? "default" : "secondary"}>{formatDriverStatus(row.status)}</Badge>,
    },
    {
      key: "action",
      label: "Action",
      render: (row) => {
        const isAssigned = isAssignedDelivery(row.status);
        return (
          <div className="flex items-center gap-1 whitespace-nowrap">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={() => setViewDelivery(row)}
              title="View delivery"
            >
              <Eye className="h-4 w-4 text-blue-600" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 p-0"
              disabled={!isAssigned || isUpdatingDeliveryKey === row.id}
              onClick={() => updateDeliveryStatus(row, "successful")}
              title="Mark successful"
            >
              {isUpdatingDeliveryKey === row.id ? (
                <Loader2 className="h-4 w-4 animate-spin text-green-600" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              )}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 p-0"
              disabled={!isAssigned || isUpdatingDeliveryKey === row.id}
              onClick={() => updateDeliveryStatus(row, "failed")}
              title="Mark failed"
            >
              <XCircle className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="My Deliveries"
        
        actions={
          <div className="flex items-center gap-2">
            <Button asChild size="sm">
              <Link to="/driver/incidents">Report Incident</Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        {DRIVER_DELIVERY_TABS.map((tab) => (
          <Card key={tab.key} className="border-border/70">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{tab.label}</p>
              <p className="mt-1 text-2xl font-semibold">{deliveriesByTab[tab.key].length}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as DriverDeliveryTabKey)}>
        <TabsList className="h-auto w-full flex-wrap justify-start gap-2 rounded-2xl bg-transparent p-0">
          {DRIVER_DELIVERY_TABS.map((tab) => (
            <TabsTrigger
              key={tab.key}
              value={tab.key}
              className="rounded-full border border-border/70 bg-background px-4 data-[state=active]:border-primary/40 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {DRIVER_DELIVERY_TABS.map((tab) => (
          <TabsContent key={tab.key} value={tab.key} className="mt-4">
            <DataTable
              columns={columns}
              data={deliveriesByTab[tab.key]}
              isLoading={isLoading}
              searchPlaceholder={`Search ${tab.label.toLowerCase()}...`}
            />
          </TabsContent>
        ))}
      </Tabs>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Delivery Request History</h2>
        <DataTable
          columns={columns}
          data={historyRows}
          isLoading={isLoading}
          searchPlaceholder="Search delivery request history..."
        />
      </div>

      <Dialog open={!!viewDelivery} onOpenChange={(open) => !open && setViewDelivery(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Delivery Details</DialogTitle>
            
          </DialogHeader>

          {viewDelivery ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Tracking Number</p>
                <p className="font-medium">{viewDelivery.custom_tracking_number || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <p className="font-medium">{formatDriverStatus(viewDelivery.status)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Service Type</p>
                <p className="font-medium">{formatDriverServiceType(viewDelivery.service_type)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Product Type</p>
                <p className="font-medium">{viewDelivery.row_type === "consolidation" ? (getDriverProductType(viewDelivery) !== "-" ? getDriverProductType(viewDelivery) : "Mixed Products") : getDriverProductType(viewDelivery)}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs text-muted-foreground">Receiver Details</p>
                <div className="mt-2 space-y-3">
                  {getDriverReceivers(viewDelivery).length > 0 ? (
                    getDriverReceivers(viewDelivery).map((receiver, index) => (
                      <div
                        key={`${receiver.id || "receiver"}-${index}`}
                        className="rounded-lg border border-border/70 p-3"
                      >
                        <p className="font-medium">{receiver.full_name || "Receiver"}</p>
                        <p className="text-sm text-muted-foreground">{receiver.phone || "No phone"}</p>
                        <p className="text-sm text-muted-foreground">{getDriverReceiverLocation({ receiver })}</p>
                      </div>
                    ))
                  ) : (
                    <p className="font-medium">-</p>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">AWB/BL No.</p>
                <p className="font-medium">{getDriverAwbNumber(viewDelivery)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Shipping Fee</p>
                <p className="font-medium">{formatAmount(Number(viewDelivery.shipping_cost || 0))}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Weight</p>
                <p className="font-medium">{Number(viewDelivery.weight || 0).toFixed(2)} kg</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">CBM</p>
                <p className="font-medium">{Number(viewDelivery.cbm || 0).toFixed(4)} CBM</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Requested At</p>
                <p className="font-medium">{formatDateTime(viewDelivery.delivery_request_requested_at)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Assigned At</p>
                <p className="font-medium">{formatDateTime(viewDelivery.delivery_request_assigned_at)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Completed At</p>
                <p className="font-medium">{formatDateTime(viewDelivery.delivery_request_completed_at)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Updated</p>
                <p className="font-medium">{formatDateTime(viewDelivery.updated_at)}</p>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDelivery(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DriverShipments;

