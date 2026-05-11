import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { CustomerProfileGate } from "@/components/customer/CustomerProfileGate";
import { useCustomerRecord } from "@/hooks/useCustomerRecord";
import { useDefaultCurrency } from "@/hooks/useDefaultCurrency";
import { getPortalShipmentWorkflowStatus } from "@/lib/parcelWorkflow";
import { remapNotificationsToWarehouseTracking } from "@/lib/notifications";
import { getWarehouseTrackingNumber, resolveTrackingByStatus } from "@/lib/shipmentNotes";
import { Loader2, Bell, Package, CreditCard, QrCode, Eye } from "lucide-react";
import { format } from "date-fns";

const statusLabel: Record<string, string> = {
  saved_pickup: "Created",
  saved_dropoff: "Incoming",
  received: "Need Action",
  requested_pickup: "Submitted",
  approved: "Confirm Shipment",
  assigned: "Outgoing Parcel",
  supplied: "In Transit",
  delivered: "Ready for Collection",
  closed: "Collected",
  returned: "Returned",
  returned_stock: "Returned to stock",
  returned_delivered: "Returned & Delivered",
};

type ShipmentRow = {
  id: string;
  code: string;
  status: string;
  created_at: string;
  updated_at: string;
  total_cost: number;
  payment_status: string | null;
  service_type: string;
  description: string | null;
  custom_tracking_number: string | null;
  notes: string | null;
  consolidation_id: string | null;
};

type ConsolidationChildShipment = {
  id: string;
  code: string;
  status: string;
  created_at: string;
  updated_at: string;
  description: string | null;
  custom_tracking_number: string | null;
};

type ConsolidationShipmentRow = {
  shipment_id: string;
  shipment: ConsolidationChildShipment | null;
};

type ConsolidationRow = {
  id: string;
  code: string;
  status: string;
  created_at: string;
  updated_at: string;
  notes: string | null;
  tracking_code: string | null;
  consolidation_shipments: ConsolidationShipmentRow[];
};

type RecentUpdateRow = {
  id: string;
  sourceId: string;
  rowType: "shipment" | "consolidation";
  status: string;
  created_at: string;
  updated_at: string;
  trackingNumber: string;
  description: string;
  notes: string | null;
  code: string;
  childShipments: ConsolidationChildShipment[];
};

type NotificationRow = {
  id: string;
  title: string;
  message: string;
  created_at: string;
  reference_id?: string | null;
};

const CustomerOverview = () => {
  const { customer } = useCustomerRecord();
  const { formatAmount } = useDefaultCurrency();
  const [shipments, setShipments] = useState<ShipmentRow[]>([]);
  const [consolidations, setConsolidations] = useState<ConsolidationRow[]>([]);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [viewUpdate, setViewUpdate] = useState<RecentUpdateRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [recentUpdatesPage, setRecentUpdatesPage] = useState(1);
  const RECENT_UPDATES_PAGE_SIZE = 10;

  const getConsolidationStatusLabel = (status: string) => {
    const normalized = (status || "").toLowerCase().trim();
    const mapped: Record<string, string> = {
      requested: "Submitted",
      requested_pickup: "Submitted",
      approved: "Confirm Shipment",
      assigned: "Outgoing Parcel",
      in_transit: "In Transit",
      intransit: "In Transit",
      arrived: "Ready for Collection",
      collected: "Collected",
      closed: "Collected",
    };
    return mapped[normalized] || statusLabel[normalized] || status;
  };

  useEffect(() => {
    const fetchShipments = async () => {
      if (!customer?.id) {
        setShipments([]);
        setConsolidations([]);
        setNotifications([]);
        setIsLoading(false);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const [shipmentsRes, consolidationsRes, notificationsRes] = await Promise.all([
        supabase
          .from("shipments")
          .select("id, code, status, created_at, updated_at, total_cost, payment_status, service_type, description, custom_tracking_number, notes, consolidation_id")
          .eq("customer_id", customer.id)
          .order("updated_at", { ascending: false }),
        supabase
          .from("consolidations")
          .select(
            "id, code, status, created_at, updated_at, notes, tracking_code, consolidation_shipments(shipment_id, shipment:shipments(id, code, status, created_at, updated_at, description, custom_tracking_number))"
          )
          .eq("customer_id", customer.id)
          .order("updated_at", { ascending: false }),
        user?.id
          ? supabase
              .from("notifications")
            .select("id, title, message, created_at, reference_id")
              .eq("user_id", user.id)
              .order("created_at", { ascending: false })
              .limit(6)
          : Promise.resolve({ data: [], error: null }),
      ]);

      setShipments((shipmentsRes.data || []) as ShipmentRow[]);
      setConsolidations((consolidationsRes.data || []) as unknown as ConsolidationRow[]);
      const normalizedNotifications = await remapNotificationsToWarehouseTracking(
        (notificationsRes.data || []) as NotificationRow[],
      );
      setNotifications(normalizedNotifications);
      setIsLoading(false);
    };

    fetchShipments();
  }, [customer?.id]);

  const counts = useMemo(() => {
    const result = {
      created: 0,
      incoming: 0,
      needAction: 0,
      submitted: 0,
      confirm: 0,
      outgoing: 0,
      intransit: 0,
      arrived: 0,
      collected: 0,
      unpaid: 0,
      paid: 0,
    };

    shipments.forEach((s) => {
      // Hide shipments that are part of a consolidation in stages where the consolidation record should take over
      if (s.consolidation_id) return;

      const workflowStatus = getPortalShipmentWorkflowStatus(s, shipments);
      const status = (s.status || "").toLowerCase().trim();
      
      if (status === "saved_pickup" || status === "created") result.created += 1;
      if (status === "saved_dropoff" || status === "incoming") result.incoming += 1;
      if (workflowStatus === "received") result.needAction += 1;
      if (workflowStatus === "requested_pickup") result.submitted += 1;
      if (status === "approved") result.confirm += 1;
      if (status === "assigned") result.outgoing += 1;
      if (status === "supplied") result.intransit += 1;
      if (status === "delivered") result.arrived += 1;
      if (status === "closed") result.collected += 1;
      
      if (s.payment_status === "completed") result.paid += 1;
      else result.unpaid += 1;
    });

    return result;
  }, [shipments]);

  const activeShipments = shipments.filter(
    (s) => !["closed", "returned", "returned_stock", "returned_delivered"].includes(s.status)
  );

  const outstandingTotal = shipments
    .filter((s) => s.payment_status !== "completed")
    .reduce((sum, s) => sum + (s.total_cost || 0), 0);

  const recentUpdates = useMemo<RecentUpdateRow[]>(() => {
    const consolidatedChildIds = new Set<string>();
    consolidations.forEach((consolidation) => {
      (consolidation.consolidation_shipments || []).forEach((entry) => {
        if (entry.shipment_id) {
          consolidatedChildIds.add(entry.shipment_id);
        }
      });
    });

    const shipmentRows: RecentUpdateRow[] = shipments
      .filter((shipment) => !shipment.consolidation_id)
      .map((shipment) => ({
        id: `shipment-${shipment.id}`,
        sourceId: shipment.id,
        rowType: "shipment",
        status: shipment.status,
        created_at: shipment.created_at,
        updated_at: shipment.updated_at,
        trackingNumber: shipment.custom_tracking_number?.trim() || resolveTrackingByStatus(shipment.status, shipment.notes, shipment.custom_tracking_number) || "Not provided",
        description: shipment.description || "Shipment",
        notes: shipment.notes,
        code: shipment.code,
        childShipments: [],
      }));

    const consolidationRows: RecentUpdateRow[] = consolidations.map((consolidation) => {
      const childShipments = (consolidation.consolidation_shipments || [])
        .map((entry) => entry.shipment)
        .filter(Boolean) as ConsolidationChildShipment[];
      const warehouseTracking = resolveTrackingByStatus(consolidation.status, consolidation.notes, consolidation.tracking_code);

      return {
        id: `consolidation-${consolidation.id}`,
        sourceId: consolidation.id,
        rowType: "consolidation",
        status: consolidation.status,
        created_at: consolidation.created_at,
        updated_at: consolidation.updated_at,
        trackingNumber: consolidation.tracking_code?.trim() || warehouseTracking || "Not provided",
        description:
          childShipments.length > 1
            ? "Mixed Products"
            : childShipments[0]?.description || "Mixed Product",
        notes: consolidation.notes,
        code: consolidation.code,
        childShipments,
      };
    });

    return [...shipmentRows, ...consolidationRows].sort(
      (a, b) =>
        new Date(b.updated_at || b.created_at).getTime() -
        new Date(a.updated_at || a.created_at).getTime()
    );
  }, [consolidations, shipments]);

  const pagedRecentUpdates = useMemo(
    () =>
      recentUpdates.slice(
        (recentUpdatesPage - 1) * RECENT_UPDATES_PAGE_SIZE,
        recentUpdatesPage * RECENT_UPDATES_PAGE_SIZE
      ),
    [recentUpdates, recentUpdatesPage]
  );

  useEffect(() => {
    setRecentUpdatesPage(1);
  }, [recentUpdates.length]);

  return (
    <CustomerProfileGate>
      <div className="space-y-6">
        <PageHeader
          title="Dashboard"
          actions={
            <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
              <Badge className="h-9 px-3 justify-center bg-blue-600 text-white hover:bg-blue-700 shadow-sm border-0 font-bold transition-all">
                ID: {customer?.code || "---"}
              </Badge>
              <Button asChild size="sm" className="h-9 bg-slate-900 text-white hover:bg-slate-800 shadow-sm font-bold transition-all">
                <Link to="/customer/shipments" className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Shipments
                </Link>
              </Button>
              <Button asChild size="sm" className="h-9 bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm font-bold transition-all">
                <Link to="/customer/payments" className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Payments
                </Link>
              </Button>
              <Button asChild size="sm" className="h-9 bg-orange-500 text-white hover:bg-orange-600 shadow-sm font-bold transition-all">
                <Link to="/customer/tracking" className="flex items-center gap-2">
                  <QrCode className="h-4 w-4" />
                  Tracking
                </Link>
              </Button>
            </div>
          }
        />

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Active Shipments</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold">{isLoading ? "..." : activeShipments.length}</p>
              <p className="text-sm text-muted-foreground mt-1">Shipments in progress</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Outstanding Payments</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold">{isLoading ? "..." : formatAmount(outstandingTotal)}</p>
              <p className="text-sm text-muted-foreground mt-1">Unpaid shipment balance</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
          <Card>
            <CardHeader>
              <CardTitle>Shipment Status Summary</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { label: "Created Parcels", value: counts.created },
                { label: "Incoming Parcels", value: counts.incoming },
                { label: "Need Action", value: counts.needAction },
                { label: "Submitted Shipments", value: counts.submitted },
                { label: "Confirm Shipment", value: counts.confirm },
                { label: "Outgoing Parcel", value: counts.outgoing },
                { label: "In Transit", value: counts.intransit },
                { label: "Ready for Collection", value: counts.arrived },
                { label: "Collected", value: counts.collected },
                { label: "Unpaid", value: counts.unpaid },
                { label: "Paid", value: counts.paid },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="text-xl font-semibold">{isLoading ? "..." : item.value}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {isLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : notifications.length === 0 ? (
                <p className="text-muted-foreground">No new notifications.</p>
              ) : (
                notifications.map((note) => (
                  <div key={note.id} className="rounded-md bg-muted px-3 py-2">
                    <p className="font-medium">{note.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{note.message}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent Updates</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : recentUpdates.length === 0 ? (
              <p className="text-muted-foreground">No recent updates.</p>
            ) : (
              <>
                <div className="space-y-3">
                  {pagedRecentUpdates.map((update) => (
                    <div key={update.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                      <div>
                        <p className="font-medium">{update.trackingNumber}</p>
                        <p className="text-xs text-muted-foreground">
                          {update.description} • {update.rowType === "consolidation" ? getConsolidationStatusLabel(update.status) : statusLabel[update.status] || update.status}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {update.rowType === "consolidation" ? getConsolidationStatusLabel(update.status) : statusLabel[update.status] || update.status}
                        </Badge>
                        <Button size="icon" variant="outline" onClick={() => setViewUpdate(update)} title="View">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <p className="text-xs text-muted-foreground min-w-[130px] text-right">
                          {format(new Date(update.updated_at || update.created_at), "PPp")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                {recentUpdates.length > RECENT_UPDATES_PAGE_SIZE && (
                  <div className="mt-4 flex items-center justify-between gap-3 border-t pt-4">
                    <p className="text-xs text-muted-foreground">
                      Showing {(recentUpdatesPage - 1) * RECENT_UPDATES_PAGE_SIZE + 1}-{Math.min(recentUpdatesPage * RECENT_UPDATES_PAGE_SIZE, recentUpdates.length)} of {recentUpdates.length} entries
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setRecentUpdatesPage(Math.max(1, recentUpdatesPage - 1))}
                        disabled={recentUpdatesPage === 1}
                      >
                        Previous
                      </Button>
                      <span className="text-xs font-medium">{recentUpdatesPage}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setRecentUpdatesPage(recentUpdatesPage + 1)}
                        disabled={recentUpdatesPage * RECENT_UPDATES_PAGE_SIZE >= recentUpdates.length}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!viewUpdate} onOpenChange={(open) => !open && setViewUpdate(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {viewUpdate?.rowType === "consolidation" ? "Consolidated Update Details" : "Shipment Update Details"}
              </DialogTitle>
              
            </DialogHeader>

            {viewUpdate ? (
              <div className="space-y-3 text-sm">
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Tracking Number</p>
                  <p className="font-medium font-mono">{viewUpdate.trackingNumber}</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Description</p>
                    <p className="font-medium">{viewUpdate.description}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Status</p>
                    <p className="font-medium">
                      {viewUpdate.rowType === "consolidation"
                        ? getConsolidationStatusLabel(viewUpdate.status)
                        : statusLabel[viewUpdate.status] || viewUpdate.status}
                    </p>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Updated At</p>
                    <p className="font-medium">{format(new Date(viewUpdate.updated_at || viewUpdate.created_at), "PPp")}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Reference</p>
                    <p className="font-medium font-mono">{viewUpdate.code}</p>
                  </div>
                </div>
                {viewUpdate.rowType === "consolidation" ? (
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground mb-2">Included Shipments</p>
                    <div className="space-y-2">
                      {viewUpdate.childShipments.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No child shipments linked.</p>
                      ) : (
                        viewUpdate.childShipments.map((shipment) => (
                          <div key={shipment.id} className="rounded border p-2">
                            <p className="text-xs font-medium font-mono">{resolveTrackingByStatus(shipment.status, null, shipment.custom_tracking_number) || shipment.code}</p>
                            <p className="text-xs text-muted-foreground">{shipment.description || "Shipment"}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      </div>
    </CustomerProfileGate>
  );
};

export default CustomerOverview;

