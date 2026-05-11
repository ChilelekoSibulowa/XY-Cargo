import { useEffect, useMemo, useState } from "react";
import { format, isValid, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Cell } from "recharts";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { useDefaultCurrency } from "@/hooks/useDefaultCurrency";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_AGENT_COMMISSION_RATE_KG,
  DEFAULT_AGENT_COMMISSION_RATE_CBM,
  calculateAgentCommission,
  getShipmentCommissionBase,
  getShipmentInvoiceTotal,
  getMonthKey,
  type AgentShipmentRow,
} from "@/lib/agentPortal";
import { toast } from "sonner";

interface AgentProfile {
  user_id: string;
  full_name: string;
  email: string;
  commission_rate_kg: number | null;
  commission_rate_cbm: number | null;
}

interface AgentPerformance {
  agentId: string;
  name: string;
  totalShipments: number;
  delivered: number;
  collected: number;
  revenue: number;
  commission: number;
  successRate: number;
  clients: number;
}

interface MonthlyTrend {
  month: string;
  shipments: number;
  revenue: number;
  commission: number;
}

const COLORS = [
  "hsl(220, 70%, 55%)",
  "hsl(150, 60%, 45%)",
  "hsl(350, 65%, 55%)",
  "hsl(40, 80%, 50%)",
  "hsl(280, 55%, 55%)",
  "hsl(180, 50%, 45%)",
  "hsl(10, 70%, 55%)",
  "hsl(90, 55%, 45%)",
];

const AdminAgentReports = () => {
  const { formatAmount } = useDefaultCurrency();
  const [isLoading, setIsLoading] = useState(true);
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [shipments, setShipments] = useState<(AgentShipmentRow & { agentId: string })[]>([]);
  const [clientCounts, setClientCounts] = useState<Map<string, number>>(new Map());
  const [selectedAgent, setSelectedAgent] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState(() => format(startOfMonth(subMonths(new Date(), 5)), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(() => format(endOfMonth(new Date()), "yyyy-MM-dd"));

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const { data: agentRoles } = await supabase.from("user_roles").select("user_id").eq("role", "agent");
        const agentUserIds = (agentRoles || []).map((r) => r.user_id);
        if (agentUserIds.length === 0) {
          setAgents([]);
          setShipments([]);
          setIsLoading(false);
          return;
        }

        const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, email, commission_rate_kg, commission_rate_cbm").in("user_id", agentUserIds);
        setAgents((profiles || []) as AgentProfile[]);

        const { data: customers } = await supabase.from("customers").select("id, agent_id").in("agent_id", agentUserIds);
        const customerAgentMap = new Map((customers || []).map((c) => [c.id, c.agent_id]));
        const customerIds = (customers || []).map((c) => c.id);

        // Client counts per agent
        const counts = new Map<string, number>();
        (customers || []).forEach((c) => {
          if (c.agent_id) counts.set(c.agent_id, (counts.get(c.agent_id) || 0) + 1);
        });
        setClientCounts(counts);

        if (customerIds.length === 0) {
          setShipments([]);
          setIsLoading(false);
          return;
        }

        let query = supabase
          .from("shipments")
          .select(
            "id, code, customer_id, status, payment_status, paid_amount, total_cost, shipping_cost, service_type, description, notes, custom_tracking_number, weight, cbm, created_at, updated_at, estimated_delivery_date, actual_delivery_date, customer:customers(code, full_name)"
          )
          .in("customer_id", customerIds)
          .order("created_at", { ascending: false })
          .limit(5000);

        if (dateFrom) query = query.gte("created_at", dateFrom);
        if (dateTo) query = query.lte("created_at", dateTo + "T23:59:59");

        const { data: shipmentData } = await query;
        const rows = ((shipmentData || []) as AgentShipmentRow[]).map((s) => ({
          ...s,
          agentId: customerAgentMap.get(s.customer_id) || "",
        }));
        setShipments(rows);
      } catch (error: any) {
        toast.error(error?.message || "Failed to load agent reports.");
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [dateFrom, dateTo]);

  const filteredShipments = useMemo(() => {
    if (selectedAgent === "all") return shipments;
    return shipments.filter((s) => s.agentId === selectedAgent);
  }, [shipments, selectedAgent]);

  // Agent performance table
  const agentPerformance = useMemo<AgentPerformance[]>(() => {
    const agentMap = new Map(agents.map((a) => [a.user_id, a.full_name]));
    const map = new Map<string, AgentPerformance>();

    shipments.forEach((s) => {
      const cur = map.get(s.agentId) || {
        agentId: s.agentId,
        name: agentMap.get(s.agentId) || "Unknown",
        agentProfile: agents.find(a => a.user_id === s.agentId),
        totalShipments: 0,
        delivered: 0,
        collected: 0,
        revenue: 0,
        commission: 0,
        successRate: 0,
        clients: clientCounts.get(s.agentId) || 0,
      };
      const agent = (cur as any).agentProfile;
      const rateKg = agent?.commission_rate_kg ?? DEFAULT_AGENT_COMMISSION_RATE_KG;
      const rateCbm = agent?.commission_rate_cbm ?? DEFAULT_AGENT_COMMISSION_RATE_CBM;
      
      cur.totalShipments += 1;
      if (s.status === "delivered") cur.delivered += 1;
      if (s.status === "closed") cur.collected += 1;
      cur.revenue += getShipmentInvoiceTotal(s);
      cur.commission += calculateAgentCommission(s, rateKg, rateCbm);
      map.set(s.agentId, cur);
    });

    // Also include agents with no shipments
    agents.forEach((a) => {
      if (!map.has(a.user_id)) {
        map.set(a.user_id, {
          agentId: a.user_id,
          name: a.full_name,
          totalShipments: 0,
          delivered: 0,
          collected: 0,
          revenue: 0,
          commission: 0,
          successRate: 0,
          clients: clientCounts.get(a.user_id) || 0,
        });
      }
    });

    return Array.from(map.values()).map((a) => ({
      ...a,
      successRate: a.totalShipments > 0 ? ((a.delivered + a.collected) / a.totalShipments) * 100 : 0,
    })).sort((a, b) => b.revenue - a.revenue);
  }, [shipments, agents, clientCounts]);

  // Shipments by agent chart data
  const shipmentsByAgentChart = useMemo(() => {
    return agentPerformance.map((a) => ({
      name: a.name.length > 12 ? a.name.slice(0, 12) + "…" : a.name,
      shipments: a.totalShipments,
      fullName: a.name,
    }));
  }, [agentPerformance]);

  // Revenue by agent chart data
  const revenueByAgentChart = useMemo(() => {
    return agentPerformance.map((a) => ({
      name: a.name.length > 12 ? a.name.slice(0, 12) + "…" : a.name,
      revenue: Math.round(a.revenue * 100) / 100,
      fullName: a.name,
    }));
  }, [agentPerformance]);

  // Commission by agent chart data
  const commissionByAgentChart = useMemo(() => {
    return agentPerformance.map((a) => ({
      name: a.name.length > 12 ? a.name.slice(0, 12) + "…" : a.name,
      commission: Math.round(a.commission * 100) / 100,
      fullName: a.name,
    }));
  }, [agentPerformance]);

  // Monthly trends
  const monthlyTrends = useMemo<MonthlyTrend[]>(() => {
    const map = new Map<string, MonthlyTrend>();
    filteredShipments.forEach((s) => {
      if (!s.created_at || !isValid(new Date(s.created_at))) return;
      const key = getMonthKey(s.created_at);
      const agent = agents.find(a => a.user_id === s.agentId);
      const rateKg = agent?.commission_rate_kg ?? DEFAULT_AGENT_COMMISSION_RATE_KG;
      const rateCbm = agent?.commission_rate_cbm ?? DEFAULT_AGENT_COMMISSION_RATE_CBM;

      const cur = map.get(key) || { month: key, shipments: 0, revenue: 0, commission: 0 };
      cur.shipments += 1;
      cur.revenue += getShipmentInvoiceTotal(s);
      cur.commission += calculateAgentCommission(s, rateKg, rateCbm);
      map.set(key, cur);
    });
    return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month)).slice(-12);
  }, [filteredShipments]);

  // Overall summary
  const summary = useMemo(() => {
    const totalShipments = filteredShipments.length;
    const totalRevenue = filteredShipments.reduce((s, r) => s + getShipmentInvoiceTotal(r), 0);
    const totalCommission = filteredShipments.reduce((sum, r) => {
      const agent = agents.find(a => a.user_id === r.agentId);
      const rateKg = agent?.commission_rate_kg ?? DEFAULT_AGENT_COMMISSION_RATE_KG;
      const rateCbm = agent?.commission_rate_cbm ?? DEFAULT_AGENT_COMMISSION_RATE_CBM;
      return sum + calculateAgentCommission(r, rateKg, rateCbm);
    }, 0);
    const delivered = filteredShipments.filter((s) => ["delivered", "closed"].includes(s.status)).length;
    const successRate = totalShipments > 0 ? (delivered / totalShipments) * 100 : 0;
    return { totalShipments, totalRevenue, totalCommission, successRate };
  }, [filteredShipments]);

  const performanceColumns: Column<AgentPerformance>[] = [
    { key: "name", label: "Agent" },
    { key: "clients", label: "Clients" },
    { key: "totalShipments", label: "Shipments" },
    { key: "delivered", label: "Delivered" },
    { key: "collected", label: "Collected" },
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
    {
      key: "successRate",
      label: "Success Rate",
      render: (item) => `${item.successRate.toFixed(1)}%`,
    },
  ];

  const trendColumns: Column<MonthlyTrend>[] = [
    { key: "month", label: "Month" },
    { key: "shipments", label: "Shipments" },
    { key: "revenue", label: "Revenue", render: (item) => formatAmount(item.revenue) },
    { key: "commission", label: "Commission", render: (item) => formatAmount(item.commission) },
  ];

  const shipmentsChartConfig = {
    shipments: { label: "Shipments", color: "hsl(220, 70%, 55%)" },
  };
  const revenueChartConfig = {
    revenue: { label: "Revenue", color: "hsl(150, 60%, 45%)" },
  };
  const commissionChartConfig = {
    commission: { label: "Commission", color: "hsl(40, 80%, 50%)" },
  };
  const trendChartConfig = {
    shipments: { label: "Shipments", color: "hsl(220, 70%, 55%)" },
    revenue: { label: "Revenue", color: "hsl(150, 60%, 45%)" },
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Agent Reports & Analytics"
        
      />

      <div className="flex flex-wrap items-end gap-4">
        <div>
          <Label className="text-xs">Agent</Label>
          <Select value={selectedAgent} onValueChange={setSelectedAgent}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Agents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Agents</SelectItem>
              {agents.map((a) => (
                <SelectItem key={a.user_id} value={a.user_id}>
                  {a.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">From</Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[160px]" />
        </div>
        <div>
          <Label className="text-xs">To</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[160px]" />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Total Agents</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{isLoading ? "..." : agents.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Total Shipments</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{isLoading ? "..." : summary.totalShipments}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Total Revenue</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{isLoading ? "..." : formatAmount(summary.totalRevenue)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Success Rate</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{isLoading ? "..." : `${summary.successRate.toFixed(1)}%`}</p></CardContent>
        </Card>
      </div>

      {/* Charts Row 1 - Performance by Agent */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-sm">Shipments by Agent</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : shipmentsByAgentChart.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data</p>
            ) : (
              <ChartContainer config={shipmentsChartConfig} className="h-[280px]">
                <BarChart data={shipmentsByAgentChart} margin={{ left: 8, right: 8, top: 8, bottom: 40 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} angle={-35} textAnchor="end" fontSize={11} interval={0} />
                  <YAxis allowDecimals={false} />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent formatter={(value, name, props) => `${props.payload.fullName}: ${value} shipments`} />} />
                  <Bar dataKey="shipments" radius={[6, 6, 0, 0]}>
                    {shipmentsByAgentChart.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Revenue by Agent</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : revenueByAgentChart.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data</p>
            ) : (
              <ChartContainer config={revenueChartConfig} className="h-[280px]">
                <BarChart data={revenueByAgentChart} margin={{ left: 8, right: 8, top: 8, bottom: 40 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} angle={-35} textAnchor="end" fontSize={11} interval={0} />
                  <YAxis />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent formatter={(value, name, props) => `${props.payload.fullName}: ${formatAmount(Number(value))}`} />} />
                  <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                    {revenueByAgentChart.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Commission by Agent</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : commissionByAgentChart.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data</p>
            ) : (
              <ChartContainer config={commissionChartConfig} className="h-[280px]">
                <BarChart data={commissionByAgentChart} margin={{ left: 8, right: 8, top: 8, bottom: 40 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} angle={-35} textAnchor="end" fontSize={11} interval={0} />
                  <YAxis />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent formatter={(value, name, props) => `${props.payload.fullName}: ${formatAmount(Number(value))}`} />} />
                  <Bar dataKey="commission" radius={[6, 6, 0, 0]}>
                    {commissionByAgentChart.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Monthly Trends Chart */}
      <Card>
        <CardHeader><CardTitle>Monthly Shipment Trends{selectedAgent !== "all" ? ` — ${agents.find((a) => a.user_id === selectedAgent)?.full_name || ""}` : ""}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading chart...</p>
          ) : monthlyTrends.length === 0 ? (
            <p className="text-sm text-muted-foreground">No shipment data for the selected period.</p>
          ) : (
            <ChartContainer config={trendChartConfig} className="h-[300px]">
              <BarChart data={monthlyTrends} margin={{ left: 12, right: 12, top: 12, bottom: 24 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="shipments" fill="var(--color-shipments)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* Agent Performance Table */}
      <Card>
        <CardHeader><CardTitle>Agent Performance Comparison</CardTitle></CardHeader>
        <CardContent>
          <DataTable columns={performanceColumns} data={agentPerformance} isLoading={isLoading} searchPlaceholder="Search agents..." />
        </CardContent>
      </Card>

      {/* Monthly Data Table */}
      <Card>
        <CardHeader><CardTitle>Monthly Breakdown</CardTitle></CardHeader>
        <CardContent>
          <DataTable columns={trendColumns} data={monthlyTrends} isLoading={isLoading} searchPlaceholder="Search months..." />
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminAgentReports;

