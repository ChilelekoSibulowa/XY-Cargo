import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, PieChart, Pie, Cell, AreaChart, Area, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Users, UserCheck, UserPlus, MapPin, TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { format, subDays, startOfDay } from "date-fns";

interface CustomerRow {
  is_active: boolean | null;
  city: string | null;
  country: string | null;
  created_at: string;
}

const CITY_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

const CustomersReport = () => {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCustomers = async () => {
    const { data, error } = await supabase
      .from("customers")
      .select("is_active, city, country, created_at");

    if (error) {
      toast.error("Failed to load customer data.");
      setCustomers([]);
    } else {
      setCustomers(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const totalCount = customers.length;
  const activeCount = useMemo(
    () => customers.filter((row) => row.is_active).length,
    [customers]
  );
  const inactiveCount = totalCount - activeCount;

  // Top cities
  const topCities = useMemo(() => {
    const counts = customers.reduce<Record<string, number>>((acc, row) => {
      if (!row.city) return acc;
      acc[row.city] = (acc[row.city] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [customers]);

  const cityPieData = useMemo(
    () =>
      topCities.map(([city, count], index) => ({
        name: city,
        value: count,
        fill: CITY_COLORS[index % CITY_COLORS.length],
      })),
    [topCities]
  );

  // Country distribution
  const countryData = useMemo(() => {
    const counts = customers.reduce<Record<string, number>>((acc, row) => {
      const country = row.country || "Unknown";
      acc[country] = (acc[country] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([country, count]) => ({ country, count }));
  }, [customers]);

  // Active vs Inactive pie
  const statusPieData = [
    { name: "Active", value: activeCount, fill: "hsl(var(--chart-1))" },
    { name: "Inactive", value: inactiveCount, fill: "hsl(var(--chart-2))" },
  ];

  // Daily signups (last 14 days)
  const dailySignups = useMemo(() => {
    const today = startOfDay(new Date());
    const days = Array.from({ length: 14 }, (_, i) => {
      const date = subDays(today, 13 - i);
      return {
        date: format(date, "MMM dd"),
        fullDate: date,
        count: 0,
      };
    });

    customers.forEach((customer) => {
      const signupDate = startOfDay(new Date(customer.created_at));
      const dayEntry = days.find(
        (d) => d.fullDate.getTime() === signupDate.getTime()
      );
      if (dayEntry) {
        dayEntry.count += 1;
      }
    });

    return days;
  }, [customers]);

  // Growth metrics
  const last7Days = customers.filter(
    (c) => new Date(c.created_at) >= subDays(new Date(), 7)
  ).length;
  const prev7Days = customers.filter(
    (c) =>
      new Date(c.created_at) >= subDays(new Date(), 14) &&
      new Date(c.created_at) < subDays(new Date(), 7)
  ).length;
  const growthRate = prev7Days > 0 ? ((last7Days - prev7Days) / prev7Days) * 100 : 0;

  const chartConfig = {
    count: {
      label: "Customers",
      color: "hsl(var(--chart-1))",
    },
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Customers Report"
        
      />

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-primary" />
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
            <CardTitle className="text-sm font-medium">Active Customers</CardTitle>
            <UserCheck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{isLoading ? "..." : activeCount}</div>
            <p className="text-xs text-muted-foreground">
              {totalCount > 0 ? ((activeCount / totalCount) * 100).toFixed(1) : 0}% active rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">New This Week</CardTitle>
            <UserPlus className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{isLoading ? "..." : last7Days}</div>
            <p className="text-xs text-muted-foreground">Last 7 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Top City</CardTitle>
            <MapPin className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? "..." : topCities[0]?.[0] || "N/A"}</div>
            <p className="text-xs text-muted-foreground">
              {topCities[0]?.[1] || 0} customers
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Active vs Inactive */}
        <Card>
          <CardHeader>
            <CardTitle>Customer Status</CardTitle>
            
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

        {/* Top Cities */}
        <Card>
          <CardHeader>
            <CardTitle>Top Cities</CardTitle>
            
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Loading chart...</p>
            ) : cityPieData.length === 0 ? (
              <p className="text-muted-foreground">No data available.</p>
            ) : (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={cityPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={110}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {cityPieData.map((entry, index) => (
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

      {/* Daily Signups Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Customer Acquisition Trend</CardTitle>
          
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading chart...</p>
          ) : (
            <ChartContainer config={chartConfig} className="h-[300px]">
              <AreaChart data={dailySignups} margin={{ left: 12, right: 12, top: 12, bottom: 12 }}>
                <defs>
                  <linearGradient id="colorSignups" x1="0" y1="0" x2="0" y2="1">
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
                  fill="url(#colorSignups)"
                />
              </AreaChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* Country Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Customers by Country</CardTitle>
          
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading chart...</p>
          ) : countryData.length === 0 ? (
            <p className="text-muted-foreground">No data available.</p>
          ) : (
            <ChartContainer config={chartConfig} className="h-[280px]">
              <BarChart data={countryData} margin={{ left: 12, right: 12, top: 12, bottom: 28 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="country"
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

export default CustomersReport;

