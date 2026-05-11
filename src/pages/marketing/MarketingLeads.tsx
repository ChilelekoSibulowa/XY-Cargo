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
import { Plus, Users, UserCheck, UserX, TrendingUp, UserPlus, Pencil, Trash2 } from "lucide-react";
import { TablePagination, paginate } from "@/components/shared/TablePagination";
import { toast } from "sonner";

interface LeadRow {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  status: string;
  assigned_to: string | null;
  follow_up_status: string;
  deal_value: number;
  sales_feedback: string | null;
  created_at: string;
}

interface ProfileOption {
  user_id: string;
  full_name: string | null;
  email: string | null;
}

const statusColors: Record<string, string> = {
  new: "bg-blue-100 text-blue-800",
  qualified: "bg-yellow-100 text-yellow-800",
  converted: "bg-green-100 text-green-800",
  lost: "bg-red-100 text-red-800",
};

const followUpOptions = ["pending", "in_progress", "closed"];

const emptyForm = {
  full_name: "",
  email: "",
  phone: "",
  source: "",
  status: "new",
  assigned_to: "unassigned",
  follow_up_status: "pending",
  deal_value: "0",
  sales_feedback: "",
};

const MarketingLeads = () => {
  const sb = supabase as any;
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LeadRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteItem, setDeleteItem] = useState<LeadRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [salesTeam, setSalesTeam] = useState<ProfileOption[]>([]);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [leadsPage, setLeadsPage] = useState(1);

  const fetchLeads = async () => {
    setIsLoading(true);
    const { data, error } = await sb
      .from("marketing_leads")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(error.message || "Failed to load leads");
    } else {
      setLeads((data || []) as LeadRow[]);
    }
    setIsLoading(false);
  };

  const fetchProfiles = async () => {
    const { data } = await sb.from("profiles").select("user_id, full_name, email");
    const allProfiles = (data || []) as ProfileOption[];
    setProfiles(allProfiles);
    setSalesTeam(allProfiles);
  };

  useEffect(() => {
    fetchLeads();
    fetchProfiles();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (lead: LeadRow) => {
    setEditing(lead);
    setForm({
      full_name: lead.full_name,
      email: lead.email || "",
      phone: lead.phone || "",
      source: lead.source || "",
      status: lead.status,
      assigned_to: lead.assigned_to || "unassigned",
      follow_up_status: lead.follow_up_status || "pending",
      deal_value: String(lead.deal_value ?? 0),
      sales_feedback: lead.sales_feedback || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.full_name.trim()) {
      toast.error("Please enter a lead name");
      return;
    }

    setIsSaving(true);
    const payload = {
      full_name: form.full_name.trim(),
      email: form.email.trim() ? form.email.trim() : null,
      phone: form.phone.trim() ? form.phone.trim() : null,
      source: form.source.trim() ? form.source.trim() : null,
      status: form.status,
      assigned_to: form.assigned_to === "unassigned" ? null : form.assigned_to,
      follow_up_status: form.follow_up_status || "pending",
      deal_value: Number(form.deal_value) || 0,
      sales_feedback: form.sales_feedback.trim() ? form.sales_feedback.trim() : null,
    };

    const { error } = editing
      ? await sb.from("marketing_leads").update(payload).eq("id", editing.id)
      : await sb.from("marketing_leads").insert(payload);

    if (error) {
      toast.error(error.message || "Failed to save lead");
    } else {
      toast.success(editing ? "Lead updated" : "Lead created");
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
      fetchLeads();
    }
    setIsSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    setIsDeleting(true);
    const { error } = await sb.from("marketing_leads").delete().eq("id", deleteItem.id);
    if (error) {
      toast.error(error.message || "Failed to delete lead");
    } else {
      toast.success("Lead deleted");
      fetchLeads();
    }
    setIsDeleting(false);
    setDeleteItem(null);
  };

  const sourceBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    leads.forEach((lead) => {
      const key = lead.source || "Unknown";
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [leads]);

  const profileMap = useMemo(() => {
    const map = new Map<string, ProfileOption>();
    profiles.forEach((profile) => map.set(profile.user_id, profile));
    return map;
  }, [profiles]);

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Lead Management"
        
        actions={
          <Button size="sm" onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Add Lead</Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" /> All Leads</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{isLoading ? "..." : leads.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4" /> New</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{isLoading ? "..." : leads.filter((lead) => lead.status === "new").length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><UserPlus className="h-4 w-4" /> Qualified</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{isLoading ? "..." : leads.filter((lead) => lead.status === "qualified").length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><UserCheck className="h-4 w-4" /> Converted</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{isLoading ? "..." : leads.filter((lead) => lead.status === "converted").length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><UserX className="h-4 w-4" /> Lost</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{isLoading ? "..." : leads.filter((lead) => lead.status === "lost").length}</p></CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3">Name</th>
                  <th className="text-left p-3">Email</th>
                  <th className="text-left p-3">Phone</th>
                  <th className="text-left p-3">Source</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Assigned</th>
                  <th className="text-left p-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {paginate(leads, leadsPage).map((lead) => {
                  const assignedProfile = lead.assigned_to ? profileMap.get(lead.assigned_to) : null;
                  return (
                    <tr key={lead.id} className="border-b hover:bg-muted/30">
                      <td className="p-3 font-medium">{lead.full_name}</td>
                      <td className="p-3 text-muted-foreground">{lead.email || "-"}</td>
                      <td className="p-3">{lead.phone || "-"}</td>
                      <td className="p-3">{lead.source || "-"}</td>
                      <td className="p-3"><Badge className={statusColors[lead.status] || "bg-muted"}>{lead.status}</Badge></td>
                      <td className="p-3 text-muted-foreground">{assignedProfile?.full_name || "Unassigned"}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Button size="icon" variant="ghost" className="h-8 w-8 p-0" onClick={() => openEdit(lead)}>
                            <Pencil className="h-4 w-4 text-blue-600" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 p-0" onClick={() => setDeleteItem(lead)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {leads.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-muted-foreground">No leads found.</td>
                  </tr>
                )}
              </tbody>
            </table>
            <TablePagination currentPage={leadsPage} totalPages={Math.max(1, Math.ceil(leads.length / 20))} onPageChange={setLeadsPage} totalItems={leads.length} pageSize={20} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Lead Source Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {sourceBreakdown.map(([source, count]) => (
              <div key={source} className="flex items-center justify-between">
                <span>{source}</span>
                <span className="font-semibold">{count}</span>
              </div>
            ))}
            {sourceBreakdown.length === 0 && (
              <p className="text-muted-foreground">No lead sources yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Lead" : "Create Lead"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name *</Label>
              <Input id="full_name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="source">Source</Label>
                <Input id="source" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="qualified">Qualified</SelectItem>
                    <SelectItem value="converted">Converted</SelectItem>
                    <SelectItem value="lost">Lost</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="assigned_to">Assign to Sales</Label>
                <Select value={form.assigned_to} onValueChange={(value) => setForm({ ...form, assigned_to: value })}>
                  <SelectTrigger><SelectValue placeholder="Select team member" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {salesTeam.map((member) => (
                      <SelectItem key={member.user_id} value={member.user_id}>
                        {member.full_name || member.email || member.user_id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="follow_up_status">Follow-up Status</Label>
                <Select value={form.follow_up_status} onValueChange={(value) => setForm({ ...form, follow_up_status: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {followUpOptions.map((option) => (
                      <SelectItem key={option} value={option}>{option.replace("_", " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="deal_value">Deal Value</Label>
              <Input id="deal_value" type="number" min="0" value={form.deal_value} onChange={(e) => setForm({ ...form, deal_value: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sales_feedback">Sales Feedback</Label>
              <Textarea id="sales_feedback" value={form.sales_feedback} onChange={(e) => setForm({ ...form, sales_feedback: e.target.value })} />
            </div>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : editing ? "Update Lead" : "Create Lead"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <DeleteDialog
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        title="Delete Lead"
        description="Are you sure you want to delete this lead?"
      />
    </div>
  );
};

export default MarketingLeads;

