import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, Column } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format } from "date-fns";
import { Check, Undo2 } from "lucide-react";
import { isNotificationsUnavailableError } from "@/lib/notifications";

type NotificationRow = {
  id: string;
  title: string;
  message: string;
  is_read: boolean | null;
  created_at: string;
  user_id: string;
};

const SupportCommunications = () => {
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  const fetchNotifications = async () => {
    const { data, error } = await supabase
      .from("notifications")
      .select("id, title, message, is_read, created_at, user_id")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      if (!isNotificationsUnavailableError(error)) {
        toast.error("Failed to load notifications.");
      } else {
        console.warn("Notifications are unavailable in this environment:", error.message);
      }
      setNotifications([]);
    } else {
      setNotifications((data || []) as NotificationRow[]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const markRead = async (id: string, isRead: boolean) => {
    setIsUpdating(id);
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: isRead })
      .eq("id", id);

    if (error) {
      toast.error("Failed to update notification.");
    } else {
      setNotifications((prev) =>
        prev.map((row) => (row.id === id ? { ...row, is_read: isRead } : row)),
      );
    }
    setIsUpdating(null);
  };

  const columns: Column<NotificationRow>[] = [
    { key: "title", label: "Title" },
    { key: "message", label: "Message" },
    {
      key: "is_read",
      label: "Status",
      render: (item) => (item.is_read ? "Read" : "Unread"),
    },
    {
      key: "created_at",
      label: "Date",
      render: (item) => format(new Date(item.created_at), "PP"),
    },
    {
      key: "action",
      label: "Action",
      render: (item) => (
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 p-0"
          disabled={isUpdating === item.id}
          onClick={() => markRead(item.id, !item.is_read)}
          title={item.is_read ? "Mark unread" : "Mark read"}
        >
          {item.is_read ? (
            <Undo2 className="h-4 w-4 text-blue-600" />
          ) : (
            <Check className="h-4 w-4 text-green-600" />
          )}
        </Button>
      ),
    },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Customer Communication"
        
      />
      <DataTable
        columns={columns}
        data={notifications}
        isLoading={isLoading}
        searchPlaceholder="Search notifications..."
      />
    </div>
  );
};

export default SupportCommunications;

