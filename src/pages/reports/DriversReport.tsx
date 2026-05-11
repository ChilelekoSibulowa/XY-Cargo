import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Users, Plane, TrendingUp, CheckCircle2, Package } from "lucide-react";

type DriverRow = {
  id: string;
  full_name: string;
  is_active: boolean | null;
};

type ShipmentRow = {
  assigned_driver_id: string | null;
  status: string;
};

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(220, 70%, 50%)",
];

const DriversReport = () => {
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [shipments, setShipments] = useState<ShipmentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const [driversRes, shipmentsRes] = await Promise.all([
        supabase.from("drivers").select("id, full_name, is_active"),
        supabase.from("shipments").select("assigned_driver_id, status"),
      ]);

      if (driversRes.error || shipmentsRes.error) {
        toast.error("Failed to load drivers report data.");
        setDrivers([]);
        setShipments([]);
      } else {
        setDrivers(driversRes.data || []);
        setShipments(shipmentsRes.data || []);
      }
      setIsLoading(false);
    };

    fetchData();
  }, []);

  const totalDrivers = drivers.length;
  const activeDrivers = useMemo(
    () => drivers.filter((driver) => driver.is_active).length,
    [drivers]
  );

  const shipmentCounts = useMemo(() => {
    return shipments.reduce<Record<string, { total: number; delivered: number }>>((acc, row) => {
      if (!row.assigned_driver_id) return acc;
      if (!acc[row.assigned_driver_id]) {
        acc[row.assigned_driver_id] = { total: 0, delivered: 0 };
      }
      acc[row.assigned_driver_id].total += 1;
      if (row.status === "delivered" || row.status === "closed") {
        acc[row.assigned_driver_id].delivered += 1;
      }
      return acc;
    }, {});
  }, [shipments]);

  const topDrivers = useMemo(() => {
    return drivers
      .map((driver) => ({
        id: driver.id,
        name: driver.full_name || "Unnamed Driver",
        total: shipmentCounts[driver.id]?.total || 0,
        delivered: shipmentCounts[driver.id]?.delivered || 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [drivers, shipmentCounts]);

  const topDriver = topDrivers[0];
  const deliveredTotal = topDrivers.reduce((sum, driver) => sum + driver.delivered, 0);
  const assignedTotal = topDrivers.reduce((sum, driver) => sum + driver.total, 0);

  // Pie chart for driver distribution
  const driverPieData = useMemo(
    () =>
      topDrivers
        .filter((d) => d.total > 0)
        .map((driver, index) => ({
          name: driver.name,
          value: driver.total,
          fill: COLORS[index % COLORS.length],
        })),
    [topDrivers]
  );

  // Active vs Inactive pie
  const statusPieData = [
    { name: "Active", value: activeDrivers, fill: "hsl(var(--chart-1))" },
    { name: "Inactive", value: totalDrivers - activeDrivers, fill: "hsl(var(--chart-2))" },
  ];

  const chartConfig = {
    total: {
      label: "Assigned",
      color: "hsl(var(--chart-1))",
    },
    delivered: {
      label: "Delivered",
      color: "hsl(var(--chart-2))",
    },
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Drivers Report"
        
      />

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Drivers</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{isLoading ? "..." : totalDrivers}</div>
            <p className="text-xs text-muted-foreground">Registered drivers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Drivers</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{isLoading ? "..." : activeDrivers}</div>
            <p className="text-xs text-muted-foreground">
              {totalDrivers > 0 ? ((activeDrivers / totalDrivers) * 100).toFixed(0) : 0}% active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Deliveries</CardTitle>
            <Package className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{isLoading ? "..." : deliveredTotal}</div>
            <p className="text-xs text-muted-foreground">Completed deliveries</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Top Driver</CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold truncate">{isLoading ? "..." : topDriver?.name || "N/A"}</div>
            <p className="text-xs text-muted-foreground">
              {topDriver?.total || 0} shipments
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Workload Distribution Pie */}
        <Card>
          <CardHeader>
            <CardTitle>Workload Distribution</CardTitle>
            
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Loading chart...</p>
            ) : driverPieData.length === 0 ? (
              <p className="text-muted-foreground">No data available.</p>
            ) : (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={driverPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={110}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {driverPieData.map((entry, index) => (
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

        {/* Active vs Inactive */}
        <Card>
          <CardHeader>
            <CardTitle>Driver Status</CardTitle>
            
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Loading chart...</p>
            ) : (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
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
      </div>

      {/* Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Top Drivers by Performance</CardTitle>
          
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading chart...</p>
          ) : topDrivers.length === 0 ? (
            <p className="text-muted-foreground">No data available.</p>
          ) : (
            <ChartContainer config={chartConfig} className="h-[280px]">
              <BarChart data={topDrivers} margin={{ left: 12, right: 12, top: 12, bottom: 28 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                  height={40}
                />
                <YAxis allowDecimals={false} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                <Bar dataKey="total" name="Assigned" fill="hsl(var(--chart-1))" radius={[6, 6, 0, 0]} />
                <Bar dataKey="delivered" name="Delivered" fill="hsl(var(--chart-2))" radius={[6, 6, 0, 0]} />
                <Legend />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Delivery Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg bg-muted/50 p-4 text-center">
              <Plane className="h-8 w-8 mx-auto mb-2 text-primary" />
              <div className="text-3xl font-bold">{isLoading ? "..." : assignedTotal}</div>
              <p className="text-sm text-muted-foreground">Total Assigned</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-4 text-center">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <div className="text-3xl font-bold">
                {isLoading ? "..." : assignedTotal > 0 ? ((deliveredTotal / assignedTotal) * 100).toFixed(1) : 0}%
              </div>
              <p className="text-sm text-muted-foreground">Completion Rate</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DriversReport;

