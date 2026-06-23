import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Bell, Loader2, Package, QrCode, Wallet, Users, Eye } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDefaultCurrency } from "@/hooks/useDefaultCurrency";
import {
  DEFAULT_AGENT_COMMISSION_RATE_KG,
  DEFAULT_AGENT_COMMISSION_RATE_CBM,
  calculateAgentCommission,
  fetchAgentNotifications,
  fetchAgentPayments,
  fetchAgentShipments,
  fetchAgentWalletBalance,
  formatAgentStatus,
  getCurrentAgentId,
  getCurrentMonthKey,
  isAgentBillableShipment,
  getShipmentCommissionBase,
  getShipmentInvoiceTotal,
  getShipmentOutstandingBalance,
  type AgentNotificationRow,
  type AgentPaymentRow,
  type AgentShipmentRow,
} from "@/lib/agentPortal";
import { getWarehouseTrackingNumber, resolveTrackingByStatus } from "@/lib/shipmentNotes";
import { getPortalShipmentWorkflowStatus, isUnconsolidatedConsolidationParcel, isSingleHandlingMethod } from "@/lib/parcelWorkflow";
import { normalizeShipmentStatus, isShipmentStageStatus, mapConsolidationStatusToShipmentStatus } from "@/lib/warehouseTabFilters";
import { toast } from "sonner";
import { isFinanceInvoiceVisible, getInvoiceOutstandingBalance } from "@/lib/financePortal";

type ConsolidationChildShipment = {
  id: string;
  code: string;
  status: string;
  created_at: string;
  updated_at: string;
  description: string | null;
  custom_tracking_number: string | null;
};

type ConsolidationRow = {
  id: string;
  code: string;
  status: string;
  created_at: string;
  updated_at: string;
  notes: string | null;
  tracking_code: string | null;
  consolidation_shipments: { shipment_id: string; shipment: ConsolidationChildShipment | null }[];
};

type RecentUpdateRow = {
  id: string;
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

const AgentDashboard = () => {
  const { formatAmount } = useDefaultCurrency();
  const [shipments, setShipments] = useState<AgentShipmentRow[]>([]);
  const [consolidations, setConsolidations] = useState<ConsolidationRow[]>([]);
  const [payments, setPayments] = useState<AgentPaymentRow[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<AgentNotificationRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [walletBalance, setWalletBalance] = useState(0);
  const [agentProfile, setAgentProfile] = useState<{
    commission_rate_kg: number;
    commission_rate_cbm: number;
  } | null>(null);
  const [currentAgentId, setCurrentAgentId] = useState<string | null>(null);
  const [viewUpdate, setViewUpdate] = useState<RecentUpdateRow | null>(null);
  const [recentUpdatesPage, setRecentUpdatesPage] = useState(1);
  const RECENT_UPDATES_PAGE_SIZE = 10;

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const agentId = await getCurrentAgentId();
        setCurrentAgentId(agentId);
        if (!agentId) {
          setShipments([]);
          setPayments([]);
          setNotifications([]);
          setWalletBalance(0);
          setIsLoading(false);
          return;
        }

        const { customerIds, shipments: shipmentRows } = await fetchAgentShipments(agentId, 200);
        const [paymentRows, notificationRows, profileRes, consolidationsRes, invoicesRes] = await Promise.all([
          fetchAgentPayments(customerIds, 100),
          fetchAgentNotifications(6),
          supabase.from("profiles").select("commission_rate_kg, commission_rate_cbm").eq("user_id", agentId).single(),
          customerIds.length
            ? supabase
              .from("consolidations")
              .select("id, code, status, created_at, notes, item_count, total_weight, total_cost, consolidation_shipments(shipment_id, shipment:shipments(id, code, status, created_at, updated_at, description, custom_tracking_number, notes, total_cost, shipping_cost))")
              .in("customer_id", customerIds)
              .order("created_at", { ascending: false })
            : Promise.resolve({ data: [], error: null }),
          customerIds.length
            ? supabase
              .from("invoices")
              .select("id, amount, status, shipment_id, shipment:shipments(paid_amount, total_cost, shipping_cost)")
              .in("customer_id", customerIds)
            : Promise.resolve({ data: [], error: null }),
        ]);
        const ownWalletBalance = await fetchAgentWalletBalance(agentId);

        setShipments(shipmentRows);
        setPayments(paymentRows);
        setInvoices((invoicesRes as any)?.data || []);
        setNotifications(notificationRows);
        setConsolidations(((consolidationsRes as any)?.data || []) as ConsolidationRow[]);
        setWalletBalance(Number(ownWalletBalance || 0));
        setAgentProfile({
          commission_rate_kg: profileRes.data?.commission_rate_kg ?? DEFAULT_AGENT_COMMISSION_RATE_KG,
          commission_rate_cbm: profileRes.data?.commission_rate_cbm ?? DEFAULT_AGENT_COMMISSION_RATE_CBM,
        });
      } catch (error: any) {
        toast.error(error?.message || "Failed to load the agent dashboard.");
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboard();
  }, []);

  const metrics = useMemo(() => {
    const visibleShipments = shipments.filter(s => !s.consolidation_id && !isUnconsolidatedConsolidationParcel(s));
    
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

    const activeShipmentsCount = activeSingles.length + activeConsolidations.length;
    const settledShipments = visibleShipments.filter((shipment) => shipment.payment_status === "completed");
    const outstandingPayments = invoices
      .filter((invoice) => isFinanceInvoiceVisible(invoice.status))
      .reduce((total, invoice) => {
        const shipment = Array.isArray(invoice.shipment) ? invoice.shipment[0] : invoice.shipment;
        return total + getInvoiceOutstandingBalance(invoice, shipment);
      }, 0);
    const rateKg = agentProfile?.commission_rate_kg ?? DEFAULT_AGENT_COMMISSION_RATE_KG;
    const rateCbm = agentProfile?.commission_rate_cbm ?? DEFAULT_AGENT_COMMISSION_RATE_CBM;

    const totalCommission = settledShipments.reduce(
      (total, shipment) => total + calculateAgentCommission(shipment, rateKg, rateCbm),
      0,
    );
    const currentMonthKey = getCurrentMonthKey();
    const monthlyCommission = settledShipments
      .filter((shipment) => shipment.created_at && shipment.created_at.startsWith(currentMonthKey))
      .reduce((total, shipment) => total + calculateAgentCommission(shipment, rateKg, rateCbm), 0);

    return {
      activeShipments: activeShipmentsCount,
      outstandingPayments,
      totalCommission,
      monthlyCommission,
      successfulPayments: payments.filter((payment) => payment.status === "completed").length,
      pendingPayments: payments.filter((payment) => payment.status !== "completed").length,
    };
  }, [payments, shipments, agentProfile]);

  const statusSummary = useMemo(() => {
    const summary = [
      { label: "Submitted", total: 0 },
      { label: "Confirm Shipment", total: 0 },
      { label: "Outgoing Parcel", total: 0 },
      { label: "In Transit", total: 0 },
      { label: "Ready for Collection", total: 0 },
      { label: "Collected", total: 0 },
    ];

    shipments
      .filter((shipment) => !shipment.consolidation_id && !isUnconsolidatedConsolidationParcel(shipment))
      .forEach((shipment) => {
        const workflowStatus = getPortalShipmentWorkflowStatus(shipment, shipments);
        if (workflowStatus === "requested_pickup") summary[0].total += 1;
        if (shipment.status === "approved") summary[1].total += 1;
        if (shipment.status === "assigned") summary[2].total += 1;
        if (shipment.status === "supplied") summary[3].total += 1;
        if (shipment.status === "delivered") summary[4].total += 1;
        if (shipment.status === "closed") summary[5].total += 1;
      });

    return summary;
  }, [shipments]);

  const recentUpdates = useMemo<RecentUpdateRow[]>(() => {
    const shipmentRows: RecentUpdateRow[] = shipments
      .filter((shipment) => !shipment.consolidation_id && !isUnconsolidatedConsolidationParcel(shipment))
      .map((shipment) => ({
        id: `shipment-${shipment.id}`,
        rowType: "shipment",
        status: shipment.status,
        created_at: shipment.created_at,
        updated_at: shipment.updated_at,
        trackingNumber:
          shipment.custom_tracking_number?.trim() ||
          resolveTrackingByStatus(shipment.status, shipment.notes, shipment.custom_tracking_number) ||
          "Not provided",
        description: shipment.description || "Shipment",
        notes: shipment.notes,
        code: shipment.code,
        childShipments: [],
      }));

    const consolidationRows: RecentUpdateRow[] = consolidations.map((consolidation) => {
      const childShipments = (consolidation.consolidation_shipments || [])
        .map((entry) => entry.shipment)
        .filter(Boolean) as ConsolidationChildShipment[];
      const warehouseTracking = resolveTrackingByStatus(
        consolidation.status,
        consolidation.notes,
        consolidation.tracking_code,
      );
      return {
        id: `consolidation-${consolidation.id}`,
        rowType: "consolidation",
        status: consolidation.status,
        created_at: consolidation.created_at,
        updated_at: consolidation.updated_at,
        trackingNumber: consolidation.tracking_code?.trim() || warehouseTracking || "Not provided",
        description:
          childShipments.length > 1 ? "Mixed Products" : childShipments[0]?.description || "Mixed Product",
        notes: consolidation.notes,
        code: consolidation.code,
        childShipments,
      };
    });

    return [...shipmentRows, ...consolidationRows].sort(
      (a, b) =>
        new Date(b.updated_at || b.created_at).getTime() -
        new Date(a.updated_at || a.created_at).getTime(),
    );
  }, [consolidations, shipments]);

  const pagedRecentUpdates = useMemo(
    () =>
      recentUpdates.slice(
        (recentUpdatesPage - 1) * RECENT_UPDATES_PAGE_SIZE,
        recentUpdatesPage * RECENT_UPDATES_PAGE_SIZE,
      ),
    [recentUpdates, recentUpdatesPage],
  );

  useEffect(() => {
    setRecentUpdatesPage(1);
  }, [recentUpdates.length]);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Agent Dashboard"
        actions={
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
            <Badge className="h-9 px-3 justify-center bg-blue-600 text-white hover:bg-blue-700 shadow-sm border-0 font-bold transition-all">
              ID: {currentAgentId ? "AGENT-" + currentAgentId.slice(0, 8).toUpperCase() : "---"}
            </Badge>
            <Button asChild size="sm" className="h-9 bg-slate-900 text-white hover:bg-slate-800 shadow-sm font-bold transition-all">
              <Link to="/agent/shipments" className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Shipments
              </Link>
            </Button>
            <Button asChild size="sm" className="h-9 bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm font-bold transition-all">
              <Link to="/agent/customers/create" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Register
              </Link>
            </Button>
            <Button asChild size="sm" className="h-9 bg-orange-500 text-white hover:bg-orange-600 shadow-sm font-bold transition-all">
              <Link to="/agent/tracking" className="flex items-center gap-2">
                <QrCode className="h-4 w-4" />
                Tracking
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="border-border/70 bg-gradient-to-br from-white to-slate-50">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Total Active Shipments</CardTitle></CardHeader>
          <CardContent>
            <div className="text-xl font-semibold">{isLoading ? "..." : metrics.activeShipments}</div>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-gradient-to-br from-white to-amber-50">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Outstanding Payments</CardTitle></CardHeader>
          <CardContent>
            <div className="text-xl font-semibold">{isLoading ? "..." : formatAmount(metrics.outstandingPayments)}</div>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-gradient-to-br from-white to-emerald-50">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Total Commission Earned</CardTitle></CardHeader>
          <CardContent>
            <div className="text-xl font-semibold">{isLoading ? "..." : formatAmount(metrics.totalCommission)}</div>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-gradient-to-br from-white to-sky-50">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Commission Earned (Month)</CardTitle></CardHeader>
          <CardContent>
            <div className="text-xl font-semibold">{isLoading ? "..." : formatAmount(metrics.monthlyCommission)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Agent Wallet Balance</CardTitle></CardHeader>
          <CardContent className="flex items-center gap-3">
            <Wallet className="h-5 w-5 text-primary" />
            <div>
              <div className="text-lg font-semibold">{isLoading ? "..." : formatAmount(walletBalance)}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Successful Payments</CardTitle></CardHeader>
          <CardContent><div className="text-lg font-semibold">{isLoading ? "..." : metrics.successfulPayments}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Pending Payments</CardTitle></CardHeader>
          <CardContent><div className="text-lg font-semibold">{isLoading ? "..." : metrics.pendingPayments}</div></CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader><CardTitle>Shipment Status Summary</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {statusSummary.map((item) => (
              <div key={item.label} className="rounded-xl border border-border/70 bg-muted/20 p-4">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="mt-2 text-lg font-semibold">{isLoading ? "..." : item.total}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4" /> Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground">No agent notifications yet.</p>
            ) : (
              notifications.map((item) => (
                <div key={item.id} className="rounded-xl border border-border/70 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{item.title}</p>
                    <Badge variant="outline" className="text-[11px]">{format(new Date(item.created_at), "dd MMM")}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{item.message}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Recent Updates</CardTitle></CardHeader>
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
                    <Button size="sm" variant="outline" onClick={() => setRecentUpdatesPage(Math.max(1, recentUpdatesPage - 1))} disabled={recentUpdatesPage === 1}>
                      Previous
                    </Button>
                    <span className="text-xs font-medium">{recentUpdatesPage}</span>
                    <Button size="sm" variant="outline" onClick={() => setRecentUpdatesPage(recentUpdatesPage + 1)} disabled={recentUpdatesPage * RECENT_UPDATES_PAGE_SIZE >= recentUpdates.length}>
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
  );
};

export default AgentDashboard;
