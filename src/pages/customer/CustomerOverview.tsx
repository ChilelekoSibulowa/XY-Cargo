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
import { getPortalShipmentWorkflowStatus, isSingleHandlingMethod } from "@/lib/parcelWorkflow";
import { normalizeShipmentStatus, isShipmentStageStatus, mapConsolidationStatusToShipmentStatus } from "@/lib/warehouseTabFilters";
import { remapNotificationsToWarehouseTracking } from "@/lib/notifications";
import { getWarehouseTrackingNumber, resolveTrackingByStatus, getAirwayBillNumber } from "@/lib/shipmentNotes";
import { Loader2, Bell, Package, CreditCard, QrCode, Eye } from "lucide-react";
import { format } from "date-fns";
import { isFinanceInvoiceVisible, getInvoiceOutstandingBalance } from "@/lib/financePortal";

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
  total_cost: number | null;
  total_weight: number | null;
  total_cbm: number | null;
  item_count: number | null;
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
  const [invoices, setInvoices] = useState<any[]>([]);
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

      const [shipmentsRes, consolidationsRes, notificationsRes, invoicesRes] = await Promise.all([
        supabase
          .from("shipments")
          .select("id, code, status, created_at, updated_at, total_cost, shipping_cost, payment_status, service_type, description, custom_tracking_number, notes, consolidation_id")
          .eq("customer_id", customer.id)
          .order("updated_at", { ascending: false }),
        supabase
          .from("consolidations")
          .select(
            "id, code, status, created_at, updated_at, notes, tracking_code, total_cost, total_weight, total_cbm, item_count, consolidation_shipments(shipment_id, shipment:shipments(id, code, status, created_at, updated_at, description, custom_tracking_number, payment_status, total_cost, shipping_cost, notes))"
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
        supabase
          .from("invoices")
          .select("id, amount, status, shipment_id, shipment:shipments(paid_amount, total_cost, shipping_cost)")
          .eq("customer_id", customer.id)
      ]);

      setShipments((shipmentsRes.data || []) as ShipmentRow[]);
      setConsolidations((consolidationsRes.data || []) as unknown as ConsolidationRow[]);
      setInvoices((invoicesRes.data || []) as any[]);
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

    // 1. Process individual shipments (that are not part of a consolidation)
    shipments.forEach((s) => {
      // For status counts, only count if NOT part of a consolidation
      if (!s.consolidation_id) {
        const workflowStatus = getPortalShipmentWorkflowStatus(s, shipments);
        const status = (s.status || "").toLowerCase().trim();

        if (status === "saved_pickup" || status === "created") result.created += 1;
        else if (status === "saved_dropoff" || status === "incoming") result.incoming += 1;
        else if (workflowStatus === "received") result.needAction += 1;
        else if (workflowStatus === "requested_pickup") result.submitted += 1;
        else if (status === "approved") result.confirm += 1;
        else if (status === "assigned") result.outgoing += 1;
        else if (status === "supplied" || status === "in_transit" || status === "intransit") result.intransit += 1;
        else if (status === "delivered") result.arrived += 1;
        else if (status === "closed") result.collected += 1;
      }

      // Payment counts: count EVERY individual parcel record
      if (s.payment_status === "completed") result.paid += 1;
      else result.unpaid += 1;
    });

    // 2. Process consolidations for status counts
    consolidations.forEach((c) => {
      const status = (c.status || "").toLowerCase().trim();

      if (status === "submitted" || status === "requested" || status === "requested_pickup") result.submitted += 1;
      else if (status === "approved" || status === "confirmed") result.confirm += 1;
      else if (status === "assigned" || status === "outgoing") result.outgoing += 1;
      else if (status === "supplied" || status === "in_transit" || status === "intransit") result.intransit += 1;
      else if (status === "delivered" || status === "arrived") result.arrived += 1;
      else if (status === "closed" || status === "collected") result.collected += 1;
    });

    return result;
  }, [shipments, consolidations]);

  const activeShipments = useMemo(() => {
    const activeSingles = shipments.filter((s) => {
      if (s.consolidation_id) return false;
      if (!isSingleHandlingMethod(s)) return false;
      const mappedStatus = getPortalShipmentWorkflowStatus(s, shipments);
      const normalized = normalizeShipmentStatus(mappedStatus);
      return !["saved_pickup", "saved_dropoff", "received"].includes(normalized) && isShipmentStageStatus(normalized);
    });

    const activeConsolidations = consolidations.filter((c) => {
      const mappedStatus = mapConsolidationStatusToShipmentStatus[c.status?.toLowerCase() || ""] || c.status;
      const normalized = normalizeShipmentStatus(mappedStatus);
      return !["saved_pickup", "saved_dropoff", "received"].includes(normalized) && isShipmentStageStatus(normalized);
    });

    return { length: activeSingles.length + activeConsolidations.length };
  }, [shipments, consolidations]);

  const outstandingTotal = useMemo(() => {
    return invoices
      .filter((invoice) => isFinanceInvoiceVisible(invoice.status))
      .reduce((sum, invoice) => {
        const shipment = Array.isArray(invoice.shipment) ? invoice.shipment[0] : invoice.shipment;
        return sum + getInvoiceOutstandingBalance(invoice, shipment);
      }, 0);
  }, [invoices]);

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
        trackingNumber: shipment.custom_tracking_number?.trim() || getWarehouseTrackingNumber(shipment.notes) || shipment.code,
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
        trackingNumber: consolidation.tracking_code?.trim() || getWarehouseTrackingNumber(consolidation.notes) || consolidation.code,
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
              <p className="text-sm text-muted-foreground mt-1">Unified shipments in progress</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Outstanding Payments</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold">{isLoading ? "..." : formatAmount(outstandingTotal)}</p>
              <p className="text-sm text-muted-foreground mt-1">Total unpaid balance</p>
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
              <DialogTitle>Update Details</DialogTitle>
            </DialogHeader>

            {viewUpdate && (
              <div className="rounded-lg border bg-slate-50 p-4 shadow-sm mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-slate-900">
                    {viewUpdate.rowType === "consolidation" ? "Consolidated Shipment" : "Single Shipment"}: {viewUpdate.code}
                  </h3>
                  <Badge variant="outline" className="bg-white">
                    {viewUpdate.rowType === "consolidation" ? getConsolidationStatusLabel(viewUpdate.status) : statusLabel[viewUpdate.status] || viewUpdate.status}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <p className="text-muted-foreground font-medium">
                    Shipment Tracking:{" "}
                    <span className="font-mono text-slate-900">
                      {viewUpdate.trackingNumber}
                    </span>
                  </p>
                  <p className="text-muted-foreground font-medium">
                    AWB/BL No.:{" "}
                    <span className="font-mono text-slate-900">
                      {getAirwayBillNumber(viewUpdate.notes) || "-"}
                    </span>
                  </p>
                </div>
              </div>
            )}

            {viewUpdate ? (
              <div className="space-y-3 text-sm">
                <div className="hidden">
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Tracking Number</p>
                    <p className="font-medium font-mono">{viewUpdate.trackingNumber}</p>
                  </div>
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
                            <p className="text-xs font-medium font-mono">Tracking: {shipment.custom_tracking_number || "-"}</p>
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

