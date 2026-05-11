import { LayoutGrid, BellRing, Bell, UserCircle, Maximize2, Globe2, PlusCircle, Eye } from "lucide-react";
import { CurrencySwitcher } from "@/components/shared/CurrencySwitcher";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuthContext } from "@/components/auth/AuthContext";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  isNotificationsUnavailableError,
  remapNotificationsToWarehouseTracking,
} from "@/lib/notifications";

interface TopBarProps {
  onMenuClick?: () => void;
}

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  is_read: boolean | null;
  created_at: string;
  notification_type?: string | null;
  reference_id?: string | null;
};

export const TopBar = ({ onMenuClick }: TopBarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userRole, user } = useAuthContext();
  const isCustomer = userRole === "customer";
  const isAgent = userRole === "agent";
  const isDriver = userRole === "driver";
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(true);
  const [isUpdatingNotification, setIsUpdatingNotification] = useState<string | null>(null);

  const unreadCount = useMemo(() => notifications.length, [notifications]);

  const handleLogout = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        await supabase.auth.signOut({ scope: "local" });
        toast.error("Signed out locally. Please log in again if needed.");
      }
    } finally {
      navigate("/login", { replace: true });
      setIsSigningOut(false);
    }
  };

  const fetchNotifications = async (userId: string) => {
    setIsLoadingNotifications(true);
    const { data, error } = await supabase
      .from("notifications")
      .select("id, title, message, is_read, created_at, notification_type, reference_id")
      .eq("user_id", userId)
      .eq("is_read", false)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      setNotifications([]);
      if (!isNotificationsUnavailableError(error)) {
        toast.error("Failed to load notifications.");
      } else {
        console.warn("Notifications are unavailable in this environment:", error.message);
      }
    } else {
      const normalized = await remapNotificationsToWarehouseTracking((data || []) as NotificationItem[]);
      setNotifications(normalized);
    }
    setIsLoadingNotifications(false);
  };

  const toggleNotificationRead = async (notificationId: string, isRead: boolean) => {
    if (!user?.id) return;
    setIsUpdatingNotification(notificationId);
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: isRead })
      .eq("id", notificationId);

    if (error) {
      toast.error("Failed to update notification.");
    } else {
      setNotifications((prev) =>
        isRead
          ? prev.filter((note) => note.id !== notificationId)
          : prev.map((note) => (note.id === notificationId ? { ...note, is_read: isRead } : note)),
      );
    }
    setIsUpdatingNotification(null);
  };

  const markAllNotificationsRead = async () => {
    if (!user?.id || unreadCount === 0) return;
    setIsUpdatingNotification("all");
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);

    if (error) {
      toast.error("Failed to mark notifications as read.");
    } else {
      setNotifications([]);
    }
    setIsUpdatingNotification(null);
  };

  const getDefaultNotificationRoute = () => {
    if (userRole === "customer") return "/customer/shipments";
    if (userRole === "driver") return "/driver/deliveries";
    if (userRole === "agent") return "/agent/dashboard";
    if (userRole === "admin") return "/warehouse/parcels";
    if (userRole === "staff" || userRole === "branch_manager") return "/warehouse/parcels";
    return "/dashboard";
  };

  const getPortalLabel = () => {
    if (userRole === "agent") return "Agent Portal";
    if (userRole === "customer") return "Customer Portal";
    if (userRole === "driver") return "Driver Portal";
    if (userRole === "staff") return "Staff Portal";
    if (userRole === "branch_manager") return "Branch Manager Portal";
    if (userRole === "admin") return "Admin Portal";
    return "Portal";
  };

  const getQuickCreateRoute = () => {
    if (userRole === "agent") return "/agent/place-order";
    if (userRole === "customer") return "/customer/place-order";
    return "/warehouse/create-shipment";
  };

  const getProfileRoute = () => {
    if (userRole === "customer") return "/customer/profile";
    if (userRole === "agent") return "/agent/settings";
    if (userRole === "driver") return "/driver/settings";
    return "/profile";
  };

  const getSettingsRoute = () => {
    if (userRole === "customer") return "/customer/security";
    if (userRole === "agent") return "/agent/settings";
    if (userRole === "driver") return "/driver/settings";
    return "/settings/general";
  };

  const resolveNotificationRoute = (note: NotificationItem) => {
    const notificationType = (note.notification_type || "").toLowerCase().trim();
    const pathname = location.pathname;
    const isFinancePortal = pathname.startsWith("/finance");
    const isSupportPortal = pathname.startsWith("/support");

    if (notificationType.startsWith("route:")) {
      const customRoute = notificationType.replace("route:", "").trim();
      return customRoute || getDefaultNotificationRoute();
    }

    if (notificationType.includes("payment")) {
      if (isCustomer) return "/customer/payments";
      if (isAgent) return "/agent/payments";
      if (isFinancePortal) return "/finance/payments";
      return "/finance/payments";
    }

    if (notificationType.includes("claim")) {
      if (isCustomer) return "/customer/refunds";
      if (isAgent) return "/agent/refunds";
      if (isSupportPortal) return "/support/claims";
      return "/finance/claims";
    }

    if (notificationType.includes("support") || notificationType.includes("ticket")) {
      if (isDriver) return "/driver/incidents";
      if (isCustomer) return "/customer/support-tickets";
      if (isAgent) return "/agent/support";
      return "/support/tickets";
    }

    if (notificationType.includes("shipment") || notificationType.includes("parcel")) {
      if (isCustomer) return "/customer/shipments";
      if (isAgent) return "/agent/shipments";
      if (isDriver) return "/driver/deliveries";
      return getDefaultNotificationRoute();
    }

    if (note.reference_id) {
      if (isCustomer) return "/customer/shipments";
      if (isAgent) return "/agent/shipments";
      if (isDriver) return "/driver/deliveries";
      return getDefaultNotificationRoute();
    }

    return getDefaultNotificationRoute();
  };

  const openNotification = async (note: NotificationItem) => {
    const target = resolveNotificationRoute(note);
    if (!target) return;

    if (!note.is_read) {
      await toggleNotificationRead(note.id, true);
    }

    setIsNotificationsOpen(false);
    navigate(target, {
      state: note.reference_id ? { notificationReferenceId: note.reference_id } : undefined,
    });
  };

  useEffect(() => {
    if (!user?.id) {
      setNotifications([]);
      setIsLoadingNotifications(false);
      return;
    }

    void fetchNotifications(user.id);

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newNote = payload.new as NotificationItem;
            if (newNote?.title) {
              void remapNotificationsToWarehouseTracking([newNote]).then(([normalized]) => {
                toast.message(normalized.title, {
                  description: normalized.message,
                  action: {
                    label: "Open",
                    onClick: () => {
                      void openNotification(newNote);
                    },
                  },
                });
              });
            }
          }
          void fetchNotifications(user.id);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  return (
    <header className="h-16 md:h-14 bg-white border-b border-border flex items-center justify-between px-4 md:px-6 sticky top-0 z-50">
      <div className="flex items-center gap-2">
        <button
          onClick={onMenuClick}
          className="h-8 w-8 text-slate-600 hover:text-slate-900 transition-colors md:hidden flex items-center justify-center bg-transparent border-none outline-none"
        >
          <LayoutGrid className="w-6 h-6" />
        </button>

        <div className="hidden sm:flex items-center gap-1 ml-1">
          <Badge variant="outline" className="mr-1 hidden lg:inline-flex font-jakarta font-bold">
            {getPortalLabel()}
          </Badge>

          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="text-slate-600 hover:text-slate-900 transition-colors text-xs md:text-xs font-semibold font-jakarta flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-50 group border border-transparent hover:border-slate-200"
            >
              <Eye className="w-7 h-7 md:w-4 md:h-4" />
              <span className="hidden xs:inline">View Website</span>
            </Link>
          </div>

          {!isCustomer && !isDriver && (
            <div className="flex items-center">
              <Link
                to={getQuickCreateRoute()}
                className="text-primary hover:text-primary transition-colors text-sm md:text-xs font-bold font-jakarta flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/5 hover:bg-primary/10 group border border-primary/10"
              >
                <PlusCircle className="w-7 h-7 md:w-4 md:h-4" />
                {isAgent ? "Client Shipment" : "New Shipment"}
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <CurrencySwitcher />

        <DropdownMenu open={isNotificationsOpen} onOpenChange={setIsNotificationsOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative h-14 w-14 md:h-12 md:w-12 text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors active:bg-slate-100">
              <BellRing className="w-9 h-9 md:w-6 md:h-6" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 md:-top-0.5 md:-right-0.5 h-5 w-5 md:h-4 md:w-4 flex items-center justify-center text-[11px] md:text-[10px] font-bold bg-stat-red text-white rounded-full">
                  {unreadCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <div className="flex items-center justify-between px-3 py-2.5 border-b">
              <span className="text-sm font-bold font-jakarta">Notifications</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllNotificationsRead}
                disabled={unreadCount === 0 || isUpdatingNotification === "all"}
                className="h-6 px-2 text-[11px]"
              >
                Mark all read
              </Button>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {isLoadingNotifications ? (
                <div className="p-4 text-xs text-muted-foreground text-center">Loading...</div>
              ) : notifications.length === 0 ? (
                <div className="p-6 text-center">
                  <Bell className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground">No notifications</p>
                </div>
              ) : (
                notifications.map((note) => (
                  <div
                    key={note.id}
                    className={cn(
                      "flex gap-3 border-b border-border/30 px-3 py-2.5 last:border-b-0 cursor-pointer transition-colors hover:bg-muted/40",
                      !note.is_read && "bg-muted/20",
                    )}
                    onClick={() => void openNotification(note)}
                  >
                    <span
                      className={cn(
                        "mt-1.5 h-1.5 w-1.5 rounded-full shrink-0",
                        note.is_read ? "bg-muted-foreground/20" : "bg-stat-blue",
                      )}
                    />
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn("text-xs font-medium truncate", note.is_read && "text-muted-foreground")}>
                          {note.title}
                        </p>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {format(new Date(note.created_at), "PP")}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">{note.message}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-14 w-14 md:h-12 md:w-12 text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors active:bg-slate-100">
              <UserCircle className="w-9 h-9 md:w-6 md:h-6" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link to={getProfileRoute()}>Profile</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to={getSettingsRoute()}>Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              disabled={isSigningOut}
              className="text-destructive"
            >
              {isSigningOut ? "Signing Out..." : "Sign Out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="hidden xs:flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-12 md:h-12 text-slate-600 hover:text-slate-900 gap-2 text-sm font-semibold rounded-lg">
                <Globe2 className="w-8 h-8 md:w-5 md:h-5" />
                EN
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>English</DropdownMenuItem>
              <DropdownMenuItem>French</DropdownMenuItem>
              <DropdownMenuItem>Swahili</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleFullscreen}
            className="hidden sm:flex h-12 w-12 text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors active:bg-slate-100"
          >
            <Maximize2 className="w-6 h-6" />
          </Button>
        </div>
      </div>
    </header>
  );
};
