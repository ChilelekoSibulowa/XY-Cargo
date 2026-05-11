import { useEffect, useMemo, useState } from "react";
import { format, isValid } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Eye } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/shared/PageHeader";
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
import {
  extractNoteValue,
  getWarehouseTrackingNumber,
  resolveTrackingByStatus,
} from "@/lib/shipmentNotes";
import {
  DEFAULT_AGENT_COMMISSION_RATE_KG,
  DEFAULT_AGENT_COMMISSION_RATE_CBM,
  calculateAgentCommission,
  fetchAgentShipments,
  formatAgentStatus,
  getCurrentAgentId,
  getShipmentCommissionBase,
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
  status: string,
  notes: string | null,
  customTrackingNumber: string | null,
) =>
  resolveTrackingByStatus(status, notes, customTrackingNumber) ||
  "Tracking pending";

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

        const [{ shipments: shipmentRows }, profileRes] = await Promise.all([
          fetchAgentShipments(agentId, 500),
          supabase.from("profiles").select("commission_rate_kg, commission_rate_cbm").eq("user_id", agentId).single(),
        ]);
        setShipments(shipmentRows);
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
          shipment.status,
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
          {isLoading ? (
            <p className="text-sm text-muted-foreground">
              Loading shipment history...
            </p>
          ) : shippingHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No shipment history available yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[980px] w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="p-3 text-left font-medium">Client</th>
                    <th className="p-3 text-left font-medium">Tracking No.</th>
                    <th className="p-3 text-left font-medium">Service Type</th>
                    <th className="p-3 text-left font-medium">Description</th>
                    <th className="p-3 text-left font-medium">Shipping Fee</th>
                    <th className="p-3 text-left font-medium">Created</th>
                    <th className="p-3 text-left font-medium">Status</th>
                    <th className="p-3 text-left font-medium">Arrival Date</th>
                    <th className="p-3 text-left font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {shippingHistory
                    .slice(
                      (historyPage - 1) * HISTORY_PAGE_SIZE,
                      historyPage * HISTORY_PAGE_SIZE,
                    )
                    .map((row) => (
                      <tr key={row.id} className="border-b hover:bg-muted/20">
                        <td className="p-3">{row.client}</td>
                        <td className="p-3 font-mono text-xs">
                          {row.trackingNumber}
                        </td>
                        <td className="p-3">{row.serviceType}</td>
                        <td className="p-3">{row.description}</td>
                        <td className="p-3">{formatAmount(row.shippingFee)}</td>
                        <td className="p-3">
                          {formatDisplayDate(row.createdAt)}
                        </td>
                        <td className="p-3">{row.status}</td>
                        <td className="p-3">
                          {formatDisplayDate(row.arrivalDate)}
                        </td>
                        <td className="p-3">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => setSelectedShipment(row.shipment)}
                            title="View details"
                          >
                            <Eye className="h-4 w-4 text-blue-600" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {shippingHistory.length > HISTORY_PAGE_SIZE && (
                <div className="flex items-center justify-between gap-3 border-t p-3 bg-muted/20">
                  <p className="text-xs text-muted-foreground">
                    Showing {(historyPage - 1) * HISTORY_PAGE_SIZE + 1}-
                    {Math.min(
                      historyPage * HISTORY_PAGE_SIZE,
                      shippingHistory.length,
                    )}{" "}
                    of {shippingHistory.length} entries
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setHistoryPage(Math.max(1, historyPage - 1))
                      }
                      disabled={historyPage === 1}
                    >
                      Previous
                    </Button>
                    <span className="text-xs font-medium">{historyPage}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setHistoryPage(historyPage + 1)}
                      disabled={
                        historyPage * HISTORY_PAGE_SIZE >=
                        shippingHistory.length
                      }
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
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
                    selectedShipment.status,
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

