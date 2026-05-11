import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, MessageCircle, MessagesSquare, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/components/auth/AuthContext";
import { toast } from "sonner";
import {
  SUPPORT_TICKET_CATEGORIES,
  SUPPORT_TICKET_PRIORITIES,
  buildSupportTicketCode,
  formatSupportLabel,
  type SupportTicketRow,
  uploadSupportAttachment,
} from "@/lib/supportTickets";

type AgentCustomerRow = {
  id: string;
  full_name: string;
  code: string;
};

const ticketSelect =
  "id, ticket_code, customer_id, shipment_id, subject, description, category, priority, status, assigned_to, resolution_notes, created_by, escalated_to_department, escalated_at, created_at, updated_at, customer:customers(full_name, code)";

const AgentSupport = () => {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const [customers, setCustomers] = useState<AgentCustomerRow[]>([]);
  const [tickets, setTickets] = useState<SupportTicketRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    customer_id: "unlinked",
    subject: "",
    description: "",
    priority: "medium",
    category: "general",
  });

  const loadSupport = async () => {
    if (!user?.id) {
      setCustomers([]);
      setTickets([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data: customerRows, error: customerError } = await supabase
        .from("customers")
        .select("id, full_name, code")
        .eq("agent_id", user.id)
        .order("full_name");

      if (customerError) throw customerError;

      const customerIds = (customerRows || []).map((customer) => customer.id);
      const [ownedRes, customerRes] = await Promise.all([
        supabase
          .from("support_tickets")
          .select(ticketSelect)
          .eq("created_by", user.id)
          .order("updated_at", { ascending: false }),
        customerIds.length > 0
          ? supabase
              .from("support_tickets")
              .select(ticketSelect)
              .in("customer_id", customerIds)
              .order("updated_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (ownedRes.error) throw ownedRes.error;
      if (customerRes.error) throw customerRes.error;

      const merged = new Map<string, SupportTicketRow>();
      [...((ownedRes.data || []) as SupportTicketRow[]), ...((customerRes.data || []) as SupportTicketRow[])].forEach(
        (row) => merged.set(row.id, row),
      );

      setCustomers((customerRows || []) as AgentCustomerRow[]);
      setTickets(
        Array.from(merged.values()).sort(
          (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
        ),
      );
    } catch (error: any) {
      toast.error(error?.message || "Failed to load support center.");
      setCustomers([]);
      setTickets([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadSupport();
  }, [user?.id]);

  const handleSubmit = async () => {
    if (!user?.id) {
      toast.error("Agent session not found.");
      return;
    }
    if (!form.subject.trim() || !form.description.trim()) {
      toast.error("Subject and description are required.");
      return;
    }

    setIsSaving(true);
    try {
      const { data: createdTicket, error } = await supabase
        .from("support_tickets")
        .insert({
          ticket_code: buildSupportTicketCode(),
          customer_id: form.customer_id === "unlinked" ? null : form.customer_id,
          subject: form.subject.trim(),
          description: form.description.trim(),
          priority: form.priority,
          category: form.category,
          status: "open",
          created_by: user.id,
          escalated_to_department: "support",
        })
        .select("id")
        .single();

      if (error) throw error;

      let attachment: {
        attachment_url: string;
        attachment_name: string;
        attachment_type: string | null;
      } | null = null;

      if (selectedFile) {
        attachment = await uploadSupportAttachment(createdTicket.id, user.id, selectedFile);
      }

      const { error: messageError } = await supabase.from("support_ticket_messages").insert({
        ticket_id: createdTicket.id,
        sender_user_id: user.id,
        sender_role: "agent",
        sender_name: user.user_metadata?.full_name || user.email || "Agent",
        message: form.description.trim(),
        ...(attachment || {}),
      });

      if (messageError) throw messageError;

      toast.success("Support ticket created.");
      setForm({
        customer_id: "unlinked",
        subject: "",
        description: "",
        priority: "medium",
        category: "general",
      });
      setSelectedFile(null);
      setIsDialogOpen(false);
      await loadSupport();
      navigate(`/agent/support/${createdTicket.id}`);
    } catch (error: any) {
      toast.error(error?.message || "Failed to create support ticket.");
    } finally {
      setIsSaving(false);
    }
  };

  const metrics = useMemo(
    () => ({
      open: tickets.filter((ticket) => !["resolved", "closed"].includes(ticket.status)).length,
      closed: tickets.filter((ticket) => ticket.status === "closed").length,
      resolved: tickets.filter((ticket) => ticket.status === "resolved").length,
    }),
    [tickets],
  );

  const columns: Column<SupportTicketRow>[] = [
    {
      key: "ticket_code",
      label: "Ticket",
      render: (row) => <span className="font-mono text-xs">{row.ticket_code}</span>,
    },
    {
      key: "customer",
      label: "Client",
      render: (row) => {
        const customer = Array.isArray(row.customer) ? row.customer[0] : row.customer;
        return customer?.full_name || "Unlinked";
      },
    },
    { key: "subject", label: "Subject" },
    {
      key: "category",
      label: "Category",
      render: (row) => <Badge variant="outline">{formatSupportLabel(row.category)}</Badge>,
    },
    {
      key: "priority",
      label: "Priority",
      render: (row) => <Badge variant="outline">{formatSupportLabel(row.priority)}</Badge>,
    },
    {
      key: "status",
      label: "Status",
      render: (row) => <StatusBadge status={row.status} label={formatSupportLabel(row.status)} />,
    },
    {
      key: "updated_at",
      label: "Updated",
      render: (row) => format(new Date(row.updated_at), "dd MMM yyyy"),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Support Center"
        
        actions={
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Ticket
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">My Open Tickets</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold">{isLoading ? "..." : metrics.open}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Closed Tickets</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold">{isLoading ? "..." : metrics.closed}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Resolved Tickets</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold">{isLoading ? "..." : metrics.resolved}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Live Chat</CardTitle></CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <a href="mailto:support@xycargo.com?subject=Agent%20Live%20Chat%20Request">
                <MessageCircle className="mr-2 h-4 w-4" /> Start Chat
              </a>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Message Support</CardTitle></CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <a href="mailto:support@xycargo.com?subject=Agent%20Support%20Message">
                <MessagesSquare className="mr-2 h-4 w-4" /> Send Message
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ticket Queue</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={tickets}
            isLoading={isLoading}
            searchPlaceholder="Search tickets..."
            viewLink={(row) => `/agent/support/${row.id}`}
          />
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Ticket</DialogTitle>
            
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Client</Label>
              <Select
                value={form.customer_id}
                onValueChange={(value) => setForm((prev) => ({ ...prev, customer_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a client (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unlinked">No linked client</SelectItem>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.full_name} ({customer.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Subject</Label>
              <Input
                value={form.subject}
                onChange={(event) => setForm((prev) => ({ ...prev, subject: event.target.value }))}
                placeholder="Summarize the issue"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, category: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORT_TICKET_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {formatSupportLabel(category)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={form.priority}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, priority: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORT_TICKET_PRIORITIES.map((priority) => (
                      <SelectItem key={priority} value={priority}>
                        {formatSupportLabel(priority)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                rows={6}
                placeholder="Describe the issue in full so support can respond properly."
              />
            </div>

            <div className="space-y-2">
              <Label>Attachment</Label>
              <Input
                type="file"
                onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
              />
              {selectedFile ? (
                <p className="text-xs text-muted-foreground">{selectedFile.name}</p>
              ) : null}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSaving || isLoading}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create Ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AgentSupport;

