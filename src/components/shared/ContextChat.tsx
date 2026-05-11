import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/components/auth/AuthContext";
import { SupportTicketConversation } from "@/components/support/SupportTicketConversation";
import { SupportTicketComposer } from "@/components/support/SupportTicketComposer";
import { toast } from "sonner";
import {
  buildSupportTicketCode,
  uploadSupportAttachment,
  type SupportTicketMessageRow,
  type SupportTicketRow,
} from "@/lib/supportTickets";

type ContextChatProps = {
  contextId: string;
  contextType: "sourcing" | "supplier_payment";
  customerId: string;
  subject: string;
  description?: string;
  placeholder?: string;
  title?: string;
};

export const ContextChat = ({
  contextId,
  contextType,
  customerId,
  subject,
  description = "Chat regarding request.",
  placeholder = "Type your message here...",
  title = "Chat with Support",
}: ContextChatProps) => {
  const { user, userRole } = useAuthContext();
  const [ticket, setTicket] = useState<SupportTicketRow | null>(null);
  const [messages, setMessages] = useState<SupportTicketMessageRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [reply, setReply] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const loadChat = async () => {
    setIsLoading(true);
    try {
      const column = contextType === "sourcing" ? "sourcing_request_id" : "supplier_payment_request_id";
      
      const { data: ticketData, error: ticketError } = await supabase
        .from("support_tickets")
        .select("*")
        .eq(column, contextId)
        .maybeSingle();

      if (ticketError) throw ticketError;

      if (ticketData) {
        setTicket(ticketData as SupportTicketRow);
        
        const { data: messageData, error: messageError } = await supabase
          .from("support_ticket_messages")
          .select("*")
          .eq("ticket_id", ticketData.id)
          .order("created_at", { ascending: true });

        if (messageError) throw messageError;
        setMessages((messageData || []) as SupportTicketMessageRow[]);
      } else {
        setTicket(null);
        setMessages([]);
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to load chat.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadChat();
  }, [contextId]);

  const handleSend = async () => {
    if (!user) {
      toast.error("You must be logged in to chat.");
      return;
    }
    if (!reply.trim() && !selectedFile) {
      toast.error("Write a message or attach a file before sending.");
      return;
    }

    setIsSending(true);
    try {
      let currentTicketId = ticket?.id;

      // 1. Create ticket if it doesn't exist
      if (!currentTicketId) {
        const column = contextType === "sourcing" ? "sourcing_request_id" : "supplier_payment_request_id";
        const { data: newTicket, error: createError } = await supabase
          .from("support_tickets")
          .insert({
            ticket_code: buildSupportTicketCode(),
            customer_id: customerId,
            [column]: contextId,
            subject: subject,
            description: description,
            category: contextType === "sourcing" ? "general" : "payment",
            priority: "medium",
            status: "open",
            created_by: user.id,
            escalated_to_department: contextType === "sourcing" ? "support" : "finance",
          })
          .select()
          .single();

        if (createError) throw createError;
        currentTicketId = newTicket.id;
        setTicket(newTicket as SupportTicketRow);
      }

      // 2. Upload attachment if any
      let attachment: any = null;
      if (selectedFile) {
        attachment = await uploadSupportAttachment(currentTicketId, user.id, selectedFile);
      }

      // 3. Insert message
      const { error: messageError } = await supabase.from("support_ticket_messages").insert({
        ticket_id: currentTicketId,
        sender_user_id: user.id,
        sender_role: userRole || "customer",
        sender_name: user.user_metadata?.full_name || user.email || "User",
        message: reply.trim(),
        is_internal: false,
        ...(attachment || {}),
      });

      if (messageError) throw messageError;

      setReply("");
      setSelectedFile(null);
      await loadChat();
    } catch (error: any) {
      toast.error(error?.message || "Failed to send message.");
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SupportTicketConversation
        title={title}
        messages={messages}
        currentUserId={user?.id}
        emptyState="No messages yet. Send a message to start chatting with support."
        className="max-h-[400px]"
      />
      <SupportTicketComposer
        value={reply}
        onChange={setReply}
        onSend={handleSend}
        isSending={isSending}
        selectedFile={selectedFile}
        onFileChange={setSelectedFile}
        placeholder={placeholder}
      />
    </div>
  );
};
