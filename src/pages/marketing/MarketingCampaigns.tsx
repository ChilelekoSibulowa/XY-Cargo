import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DeleteDialog } from "@/components/shared/DeleteDialog";
import { useDefaultCurrency } from "@/hooks/useDefaultCurrency";
import { Plus, Target, Mail, MessageSquare, Globe, Smartphone, Pencil, Trash2, RefreshCw } from "lucide-react";
import { TablePagination, paginate } from "@/components/shared/TablePagination";
import { toast } from "sonner";

type CampaignRow = {
  id: string;
  name: string;
  channel: string;
  status: string;
  budget: number;
  spend: number;
  leads: number;
  revenue_attributed: number;
  views: number | null;
  viewers: number | null;
  engagements: number | null;
  reach: number | null;
  page_likes: number | null;
  link_clicks: number | null;
  data_source?: string | null;
  platform?: string | null;
  meta_campaign_id?: string | null;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
};

const channelIcons: Record<string, React.ElementType> = {
  "Google Ads": Target,
  "Facebook / Instagram": Globe,
  TikTok: Smartphone,
  Email: Mail,
  SMS: MessageSquare,
  Other: Target,
};

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  paused: "bg-yellow-100 text-yellow-800",
  completed: "bg-gray-100 text-gray-800",
};

const emptyForm = {
  name: "",
  channel: "Google Ads",
  status: "active",
  budget: "0",
  spend: "0",
  leads: "0",
  revenue_attributed: "0",
  views: "0",
  viewers: "0",
  engagements: "0",
  reach: "0",
  page_likes: "0",
  link_clicks: "0",
  start_date: "",
  end_date: "",
  notes: "",
};

const MarketingCampaigns = () => {
  const { formatAmount } = useDefaultCurrency();
  const sb = supabase as any;
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CampaignRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [deleteItem, setDeleteItem] = useState<CampaignRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [campaignPage, setCampaignPage] = useState(1);

  const fetchCampaigns = async () => {
    setIsLoading(true);
    const { data, error } = await sb
      .from("marketing_campaigns")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(error.message || "Failed to load campaigns");
    } else {
      setCampaigns((data || []) as CampaignRow[]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (campaign: CampaignRow) => {
    setEditing(campaign);
    setForm({
      name: campaign.name,
      channel: campaign.channel,
      status: campaign.status,
      budget: String(campaign.budget ?? 0),
      spend: String(campaign.spend ?? 0),
      leads: String(campaign.leads ?? 0),
      revenue_attributed: String(campaign.revenue_attributed ?? 0),
      views: String(campaign.views ?? 0),
      viewers: String(campaign.viewers ?? 0),
      engagements: String(campaign.engagements ?? 0),
      reach: String(campaign.reach ?? 0),
      page_likes: String(campaign.page_likes ?? 0),
      link_clicks: String(campaign.link_clicks ?? 0),
      start_date: campaign.start_date || "",
      end_date: campaign.end_date || "",
      notes: campaign.notes || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Please enter a campaign name");
      return;
    }

    setIsSaving(true);
    const payload = {
      name: form.name.trim(),
      channel: form.channel,
      status: form.status,
      budget: Number(form.budget) || 0,
      spend: Number(form.spend) || 0,
      leads: Number(form.leads) || 0,
      revenue_attributed: Number(form.revenue_attributed) || 0,
      views: Number(form.views) || 0,
      viewers: Number(form.viewers) || 0,
      engagements: Number(form.engagements) || 0,
      reach: Number(form.reach) || 0,
      page_likes: Number(form.page_likes) || 0,
      link_clicks: Number(form.link_clicks) || 0,
      start_date: form.start_date ? form.start_date : null,
      end_date: form.end_date ? form.end_date : null,
      notes: form.notes.trim() ? form.notes.trim() : null,
    };

    const { error } = editing
      ? await sb.from("marketing_campaigns").update(payload).eq("id", editing.id)
      : await sb.from("marketing_campaigns").insert(payload);

    if (error) {
      toast.error(error.message || "Failed to save campaign");
    } else {
      toast.success(editing ? "Campaign updated" : "Campaign created");
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
      fetchCampaigns();
    }
    setIsSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    setIsDeleting(true);
    const { error } = await sb.from("marketing_campaigns").delete().eq("id", deleteItem.id);
    if (error) {
      toast.error(error.message || "Failed to delete campaign");
    } else {
      toast.success("Campaign deleted");
      fetchCampaigns();
    }
    setIsDeleting(false);
    setDeleteItem(null);
  };

  const handleSyncFromMeta = async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-social-metrics");
      if (error) {
        toast.error(error.message || "Failed to sync Meta campaigns.");
      } else if (data?.success === false) {
        toast.error(data?.error || "Failed to sync Meta campaigns.");
      } else {
        const results = Array.isArray(data?.results) ? data.results : [];
        toast.success(results.length ? results.join("; ") : "Meta sync completed.");
        await fetchCampaigns();
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to sync Meta campaigns.");
    } finally {
      setIsSyncing(false);
    }
  };

  const activeCampaigns = campaigns.filter((campaign) => campaign.status === "active");
  const totalLeads = campaigns.reduce((sum, campaign) => sum + (campaign.leads || 0), 0);
  const totalBudget = campaigns.reduce((sum, campaign) => sum + (campaign.budget || 0), 0);
  const totalSpend = campaigns.reduce((sum, campaign) => sum + (campaign.spend || 0), 0);

  const channelCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    campaigns.forEach((campaign) => {
      counts[campaign.channel] = (counts[campaign.channel] || 0) + 1;
    });
    return counts;
  }, [campaigns]);

  const channels = ["Google Ads", "Facebook / Instagram", "TikTok", "Email", "SMS", "Other"];

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Campaign Management"
        
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleSyncFromMeta} disabled={isSyncing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} /> Sync from Meta
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> New Campaign
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm break-words [overflow-wrap:anywhere]">Active Campaigns</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold break-all">{isLoading ? "..." : activeCampaigns.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm break-words [overflow-wrap:anywhere]">Total Leads</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold break-all">{isLoading ? "..." : totalLeads}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm break-words [overflow-wrap:anywhere]">Campaign Budget</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold break-all">{isLoading ? "..." : formatAmount(totalBudget, "USD")}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm break-words [overflow-wrap:anywhere]">Budget Tracking</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-bold break-all">{isLoading ? "..." : formatAmount(totalSpend, "USD")}</p>
            <p className="text-xs text-muted-foreground">Actual spend to date</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {channels.map((channel) => {
          const Icon = channelIcons[channel] || Target;
          return (
            <Card key={channel} className="min-w-0">
              <CardHeader className="pb-2 min-w-0">
                <CardTitle className="min-w-0 text-sm flex items-start gap-2 whitespace-normal break-words [overflow-wrap:anywhere] leading-tight">
                  <Icon className="h-4 w-4 mt-0.5 shrink-0" />
                  <span className="min-w-0 break-words [overflow-wrap:anywhere]">{channel}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="min-w-0">
                <p className="text-2xl font-bold break-all">{isLoading ? "..." : channelCounts[channel] || 0}</p>
                <p className="text-xs text-muted-foreground">Campaigns</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="space-y-3">
        {paginate(campaigns, campaignPage).map((campaign) => {
          const Icon = channelIcons[campaign.channel] || Target;
          return (
            <Card key={campaign.id}>
              <CardContent className="p-4 flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{campaign.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {campaign.channel} | Budget: {formatAmount(campaign.budget, "USD")} | {campaign.data_source === "meta" ? "Meta sync" : campaign.data_source === "manual_cost" ? "Manual cost" : "Manual campaign"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium">{campaign.leads} leads</span>
                  <Badge className={statusColors[campaign.status] || ""}>{campaign.status}</Badge>
                  <Button variant="ghost" size="icon" className="h-8 w-8 p-0" onClick={() => openEdit(campaign)}>
                    <Pencil className="h-4 w-4 text-blue-600" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 p-0" onClick={() => setDeleteItem(campaign)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {campaigns.length === 0 && !isLoading && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">No campaigns yet. Add a new campaign to get started.</CardContent>
          </Card>
        )}
        <TablePagination currentPage={campaignPage} totalPages={Math.max(1, Math.ceil(campaigns.length / 20))} onPageChange={setCampaignPage} totalItems={campaigns.length} pageSize={20} />
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Campaign" : "Create Campaign"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="name">Campaign Name *</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="channel">Channel *</Label>
              <Select value={form.channel} onValueChange={(value) => setForm({ ...form, channel: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {channels.map((channel) => (
                    <SelectItem key={channel} value={channel}>{channel}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="budget">Budget</Label>
                <Input id="budget" type="number" min="0" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="spend">Spend</Label>
                <Input id="spend" type="number" min="0" value={form.spend} onChange={(e) => setForm({ ...form, spend: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="leads">Leads</Label>
                <Input id="leads" type="number" min="0" value={form.leads} onChange={(e) => setForm({ ...form, leads: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="revenue">Revenue Attributed</Label>
                <Input id="revenue" type="number" min="0" value={form.revenue_attributed} onChange={(e) => setForm({ ...form, revenue_attributed: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="views">Views</Label>
                <Input id="views" type="number" min="0" value={form.views} onChange={(e) => setForm({ ...form, views: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="viewers">Viewers</Label>
                <Input id="viewers" type="number" min="0" value={form.viewers} onChange={(e) => setForm({ ...form, viewers: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="engagements">Engagements</Label>
                <Input id="engagements" type="number" min="0" value={form.engagements} onChange={(e) => setForm({ ...form, engagements: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reach">Reach</Label>
                <Input id="reach" type="number" min="0" value={form.reach} onChange={(e) => setForm({ ...form, reach: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="page_likes">Page Likes</Label>
                <Input id="page_likes" type="number" min="0" value={form.page_likes} onChange={(e) => setForm({ ...form, page_likes: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="link_clicks">Link Clicks</Label>
                <Input id="link_clicks" type="number" min="0" value={form.link_clicks} onChange={(e) => setForm({ ...form, link_clicks: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date</Label>
                <Input id="start_date" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">End Date</Label>
                <Input id="end_date" type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : editing ? "Update Campaign" : "Create Campaign"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <DeleteDialog
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        title="Delete Campaign"
        description="Are you sure you want to delete this campaign?"
      />
    </div>
  );
};

export default MarketingCampaigns;
