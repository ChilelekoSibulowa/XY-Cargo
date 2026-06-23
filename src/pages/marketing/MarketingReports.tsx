import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Users, TrendingUp, Eye, Target, DollarSign, Package } from "lucide-react";
import { format, startOfDay, subDays } from "date-fns";
import { useCurrency } from "@/hooks/useCurrencyContext";
import { isBlockedMarketingSource, normalizeMarketingSource } from "@/lib/marketingMetrics";

interface LeadRow {
  status: string;
  created_at: string;
  source: string | null;
  deal_value: number;
}

interface CampaignRow {
  revenue_attributed: number;
  spend: number;
  channel: string;
  created_at: string;
}

interface AnalyticsRow {
  views: number;
  view_date: string;
  page_path: string;
  traffic_source: string;
}

interface ShipmentRow {
  created_at: string;
}

const SOURCE_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

const MarketingReports = () => {
  const sb = supabase as any;
  const { formatAmount } = useCurrency();
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsRow[]>([]);
  const [shipments, setShipments] = useState<ShipmentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const [leadRes, campaignRes, analyticsRes, shipmentRes] = await Promise.all([
        sb.from("marketing_leads").select("status, created_at, source, deal_value"),
        sb.from("marketing_campaigns").select("revenue_attributed, spend, channel, created_at"),
        sb.from("marketing_page_analytics").select("views, view_date, page_path, traffic_source"),
        sb.from("shipments").select("created_at"),
      ]);

      setLeads(((leadRes.data || []) as LeadRow[]).filter((lead) => !isBlockedMarketingSource(lead.source)));
      setCampaigns((campaignRes.data || []) as CampaignRow[]);
      setAnalytics(((analyticsRes.data || []) as AnalyticsRow[]).filter((row) => !isBlockedMarketingSource(row.traffic_source)));
      setShipments((shipmentRes.data || []) as ShipmentRow[]);
      setIsLoading(false);
    };

    fetchData();
  }, [sb]);

  const totalLeads = leads.length;
  const convertedLeads = leads.filter((lead) => lead.status === "converted").length;
  const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;

  const last30Days = new Date();
  last30Days.setDate(last30Days.getDate() - 30);

  const monthlyLeads = leads.filter((lead) => new Date(lead.created_at) >= last30Days).length;
  const monthlyRevenue = campaigns
    .filter((campaign) => new Date(campaign.created_at) >= last30Days)
    .reduce((sum, campaign) => sum + (campaign.revenue_attributed || 0), 0);
  const monthlySpend = campaigns
    .filter((campaign) => new Date(campaign.created_at) >= last30Days)
    .reduce((sum, campaign) => sum + (campaign.spend || 0), 0);
  const monthlyTraffic = analytics
    .filter((row) => new Date(row.view_date) >= last30Days)
    .reduce((sum, row) => sum + (row.views || 0), 0);
  const monthlyShipments = shipments.filter((shipment) => new Date(shipment.created_at) >= last30Days).length;

  const roi = monthlySpend > 0 ? ((monthlyRevenue - monthlySpend) / monthlySpend) * 100 : 0;

  const leadStatusData = useMemo(() => {
    const counts = leads.reduce<Record<string, number>>((acc, lead) => {
      acc[lead.status] = (acc[lead.status] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts).map(([status, count], index) => ({
      name: status,
      value: count,
      fill: SOURCE_COLORS[index % SOURCE_COLORS.length],
    }));
  }, [leads]);

  const leadSourceData = useMemo(() => {
    const counts = leads.reduce<Record<string, number>>((acc, lead) => {
      const source = lead.source || "Unknown";
      acc[source] = (acc[source] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([source, count], index) => ({
        name: source,
        value: count,
        fill: SOURCE_COLORS[index % SOURCE_COLORS.length],
      }));
  }, [leads]);

  const channelData = useMemo(() => {
    const map = campaigns.reduce<Record<string, { revenue: number; spend: number }>>((acc, campaign) => {
      if (!acc[campaign.channel]) acc[campaign.channel] = { revenue: 0, spend: 0 };
      acc[campaign.channel].revenue += campaign.revenue_attributed || 0;
      acc[campaign.channel].spend += campaign.spend || 0;
      return acc;
    }, {});

    return Object.entries(map).map(([channel, data]) => ({
      channel,
      revenue: data.revenue,
      spend: data.spend,
    }));
  }, [campaigns]);

  const dailyTraffic = useMemo(() => {
    const today = startOfDay(new Date());
    const days = Array.from({ length: 14 }, (_, index) => {
      const date = subDays(today, 13 - index);
      return {
        date: format(date, "MMM dd"),
        fullDate: date,
        views: 0,
      };
    });

    analytics.forEach((row) => {
      const rowDate = startOfDay(new Date(row.view_date));
      const dayEntry = days.find((day) => day.fullDate.getTime() === rowDate.getTime());
      if (dayEntry) {
        dayEntry.views += row.views || 0;
      }
    });

    return days;
  }, [analytics]);

  const trafficSourceData = useMemo(() => {
    const counts = analytics.reduce<Record<string, number>>((acc, row) => {
      const source = normalizeMarketingSource(row.traffic_source);
      acc[source] = (acc[source] || 0) + row.views;
      return acc;
    }, {});

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([source, views], index) => ({
        name: source,
        value: views,
        fill: SOURCE_COLORS[index % SOURCE_COLORS.length],
      }));
  }, [analytics]);

  const chartConfig = {
    revenue: { label: "Revenue", color: "hsl(var(--chart-1))" },
    spend: { label: "Spend", color: "hsl(var(--chart-2))" },
    views: { label: "Views", color: "hsl(var(--chart-3))" },
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Marketing Reports"
        
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Monthly Leads</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{isLoading ? "..." : monthlyLeads}</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Monthly Shipments</CardTitle>
            <Package className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-indigo-600">{isLoading ? "..." : monthlyShipments}</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <Target className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {isLoading ? "..." : `${conversionRate.toFixed(1)}%`}
            </div>
            <p className="text-xs text-muted-foreground">
              {convertedLeads} of {totalLeads} leads
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {isLoading ? "..." : formatAmount(monthlyRevenue)}
            </div>
            <p className="text-xs text-muted-foreground">Attributed revenue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Monthly Traffic</CardTitle>
            <Eye className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{isLoading ? "..." : monthlyTraffic.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Page views</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">ROI</CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${roi >= 0 ? "text-green-600" : "text-red-600"}`}>
              {isLoading ? "..." : `${roi.toFixed(1)}%`}
            </div>
            <p className="text-xs text-muted-foreground">Return on investment</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Lead Status Distribution</CardTitle>
            
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : leadStatusData.length === 0 ? (
              <p className="text-muted-foreground">No data available.</p>
            ) : (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={leadStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={110}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {leadStatusData.map((entry, index) => (
                        <Cell key={`lead-status-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "0.5rem",
                        fontSize: "0.875rem",
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lead Sources</CardTitle>
            
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : leadSourceData.length === 0 ? (
              <p className="text-muted-foreground">No data available.</p>
            ) : (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={leadSourceData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {leadSourceData.map((entry, index) => (
                        <Cell key={`lead-source-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "0.5rem",
                        fontSize: "0.875rem",
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daily Traffic Trend</CardTitle>
          
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : (
            <ChartContainer config={chartConfig} className="h-[300px]">
              <AreaChart data={dailyTraffic} margin={{ left: 12, right: 12, top: 12, bottom: 12 }}>
                <defs>
                  <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="views"
                  stroke="hsl(var(--chart-3))"
                  fillOpacity={1}
                  fill="url(#colorViews)"
                />
              </AreaChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Channel Performance</CardTitle>
            
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : channelData.length === 0 ? (
              <p className="text-muted-foreground">No data available.</p>
            ) : (
              <ChartContainer config={chartConfig} className="h-[280px]">
                <BarChart data={channelData} margin={{ left: 12, right: 12, top: 12, bottom: 28 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="channel" tickLine={false} axisLine={false} />
                  <YAxis />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent formatter={(value) => formatAmount(Number(value))} />}
                  />
                  <Bar dataKey="revenue" name="Revenue" fill="hsl(var(--chart-1))" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="spend" name="Spend" fill="hsl(var(--chart-2))" radius={[6, 6, 0, 0]} />
                  <Legend />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Traffic Sources</CardTitle>
            
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : trafficSourceData.length === 0 ? (
              <p className="text-muted-foreground">No data available.</p>
            ) : (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={trafficSourceData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={110}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {trafficSourceData.map((entry, index) => (
                        <Cell key={`traffic-source-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "0.5rem",
                        fontSize: "0.875rem",
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MarketingReports;
