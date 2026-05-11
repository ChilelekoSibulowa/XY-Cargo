import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useDefaultCurrency } from "@/hooks/useDefaultCurrency";
import {
  buildCampaignPerformanceRows,
  type MarketingCampaignMetricSource,
  type MarketingLeadMetricSource,
} from "@/lib/marketingMetrics";

type CampaignRow = MarketingCampaignMetricSource;
type LeadRow = MarketingLeadMetricSource;

const MarketingBudget = () => {
  const { formatAmount } = useDefaultCurrency();
  const sb = supabase as any;
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [budgetPage, setBudgetPage] = useState(1);
  const BUDGET_PAGE_SIZE = 10;

  useEffect(() => {
    const fetch = async () => {
      const [campaignRes, leadRes] = await Promise.all([
        sb.from("marketing_campaigns").select("id, name, channel, status, budget, spend, leads, revenue_attributed"),
        sb.from("marketing_leads").select("status, source"),
      ]);

      setCampaigns((campaignRes.data || []) as CampaignRow[]);
      setLeads((leadRes.data || []) as LeadRow[]);
      setIsLoading(false);
    };

    fetch();
  }, [sb]);

  const campaignRows = useMemo(
    () => buildCampaignPerformanceRows(campaigns, leads),
    [campaigns, leads],
  );

  const totalSpend = useMemo(
    () => campaignRows.reduce((sum, campaign) => sum + campaign.cost, 0),
    [campaignRows],
  );
  const totalBudget = useMemo(
    () => campaignRows.reduce((sum, campaign) => sum + campaign.budgetAmount, 0),
    [campaignRows],
  );
  const revenueAttributed = useMemo(
    () => campaignRows.reduce((sum, campaign) => sum + campaign.revenue, 0),
    [campaignRows],
  );
  const leadCount = useMemo(
    () => campaignRows.reduce((sum, campaign) => sum + campaign.leadCount, 0),
    [campaignRows],
  );

  const costPerCampaign = campaigns.length > 0 ? totalSpend / campaigns.length : 0;
  const costPerLead = leadCount > 0 ? totalSpend / leadCount : 0;
  const roi = totalSpend > 0 ? ((revenueAttributed - totalSpend) / totalSpend) * 100 : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Budget & ROI"  />

      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <Card className="border-l-4 border-l-green-500">
          <CardHeader>
            <CardTitle className="text-sm truncate">Marketing Spend Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold truncate">{isLoading ? "..." : formatAmount(totalSpend)}</p>
            <p className="text-xs text-muted-foreground truncate">Budget: {formatAmount(totalBudget)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader>
            <CardTitle className="text-sm truncate">Cost per Campaign</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold truncate">{isLoading ? "..." : formatAmount(costPerCampaign)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardHeader>
            <CardTitle className="text-sm truncate">Cost per Lead</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold truncate">{isLoading ? "..." : formatAmount(costPerLead)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-500">
          <CardHeader>
            <CardTitle className="text-sm truncate">Revenue Attributed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold truncate">{isLoading ? "..." : formatAmount(revenueAttributed)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader>
            <CardTitle className="text-sm truncate">ROI</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold truncate">{isLoading ? "..." : `${roi.toFixed(1)}%`}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Campaign Budget Performance</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-3 text-left">Campaign</th>
                <th className="p-3 text-left">Channel</th>
                <th className="p-3 text-left">Cost</th>
                <th className="p-3 text-left">Leads</th>
                <th className="p-3 text-left">Cost per Lead</th>
                <th className="p-3 text-left">ROI</th>
                <th className="p-3 text-left">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {campaignRows.slice((budgetPage - 1) * BUDGET_PAGE_SIZE, budgetPage * BUDGET_PAGE_SIZE).map((row) => (
                <tr key={row.id} className="border-b hover:bg-muted/30">
                  <td className="p-3">
                    <div className="font-medium">{row.name}</div>
                    <div className="text-xs text-muted-foreground capitalize">{row.status || "draft"}</div>
                  </td>
                  <td className="p-3 text-muted-foreground">{row.channel}</td>
                  <td className="p-3">{formatAmount(row.cost)}</td>
                  <td className="p-3">{row.leadCount}</td>
                  <td className="p-3">{formatAmount(row.costPerLead)}</td>
                  <td className="p-3">{row.roi.toFixed(1)}%</td>
                  <td className="p-3">{formatAmount(row.revenue)}</td>
                </tr>
              ))}
              {campaignRows.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-muted-foreground">
                    No campaign budget data found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {campaignRows.length > BUDGET_PAGE_SIZE && (
            <div className="flex items-center justify-between gap-3 border-t p-3 bg-muted/20">
              <p className="text-xs text-muted-foreground">
                Showing {(budgetPage - 1) * BUDGET_PAGE_SIZE + 1}-{Math.min(budgetPage * BUDGET_PAGE_SIZE, campaignRows.length)} of {campaignRows.length} entries
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setBudgetPage(Math.max(1, budgetPage - 1))}
                  disabled={budgetPage === 1}
                >
                  Previous
                </Button>
                <span className="text-xs font-medium">{budgetPage}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setBudgetPage(budgetPage + 1)}
                  disabled={budgetPage * BUDGET_PAGE_SIZE >= campaignRows.length}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MarketingBudget;

