import { format } from "date-fns";
import { Download, Paperclip } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  formatSupportLabel,
  type SupportTicketMessageRow,
} from "@/lib/supportTickets";

type SupportTicketConversationProps = {
  messages: SupportTicketMessageRow[];
  currentUserId?: string | null;
  title?: string;
  emptyState?: string;
  className?: string;
};

export const SupportTicketConversation = ({
  messages,
  currentUserId,
  title = "Conversation",
  emptyState = "No conversation yet.",
  className,
}: SupportTicketConversationProps) => {
  return (
    <Card className={cn("min-h-0", className)}>
      <CardHeader className="pb-4">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[460px] px-6 pb-6">
          <div className="space-y-4">
            {messages.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/70 px-4 py-10 text-center text-sm text-muted-foreground">
                {emptyState}
              </div>
            ) : (
              messages.map((message) => {
                const isMine =
                  Boolean(currentUserId) &&
                  message.sender_user_id === currentUserId;

                return (
                  <div
                    key={message.id}
                    className={cn("flex", isMine ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "max-w-[92%] rounded-2xl border px-4 py-3 shadow-sm sm:max-w-[80%]",
                        message.is_internal
                          ? "border-amber-200 bg-amber-50"
                          : isMine
                            ? "border-primary/20 bg-primary/5"
                            : "border-border/70 bg-background",
                      )}
                    >
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">
                          {message.sender_name || formatSupportLabel(message.sender_role)}
                        </p>
                        <Badge variant="outline" className="text-[11px]">
                          {formatSupportLabel(message.sender_role)}
                        </Badge>
                        {message.is_internal ? (
                          <Badge variant="outline" className="border-amber-300 text-[11px] text-amber-700">
                            Internal note
                          </Badge>
                        ) : null}
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(message.created_at), "PP p")}
                        </span>
                      </div>

                      {message.message ? (
                        <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">
                          {message.message}
                        </p>
                      ) : null}

                      {message.attachment_url ? (
                        <a
                          href={message.attachment_url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border/70 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-muted/50"
                        >
                          <Paperclip className="h-4 w-4" />
                          <span className="max-w-[220px] truncate">
                            {message.attachment_name || "Attachment"}
                          </span>
                          <Download className="h-4 w-4" />
                        </a>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
