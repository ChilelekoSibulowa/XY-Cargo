import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TablePagination, paginate } from "@/components/shared/TablePagination";
import { toast } from "sonner";
import { isBlockedMarketingSource, normalizeMarketingSource } from "@/lib/marketingMetrics";

type AnalyticsRow = {
  id: string;
  page_path: string;
  view_date: string;
  views: number;
  bounce_rate: number;
  session_duration: number;
  traffic_source: string;
  seo_rank: number | null;
  is_landing_page: boolean;
};

type LeadRow = {
  source: string | null;
  status: string;
};

const MarketingAnalytics = () => {
  const sb = supabase as any;
  const [rows, setRows] = useState<AnalyticsRow[]>([]);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [landingFilter, setLandingFilter] = useState<"all" | "landing" | "non_landing">("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [entriesPage, setEntriesPage] = useState(1);
  const [platformPage, setPlatformPage] = useState(1);

  const fetchRows = async () => {
    setIsLoading(true);
    const [analyticsRes, leadsRes] = await Promise.all([
      sb
        .from("marketing_page_analytics")
        .select("*")
        .order("view_date", { ascending: false }),
      sb.from("marketing_leads").select("source, status"),
    ]);

    if (analyticsRes.error) {
      toast.error(analyticsRes.error.message || "Failed to load analytics");
    } else {
      setRows((analyticsRes.data || []) as AnalyticsRow[]);
    }

    setLeads(((leadsRes.data || []) as LeadRow[]).filter((lead) => !isBlockedMarketingSource(lead.source)));
    setIsLoading(false);
  };

  useEffect(() => {
    fetchRows();
  }, []);

  const sourceOptions = useMemo(() => {
    const values = Array.from(new Set(rows.filter((row) => !isBlockedMarketingSource(row.traffic_source)).map((row) => normalizeMarketingSource(row.traffic_source))));
    return values.sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (isBlockedMarketingSource(row.traffic_source)) return false;
      const rowDate = row.view_date || "";
      const source = normalizeMarketingSource(row.traffic_source);

      if (sourceFilter !== "all" && source !== sourceFilter) return false;
      if (landingFilter === "landing" && !row.is_landing_page) return false;
      if (landingFilter === "non_landing" && row.is_landing_page) return false;
      if (fromDate && rowDate < fromDate) return false;
      if (toDate && rowDate > toDate) return false;
      return true;
    });
  }, [rows, sourceFilter, landingFilter, fromDate, toDate]);

  const entriesPageSize = 20;
  const entriesTotalPages = Math.max(1, Math.ceil(filteredRows.length / entriesPageSize));
  const paginatedEntries = paginate(filteredRows, entriesPage, entriesPageSize);

  const pageViews = filteredRows.reduce((sum, row) => sum + (row.views || 0), 0);

  const landingPagePerformance = filteredRows.filter((row) => row.is_landing_page).length;
  const bounceRateAvg = filteredRows.length
    ? filteredRows.reduce((sum, row) => sum + (row.bounce_rate || 0), 0) / filteredRows.length
    : 0;

  const trafficSources = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredRows.forEach((row) => {
      const key = normalizeMarketingSource(row.traffic_source);
      counts[key] = (counts[key] || 0) + row.views;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [filteredRows]);

  const topPages = useMemo(() => {
    return [...filteredRows]
      .sort((a, b) => (b.views || 0) - (a.views || 0))
      .slice(0, 5);
  }, [filteredRows]);

  const blogPosts = filteredRows.filter((row) => row.page_path.toLowerCase().includes("blog")).length;

  const websitePlatformRows = useMemo(() => {
    const visitsByPlatform = new Map<string, number>();
    filteredRows.forEach((row) => {
      const platform = normalizeMarketingSource(row.traffic_source);
      visitsByPlatform.set(platform, (visitsByPlatform.get(platform) || 0) + Number(row.views || 0));
    });

    const clientsByPlatform = new Map<string, number>();
    leads.forEach((lead) => {
      if (lead.status !== "converted") return;
      const platform = lead.source || "Direct";
      clientsByPlatform.set(platform, (clientsByPlatform.get(platform) || 0) + 1);
    });

    const allPlatforms = Array.from(new Set([...visitsByPlatform.keys(), ...clientsByPlatform.keys()]));
    return allPlatforms
      .map((platform) => ({
        platform,
        websiteVisits: visitsByPlatform.get(platform) || 0,
        registeredClients: clientsByPlatform.get(platform) || 0,
      }))
      .sort((a, b) => b.websiteVisits - a.websiteVisits);
  }, [filteredRows, leads]);

  const platformPageSize = 20;
  const platformTotalPages = Math.max(1, Math.ceil(websitePlatformRows.length / platformPageSize));
  const paginatedPlatforms = paginate(websitePlatformRows, platformPage, platformPageSize);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Website Analytics"
        
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label htmlFor="analyticsSourceFilter">Platform/Source</Label>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger id="analyticsSourceFilter">
                <SelectValue placeholder="All sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                {sourceOptions.map((source) => (
                  <SelectItem key={source} value={source}>{source}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="analyticsLandingFilter">Page Type</Label>
            <Select value={landingFilter} onValueChange={(value) => setLandingFilter(value as "all" | "landing" | "non_landing")}>
              <SelectTrigger id="analyticsLandingFilter">
                <SelectValue placeholder="All pages" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All pages</SelectItem>
                <SelectItem value="landing">Landing pages only</SelectItem>
                <SelectItem value="non_landing">Non-landing pages only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="analyticsFromDate">From Date</Label>
            <Input
              id="analyticsFromDate"
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="analyticsToDate">To Date</Label>
            <Input
              id="analyticsToDate"
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm leading-snug !whitespace-normal [overflow-wrap:anywhere]">Page Views</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{isLoading ? "..." : pageViews}</p>
            <p className="text-xs text-muted-foreground">Filtered range</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm leading-snug !whitespace-normal [overflow-wrap:anywhere]">Landing Page Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{isLoading ? "..." : landingPagePerformance}</p>
            <p className="text-xs text-muted-foreground">Landing pages tracked</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm leading-snug !whitespace-normal [overflow-wrap:anywhere]">Bounce Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{isLoading ? "..." : `${bounceRateAvg.toFixed(1)}%`}</p>
            <p className="text-xs text-muted-foreground">Average bounce rate</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm leading-snug break-words">Traffic Sources</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {trafficSources.map(([source, count]) => (
              <div key={source} className="flex items-center justify-between">
                <span>{source}</span>
                <span className="font-semibold">{count}</span>
              </div>
            ))}
            {trafficSources.length === 0 && <p className="text-muted-foreground">No traffic data yet.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm leading-snug break-words">Top Performing Pages</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {topPages.map((page) => (
              <div key={page.id} className="flex items-center justify-between gap-3">
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{page.page_path}</span>
                <div className="shrink-0 text-right">
                  <div className="font-semibold">{page.views} views</div>
                </div>
              </div>
            ))}
            {topPages.length === 0 && <p className="text-muted-foreground">No pages found.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm leading-snug break-words">Blog Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{isLoading ? "..." : blogPosts}</p>
            <p className="text-xs text-muted-foreground">Blog pages tracked</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm leading-snug break-words">Auto-Tracked Analytics Entries</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-3 text-left">Page</th>
                <th className="p-3 text-left">Views</th>
                <th className="p-3 text-left">Bounce Rate</th>
                <th className="p-3 text-left">Source</th>
                <th className="p-3 text-left">Date</th>
              </tr>
            </thead>
            <tbody>
              {paginatedEntries.map((row) => (
                <tr key={row.id} className="border-b hover:bg-muted/30">
                  <td className="p-3 font-medium max-w-[360px] truncate">{row.page_path}</td>
                  <td className="p-3">{row.views}</td>
                  <td className="p-3">{row.bounce_rate}%</td>
                  <td className="p-3">{normalizeMarketingSource(row.traffic_source)}</td>
                  <td className="p-3 text-muted-foreground">{row.view_date}</td>
                </tr>
              ))}
              {filteredRows.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-muted-foreground">
                    No analytics entries yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <TablePagination currentPage={entriesPage} totalPages={entriesTotalPages} onPageChange={setEntriesPage} totalItems={filteredRows.length} pageSize={entriesPageSize} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm leading-snug break-words">Website Analytics by Platform</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-3 text-left">Platform</th>
                <th className="p-3 text-left">Website Visits</th>
                <th className="p-3 text-left">Registered Clients</th>
              </tr>
            </thead>
            <tbody>
              {paginatedPlatforms.map((row) => (
                <tr key={row.platform} className="border-b hover:bg-muted/30">
                  <td className="p-3 font-medium">{row.platform}</td>
                  <td className="p-3">{row.websiteVisits}</td>
                  <td className="p-3">{row.registeredClients}</td>
                </tr>
              ))}
              {websitePlatformRows.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={3} className="p-6 text-center text-muted-foreground">
                    No platform analytics found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <TablePagination currentPage={platformPage} totalPages={platformTotalPages} onPageChange={setPlatformPage} totalItems={websitePlatformRows.length} pageSize={platformPageSize} />
        </CardContent>
      </Card>
    </div>
  );
};

export default MarketingAnalytics;
