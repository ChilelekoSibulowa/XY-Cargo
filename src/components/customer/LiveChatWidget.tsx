import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/components/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  MessageCircle,
  X,
  Send,
  Loader2,
  ArrowLeft,
  Plus,
} from "lucide-react";
import { format } from "date-fns";

type ChatRow = {
  id: string;
  chat_code: string;
  subject: string;
  status: string;
  last_message_preview: string | null;
  last_message_at: string | null;
  created_at: string;
  current_assigned_agent_name: string | null;
};

type MessageRow = {
  id: string;
  chat_id: string;
  sender_id: string | null;
  sender_type: string;
  sender_name: string;
  body: string | null;
  message_type: string;
  created_at: string;
};

const generateCustomerCode = () => {
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `CUST-${random}`;
};

const normalizeStoredPhone = (value: unknown) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === "pending") return null;
  return trimmed;
};

const LiveChatWidget = () => {
  const { user, userRole } = useAuthContext();
  const [isOpen, setIsOpen] = useState(false);
  const [chats, setChats] = useState<ChatRow[]>([]);
  const [activeChat, setActiveChat] = useState<ChatRow | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [profileData, setProfileData] = useState<{ full_name: string; email: string; phone: string | null } | null>(null);
  const [customerData, setCustomerData] = useState<{ id: string } | null>(null);
  const [driverData, setDriverData] = useState<{ id: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const requesterRole = (userRole || "customer").toLowerCase();
  const isSupportedRequesterRole = requesterRole === "customer" || requesterRole === "driver";

  const formatTimestamp = useCallback(
    (value: string | null | undefined, pattern: string, fallback: string) => {
      if (!value) return fallback;
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? fallback : format(date, pattern);
    },
    []
  );

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Load profile and role-specific data
  useEffect(() => {
    if (!user?.id) return;
    const load = async () => {
      // Get profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email, phone")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profile) {
        setProfileData(profile);
      } else {
        setProfileData({
          full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
          email: user.email || "",
          phone: user.user_metadata?.phone || null,
        });
      }

      // Get customer record if applicable
      const { data: cust } = await supabase
        .from("customers")
        .select("id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      if (cust) {
        setCustomerData(cust);
      } else if (requesterRole === "customer") {
        const metadataPhone = normalizeStoredPhone(user.user_metadata?.phone);
        const { data: createdCustomer } = await supabase
          .from("customers")
          .insert({
            user_id: user.id,
            code: generateCustomerCode(),
            full_name: user.user_metadata?.full_name || user.email || "Customer",
            email: user.email || null,
            phone: metadataPhone || "Pending",
          })
          .select("id")
          .maybeSingle();

        if (createdCustomer) {
          setCustomerData(createdCustomer);
        }
      }

      // Get driver record if applicable
      const { data: drv } = await supabase
        .from("drivers")
        .select("id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      if (drv) setDriverData(drv);
    };
    load();
  }, [requesterRole, user?.email, user?.id, user?.user_metadata]);

  const fetchChats = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from("support_chats")
      .select("id, chat_code, subject, status, created_at, last_message_preview, last_message_at, current_assigned_agent_name")
      .eq("requester_user_id", user.id)
      .order("last_message_at", { ascending: false })
      .limit(20);

    if (!error && data) setChats(data as ChatRow[]);
    setIsLoading(false);
  }, [user?.id]);

  const fetchMessages = useCallback(async (chatId: string) => {
    const { data, error } = await supabase
      .from("support_chat_messages")
      .select("id, chat_id, sender_id, sender_type, sender_name, body, message_type, created_at")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true })
      .limit(100);

    if (!error && data) setMessages(data as MessageRow[]);
  }, []);

  useEffect(() => {
    if (isOpen) fetchChats();
  }, [isOpen, fetchChats]);

  useEffect(() => {
    if (!activeChat?.id) return;
    fetchMessages(activeChat.id);

    const channel = supabase
      .channel(`chat-${activeChat.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_chat_messages", filter: `chat_id=eq.${activeChat.id}` },
        (payload) => {
          const msg = payload.new as MessageRow;
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeChat?.id, fetchMessages]);

  const getRequesterRole = (): string => {
    return requesterRole === "driver" ? "driver" : "customer";
  };

  const handleStartChat = async () => {
    if (!user?.id || !profileData) return;
    if (!isSupportedRequesterRole) {
      toast.error("Live chat is only available for customer and driver accounts.");
      return;
    }
    const subject = newSubject.trim();
    if (!subject) {
      toast.error("Please enter a subject for your chat.");
      return;
    }

    setIsSending(true);
    const chatCode = `CHAT-${Date.now().toString(36).toUpperCase()}`;
    const role = getRequesterRole();
    const activeCustomerId = role === "customer" ? customerData?.id || null : null;
    const activeDriverId = role === "driver" ? driverData?.id || null : null;

    if (role === "customer" && !activeCustomerId) {
      toast.error("Customer profile is still loading. Please try again in a moment.");
      setIsSending(false);
      return;
    }

    if (role === "driver" && !activeDriverId) {
      toast.error("Driver profile not found for this account.");
      setIsSending(false);
      return;
    }

    const insertPayload: any = {
      chat_code: chatCode,
      requester_user_id: user.id,
      requester_role: role,
      requester_name: profileData.full_name,
      requester_email: profileData.email || user.email,
      requester_phone: profileData.phone,
      subject,
      issue_category: "general",
      priority: "medium",
      status: "new",
      current_department: "support",
    };

    // Attach customer_id or driver_id if available
    if (activeCustomerId) insertPayload.customer_id = activeCustomerId;
    if (activeDriverId) insertPayload.driver_id = activeDriverId;

    const { data, error } = await supabase
      .from("support_chats")
      .insert(insertPayload)
      .select("id, chat_code, subject, status, created_at, last_message_preview, last_message_at, current_assigned_agent_name")
      .single();

    if (error) {
      console.error("Chat creation error:", JSON.stringify(error));
      if (error.code === "42501" || error.message?.includes("policy")) {
        toast.error("Permission error. Please log out and log back in.");
      } else {
        toast.error(error.message || "Failed to start chat. Please try again.");
      }
      setIsSending(false);
      return;
    }

    const chatRow = data as ChatRow;
    setChats((prev) => [chatRow, ...prev]);
    setActiveChat(chatRow);
    setNewSubject("");
    setShowNewChat(false);
    setIsSending(false);
  };

  const handleSendMessage = async () => {
    if (!activeChat?.id || !user?.id || !profileData) return;
    const body = newMessage.trim();
    if (!body) return;

    setIsSending(true);
    const { error } = await supabase
      .from("support_chat_messages")
      .insert({
        chat_id: activeChat.id,
        sender_id: user.id,
        sender_type: "user",
        sender_name: profileData.full_name,
        body,
        message_type: "text",
      });

    if (error) {
      console.error("Message send error:", JSON.stringify(error));
      if (error.code === "42501" || error.message?.includes("policy")) {
        toast.error("Permission error sending message. Try closing and reopening the chat.");
      } else {
        toast.error("Failed to send message.");
      }
    } else {
      setNewMessage("");
    }
    setIsSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!user?.id || !isSupportedRequesterRole) return null;

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:scale-105 hover:shadow-xl"
          aria-label="Open live chat"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {isOpen && (
        <div className="fixed bottom-4 right-4 z-50 flex h-[520px] w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
          <div className="flex items-center justify-between border-b bg-primary/5 px-4 py-3">
            <div className="flex items-center gap-2">
              {activeChat && (
                <button onClick={() => { setActiveChat(null); setMessages([]); }} className="mr-1 rounded p-1 hover:bg-muted">
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}
              <MessageCircle className="h-5 w-5 text-primary" />
              <span className="text-sm font-semibold">
                {activeChat ? activeChat.subject : "Live Support"}
              </span>
            </div>
            <button onClick={() => { setIsOpen(false); setActiveChat(null); }} className="rounded p-1 hover:bg-muted">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {activeChat ? (
              <div className="flex h-full flex-col">
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {messages.length === 0 && (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      No messages yet. Start the conversation!
                    </p>
                  )}
                  {messages.map((msg) => {
                    const isMe = msg.sender_id === user.id;
                    return (
                      <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                            isMe
                              ? "bg-primary text-primary-foreground rounded-br-md"
                              : "bg-muted text-foreground rounded-bl-md"
                          }`}
                        >
                          {!isMe && (
                            <p className="mb-0.5 text-[10px] font-semibold opacity-70">
                              {msg.sender_name}
                            </p>
                          )}
                          <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                          <p className={`mt-1 text-[10px] ${isMe ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                            {formatTimestamp(msg.created_at, "HH:mm", "--:--")}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                <div className="border-t p-3">
                  <div className="flex gap-2">
                    <Input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Type a message..."
                      disabled={isSending}
                      className="flex-1"
                    />
                    <Button
                      size="icon"
                      onClick={handleSendMessage}
                      disabled={isSending || !newMessage.trim()}
                    >
                      {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 space-y-3">
                {showNewChat ? (
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Start a new conversation</p>
                    <Input
                      value={newSubject}
                      onChange={(e) => setNewSubject(e.target.value)}
                      placeholder="What do you need help with?"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleStartChat} disabled={isSending}>
                        {isSending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                        Start Chat
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setShowNewChat(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" className="w-full" onClick={() => setShowNewChat(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Conversation
                  </Button>
                )}

                {isLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : chats.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No conversations yet. Start one above!
                  </p>
                ) : (
                  chats.map((chat) => (
                    <button
                      key={chat.id}
                      onClick={() => setActiveChat(chat)}
                      className="w-full rounded-lg border p-3 text-left transition hover:bg-muted/50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium truncate">{chat.subject}</p>
                        <Badge variant={chat.status === "closed" ? "secondary" : "default"} className="text-[10px] shrink-0">
                          {chat.status}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground truncate">
                        {chat.last_message_preview || "No messages yet"}
                      </p>
                      <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>{chat.current_assigned_agent_name || "Unassigned"}</span>
                        <span>{formatTimestamp(chat.last_message_at || chat.created_at, "dd MMM HH:mm", "No activity yet")}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default LiveChatWidget;
