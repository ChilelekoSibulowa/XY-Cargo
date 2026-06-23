import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useDefaultCurrency } from "@/hooks/useDefaultCurrency";
import {
  buildCampaignPerformanceRows,
  isBlockedMarketingSource,
  type MarketingCampaignMetricSource,
  type MarketingLeadMetricSource,
} from "@/lib/marketingMetrics";
import { Plus } from "lucide-react";
import { toast } from "sonner";

type CampaignRow = MarketingCampaignMetricSource;
type LeadRow = MarketingLeadMetricSource;

const channels = ["Google Ads", "Facebook / Instagram", "TikTok", "Email", "SMS", "Other"];

const manualCostDefaults = {
  name: "",
  channel: "Facebook / Instagram",
  platform: "",
  cost: "",
  budget: "",
  revenue_attributed: "",
  notes: "",
};

const MarketingBudget = () => {
  const { formatAmount } = useDefaultCurrency();
  const sb = supabase as any;
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [budgetPage, setBudgetPage] = useState(1);
  const [costDialogOpen, setCostDialogOpen] = useState(false);
  const [costForm, setCostForm] = useState(manualCostDefaults);
  const [isSavingCost, setIsSavingCost] = useState(false);
  const BUDGET_PAGE_SIZE = 10;

  const fetchData = async () => {
    setIsLoading(true);
    const [campaignRes, leadRes] = await Promise.all([
      sb.from("marketing_campaigns").select("id, name, channel, platform, data_source, status, budget, spend, leads, revenue_attributed").order("updated_at", { ascending: false }),
        sb.from("marketing_leads").select("status, source"),
      ]);

      setCampaigns((campaignRes.data || []) as CampaignRow[]);
      setLeads(((leadRes.data || []) as LeadRow[]).filter((lead) => !isBlockedMarketingSource(lead.source)));
      setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
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

  const handleSaveManualCost = async () => {
    const name = costForm.name.trim();
    const cost = Number(costForm.cost);
    if (!name) {
      toast.error("Enter a campaign name.");
      return;
    }
    if (!Number.isFinite(cost) || cost < 0) {
      toast.error("Enter a valid campaign cost.");
      return;
    }

    setIsSavingCost(true);
    const payload = {
      name,
      channel: costForm.channel,
      platform: costForm.platform.trim() || costForm.channel,
      status: "active",
      budget: Number(costForm.budget) || cost,
      spend: cost,
      leads: 0,
      revenue_attributed: Number(costForm.revenue_attributed) || 0,
      data_source: "manual_cost",
      manual_cost_notes: costForm.notes.trim() || null,
    };

    const { error } = await sb.from("marketing_campaigns").insert(payload);
    if (error) {
      toast.error(error.message || "Failed to save campaign cost.");
    } else {
      toast.success("Campaign cost saved.");
      setCostDialogOpen(false);
      setCostForm(manualCostDefaults);
      await fetchData();
    }
    setIsSavingCost(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Budget & ROI"
        actions={
          <Button size="sm" onClick={() => setCostDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Campaign Cost
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                <th className="p-3 text-left">Data Source</th>
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
                  <td className="p-3 text-muted-foreground">
                    {row.data_source === "manual_cost" ? "Manual cost entry" : row.data_source === "meta" ? "Meta sync" : "Campaign record"}
                  </td>
                  <td className="p-3">{formatAmount(row.cost)}</td>
                  <td className="p-3">{row.leadCount}</td>
                  <td className="p-3">{formatAmount(row.costPerLead)}</td>
                  <td className="p-3">{row.roi.toFixed(1)}%</td>
                  <td className="p-3">{formatAmount(row.revenue)}</td>
                </tr>
              ))}
              {campaignRows.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-muted-foreground">
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

      <Dialog open={costDialogOpen} onOpenChange={setCostDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Campaign Cost</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="manual-cost-campaign">Campaign *</Label>
              <Input
                id="manual-cost-campaign"
                value={costForm.name}
                onChange={(event) => setCostForm({ ...costForm, name: event.target.value })}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Channel *</Label>
                <Select value={costForm.channel} onValueChange={(value) => setCostForm({ ...costForm, channel: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {channels.map((channel) => (
                      <SelectItem key={channel} value={channel}>{channel}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="manual-cost-platform">Platform</Label>
                <Input
                  id="manual-cost-platform"
                  placeholder="Facebook, Instagram, Google, etc."
                  value={costForm.platform}
                  onChange={(event) => setCostForm({ ...costForm, platform: event.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="manual-cost-amount">Cost *</Label>
                <Input
                  id="manual-cost-amount"
                  type="number"
                  min="0"
                  value={costForm.cost}
                  onChange={(event) => setCostForm({ ...costForm, cost: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manual-cost-budget">Budget</Label>
                <Input
                  id="manual-cost-budget"
                  type="number"
                  min="0"
                  value={costForm.budget}
                  onChange={(event) => setCostForm({ ...costForm, budget: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manual-cost-revenue">Revenue</Label>
                <Input
                  id="manual-cost-revenue"
                  type="number"
                  min="0"
                  value={costForm.revenue_attributed}
                  onChange={(event) => setCostForm({ ...costForm, revenue_attributed: event.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-cost-notes">Notes</Label>
              <Textarea
                id="manual-cost-notes"
                value={costForm.notes}
                onChange={(event) => setCostForm({ ...costForm, notes: event.target.value })}
              />
            </div>
            <Button onClick={handleSaveManualCost} disabled={isSavingCost}>
              {isSavingCost ? "Saving..." : "Save Cost Entry"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MarketingBudget;
