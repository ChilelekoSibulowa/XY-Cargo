import { useEffect, useMemo, useState } from "react";
import { format, isValid } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Eye } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/shared/PageHeader";
import { PortalShipmentHistoryTable } from "@/components/shipments/PortalShipmentHistoryTable";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { useDefaultCurrency } from "@/hooks/useDefaultCurrency";
import { isSingleHandlingMethod } from "@/lib/parcelWorkflow";
import { getWarehouseTrackingNumber } from "@/lib/shipmentNotes";
import {
  DEFAULT_AGENT_COMMISSION_RATE_KG,
  DEFAULT_AGENT_COMMISSION_RATE_CBM,
  calculateAgentCommission,
  fetchAgentShipments,
  formatAgentStatus,
  getCurrentAgentId,
  getShipmentInvoiceTotal,
  getMonthKey,
  type AgentShipmentRow,
} from "@/lib/agentPortal";
import { toast } from "sonner";

const formatDisplayDate = (
  value: string | null | undefined,
  pattern = "dd MMM yyyy",
) => {
  if (!value) return "-";
  const parsed = new Date(value);
  return isValid(parsed) ? format(parsed, pattern) : "-";
};

const getOutgoingAwareTrackingNumber = (
  notes: string | null,
  trackingCode?: string | null,
) =>
  getWarehouseTrackingNumber(notes)?.trim() ||
  trackingCode?.trim() ||
  "Tracking pending";

const SHIPMENT_HISTORY_STATUSES = new Set([
  "requested_pickup",
  "approved",
  "assigned",
  "supplied",
  "delivered",
  "closed",
  "paid",
  "unpaid",
]);

const CONSOLIDATION_HISTORY_STATUSES = new Set([
  "submitted",
  "confirmed",
  "outgoing",
  "in_transit",
  "intransit",
  "arrived",
  "collected",
  "requested",
  "approved",
  "assigned",
  "supplied",
  "delivered",
  "closed",
]);

const consolidationStatusToShipmentStatus: Record<string, string> = {
  submitted: "requested_pickup",
  requested: "requested_pickup",
  confirmed: "approved",
  approved: "approved",
  outgoing: "assigned",
  assigned: "assigned",
  in_transit: "supplied",
  intransit: "supplied",
  supplied: "supplied",
  arrived: "delivered",
  delivered: "delivered",
  collected: "closed",
  closed: "closed",
};

const normalizeStatus = (status: string | null | undefined) =>
  (status || "").trim().toLowerCase();

const isShipmentHistoryStatus = (status: string | null | undefined) =>
  SHIPMENT_HISTORY_STATUSES.has(normalizeStatus(status));

const isConsolidationHistoryStatus = (status: string | null | undefined) =>
  CONSOLIDATION_HISTORY_STATUSES.has(normalizeStatus(status));

const getLinkShipment = (link: { shipment?: AgentShipmentRow | AgentShipmentRow[] | null }) => {
  if (Array.isArray(link.shipment)) return link.shipment[0] || null;
  return link.shipment || null;
};

type ConsolidationReportRow = {
  id: string;
  code: string;
  customer_id: string;
  status: string;
  notes: string | null;
  total_cost: number | null;
  total_weight: number | null;
  total_cbm: number | null;
  tracking_code: string | null;
  collected_at: string | null;
  created_at: string;
  updated_at: string;
  customer: {
    code: string | null;
    full_name: string | null;
  } | null;
  consolidation_shipments?: Array<{
    shipment_id: string;
    shipment?: AgentShipmentRow | AgentShipmentRow[] | null;
  }> | null;
};

const getSharedReceiver = (shipments: AgentShipmentRow[]) => {
  const receivers = shipments
    .map((shipment) => shipment.receiver)
    .filter((receiver): receiver is NonNullable<AgentShipmentRow["receiver"]> => !!receiver);

  if (receivers.length === 0) return null;

  const firstKey = JSON.stringify(receivers[0]);
  return receivers.every((receiver) => JSON.stringify(receiver) === firstKey) ? receivers[0] : null;
};

const buildConsolidatedReportRow = (
  consolidation: ConsolidationReportRow,
): AgentShipmentRow | null => {
  const links = consolidation.consolidation_shipments || [];
  const childShipments = links
    .map(getLinkShipment)
    .filter((shipment): shipment is AgentShipmentRow => !!shipment);

  if (childShipments.length === 0) return null;

  const normalizedStatus = normalizeStatus(consolidation.status);
  const status = consolidationStatusToShipmentStatus[normalizedStatus] || normalizedStatus;
  const distinctServiceTypes = Array.from(
    new Set(childShipments.map((shipment) => shipment.service_type).filter(Boolean)),
  );
  const description = childShipments
    .map((shipment) => shipment.description || shipment.code)
    .filter(Boolean)
    .slice(0, 2)
    .join(", ");
  const latestEstimatedDelivery = childShipments
    .map((shipment) => shipment.estimated_delivery_date)
    .filter((value): value is string => !!value)
    .sort()
    .at(-1) || null;
  const latestActualDelivery = childShipments
    .map((shipment) => shipment.actual_delivery_date)
    .filter((value): value is string => !!value)
    .sort()
    .at(-1) || null;

  return {
    id: `consolidation-${consolidation.id}`,
    code: consolidation.code,
    customer_id: consolidation.customer_id,
    status,
    payment_status: childShipments.every((shipment) => shipment.payment_status === "completed")
      ? "completed"
      : null,
    paid_amount: childShipments.reduce((sum, shipment) => sum + Number(shipment.paid_amount || 0), 0),
    total_cost: childShipments.reduce((sum, shipment) => sum + Number(shipment.total_cost || 0), 0),
    shipping_cost: Number(
      consolidation.total_cost ??
      childShipments.reduce((sum, shipment) => sum + Number(shipment.shipping_cost || 0), 0),
    ),
    service_type: distinctServiceTypes.length === 1 ? distinctServiceTypes[0] : "mixed",
    description: consolidation.notes || description || "Consolidated shipment",
    notes: consolidation.notes,
    custom_tracking_number: getOutgoingAwareTrackingNumber(consolidation.notes, consolidation.tracking_code),
    handling_method: "consolidated",
    created_at: consolidation.created_at,
    updated_at: consolidation.updated_at,
    weight: Number(
      consolidation.total_weight ??
      childShipments.reduce((sum, shipment) => sum + Number(shipment.weight || 0), 0),
    ),
    cbm: Number(
      consolidation.total_cbm ??
      childShipments.reduce((sum, shipment) => sum + Number(shipment.cbm || 0), 0),
    ),
    consolidation_id: consolidation.id,
    estimated_delivery_date: latestEstimatedDelivery,
    actual_delivery_date: consolidation.collected_at || latestActualDelivery,
    customer: consolidation.customer,
    receiver: getSharedReceiver(childShipments),
  };
};

const fetchAgentShippingHistoryRows = async (
  customerIds: string[],
  rawShipments: AgentShipmentRow[],
) => {
  if (customerIds.length === 0) return [] as AgentShipmentRow[];

  const { data, error } = await supabase
    .from("consolidations")
    .select(
      "id, code, customer_id, status, notes, total_cost, total_weight, total_cbm, tracking_code, collected_at, created_at, updated_at, customer:customers(code, full_name), consolidation_shipments(shipment_id, shipment:shipments(id, code, customer_id, status, payment_status, paid_amount, total_cost, shipping_cost, service_type, description, notes, custom_tracking_number, handling_method, weight, cbm, created_at, updated_at, estimated_delivery_date, actual_delivery_date, consolidation_id, customer:customers(code, full_name), receiver:receivers(full_name, phone, address)))",
    )
    .in("customer_id", customerIds)
    .order("updated_at", { ascending: false })
    .limit(500);

  if (error) throw error;

  const allConsolidations = (data || []) as ConsolidationReportRow[];
  const consolidations = allConsolidations.filter((row) =>
    isConsolidationHistoryStatus(row.status),
  );
  const linkedShipmentIds = new Set<string>();
  allConsolidations.forEach((consolidation) => {
    (consolidation.consolidation_shipments || []).forEach((link) => {
      if (link.shipment_id) linkedShipmentIds.add(link.shipment_id);
      const shipment = getLinkShipment(link);
      if (shipment?.id) linkedShipmentIds.add(shipment.id);
    });
  });

  const singleShipments = rawShipments
    .filter((shipment) => isShipmentHistoryStatus(shipment.status))
    .filter((shipment) => !shipment.consolidation_id)
    .filter((shipment) => !linkedShipmentIds.has(shipment.id))
    .filter((shipment) => isSingleHandlingMethod(shipment))
    .map((shipment) => ({
      ...shipment,
      custom_tracking_number: getOutgoingAwareTrackingNumber(shipment.notes),
    }));

  const consolidatedShipments = consolidations
    .map(buildConsolidatedReportRow)
    .filter((shipment): shipment is AgentShipmentRow => !!shipment);

  return [...singleShipments, ...consolidatedShipments].sort(
    (left, right) =>
      new Date(right.updated_at || right.created_at).getTime() -
      new Date(left.updated_at || left.created_at).getTime(),
  );
};

type RevenueByClientRow = {
  id: string;
  client: string;
  shipments: number;
  revenue: number;
};

type TrendRow = {
  month: string;
  shipments: number;
  revenue: number;
  commission: number;
};

const AgentReports = () => {
  const { formatAmount } = useDefaultCurrency();
  const [shipments, setShipments] = useState<AgentShipmentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedShipment, setSelectedShipment] =
    useState<AgentShipmentRow | null>(null);
  const [agentProfile, setAgentProfile] = useState<{
    commission_rate_kg: number;
    commission_rate_cbm: number;
  } | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const HISTORY_PAGE_SIZE = 10;

  useEffect(() => {
    const loadReports = async () => {
      try {
        const agentId = await getCurrentAgentId();
        if (!agentId) {
          setShipments([]);
          setIsLoading(false);
          return;
        }

        const [{ customerIds, shipments: shipmentRows }, profileRes] = await Promise.all([
          fetchAgentShipments(agentId, 500),
          supabase.from("profiles").select("commission_rate_kg, commission_rate_cbm").eq("user_id", agentId).single(),
        ]);
        const shipmentHistoryRows = await fetchAgentShippingHistoryRows(customerIds, shipmentRows);
        setShipments(shipmentHistoryRows);
        setAgentProfile({
          commission_rate_kg: profileRes.data?.commission_rate_kg ?? DEFAULT_AGENT_COMMISSION_RATE_KG,
          commission_rate_cbm: profileRes.data?.commission_rate_cbm ?? DEFAULT_AGENT_COMMISSION_RATE_CBM,
        });
      } catch (error: any) {
        toast.error(error?.message || "Failed to load reports.");
      } finally {
        setIsLoading(false);
      }
    };

    loadReports();
  }, []);

  const shipmentsByMonth = useMemo<TrendRow[]>(() => {
    const map = new Map<string, TrendRow>();

    shipments.forEach((shipment) => {
      if (!shipment.created_at || !isValid(new Date(shipment.created_at)))
        return;
      const key = getMonthKey(shipment.created_at);
      const current = map.get(key) || {
        month: key,
        shipments: 0,
        revenue: 0,
        commission: 0,
      };
      const rateKg = agentProfile?.commission_rate_kg ?? DEFAULT_AGENT_COMMISSION_RATE_KG;
      const rateCbm = agentProfile?.commission_rate_cbm ?? DEFAULT_AGENT_COMMISSION_RATE_CBM;

      current.shipments += 1;
      current.revenue += getShipmentInvoiceTotal(shipment);
      current.commission += calculateAgentCommission(shipment, rateKg, rateCbm);
      map.set(key, current);
    });

    return Array.from(map.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-6);
  }, [shipments]);

  const revenueByClient = useMemo<RevenueByClientRow[]>(() => {
    const map = new Map<string, RevenueByClientRow>();

    shipments.forEach((shipment) => {
      const clientId = shipment.customer_id || shipment.id;
      const current = map.get(clientId) || {
        id: clientId,
        client: shipment.customer?.full_name || "Client",
        shipments: 0,
        revenue: 0,
      };
      current.shipments += 1;
      current.revenue += getShipmentInvoiceTotal(shipment);
      map.set(clientId, current);
    });

    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [shipments]);

  const successRate = useMemo(() => {
    if (shipments.length === 0) return 0;
    const successful = shipments.filter((shipment) =>
      ["delivered", "closed"].includes(shipment.status),
    ).length;
    return (successful / shipments.length) * 100;
  }, [shipments]);

  const slaCompliance = useMemo(() => {
    const measurable = shipments.filter(
      (shipment) =>
        shipment.actual_delivery_date && shipment.estimated_delivery_date,
    );
    if (measurable.length === 0) return 0;
    const onTime = measurable.filter(
      (shipment) =>
        new Date(shipment.actual_delivery_date as string) <=
        new Date(shipment.estimated_delivery_date as string),
    ).length;
    return (onTime / measurable.length) * 100;
  }, [shipments]);

  const revenueColumns: Column<RevenueByClientRow>[] = [
    { key: "client", label: "Client" },
    { key: "shipments", label: "Shipments" },
    {
      key: "revenue",
      label: "Revenue",
      render: (item) => formatAmount(item.revenue),
    },
  ];

  const trendColumns: Column<TrendRow>[] = [
    { key: "month", label: "Month" },
    { key: "shipments", label: "Shipments" },
    {
      key: "revenue",
      label: "Revenue",
      render: (item) => formatAmount(item.revenue),
    },
    {
      key: "commission",
      label: "Commission",
      render: (item) => formatAmount(item.commission),
    },
  ];

  const chartConfig = {
    shipments: {
      label: "Shipments",
      color: "hsl(var(--stat-blue))",
    },
  };

  const shippingHistory = useMemo(
    () =>
      shipments.map((shipment) => ({
        id: shipment.id,
        client: shipment.customer?.full_name || "Client",
        trackingNumber: getOutgoingAwareTrackingNumber(
          shipment.notes,
          shipment.custom_tracking_number,
        ),
        serviceType: shipment.service_type || "-",
        description: shipment.description || "Shipment",
        shippingFee: Number(shipment.shipping_cost || 0),
        createdAt: shipment.created_at,
        status: formatAgentStatus(shipment.status),
        arrivalDate:
          shipment.actual_delivery_date || shipment.estimated_delivery_date,
        shipment,
      })),
    [shipments],
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Reports & Analytics"
        
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Shipments by Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {isLoading
                ? "..."
                : shipmentsByMonth.reduce(
                    (sum, item) => sum + item.shipments,
                    0,
                  )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Revenue by Client</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {isLoading
                ? "..."
                : formatAmount(
                    revenueByClient.reduce(
                      (sum, item) => sum + item.revenue,
                      0,
                    ),
                  )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Shipment Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {isLoading ? "..." : `${successRate.toFixed(1)}%`}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">SLA Compliance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {isLoading ? "..." : `${slaCompliance.toFixed(1)}%`}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Shipments by Month</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading chart...</p>
          ) : shipmentsByMonth.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No shipment data yet.
            </p>
          ) : (
            <ChartContainer config={chartConfig} className="h-[280px]">
              <BarChart
                data={shipmentsByMonth}
                margin={{ left: 12, right: 12, top: 12, bottom: 24 }}
              >
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      formatter={(value) => `${value} shipments`}
                    />
                  }
                />
                <Bar
                  dataKey="shipments"
                  fill="var(--color-shipments)"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue by Client</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={revenueColumns}
              data={revenueByClient}
              isLoading={isLoading}
              searchPlaceholder="Search clients..."
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Commission Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={trendColumns}
              data={shipmentsByMonth}
              isLoading={isLoading}
              searchPlaceholder="Search monthly trends..."
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Shipping History</CardTitle>
        </CardHeader>
        <CardContent>
          <PortalShipmentHistoryTable scope="agent" />
        </CardContent>
      </Card>

      <Dialog
        open={!!selectedShipment}
        onOpenChange={(open) => !open && setSelectedShipment(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Shipment Details</DialogTitle>
            
          </DialogHeader>
          {selectedShipment ? (
            <div className="grid gap-3 sm:grid-cols-2 text-sm">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Client</p>
                <p className="font-medium">
                  {selectedShipment.customer?.full_name || "Client"}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Tracking No.</p>
                <p className="font-medium">
                  {getOutgoingAwareTrackingNumber(
                    selectedShipment.notes,
                    selectedShipment.custom_tracking_number,
                  )}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Status</p>
                <p className="font-medium">
                  {formatAgentStatus(selectedShipment.status)}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Service Type</p>
                <p className="font-medium">
                  {selectedShipment.service_type || "-"}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Item Value</p>
                <p className="font-medium">
                  {formatAmount(Number(selectedShipment.total_cost || 0))}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Shipping Fee</p>
                <p className="font-medium">
                  {formatAmount(Number(selectedShipment.shipping_cost || 0))}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Created</p>
                <p className="font-medium">
                  {formatDisplayDate(selectedShipment.created_at)}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Arrival Date</p>
                <p className="font-medium">
                  {formatDisplayDate(
                    selectedShipment.actual_delivery_date ||
                      selectedShipment.estimated_delivery_date,
                  )}
                </p>
              </div>
              <div className="rounded-lg border p-3 sm:col-span-2">
                <p className="text-xs text-muted-foreground">Description</p>
                <p className="font-medium">
                  {selectedShipment.description || "Shipment"}
                </p>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedShipment(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AgentReports;
