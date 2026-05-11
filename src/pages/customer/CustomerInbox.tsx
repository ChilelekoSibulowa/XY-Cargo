import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Bell, BellOff, Check, Mail, MessageSquare, Trash2, Eye, X } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function CustomerInbox() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [selectedNotification, setSelectedNotification] = useState<any>(null);

  const { data: notifications, isLoading } = useQuery({
    queryKey: ["customer-notifications", filter],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      let query = supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (filter === "unread") {
        query = query.eq("is_read", false);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-notifications"] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-notifications"] });
      toast.success("All messages marked as read");
    },
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-notifications"] });
      toast.success("Message deleted");
    },
  });

  const handleViewNotification = (notification: any) => {
    setSelectedNotification(notification);
    if (!notification.is_read) {
      markAsReadMutation.mutate(notification.id);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Inbox" 
        subtitle="Check your notifications and messages"
      />

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Button 
            variant={filter === "all" ? "default" : "outline"} 
            size="sm"
            onClick={() => setFilter("all")}
          >
            All
          </Button>
          <Button 
            variant={filter === "unread" ? "default" : "outline"} 
            size="sm"
            onClick={() => setFilter("unread")}
          >
            Unread
          </Button>
        </div>

        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => markAllAsReadMutation.mutate()}
          disabled={!notifications?.some(n => !n.is_read)}
        >
          <Check className="w-4 h-4 mr-2" />
          Mark all as read
        </Button>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="border-border/60">
              <CardContent className="p-4 flex gap-4">
                <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-1/4" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : notifications && notifications.length > 0 ? (
          notifications.map((notification) => (
            <Card 
              key={notification.id} 
              className={`transition-all border-border/60 hover:border-primary/30 cursor-pointer ${
                !notification.is_read ? "bg-primary/5 border-primary/20 shadow-sm" : "opacity-80"
              }`}
              onClick={() => handleViewNotification(notification)}
            >
              <CardContent className="p-4">
                <div className="flex gap-4">
                  <div className={`h-10 w-10 rounded-full shrink-0 flex items-center justify-center ${
                    !notification.is_read ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  }`}>
                    {notification.notification_type === "shipment" ? (
                      <MessageSquare className="w-5 h-5" />
                    ) : (
                      <Bell className="w-5 h-5" />
                    )}
                  </div>
                  
                  <div className="flex-1 space-y-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <h4 className={`text-sm font-semibold truncate ${!notification.is_read ? "text-foreground font-bold" : "text-muted-foreground"}`}>
                          {notification.title}
                        </h4>
                        {!notification.is_read && (
                          <Badge variant="default" className="h-1.5 w-1.5 rounded-full p-0 shrink-0" />
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0 uppercase tracking-wider">
                        {format(new Date(notification.created_at), "MMM d, HH:mm")}
                      </span>
                    </div>
                    <p className={`text-sm line-clamp-2 ${!notification.is_read ? "text-foreground/90" : "text-muted-foreground"}`}>
                      {notification.message}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <BellOff className="w-8 h-8 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">Your inbox is empty</h3>
              <p className="text-sm text-muted-foreground">
                {filter === "unread" ? "You don't have any unread messages." : "You'll see your shipment updates and notifications here."}
              </p>
            </div>
            {filter === "unread" && (
              <Button variant="outline" size="sm" onClick={() => setFilter("all")}>
                View all messages
              </Button>
            )}
          </div>
        )}
      </div>

      <Dialog open={!!selectedNotification} onOpenChange={(open) => !open && setSelectedNotification(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                {selectedNotification?.notification_type === "shipment" ? (
                  <MessageSquare className="w-6 h-6" />
                ) : (
                  <Bell className="w-6 h-6" />
                )}
              </div>
              <div className="space-y-1">
                <DialogTitle className="text-xl">{selectedNotification?.title}</DialogTitle>
                <DialogDescription className="text-xs uppercase tracking-widest text-muted-foreground">
                  {selectedNotification && format(new Date(selectedNotification.created_at), "PPPP 'at' p")}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="py-6">
            <p className="text-base leading-relaxed text-foreground whitespace-pre-wrap">
              {selectedNotification?.message}
            </p>
          </div>
          <div className="flex items-center justify-between gap-4">
             <Button 
              variant="outline" 
              size="sm"
              className="text-destructive hover:bg-destructive/5 hover:text-destructive border-destructive/20"
              onClick={() => {
                deleteNotificationMutation.mutate(selectedNotification.id);
                setSelectedNotification(null);
              }}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Message
            </Button>
            <Button size="sm" onClick={() => setSelectedNotification(null)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
