import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, PieChart, Pie, Cell, AreaChart, Area, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Package, TrendingUp, Clock, CheckCircle2, Plane, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { format, subDays, startOfDay } from "date-fns";
import { useCurrency } from "@/hooks/useCurrencyContext";
import { toShipmentLevelRows } from "@/lib/shipmentReporting";

interface ShipmentRow {
  id: string;
  consolidation_id: string | null;
  status: string;
  service_type: string;
  created_at: string;
  total_cost: number;
  shipping_cost: number | null;
  weight: number | null;
  cbm: number | null;
}

const SHIPMENT_STAGE_STATUSES = new Set([
  "requested_pickup",
  "approved",
  "assigned",
  "supplied",
  "delivered",
  "closed",
  "returned",
  "returned_stock",
  "returned_delivered",
]);

const STATUS_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(220, 70%, 50%)",
  "hsl(280, 70%, 50%)",
  "hsl(340, 70%, 50%)",
];

const SERVICE_COLORS = {
  air: "hsl(var(--chart-1))",
  sea: "hsl(var(--chart-2))",
};

const getShipmentBillingAmount = (shipment: Pick<ShipmentRow, "shipping_cost" | "total_cost">) => {
  const shippingFee = Number(shipment.shipping_cost || 0);
  if (shippingFee > 0) return shippingFee;
  return Number(shipment.total_cost || 0);
};

const ShipmentsReport = () => {
  const { formatAmount } = useCurrency();
  const [shipments, setShipments] = useState<ShipmentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchShipments = async () => {
    const { data, error } = await supabase
      .from("shipments")
      .select("id, status, service_type, created_at, total_cost, shipping_cost, weight, cbm");

    if (error) {
      toast.error("Failed to load shipment data.");
      setShipments([]);
    } else {
      const shipmentRows = ((data || []) as Omit<ShipmentRow, "consolidation_id">[]) || [];
      const shipmentIds = shipmentRows.map((row) => row.id);
      let consolidationMap = new Map<string, string>();

      if (shipmentIds.length > 0) {
        const { data: links } = await supabase
          .from("consolidation_shipments")
          .select("shipment_id, consolidation_id")
          .in("shipment_id", shipmentIds);

        consolidationMap = new Map(
          ((links || []) as Array<{ shipment_id: string; consolidation_id: string }>).map((row) => [
            row.shipment_id,
            row.consolidation_id,
          ]),
        );
      }

      setShipments(
        shipmentRows.map((row) => ({
          ...row,
          consolidation_id: consolidationMap.get(row.id) || null,
        })),
      );
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchShipments();
  }, []);

  const shipmentLevelRows = useMemo(() => toShipmentLevelRows(shipments), [shipments]);

  const shipmentStageRows = useMemo(
    () => shipmentLevelRows.filter((row) => SHIPMENT_STAGE_STATUSES.has((row.status || "").toLowerCase().trim())),
    [shipmentLevelRows],
  );

  // Status distribution
  const statusCounts = useMemo(() => {
    return shipmentStageRows.reduce<Record<string, number>>((acc, shipment) => {
      acc[shipment.status] = (acc[shipment.status] || 0) + 1;
      return acc;
    }, {});
  }, [shipmentStageRows]);

  const statusPieData = useMemo(
    () =>
      Object.entries(statusCounts).map(([status, count], index) => ({
        name: status.replace(/_/g, " "),
        value: count,
        fill: STATUS_COLORS[index % STATUS_COLORS.length],
      })),
    [statusCounts]
  );

  // Service type distribution
  const serviceTypeCounts = useMemo(() => {
    return shipmentStageRows.reduce<Record<string, number>>((acc, shipment) => {
      acc[shipment.service_type] = (acc[shipment.service_type] || 0) + 1;
      return acc;
    }, {});
  }, [shipmentStageRows]);

  const servicePieData = useMemo(
    () =>
      Object.entries(serviceTypeCounts).map(([type, count]) => ({
        name: type.toUpperCase(),
        value: count,
        fill: SERVICE_COLORS[type as keyof typeof SERVICE_COLORS] || "hsl(var(--chart-3))",
      })),
    [serviceTypeCounts]
  );

  // Daily trend (last 14 days)
  const dailyTrend = useMemo(() => {
    const today = startOfDay(new Date());
    const days = Array.from({ length: 14 }, (_, i) => {
      const date = subDays(today, 13 - i);
      return {
        date: format(date, "MMM dd"),
        fullDate: date,
        count: 0,
        revenue: 0,
      };
    });

    shipmentStageRows.forEach((shipment) => {
      const shipmentDate = startOfDay(new Date(shipment.created_at));
      const dayEntry = days.find(
        (d) => d.fullDate.getTime() === shipmentDate.getTime()
      );
      if (dayEntry) {
        dayEntry.count += 1;
        dayEntry.revenue += getShipmentBillingAmount(shipment);
      }
    });

    return days;
  }, [shipmentStageRows]);

  // Statistics
  const totalCount = shipmentStageRows.length;
  const deliveredCount = shipmentStageRows.filter((s) => s.status === "delivered" || s.status === "closed").length;
  const inTransitCount = shipmentStageRows.filter((s) => s.status === "supplied" || s.status === "assigned").length;
  const pendingCount = shipmentStageRows.filter((s) => ["requested_pickup", "approved"].includes(s.status)).length;

  const last7Days = shipmentStageRows.filter(
    (s) => new Date(s.created_at) >= subDays(new Date(), 7)
  ).length;
  const prev7Days = shipmentStageRows.filter(
    (s) =>
      new Date(s.created_at) >= subDays(new Date(), 14) &&
      new Date(s.created_at) < subDays(new Date(), 7)
  ).length;
  const growthRate = prev7Days > 0 ? ((last7Days - prev7Days) / prev7Days) * 100 : 0;

  const totalShippingFees = shipmentStageRows.reduce((sum, s) => sum + getShipmentBillingAmount(s), 0);
  const totalWeight = shipmentStageRows.reduce((sum, s) => sum + Number(s.weight || 0), 0);
  const totalCbm = shipmentStageRows.reduce((sum, s) => sum + Number(s.cbm || 0), 0);

  const statusBarData = useMemo(
    () =>
      Object.entries(statusCounts).map(([status, count]) => ({
        status: status.replace(/_/g, " "),
        count,
      })),
    [statusCounts]
  );

  const chartConfig = {
    count: {
      label: "Shipments",
      color: "hsl(var(--chart-1))",
    },
    revenue: {
      label: "Revenue",
      color: "hsl(var(--chart-2))",
    },
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Shipments Report"

      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Shipments</CardTitle>
            <Package className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{isLoading ? "..." : totalCount}</div>
            <div className="flex items-center text-xs text-muted-foreground mt-1">
              {growthRate >= 0 ? (
                <ArrowUpRight className="h-3 w-3 text-green-500 mr-1" />
              ) : (
                <ArrowDownRight className="h-3 w-3 text-red-500 mr-1" />
              )}
              <span className={growthRate >= 0 ? "text-green-500" : "text-red-500"}>
                {growthRate.toFixed(1)}%
              </span>
              <span className="ml-1">vs last week</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Delivered</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{isLoading ? "..." : deliveredCount}</div>
            <p className="text-xs text-muted-foreground">
              {totalCount > 0 ? ((deliveredCount / totalCount) * 100).toFixed(1) : 0}% completion rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">In Transit</CardTitle>
            <Plane className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{isLoading ? "..." : inTransitCount}</div>
            <p className="text-xs text-muted-foreground">Currently moving</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">{isLoading ? "..." : pendingCount}</div>
            <p className="text-xs text-muted-foreground">Awaiting action</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Shipping Fees</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? "..." : formatAmount(totalShippingFees)}</div>
            <p className="text-xs text-muted-foreground">Shipment-level total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Weight</CardTitle>
            <Package className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? "..." : `${totalWeight.toFixed(2)} kg`}</div>
            <p className="text-xs text-muted-foreground">Shipment-level total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total CBM</CardTitle>
            <Package className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? "..." : totalCbm.toFixed(4)}</div>
            <p className="text-xs text-muted-foreground">Shipment-level total</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Status Distribution Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Status Distribution</CardTitle>

          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Loading chart...</p>
            ) : statusPieData.length === 0 ? (
              <p className="text-muted-foreground">No data available.</p>
            ) : (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={110}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {statusPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "0.5rem", fontSize: "0.875rem" }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Service Type Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Service Type Distribution</CardTitle>

          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Loading chart...</p>
            ) : servicePieData.length === 0 ? (
              <p className="text-muted-foreground">No data available.</p>
            ) : (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={servicePieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={110}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {servicePieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "0.5rem", fontSize: "0.875rem" }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Daily Trend Area Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Shipment Trend</CardTitle>

        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading chart...</p>
          ) : (
            <ChartContainer config={chartConfig} className="h-[300px]">
              <AreaChart data={dailyTrend} margin={{ left: 12, right: 12, top: 12, bottom: 12 }}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="hsl(var(--chart-1))"
                  fillOpacity={1}
                  fill="url(#colorCount)"
                />
              </AreaChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* Status Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Shipment Status Volume</CardTitle>

        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading chart...</p>
          ) : statusBarData.length === 0 ? (
            <p className="text-muted-foreground">No data available.</p>
          ) : (
            <ChartContainer config={chartConfig} className="h-[280px]">
              <BarChart data={statusBarData} margin={{ left: 12, right: 12, top: 12, bottom: 28 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="status"
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                  height={40}
                />
                <YAxis allowDecimals={false} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="hsl(var(--chart-1))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ShipmentsReport;

