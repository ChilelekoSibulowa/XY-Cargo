import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DeleteDialog } from "@/components/shared/DeleteDialog";
import { Mail, Users, TrendingUp, Bell, Plus, Pencil, Trash2, Send } from "lucide-react";
import { TablePagination, paginate } from "@/components/shared/TablePagination";
import { toast } from "sonner";

const getEdgeFunctionErrorMessage = (message: string | undefined, fallback: string) => {
  const normalized = (message || "").toLowerCase();
  if (normalized.includes("failed to send a request to the edge function")) {
    return "Email sending is not available yet. Deploy the send-email edge function and set the Resend secrets first.";
  }
  return message || fallback;
};

interface EmailSequence {
  id: string;
  name: string;
  description: string | null;
  status: string;
  step_count: number;
}

interface SubscriberRow {
  id: string;
  full_name: string | null;
  email: string;
  status: string;
  subscription_source: string | null;
}

interface LeadRow {
  id: string;
  status: string;
  created_at: string;
}

const subscriberDefaults = {
  full_name: "",
  email: "",
  status: "subscribed",
};

const bulkEmailDefaults = {
  subject: "",
  body: "",
  recipientMode: "all_subscribed" as "all_subscribed" | "selected",
};

const MarketingEmail = () => {
  const sb = supabase as any;
  const [sequences, setSequences] = useState<EmailSequence[]>([]);
  const [subscribers, setSubscribers] = useState<SubscriberRow[]>([]);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [subscriberDialog, setSubscriberDialog] = useState(false);
  const [subscriberForm, setSubscriberForm] = useState(subscriberDefaults);
  const [editingSubscriber, setEditingSubscriber] = useState<SubscriberRow | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkEmailDialog, setBulkEmailDialog] = useState(false);
  const [bulkEmailForm, setBulkEmailForm] = useState(bulkEmailDefaults);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const [deleteItem, setDeleteItem] = useState<{ id: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [subscriberPage, setSubscriberPage] = useState(1);

  const fetchAll = async () => {
    setIsLoading(true);
    const [sequenceRes, subscriberRes, leadRes, customerRes] = await Promise.all([
      sb.from("marketing_email_sequences").select("*").order("created_at", { ascending: false }),
      sb.from("marketing_email_subscribers").select("id, email, is_active, subscription_source, metadata").order("created_at", { ascending: false }),
      sb.from("marketing_leads").select("id, status, created_at"),
      sb.from("customers").select("id, full_name, email").order("full_name"),
    ]);

    setSequences((sequenceRes.data || []) as EmailSequence[]);
    const rawSubs = (subscriberRes.data || []) as any[];
    const manualSubscribers = rawSubs.map((s: any) => ({
      id: s.id,
      full_name: s.metadata?.full_name || null,
      email: s.email,
      status: s.is_active ? "subscribed" : "unsubscribed",
      subscription_source: s.subscription_source || null,
    }));

    const existingEmails = new Set(manualSubscribers.map((s: SubscriberRow) => s.email.toLowerCase()));
    const customerSubscribers: SubscriberRow[] = ((customerRes.data || []) as any[])
      .filter((c: any) => c.email && !existingEmails.has(c.email.toLowerCase()))
      .map((c: any) => ({
        id: `customer-${c.id}`,
        full_name: c.full_name || null,
        email: c.email,
        status: "subscribed" as const,
        subscription_source: "customer",
      }));

    setSubscribers([...manualSubscribers, ...customerSubscribers]);
    setLeads((leadRes.data || []) as LeadRow[]);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const abandonedCount = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    return leads.filter((lead) => lead.status === "new" && new Date(lead.created_at) < cutoff).length;
  }, [leads]);

  const subscribedCount = useMemo(
    () => subscribers.filter((s) => s.status === "subscribed").length,
    [subscribers],
  );

  const handleSaveSubscriber = async () => {
    if (!subscriberForm.email.trim()) {
      toast.error("Please enter subscriber email");
      return;
    }

    const payload = editingSubscriber
      ? { is_active: subscriberForm.status === "subscribed" }
      : {
          email: subscriberForm.email.trim().toLowerCase(),
          is_active: subscriberForm.status === "subscribed",
          subscription_source: "manual",
          marketing_consent: true,
          metadata: subscriberForm.full_name.trim() ? { full_name: subscriberForm.full_name.trim() } : {},
        };

    const { error } = editingSubscriber
      ? await sb.from("marketing_email_subscribers").update(payload).eq("id", editingSubscriber.id)
      : await sb.from("marketing_email_subscribers").insert(payload);

    if (error) {
      toast.error(error.message || "Failed to save subscriber");
    } else {
      toast.success(editingSubscriber ? "Subscriber updated" : "Subscriber added");
      setSubscriberDialog(false);
      setEditingSubscriber(null);
      setSubscriberForm(subscriberDefaults);
      fetchAll();
    }
  };

  const handleSendBulkEmail = async () => {
    if (!bulkEmailForm.subject.trim() || !bulkEmailForm.body.trim()) {
      toast.error("Subject and message body are required.");
      return;
    }

    const pool =
      bulkEmailForm.recipientMode === "all_subscribed"
        ? subscribers.filter((s) => s.status === "subscribed")
        : subscribers.filter((s) => selectedIds.has(s.id));

    if (pool.length === 0) {
      toast.error(
        bulkEmailForm.recipientMode === "all_subscribed"
          ? "No subscribed recipients found."
          : "Select at least one subscriber first.",
      );
      return;
    }

    const recipients = pool.map((s) => ({ email: s.email, name: s.full_name }));

    setIsSendingEmail(true);
    const { data, error } = await supabase.functions.invoke("send-email", {
      body: {
        mode: "send_marketing",
        subject: bulkEmailForm.subject.trim(),
        body: bulkEmailForm.body.trim(),
        recipients,
      },
    });

    if (error) {
      toast.error(getEdgeFunctionErrorMessage(error.message, "Failed to send email."));
      setIsSendingEmail(false);
      return;
    }

    toast.success(`Email sent to ${data?.sent ?? recipients.length} recipient(s).`);
    setIsSendingEmail(false);
    setBulkEmailDialog(false);
    setBulkEmailForm(bulkEmailDefaults);
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    setIsDeleting(true);
    const { error } = await sb.from("marketing_email_subscribers").delete().eq("id", deleteItem.id);
    if (error) {
      toast.error(error.message || "Failed to delete subscriber");
    } else {
      toast.success("Subscriber deleted");
      setSelectedIds((prev) => { const next = new Set(prev); next.delete(deleteItem.id); return next; });
      fetchAll();
    }
    setIsDeleting(false);
    setDeleteItem(null);
  };

  const allSubscribedSelected =
    subscribers.filter((s) => s.status === "subscribed").length > 0 &&
    subscribers.filter((s) => s.status === "subscribed").every((s) => selectedIds.has(s.id));

  const toggleSelectAll = () => {
    if (allSubscribedSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(subscribers.filter((s) => s.status === "subscribed").map((s) => s.id)));
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Email & Automation"  />

      {/* Stat widgets */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Sequences</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{isLoading ? "..." : sequences.length}</p><p className="text-xs text-muted-foreground">Automated flows</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Bell className="h-4 w-4" /> Abandoned Follow-up</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{isLoading ? "..." : abandonedCount}</p><p className="text-xs text-muted-foreground">Leads waiting follow-up</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" /> Subscribers</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{isLoading ? "..." : subscribers.length}</p><p className="text-xs text-muted-foreground">Total on list</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Mail className="h-4 w-4" /> Performance</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{isLoading ? "..." : subscribedCount}</p><p className="text-xs text-muted-foreground">Active / subscribed</p></CardContent>
        </Card>
      </div>

      {/* Subscribers section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-sm">Newsletter Subscribers</CardTitle>
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <Button
                size="sm"
                onClick={() => {
                  setBulkEmailForm({ ...bulkEmailDefaults, recipientMode: "selected" });
                  setBulkEmailDialog(true);
                }}
              >
                <Send className="mr-2 h-4 w-4" /> Email Selected ({selectedIds.size})
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setBulkEmailForm(bulkEmailDefaults);
                setBulkEmailDialog(true);
              }}
            >
              <Send className="mr-2 h-4 w-4" /> Send Bulk Email
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setEditingSubscriber(null); setSubscriberForm(subscriberDefaults); setSubscriberDialog(true); }}
            >
              <Plus className="mr-2 h-4 w-4" /> Add Subscriber
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-3 w-10">
                  <Checkbox
                    checked={allSubscribedSelected}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all subscribed"
                  />
                </th>
                <th className="text-left p-3">Name</th>
                <th className="text-left p-3">Email</th>
                <th className="text-left p-3">Source</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginate(subscribers, subscriberPage).map((subscriber) => {
                const isCustomerAuto = subscriber.id.startsWith("customer-");
                return (
                <tr key={subscriber.id} className="border-b hover:bg-muted/30">
                  <td className="p-3">
                    {subscriber.status === "subscribed" && (
                      <Checkbox
                        checked={selectedIds.has(subscriber.id)}
                        onCheckedChange={(checked) => {
                          setSelectedIds((prev) => {
                            const next = new Set(prev);
                            checked ? next.add(subscriber.id) : next.delete(subscriber.id);
                            return next;
                          });
                        }}
                        aria-label={`Select ${subscriber.email}`}
                      />
                    )}
                  </td>
                  <td className="p-3 font-medium">{subscriber.full_name || "-"}</td>
                  <td className="p-3 text-muted-foreground">{subscriber.email}</td>
                  <td className="p-3 capitalize text-xs text-muted-foreground">{subscriber.subscription_source || "-"}</td>
                  <td className="p-3 capitalize">{subscriber.status}</td>
                  <td className="p-3">
                    {!isCustomerAuto && (
                    <div className="flex items-center gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditingSubscriber(subscriber);
                          setSubscriberForm({ full_name: subscriber.full_name || "", email: subscriber.email, status: subscriber.status });
                          setSubscriberDialog(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => setDeleteItem({ id: subscriber.id })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    )}
                  </td>
                </tr>
                );
              })}
              {subscribers.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground">No subscribers yet. Add your first subscriber above.</td>
                </tr>
              )}
            </tbody>
          </table>
          <TablePagination currentPage={subscriberPage} totalPages={Math.max(1, Math.ceil(subscribers.length / 20))} onPageChange={setSubscriberPage} totalItems={subscribers.length} pageSize={20} />
        </CardContent>
      </Card>

      {/* Add / Edit Subscriber dialog */}
      <Dialog open={subscriberDialog} onOpenChange={setSubscriberDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSubscriber ? "Edit Subscriber" : "Add Subscriber"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={subscriberForm.full_name} onChange={(e) => setSubscriberForm({ ...subscriberForm, full_name: e.target.value })} placeholder="Optional" />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input type="email" value={subscriberForm.email} onChange={(e) => setSubscriberForm({ ...subscriberForm, email: e.target.value })} placeholder="subscriber@example.com" />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={subscriberForm.status} onValueChange={(value) => setSubscriberForm({ ...subscriberForm, status: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="subscribed">Subscribed</SelectItem>
                  <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSaveSubscriber}>{editingSubscriber ? "Update Subscriber" : "Add Subscriber"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Email dialog */}
      <Dialog open={bulkEmailDialog} onOpenChange={setBulkEmailDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Send Email to Subscribers</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Recipients</Label>
              <Select
                value={bulkEmailForm.recipientMode}
                onValueChange={(value) => setBulkEmailForm({ ...bulkEmailForm, recipientMode: value as typeof bulkEmailForm.recipientMode })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_subscribed">All subscribed ({subscribedCount})</SelectItem>
                  <SelectItem value="selected">Selected ({selectedIds.size})</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {bulkEmailForm.recipientMode === "all_subscribed"
                  ? `This will send to all ${subscribedCount} subscribed recipient(s) via Resend.`
                  : selectedIds.size === 0
                    ? "No subscribers selected. Use the checkboxes in the table to select recipients."
                    : `This will send to ${selectedIds.size} selected subscriber(s) via Resend.`}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Subject *</Label>
              <Input
                value={bulkEmailForm.subject}
                onChange={(e) => setBulkEmailForm({ ...bulkEmailForm, subject: e.target.value })}
                placeholder="e.g. Special offer for our subscribers"
              />
            </div>
            <div className="space-y-2">
              <Label>Message *</Label>
              <Textarea
                value={bulkEmailForm.body}
                onChange={(e) => setBulkEmailForm({ ...bulkEmailForm, body: e.target.value })}
                rows={8}
                placeholder="Write your email message here. Plain text and HTML are both supported."
              />
            </div>
            <Button onClick={handleSendBulkEmail} disabled={isSendingEmail}>
              {isSendingEmail ? "Sending..." : "Send Email"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <DeleteDialog
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        title="Delete Subscriber"
        description="Are you sure you want to remove this subscriber from the list?"
      />
    </div>
  );
};

export default MarketingEmail;

