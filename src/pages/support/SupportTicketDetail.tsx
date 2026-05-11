import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { useParams } from "react-router-dom";
import { Loader2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/components/auth/AuthContext";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { SupportTicketConversation } from "@/components/support/SupportTicketConversation";
import { SupportTicketComposer } from "@/components/support/SupportTicketComposer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  SUPPORT_TICKET_DEPARTMENTS,
  SUPPORT_TICKET_PRIORITIES,
  SUPPORT_TICKET_STATUSES,
  fetchSupportStaffOptions,
  formatSupportLabel,
  type SupportStaffOption,
  type SupportTicketMessageRow,
  type SupportTicketRow,
  uploadSupportAttachment,
} from "@/lib/supportTickets";
import { getWarehouseTrackingNumber, resolveTrackingByStatus } from "@/lib/shipmentNotes";

const ticketSelect =
  "id, ticket_code, customer_id, shipment_id, subject, description, category, priority, status, assigned_to, resolution_notes, created_by, escalated_to_department, escalated_at, created_at, updated_at, customer:customers(full_name, code, user_id, agent_id), shipment:shipments(code, custom_tracking_number, notes, status)";

const SupportTicketDetail = () => {
  const { ticketId } = useParams<{ ticketId: string }>();
  const { user, userRole } = useAuthContext();
  const [ticket, setTicket] = useState<SupportTicketRow | null>(null);
  const [messages, setMessages] = useState<SupportTicketMessageRow[]>([]);
  const [staffOptions, setStaffOptions] = useState<SupportStaffOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingTicket, setIsSavingTicket] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isClosingTicket, setIsClosingTicket] = useState(false);
  const [reply, setReply] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isInternal, setIsInternal] = useState(false);
  const [form, setForm] = useState({
    status: "open",
    priority: "medium",
    assigned_to: "unassigned",
    department: "support",
  });

  const staffMap = useMemo(
    () => new Map(staffOptions.map((item) => [item.user_id, item])),
    [staffOptions],
  );
  const canManageRouting = userRole !== "driver";
  const canCloseTicket = Boolean(ticket && !["closed", "resolved"].includes(ticket.status?.toLowerCase()));

  const loadTicket = async () => {
    if (!ticketId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const [{ data: ticketData, error: ticketError }, { data: messageData, error: messageError }, staffData] =
        await Promise.all([
          supabase.from("support_tickets").select(ticketSelect).eq("id", ticketId).maybeSingle(),
          supabase
            .from("support_ticket_messages")
            .select("*")
            .eq("ticket_id", ticketId)
            .order("created_at", { ascending: true }),
          fetchSupportStaffOptions(),
        ]);

      if (ticketError) throw ticketError;
      if (messageError) throw messageError;

      const actorIds = [ticketData?.created_by, ticketData?.assigned_to].filter(
        (value): value is string => Boolean(value),
      );

      const [profilesRes, rolesRes] = actorIds.length
        ? await Promise.all([
            supabase.from("profiles").select("user_id, full_name").in("user_id", actorIds),
            supabase.from("user_roles").select("user_id, role").in("user_id", actorIds),
          ])
        : [
            { data: [], error: null },
            { data: [], error: null },
          ];

      const profileMap = new Map(
        ((profilesRes.data || []) as { user_id: string; full_name: string | null }[]).map((row) => [
          row.user_id,
          row.full_name,
        ]),
      );
      const roleMap = new Map(
        ((rolesRes.data || []) as { user_id: string; role: string }[]).map((row) => [
          row.user_id,
          row.role,
        ]),
      );

      const normalizedTicket = ticketData
        ? ({
            ...(ticketData as SupportTicketRow),
            requester_name:
              (ticketData.created_by ? profileMap.get(ticketData.created_by) : null) ||
              (Array.isArray(ticketData.customer)
                ? ticketData.customer[0]?.full_name
                : ticketData.customer?.full_name) ||
              "Customer",
            requester_role:
              (ticketData.created_by ? roleMap.get(ticketData.created_by) : null) ||
              ((Array.isArray(ticketData.customer) ? ticketData.customer[0] : ticketData.customer)
                ? "customer"
                : "system"),
            assigned_name: ticketData.assigned_to
              ? profileMap.get(ticketData.assigned_to) || null
              : null,
          } as SupportTicketRow)
        : null;

      setTicket(normalizedTicket);
      setMessages((messageData || []) as SupportTicketMessageRow[]);
      setStaffOptions(staffData);
      setForm({
        status: normalizedTicket?.status || "open",
        priority: normalizedTicket?.priority || "medium",
        assigned_to: normalizedTicket?.assigned_to || "unassigned",
        department: normalizedTicket?.escalated_to_department || "support",
      });
    } catch (error: any) {
      toast.error(error?.message || "Failed to load ticket details.");
      setTicket(null);
      setMessages([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadTicket();
  }, [ticketId]);

  const handleSend = async () => {
    if (!ticketId || !user) {
      toast.error("Ticket session not found.");
      return;
    }
    if (!reply.trim() && !selectedFile) {
      toast.error("Write a message or attach a file before sending.");
      return;
    }

    setIsSending(true);
    try {
      let attachment: {
        attachment_url: string;
        attachment_name: string;
        attachment_type: string | null;
      } | null = null;

      if (selectedFile) {
        attachment = await uploadSupportAttachment(ticketId, user.id, selectedFile);
      }

      const actor = staffMap.get(user.id);

      const { error } = await supabase.from("support_ticket_messages").insert({
        ticket_id: ticketId,
        sender_user_id: user.id,
        sender_role: userRole || "staff",
        sender_name:
          actor?.full_name ||
          user.user_metadata?.full_name ||
          user.email ||
          "Support",
        message: reply.trim(),
        is_internal: isInternal,
        ...(attachment || {}),
      });

      if (error) throw error;

      toast.success(isInternal ? "Internal note saved." : "Response sent.");
      setReply("");
      setSelectedFile(null);
      setIsInternal(false);
      await loadTicket();
    } catch (error: any) {
      toast.error(error?.message || "Failed to send response.");
    } finally {
      setIsSending(false);
    }
  };

  const handleSaveTicket = async () => {
    if (!ticketId || !user) return;

    setIsSavingTicket(true);
    try {
      const nextDepartment = form.department === "support" ? "support" : form.department;
      const { error } = await supabase
        .from("support_tickets")
        .update({
          status: form.status,
          priority: form.priority,
          assigned_to: form.assigned_to === "unassigned" ? null : form.assigned_to,
          escalated_to_department: nextDepartment,
          escalated_at: nextDepartment ? new Date().toISOString() : null,
          escalated_by: nextDepartment ? user.id : null,
        })
        .eq("id", ticketId);

      if (error) throw error;

      toast.success("Ticket details updated.");
      await loadTicket();
    } catch (error: any) {
      toast.error(error?.message || "Failed to update ticket.");
    } finally {
      setIsSavingTicket(false);
    }
  };

  const handleCloseTicket = async () => {
    if (!ticketId || !user) return;

    setIsClosingTicket(true);
    try {
      const { error } = await supabase
        .from("support_tickets")
        .update({ status: "closed" })
        .eq("id", ticketId);

      if (error) throw error;

      toast.success("Ticket closed.");
      await loadTicket();
    } catch (error: any) {
      toast.error(error?.message || "Failed to close ticket.");
    } finally {
      setIsClosingTicket(false);
    }
  };

  const linkedCustomer = Array.isArray(ticket?.customer)
    ? ticket?.customer[0]
    : ticket?.customer;
  const linkedShipment = Array.isArray(ticket?.shipment)
    ? ticket?.shipment[0]
    : ticket?.shipment;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={ticket ? `${ticket.ticket_code} · ${ticket.subject}` : "Ticket Details"}
        
        backLink="/support/tickets"
      />

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !ticket ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Ticket not found or you no longer have access to it.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_360px]">
          <div className="space-y-6">
            <SupportTicketConversation
              messages={messages}
              currentUserId={user?.id}
              emptyState="No messages have been sent on this ticket yet."
            />

            <SupportTicketComposer
              title="Respond To Ticket"
              value={reply}
              onChange={setReply}
              onSend={handleSend}
              isSending={isSending}
              selectedFile={selectedFile}
              onFileChange={setSelectedFile}
              allowInternal={canManageRouting}
              isInternal={canManageRouting && isInternal}
              onInternalChange={setIsInternal}
              placeholder="Type your response, add context, or leave an internal note."
            />
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle>Ticket Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex items-center gap-2">
                  <StatusBadge status={ticket.status} label={formatSupportLabel(ticket.status)} />
                  <Badge variant="outline">{formatSupportLabel(ticket.priority)}</Badge>
                  <Badge variant="outline">{formatSupportLabel(ticket.category)}</Badge>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Requester</p>
                    <p className="font-medium">{ticket.requester_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatSupportLabel(ticket.requester_role)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Client</p>
                    <p className="font-medium">
                      {linkedCustomer?.full_name || "Not linked"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {linkedCustomer?.code || "No customer code"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Shipment</p>
                    <p className="font-medium">
                      {linkedShipment
                        ? resolveTrackingByStatus(linkedShipment.status || null, linkedShipment.notes, linkedShipment.custom_tracking_number) || "Tracking pending"
                        : "Not linked"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Assigned To</p>
                    <p className="font-medium">{ticket.assigned_name || "Unassigned"}</p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Department Queue</p>
                    <p className="font-medium">
                      {formatSupportLabel(ticket.escalated_to_department || "support")}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Created</p>
                    <p className="font-medium">{format(new Date(ticket.created_at), "PP p")}</p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Last Updated</p>
                    <p className="font-medium">{format(new Date(ticket.updated_at), "PP p")}</p>
                  </div>
                </div>

                {canCloseTicket ? (
                  <div className="mt-4">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleCloseTicket}
                      disabled={isClosingTicket}
                      className="w-full"
                    >
                      {isClosingTicket ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Close Ticket
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {canManageRouting ? (
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle>Routing & Ownership</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={form.status}
                      onValueChange={(value) => setForm((prev) => ({ ...prev, status: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SUPPORT_TICKET_STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>
                            {formatSupportLabel(status)}
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

                  <div className="space-y-2">
                    <Label>Assign To</Label>
                    <Select
                      value={form.assigned_to}
                      onValueChange={(value) => setForm((prev) => ({ ...prev, assigned_to: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select assignee" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {staffOptions.map((staff) => (
                          <SelectItem key={staff.user_id} value={staff.user_id}>
                            {`${staff.full_name || staff.email || staff.user_id} (${formatSupportLabel(staff.role)})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Escalate / Queue</Label>
                    <Select
                      value={form.department}
                      onValueChange={(value) => setForm((prev) => ({ ...prev, department: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SUPPORT_TICKET_DEPARTMENTS.map((department) => (
                          <SelectItem key={department} value={department}>
                            {formatSupportLabel(department)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button onClick={handleSaveTicket} disabled={isSavingTicket} className="w-full">
                    {isSavingTicket ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save Ticket Changes
                  </Button>
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

export default SupportTicketDetail;

