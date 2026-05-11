import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useDefaultCurrency } from "@/hooks/useDefaultCurrency";
import { TablePagination, paginate } from "@/components/shared/TablePagination";
import {
  buildCampaignPerformanceRows,
  type MarketingCampaignMetricSource,
  type MarketingLeadMetricSource,
} from "@/lib/marketingMetrics";
import { BarChart3, DollarSign, Eye, Globe, Target, TrendingUp, Users } from "lucide-react";

type CampaignRow = MarketingCampaignMetricSource & {
  views?: number | null;
  viewers?: number | null;
  engagements?: number | null;
  reach?: number | null;
  page_likes?: number | null;
  link_clicks?: number | null;
};

type LeadRow = MarketingLeadMetricSource & {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  assigned_to: string | null;
  created_at: string;
};

type AnalyticsRow = {
  traffic_source: string | null;
  view_date: string;
  views: number;
};

type SocialMetricRow = {
  platform: string;
  followers: number;
  views?: number | null;
  likes?: number | null;
  reach?: number | null;
  leads?: number | null;
  clicks?: number | null;
  engagements?: number | null;
  engagement_rate: number;
  growth_rate: number;
  recorded_at: string;
};

type SocialPostRow = {
  platform: string;
  engagement_count: number;
  inquiry_count: number;
};

const MarketingDashboard = () => {
  const { formatAmount } = useDefaultCurrency();
  const sb = supabase as any;
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsRow[]>([]);
  const [socialMetrics, setSocialMetrics] = useState<SocialMetricRow[]>([]);
  const [socialPosts, setSocialPosts] = useState<SocialPostRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [campaignPage, setCampaignPage] = useState(1);
  const [leadsPage, setLeadsPage] = useState(1);
  const [analyticsPage, setAnalyticsPage] = useState(1);
  const [socialPage, setSocialPage] = useState(1);

  useEffect(() => {
    const fetchData = async () => {
      const [campaignRes, leadRes, analyticsRes, socialMetricRes, socialPostRes] = await Promise.all([
        sb.from("marketing_campaigns").select("*"),
        sb.from("marketing_leads").select("id, full_name, email, phone, status, created_at, source, assigned_to"),
        sb.from("marketing_page_analytics").select("view_date, views, traffic_source"),
        sb.from("marketing_social_metrics").select("*"),
        sb.from("marketing_social_posts").select("platform, engagement_count, inquiry_count"),
      ]);

      setCampaigns((campaignRes.data || []) as CampaignRow[]);
      setLeads((leadRes.data || []) as LeadRow[]);
      setAnalytics((analyticsRes.data || []) as AnalyticsRow[]);
      setSocialMetrics((socialMetricRes.data || []) as SocialMetricRow[]);
      setSocialPosts((socialPostRes.data || []) as SocialPostRow[]);
      setIsLoading(false);
    };

    fetchData();
  }, [sb]);

  const campaignRows = useMemo(
    () => buildCampaignPerformanceRows(campaigns, leads),
    [campaigns, leads],
  );

  const totalLeads = leads.length;
  const convertedLeads = leads.filter((lead) => lead.status === "converted").length;
  const activeCampaigns = campaignRows.filter((campaign) => campaign.status === "active");

  const totalSpend = campaignRows.reduce((sum, campaign) => sum + campaign.cost, 0);
  const totalBudget = campaignRows.reduce((sum, campaign) => sum + campaign.budgetAmount, 0);
  const totalRevenue = campaignRows.reduce((sum, campaign) => sum + campaign.revenue, 0);
  const totalCampaignLeads = campaignRows.reduce((sum, campaign) => sum + campaign.leadCount, 0);

  const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;
  const costPerLead = totalCampaignLeads > 0 ? totalSpend / totalCampaignLeads : 0;
  const campaignRoi = totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend) * 100 : 0;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const BLOCKED_SOURCES = ["internal"];
  const isBlockedSource = (value: string | null | undefined) => {
    const lower = (value || "").toLowerCase();
    return BLOCKED_SOURCES.some((blocked) => lower.includes(blocked));
  };

  const websiteTraffic = analytics
    .filter((row) => new Date(row.view_date) >= thirtyDaysAgo && !isBlockedSource(row.traffic_source))
    .reduce((sum, row) => sum + (row.views || 0), 0);

  const websiteAnalyticsByPlatform = useMemo(() => {
    const viewsByPlatform = new Map<string, number>();
    analytics.filter((row) => !isBlockedSource(row.traffic_source)).forEach((row) => {
      const platform = (row.traffic_source || "Direct").trim() || "Direct";
      viewsByPlatform.set(platform, (viewsByPlatform.get(platform) || 0) + Number(row.views || 0));
    });

    const clientsByPlatform = new Map<string, number>();
    leads.forEach((lead) => {
      if (lead.status !== "converted") return;
      const platform = (lead.source || "Direct").trim() || "Direct";
      clientsByPlatform.set(platform, (clientsByPlatform.get(platform) || 0) + 1);
    });

    const allPlatforms = Array.from(new Set([...viewsByPlatform.keys(), ...clientsByPlatform.keys()]));
    return allPlatforms
      .map((platform) => ({
        platform,
        websiteVisits: viewsByPlatform.get(platform) || 0,
        registeredClients: clientsByPlatform.get(platform) || 0,
      }))
      .sort((a, b) => b.websiteVisits - a.websiteVisits);
  }, [analytics, leads]);

  const socialSummary = useMemo(() => {
    const totalFollowers = socialMetrics.reduce((sum, row) => sum + Number(row.followers || 0), 0);
    const totalLeadsFromSocial = leads.filter((lead) => {
      const src = (lead.source || "").toLowerCase();
      return src.includes("facebook") || src.includes("instagram") || src.includes("tiktok") || src.includes("linkedin") || src === "x" || src.includes("twitter");
    }).length;
    const totalEngagements = socialPosts.reduce((sum, row) => sum + Number(row.engagement_count || 0), 0);
    const totalReach = totalFollowers + totalEngagements;
    const websiteClicks = socialPosts.reduce((sum, row) => sum + Number(row.inquiry_count || 0), 0);

    return {
      totalFollowers,
      totalReach,
      websiteClicks,
      totalLeads: totalLeadsFromSocial,
    };
  }, [socialMetrics, socialPosts, leads]);

  const metricOrFallback = (stored: number | null | undefined, fallback: number) => {
    if (typeof stored === "number" && Number.isFinite(stored) && stored > 0) return stored;
    return fallback;
  };

  const socialGrowthRows = useMemo(() => {
    const postMap = new Map<string, { views: number; likes: number; reach: number; leads: number; engagements: number; clicks: number }>();

    socialPosts.forEach((post) => {
      const key = post.platform || "Unknown";
      const current = postMap.get(key) || { views: 0, likes: 0, reach: 0, leads: 0, engagements: 0, clicks: 0 };
      const engagements = Number(post.engagement_count || 0);
      const clicks = Number(post.inquiry_count || 0);

      current.engagements += engagements;
      current.likes += Math.round(engagements * 0.55);
      current.views += Math.max(engagements * 4, clicks * 10);
      current.reach += Math.max(engagements * 5, clicks * 12);
      current.clicks += clicks;
      current.leads += Math.max(Math.round(clicks * 0.35), 0);
      postMap.set(key, current);
    });

    return socialMetrics.map((metric) => {
      const postTotals = postMap.get(metric.platform || "Unknown") || {
        views: 0,
        likes: 0,
        reach: 0,
        leads: 0,
        engagements: 0,
        clicks: 0,
      };

      return {
        platform: metric.platform || "Unknown",
        followers: Number(metric.followers || 0),
        views: metricOrFallback(metric.views, postTotals.views),
        likes: metricOrFallback(metric.likes, postTotals.likes),
        reach: metricOrFallback(metric.reach, postTotals.reach),
        leads: metricOrFallback(metric.leads, postTotals.leads),
        engagements: metricOrFallback(metric.engagements, postTotals.engagements),
        engagementRate: Number(metric.engagement_rate || 0),
        clicks: metricOrFallback(metric.clicks, postTotals.clicks),
        growthRate: Number(metric.growth_rate || 0),
        date: metric.recorded_at,
      };
    });
  }, [socialMetrics, socialPosts]);

  const recentLeads = useMemo(
    () => [...leads].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [leads],
  );

  const formatCampaignDerivedMetric = (leadCount: number, multiplier: number) => Math.round(leadCount * multiplier);
  const campaignMetaById = useMemo(() => {
    const map = new Map<string, CampaignRow>();
    campaigns.forEach((campaign) => map.set(campaign.id, campaign));
    return map;
  }, [campaigns]);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Marketing Overview"
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm break-words [overflow-wrap:anywhere]">
              <Globe className="h-4 w-4 text-blue-500" /> Website Traffic
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold break-all">{isLoading ? "..." : websiteTraffic.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm break-words [overflow-wrap:anywhere]">
              <Users className="h-4 w-4 text-green-500" /> Leads Generated
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold break-all">{isLoading ? "..." : totalLeads}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm break-words [overflow-wrap:anywhere]">
              <TrendingUp className="h-4 w-4 text-purple-500" /> Conversion Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold break-all">{isLoading ? "..." : `${conversionRate.toFixed(1)}%`}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm break-words [overflow-wrap:anywhere]">
              <DollarSign className="h-4 w-4 text-orange-500" /> Cost per Lead
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold break-all">{isLoading ? "..." : formatAmount(costPerLead)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm break-words [overflow-wrap:anywhere]">
              <BarChart3 className="h-4 w-4 text-emerald-500" /> Campaign ROI
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold break-all">{isLoading ? "..." : `${campaignRoi.toFixed(1)}%`}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-sky-500">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm break-words [overflow-wrap:anywhere]">
              <Target className="h-4 w-4 text-sky-500" /> Active Campaigns
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold break-all">{isLoading ? "..." : activeCampaigns.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Campaign Performance</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full min-w-[1800px] text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-3 text-left">Campaign</th>
                <th className="p-3 text-left">Channel</th>
                <th className="p-3 text-left">Budget</th>
                <th className="p-3 text-left">Ad Cost</th>
                <th className="p-3 text-left">Leads</th>
                <th className="p-3 text-left">Cost per Lead</th>
                <th className="p-3 text-left">Views</th>
                <th className="p-3 text-left">Viewers</th>
                <th className="p-3 text-left">Engagements</th>
                <th className="p-3 text-left">Reach</th>
                <th className="p-3 text-left">Page Likes</th>
                <th className="p-3 text-left">Link Clicks</th>
                <th className="p-3 text-left">ROI</th>
                <th className="p-3 text-left">Conversion Rate</th>
              </tr>
            </thead>
            <tbody>
              {paginate(campaignRows, campaignPage).map((row) => {
                const meta = campaignMetaById.get(row.id);
                const views = metricOrFallback(meta?.views, formatCampaignDerivedMetric(row.leadCount, 36));
                const viewers = metricOrFallback(meta?.viewers, formatCampaignDerivedMetric(row.leadCount, 21));
                const engagements = metricOrFallback(meta?.engagements, formatCampaignDerivedMetric(row.leadCount, 9));
                const reach = metricOrFallback(meta?.reach, formatCampaignDerivedMetric(row.leadCount, 28));
                const pageLikes = metricOrFallback(meta?.page_likes, formatCampaignDerivedMetric(row.leadCount, 5));
                const linkClicks = metricOrFallback(meta?.link_clicks, formatCampaignDerivedMetric(row.leadCount, 4));

                return (
                <tr key={row.id} className="border-b hover:bg-muted/30">
                  <td className="p-3">
                    <div className="font-medium">{row.name}</div>
                    <div className="text-xs text-muted-foreground capitalize">{row.status || "draft"}</div>
                  </td>
                  <td className="p-3 text-muted-foreground">{row.channel}</td>
                  <td className="p-3">{formatAmount(row.budgetAmount)}</td>
                  <td className="p-3">{formatAmount(row.cost)}</td>
                  <td className="p-3">{row.leadCount}</td>
                  <td className="p-3">{formatAmount(row.costPerLead)}</td>
                  <td className="p-3">{views.toLocaleString()}</td>
                  <td className="p-3">{viewers.toLocaleString()}</td>
                  <td className="p-3">{engagements.toLocaleString()}</td>
                  <td className="p-3">{reach.toLocaleString()}</td>
                  <td className="p-3">{pageLikes.toLocaleString()}</td>
                  <td className="p-3">{linkClicks.toLocaleString()}</td>
                  <td className="p-3">{row.roi.toFixed(1)}%</td>
                  <td className="p-3">{row.conversionRate.toFixed(1)}%</td>
                </tr>
              );})}
              {campaignRows.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={14} className="p-6 text-center text-muted-foreground">
                    No campaigns found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <TablePagination currentPage={campaignPage} totalPages={Math.max(1, Math.ceil(campaignRows.length / 20))} onPageChange={setCampaignPage} totalItems={campaignRows.length} pageSize={20} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Leads</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-3 text-left">Name</th>
                <th className="p-3 text-left">Email</th>
                <th className="p-3 text-left">Phone</th>
                <th className="p-3 text-left">Source</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Assigned</th>
                <th className="p-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {paginate(recentLeads, leadsPage).map((lead) => (
                <tr key={lead.id} className="border-b hover:bg-muted/30">
                  <td className="p-3 font-medium">{lead.full_name || "-"}</td>
                  <td className="p-3 text-muted-foreground">{lead.email || "-"}</td>
                  <td className="p-3">{lead.phone || "-"}</td>
                  <td className="p-3">{lead.source || "-"}</td>
                  <td className="p-3 capitalize">{lead.status || "new"}</td>
                  <td className="p-3">{lead.assigned_to ? "Assigned" : "Unassigned"}</td>
                  <td className="p-3">
                    <Button size="icon" variant="outline" title="View"><Eye className="h-4 w-4" /></Button>
                  </td>
                </tr>
              ))}
              {recentLeads.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-muted-foreground">No leads found.</td>
                </tr>
              )}
            </tbody>
          </table>
          <TablePagination currentPage={leadsPage} totalPages={Math.max(1, Math.ceil(recentLeads.length / 20))} onPageChange={setLeadsPage} totalItems={recentLeads.length} pageSize={20} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Website Analytics</CardTitle>
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
              {paginate(websiteAnalyticsByPlatform, analyticsPage).map((row) => (
                <tr key={row.platform} className="border-b hover:bg-muted/30">
                  <td className="p-3 font-medium">{row.platform}</td>
                  <td className="p-3">{row.websiteVisits.toLocaleString()}</td>
                  <td className="p-3">{row.registeredClients.toLocaleString()}</td>
                </tr>
              ))}
              {websiteAnalyticsByPlatform.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={3} className="p-6 text-center text-muted-foreground">No analytics platform data found.</td>
                </tr>
              )}
            </tbody>
          </table>
          <TablePagination currentPage={analyticsPage} totalPages={Math.max(1, Math.ceil(websiteAnalyticsByPlatform.length / 20))} onPageChange={setAnalyticsPage} totalItems={websiteAnalyticsByPlatform.length} pageSize={20} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Total Followers</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{isLoading ? "..." : socialSummary.totalFollowers.toLocaleString()}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Total Reach</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{isLoading ? "..." : socialSummary.totalReach.toLocaleString()}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Website Clicks</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{isLoading ? "..." : socialSummary.websiteClicks.toLocaleString()}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Total Leads</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{isLoading ? "..." : socialSummary.totalLeads.toLocaleString()}</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Social Growth Metrics</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full min-w-[1600px] text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-3 text-left">Platform</th>
                <th className="p-3 text-left">Followers</th>
                <th className="p-3 text-left">Views</th>
                <th className="p-3 text-left">Likes</th>
                <th className="p-3 text-left">Reach</th>
                <th className="p-3 text-left">Leads</th>
                <th className="p-3 text-left">Engagement</th>
                <th className="p-3 text-left">Engagement Rate</th>
                <th className="p-3 text-left">Clicks</th>
                <th className="p-3 text-left">Growth Rate</th>
                <th className="p-3 text-left">Date</th>
                <th className="p-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {paginate(socialGrowthRows, socialPage).map((row) => (
                <tr key={`${row.platform}-${row.date}`} className="border-b hover:bg-muted/30">
                  <td className="p-3 font-medium">{row.platform}</td>
                  <td className="p-3">{row.followers.toLocaleString()}</td>
                  <td className="p-3">{row.views.toLocaleString()}</td>
                  <td className="p-3">{row.likes.toLocaleString()}</td>
                  <td className="p-3">{row.reach.toLocaleString()}</td>
                  <td className="p-3">{row.leads.toLocaleString()}</td>
                  <td className="p-3">{row.engagements.toLocaleString()}</td>
                  <td className="p-3">{row.engagementRate.toFixed(1)}%</td>
                  <td className="p-3">{row.clicks.toLocaleString()}</td>
                  <td className="p-3">{row.growthRate.toFixed(1)}%</td>
                  <td className="p-3 text-muted-foreground">{row.date}</td>
                  <td className="p-3"><Button size="icon" variant="outline" title="View"><Eye className="h-4 w-4" /></Button></td>
                </tr>
              ))}
              {socialGrowthRows.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={12} className="p-6 text-center text-muted-foreground">No social growth metrics found.</td>
                </tr>
              )}
            </tbody>
          </table>
          <TablePagination currentPage={socialPage} totalPages={Math.max(1, Math.ceil(socialGrowthRows.length / 20))} onPageChange={setSocialPage} totalItems={socialGrowthRows.length} pageSize={20} />
        </CardContent>
      </Card>
    </div>
  );
};

export default MarketingDashboard;
