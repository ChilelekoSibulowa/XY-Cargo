import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Warehouse, Package, TrendingUp, CheckCircle2 } from "lucide-react";

type BranchRow = {
  id: string;
  name: string;
  city: string | null;
  is_active: boolean | null;
};

type ShipmentRow = {
  branch_id: string;
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

const BranchesReport = () => {
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [shipments, setShipments] = useState<ShipmentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const [branchesRes, shipmentsRes] = await Promise.all([
        supabase.from("branches").select("id, name, city, is_active").eq("country", "China"),
        supabase.from("shipments").select("branch_id, status"),
      ]);

      if (branchesRes.error || shipmentsRes.error) {
        toast.error("Failed to load warehouses report data.");
        setBranches([]);
        setShipments([]);
      } else {
        setBranches(branchesRes.data || []);
        setShipments(shipmentsRes.data || []);
      }
      setIsLoading(false);
    };

    fetchData();
  }, []);

  const totalBranches = branches.length;
  const activeBranches = useMemo(
    () => branches.filter((branch) => branch.is_active).length,
    [branches]
  );

  const shipmentCounts = useMemo(() => {
    return shipments.reduce<Record<string, { total: number; delivered: number }>>((acc, row) => {
      if (!row.branch_id) return acc;
      if (!acc[row.branch_id]) {
        acc[row.branch_id] = { total: 0, delivered: 0 };
      }
      acc[row.branch_id].total += 1;
      if (row.status === "delivered" || row.status === "closed") {
        acc[row.branch_id].delivered += 1;
      }
      return acc;
    }, {});
  }, [shipments]);

  const topBranches = useMemo(() => {
    return branches
      .map((branch) => ({
        id: branch.id,
        name: branch.name,
        city: branch.city,
        total: shipmentCounts[branch.id]?.total || 0,
        delivered: shipmentCounts[branch.id]?.delivered || 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [branches, shipmentCounts]);

  const topBranch = topBranches[0];
  const totalDelivered = topBranches.reduce((sum, branch) => sum + branch.delivered, 0);
  const totalShipments = topBranches.reduce((sum, branch) => sum + branch.total, 0);

  // Pie chart for distribution
  const branchPieData = useMemo(
    () =>
      topBranches.map((branch, index) => ({
        name: branch.name,
        value: branch.total,
        fill: COLORS[index % COLORS.length],
      })),
    [topBranches]
  );

  // Active vs Inactive pie
  const statusPieData = [
    { name: "Active", value: activeBranches, fill: "hsl(var(--chart-1))" },
    { name: "Inactive", value: totalBranches - activeBranches, fill: "hsl(var(--chart-2))" },
  ];

  const chartConfig = {
    total: {
      label: "Shipments",
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
        title="Warehouses Report"
        
      />

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Warehouses</CardTitle>
            <Warehouse className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{isLoading ? "..." : totalBranches}</div>
            <p className="text-xs text-muted-foreground">All locations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Warehouses</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{isLoading ? "..." : activeBranches}</div>
            <p className="text-xs text-muted-foreground">
              {totalBranches > 0 ? ((activeBranches / totalBranches) * 100).toFixed(0) : 0}% active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Shipments</CardTitle>
            <Package className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{isLoading ? "..." : totalShipments}</div>
            <p className="text-xs text-muted-foreground">From top warehouses</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Top Warehouse</CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{isLoading ? "..." : topBranch?.name || "N/A"}</div>
            <p className="text-xs text-muted-foreground">
              {topBranch?.total || 0} shipments
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Shipment Distribution Pie */}
        <Card>
          <CardHeader>
            <CardTitle>Shipment Distribution</CardTitle>
            
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Loading chart...</p>
            ) : branchPieData.length === 0 ? (
              <p className="text-muted-foreground">No data available.</p>
            ) : (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={branchPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={110}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {branchPieData.map((entry, index) => (
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
            <CardTitle>Warehouse Status</CardTitle>
            
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
          <CardTitle>Top Warehouses by Shipment Volume</CardTitle>
          
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading chart...</p>
          ) : topBranches.length === 0 ? (
            <p className="text-muted-foreground">No data available.</p>
          ) : (
            <ChartContainer config={chartConfig} className="h-[280px]">
              <BarChart data={topBranches} margin={{ left: 12, right: 12, top: 12, bottom: 28 }}>
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
                <Bar dataKey="total" name="Total" fill="hsl(var(--chart-1))" radius={[6, 6, 0, 0]} />
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
              <div className="text-3xl font-bold">{isLoading ? "..." : totalDelivered}</div>
              <p className="text-sm text-muted-foreground">Delivered from Top Warehouses</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-4 text-center">
              <div className="text-3xl font-bold">
                {isLoading ? "..." : totalShipments > 0 ? ((totalDelivered / totalShipments) * 100).toFixed(1) : 0}%
              </div>
              <p className="text-sm text-muted-foreground">Delivery Rate</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BranchesReport;

