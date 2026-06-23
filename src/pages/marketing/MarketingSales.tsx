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
import { Pencil } from "lucide-react";
import { TablePagination, paginate } from "@/components/shared/TablePagination";
import { toast } from "sonner";
import { isBlockedMarketingSource } from "@/lib/marketingMetrics";

interface LeadRow {
  id: string;
  full_name: string;
  source: string | null;
  status: string;
  assigned_to: string | null;
  follow_up_status: string;
  deal_value: number;
  sales_feedback: string | null;
}

interface ProfileRow {
  user_id: string;
  full_name: string | null;
  email: string | null;
}

const followUpOptions = ["pending", "in_progress", "closed"];

const MarketingSales = () => {
  const sb = supabase as any;
  const { formatAmount } = useDefaultCurrency();
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LeadRow | null>(null);
  const [form, setForm] = useState({ follow_up_status: "pending", sales_feedback: "", deal_value: "0" });
  const [isSaving, setIsSaving] = useState(false);
  const [salesPage, setSalesPage] = useState(1);

  const fetchData = async () => {
    setIsLoading(true);
    const [leadRes, profileRes] = await Promise.all([
      sb.from("marketing_leads").select("id, full_name, source, status, assigned_to, follow_up_status, deal_value, sales_feedback"),
      sb.from("profiles").select("user_id, full_name, email"),
    ]);

    setLeads(((leadRes.data || []) as LeadRow[]).filter((lead) => !isBlockedMarketingSource(lead.source)));
    setProfiles((profileRes.data || []) as ProfileRow[]);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const assignedLeads = leads.filter((lead) => !!lead.assigned_to);
  const pendingFollowUps = leads.filter((lead) => lead.follow_up_status === "pending");
  const closedDeals = leads.filter((lead) => lead.status === "converted");
  const revenueFromLeads = closedDeals.reduce((sum, lead) => sum + (lead.deal_value || 0), 0);

  const profileMap = useMemo(() => {
    const map = new Map<string, ProfileRow>();
    profiles.forEach((profile) => map.set(profile.user_id, profile));
    return map;
  }, [profiles]);

  const followUpRows = useMemo(
    () => assignedLeads.map((lead) => ({
      id: lead.id,
      name: lead.full_name,
      source: lead.source || "-",
      status: lead.status,
      followUp: lead.follow_up_status,
      assignee: lead.assigned_to ? profileMap.get(lead.assigned_to)?.full_name || "Sales" : "Unassigned",
    })),
    [assignedLeads, profileMap]
  );

  const openEdit = (lead: LeadRow) => {
    setEditing(lead);
    setForm({
      follow_up_status: lead.follow_up_status || "pending",
      sales_feedback: lead.sales_feedback || "",
      deal_value: String(lead.deal_value ?? 0),
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editing) return;
    setIsSaving(true);
    const payload = {
      follow_up_status: form.follow_up_status,
      sales_feedback: form.sales_feedback.trim() ? form.sales_feedback.trim() : null,
      deal_value: Number(form.deal_value) || 0,
    };

    const { error } = await sb.from("marketing_leads").update(payload).eq("id", editing.id);

    if (error) {
      toast.error(error.message || "Failed to update lead");
    } else {
      toast.success("Lead updated");
      setDialogOpen(false);
      setEditing(null);
      fetchData();
    }
    setIsSaving(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Sales Integration"  />
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader><CardTitle className="text-sm truncate">Leads Assigned to Sales</CardTitle></CardHeader>
          <CardContent><p className="text-xl sm:text-2xl lg:text-3xl font-bold truncate">{isLoading ? "..." : assignedLeads.length}</p></CardContent>
        </Card>
        <Card className="border-l-4 border-l-yellow-500">
          <CardHeader><CardTitle className="text-sm truncate">Follow-up Status</CardTitle></CardHeader>
          <CardContent><p className="text-xl sm:text-2xl lg:text-3xl font-bold truncate">{isLoading ? "..." : pendingFollowUps.length}</p><p className="text-xs text-muted-foreground truncate">Pending follow-ups</p></CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardHeader><CardTitle className="text-sm truncate">Closed Deals</CardTitle></CardHeader>
          <CardContent><p className="text-xl sm:text-2xl lg:text-3xl font-bold truncate">{isLoading ? "..." : closedDeals.length}</p></CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardHeader><CardTitle className="text-sm truncate">Revenue from Marketing Leads</CardTitle></CardHeader>
          <CardContent><p className="text-xl sm:text-2xl lg:text-3xl font-bold truncate">{isLoading ? "..." : formatAmount(revenueFromLeads, "USD")}</p></CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader><CardTitle className="text-sm">Follow-up Status</CardTitle></CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3">Lead</th>
                  <th className="text-left p-3">Source</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Follow-up</th>
                  <th className="text-left p-3">Assignee</th>
                  <th className="text-left p-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {paginate(followUpRows, salesPage).map((row) => (
                  <tr key={row.id} className="border-b hover:bg-muted/30">
                    <td className="p-3 font-medium">{row.name}</td>
                    <td className="p-3 text-muted-foreground">{row.source}</td>
                    <td className="p-3 capitalize">{row.status}</td>
                    <td className="p-3">{row.followUp}</td>
                    <td className="p-3 text-muted-foreground">{row.assignee}</td>
                    <td className="p-3">
                      <Button variant="ghost" size="icon" className="h-8 w-8 p-0" onClick={() => {
                        const lead = leads.find((item) => item.id === row.id);
                        if (lead) openEdit(lead);
                      }}>
                        <Pencil className="h-4 w-4 text-blue-600" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {followUpRows.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-muted-foreground">No follow-ups yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
            <TablePagination currentPage={salesPage} totalPages={Math.max(1, Math.ceil(followUpRows.length / 20))} onPageChange={setSalesPage} totalItems={followUpRows.length} pageSize={20} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Sales Feedback</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Capture feedback from the sales team to improve campaign targeting.</p>
            <div className="mt-3 rounded-md border border-dashed p-3 text-xs text-muted-foreground">Update any lead to add sales feedback notes.</div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Follow-up</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Follow-up Status</Label>
              <Select value={form.follow_up_status} onValueChange={(value) => setForm({ ...form, follow_up_status: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {followUpOptions.map((option) => (
                    <SelectItem key={option} value={option}>{option.replace("_", " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Deal Value</Label>
              <Input type="number" min="0" value={form.deal_value} onChange={(e) => setForm({ ...form, deal_value: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Sales Feedback</Label>
              <Textarea value={form.sales_feedback} onChange={(e) => setForm({ ...form, sales_feedback: e.target.value })} />
            </div>
            <Button onClick={handleSave} disabled={isSaving}>{isSaving ? "Saving..." : "Update Lead"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MarketingSales;
