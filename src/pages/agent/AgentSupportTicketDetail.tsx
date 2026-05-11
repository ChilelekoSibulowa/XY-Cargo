import { useEffect, useState } from "react";
import { format } from "date-fns";
import { useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/components/auth/AuthContext";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { SupportTicketConversation } from "@/components/support/SupportTicketConversation";
import { SupportTicketComposer } from "@/components/support/SupportTicketComposer";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { resolveTrackingByStatus } from "@/lib/shipmentNotes";
import {
  formatSupportLabel,
  type SupportTicketMessageRow,
  type SupportTicketRow,
  uploadSupportAttachment,
} from "@/lib/supportTickets";

const ticketSelect =
  "id, ticket_code, customer_id, shipment_id, subject, description, category, priority, status, assigned_to, resolution_notes, created_by, escalated_to_department, escalated_at, created_at, updated_at, customer:customers(full_name, code, user_id), shipment:shipments(code, custom_tracking_number, notes, status)";

const AgentSupportTicketDetail = () => {
  const { ticketId } = useParams<{ ticketId: string }>();
  const { user } = useAuthContext();
  const [ticket, setTicket] = useState<SupportTicketRow | null>(null);
  const [messages, setMessages] = useState<SupportTicketMessageRow[]>([]);
  const [reply, setReply] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  const loadTicket = async () => {
    if (!ticketId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const [{ data: ticketData, error: ticketError }, { data: messageData, error: messageError }] =
        await Promise.all([
          supabase.from("support_tickets").select(ticketSelect).eq("id", ticketId).maybeSingle(),
          supabase
            .from("support_ticket_messages")
            .select("*")
            .eq("ticket_id", ticketId)
            .order("created_at", { ascending: true }),
        ]);

      if (ticketError) throw ticketError;
      if (messageError) throw messageError;

      setTicket((ticketData as SupportTicketRow | null) || null);
      setMessages((messageData || []) as SupportTicketMessageRow[]);
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

      const { error } = await supabase.from("support_ticket_messages").insert({
        ticket_id: ticketId,
        sender_user_id: user.id,
        sender_role: "agent",
        sender_name: user.user_metadata?.full_name || user.email || "Agent",
        message: reply.trim(),
        ...(attachment || {}),
      });

      if (error) throw error;

      toast.success("Reply sent.");
      setReply("");
      setSelectedFile(null);
      await loadTicket();
    } catch (error: any) {
      toast.error(error?.message || "Failed to send reply.");
    } finally {
      setIsSending(false);
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
        
        backLink="/agent/support"
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
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_340px]">
          <div className="space-y-6">
            <SupportTicketConversation
              messages={messages}
              currentUserId={user?.id}
              emptyState="No replies have been posted yet."
            />

            <SupportTicketComposer
              title="Reply To Support"
              value={reply}
              onChange={setReply}
              onSend={handleSend}
              isSending={isSending}
              selectedFile={selectedFile}
              onFileChange={setSelectedFile}
              placeholder="Add more details for the support team or attach a file."
            />
          </div>

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

              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Client</p>
                <p className="font-medium">{linkedCustomer?.full_name || "Not linked"}</p>
                <p className="text-xs text-muted-foreground">{linkedCustomer?.code || "No client code"}</p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Linked Shipment</p>
                <p className="font-medium">
                  {linkedShipment
                    ? resolveTrackingByStatus(linkedShipment.status || null, linkedShipment.notes || null, linkedShipment.custom_tracking_number || null) || "Tracking pending"
                    : "Not linked"}
                </p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Department</p>
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
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AgentSupportTicketDetail;

