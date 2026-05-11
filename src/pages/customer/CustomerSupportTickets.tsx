import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, MessageSquare, Plus, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CustomerProfileGate } from "@/components/customer/CustomerProfileGate";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuthContext } from "@/components/auth/AuthContext";
import { useCustomerRecord } from "@/hooks/useCustomerRecord";
import {
  SUPPORT_TICKET_CATEGORIES,
  buildSupportTicketCode,
  formatSupportLabel,
  isSupportTicketClosed,
  type SupportTicketRow,
  uploadSupportAttachment,
} from "@/lib/supportTickets";

const selectQuery =
  "id, ticket_code, customer_id, shipment_id, subject, description, category, priority, status, assigned_to, resolution_notes, created_by, escalated_to_department, escalated_at, created_at, updated_at";

const CustomerSupportTickets = () => {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const { customer } = useCustomerRecord();
  const [tickets, setTickets] = useState<SupportTicketRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    subject: "",
    category: "general",
    description: "",
  });

  const loadTickets = async () => {
    if (!customer?.id) {
      setTickets([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("support_tickets")
        .select(selectQuery)
        .eq("customer_id", customer.id)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setTickets((data || []) as SupportTicketRow[]);
    } catch (error: any) {
      toast.error(error?.message || "Failed to load support tickets.");
      setTickets([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadTickets();
  }, [customer?.id]);

  const handleCreate = async () => {
    if (!customer?.id || !user) {
      toast.error("Customer profile not ready yet.");
      return;
    }
    if (!form.subject.trim() || !form.description.trim()) {
      toast.error("Subject and description are required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const ticketCode = buildSupportTicketCode();
      const { data: createdTicket, error: ticketError } = await supabase
        .from("support_tickets")
        .insert({
          ticket_code: ticketCode,
          customer_id: customer.id,
          created_by: user.id,
          subject: form.subject.trim(),
          description: form.description.trim(),
          category: form.category,
          priority: "medium",
          status: "open",
          escalated_to_department: "support",
        })
        .select("id")
        .single();

      if (ticketError) throw ticketError;

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
        sender_role: "customer",
        sender_name: customer.full_name,
        message: form.description.trim(),
        ...(attachment || {}),
      });

      if (messageError) throw messageError;

      toast.success("Ticket created successfully.");
      setForm({ subject: "", category: "general", description: "" });
      setSelectedFile(null);
      setIsDialogOpen(false);
      await loadTickets();
      navigate(`/customer/support-tickets/${createdTicket.id}`);
    } catch (error: any) {
      toast.error(error?.message || "Failed to create ticket.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openTickets = useMemo(
    () => tickets.filter((ticket) => !isSupportTicketClosed(ticket.status)),
    [tickets],
  );
  const closedTickets = useMemo(
    () => tickets.filter((ticket) => isSupportTicketClosed(ticket.status)),
    [tickets],
  );

  const renderTicketCards = (rows: SupportTicketRow[], emptyMessage: string) => {
    if (isLoading) {
      return (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (rows.length === 0) {
      return (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <MessageSquare className="mx-auto mb-3 h-10 w-10 opacity-40" />
            {emptyMessage}
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        {rows.map((ticket) => (
          <Card key={ticket.id}>
            <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">
                    {ticket.ticket_code}
                  </span>
                  <StatusBadge status={ticket.status} label={formatSupportLabel(ticket.status)} />
                  <Badge variant="outline">{formatSupportLabel(ticket.category)}</Badge>
                </div>

                <div>
                  <p className="font-semibold text-foreground">{ticket.subject}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {ticket.resolution_notes || ticket.description}
                  </p>
                </div>

                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span>Priority: {formatSupportLabel(ticket.priority)}</span>
                  <span>Updated: {format(new Date(ticket.updated_at), "PP p")}</span>
                </div>
              </div>

              <Button asChild size="icon" variant="ghost" className="h-8 w-8 p-0" title="Open Conversation">
                <Link to={`/customer/support-tickets/${ticket.id}`}>
                  <Eye className="h-4 w-4 text-blue-600" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <CustomerProfileGate>
      <div className="space-y-6">
        <PageHeader
          title="Support Center"
          
          actions={
            <Button onClick={() => setIsDialogOpen(true)} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Create Ticket
            </Button>
          }
        />

        <Tabs defaultValue="open">
          <TabsList>
            <TabsTrigger value="open">Open Tickets</TabsTrigger>
            <TabsTrigger value="closed">Closed Tickets</TabsTrigger>
          </TabsList>

          <TabsContent value="open">
            {renderTicketCards(openTickets, "You do not have any open tickets right now.")}
          </TabsContent>

          <TabsContent value="closed">
            {renderTicketCards(closedTickets, "You do not have any closed tickets yet.")}
          </TabsContent>
        </Tabs>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Ticket</DialogTitle>
              
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input
                  value={form.subject}
                  onChange={(event) => setForm((prev) => ({ ...prev, subject: event.target.value }))}
                  placeholder="Summarize the issue"
                />
              </div>

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
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                  rows={6}
                  placeholder="Explain the issue in full detail so the support team can respond clearly."
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
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Submit Ticket
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </CustomerProfileGate>
  );
};

export default CustomerSupportTickets;

