import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Bell, Fuel, PackageCheck, Ship, Wallet, BarChart3, Shield, Package, UserCheck } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  DriverDelivery,
  DriverProfile,
  fetchDriverDeliveries,
  fetchDriverNotifications,
  formatDriverStatus,
  formatDriverServiceType,
  getCurrentDriverContext,
  isAssignedDelivery,
  isCurrentMonth,
  isSuccessfulDelivery,
  isToday,
} from "@/lib/driverPortal";

type NotificationRow = {
  id: string;
  title: string;
  message: string;
  created_at: string;
};

const DriverDashboard = () => {
  const [driver, setDriver] = useState<DriverProfile | null>(null);
  const [deliveries, setDeliveries] = useState<DriverDelivery[]>([]);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [weeklyFuelConsumption, setWeeklyFuelConsumption] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    try {
      const { user, driver: driverProfile } = await getCurrentDriverContext();

      if (!user?.id || !driverProfile?.id) {
        setDriver(null);
        setDeliveries([]);
        setNotifications([]);
        setIsLoading(false);
        return;
      }

      const [deliveriesData, notificationsData] = await Promise.all([
        fetchDriverDeliveries(driverProfile.id, 120),
        fetchDriverNotifications(user.id, 6),
      ]);

      setDriver(driverProfile);
      setDeliveries(deliveriesData);
      setNotifications(notificationsData);
      setWeeklyFuelConsumption(
        Number(user.user_metadata?.driver_weekly_fuel_consumption || 0) || 0,
      );
    } catch (error: any) {
      toast.error(error?.message || "Failed to load driver dashboard.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();

    let channel: any;
    const setupSubscription = async () => {
      const { driver: driverProfile } = await getCurrentDriverContext();
      if (!driverProfile?.id) return;

      channel = supabase
        .channel(`driver-dashboard-${driverProfile.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "shipments",
            filter: `delivery_request_assigned_driver_id=eq.${driverProfile.id}`,
          },
          () => {
            void loadDashboard();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "consolidations",
            filter: `delivery_request_assigned_driver_id=eq.${driverProfile.id}`,
          },
          () => {
            void loadDashboard();
          }
        )
        .subscribe();
    };

    void setupSubscription();

    return () => {
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [loadDashboard]);

  const todayDeliveries = useMemo(
    () =>
      deliveries.filter((delivery) =>
        isToday(
          delivery.delivery_request_assigned_at ||
            delivery.delivery_request_requested_at ||
            delivery.updated_at ||
            delivery.created_at,
        ),
      ),
    [deliveries],
  );

  const monthlyCompleted = useMemo(
    () =>
      deliveries.filter(
        (delivery) =>
          isSuccessfulDelivery(delivery.status) &&
          isCurrentMonth(delivery.delivery_request_completed_at || delivery.updated_at),
      ),
    [deliveries],
  );

  const assignedVehicle = useMemo(() => {
    if (!driver) return "Unassigned";
    const parts = [driver.vehicle_type, driver.vehicle_plate].filter(Boolean);
    return parts.length > 0 ? parts.join(" - ") : "Unassigned";
  }, [driver]);

  const activeAssignments = useMemo(
    () => deliveries.filter((delivery) => isAssignedDelivery(delivery.status)).length,
    [deliveries],
  );

  const recentDeliveries = deliveries.slice(0, 5);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Driver Dashboard"
        actions={
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
            <Badge className="h-9 px-3 justify-center bg-blue-600 text-white hover:bg-blue-700 shadow-sm border-0 font-bold transition-all">
              ID: {driver?.code || (driver?.id ? "DRIVER-" + driver.id.slice(0, 8).toUpperCase() : "---")}
            </Badge>
            <Button asChild size="sm" className="h-9 bg-slate-900 text-white hover:bg-slate-800 shadow-sm font-bold transition-all">
              <Link to="/driver/deliveries" className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Deliveries
              </Link>
            </Button>
            <Button asChild size="sm" className="h-9 bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm font-bold transition-all">
              <Link to="/driver/performance" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Performance
              </Link>
            </Button>
            <Button asChild size="sm" className="h-9 bg-orange-500 text-white hover:bg-orange-600 shadow-sm font-bold transition-all">
              <Link to="/driver/incidents" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Support
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="border-border/70">
          <CardHeader className="pb-3">
            <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium leading-tight [overflow-wrap:anywhere]">
              <PackageCheck className="h-4 w-4 text-stat-blue" />
              Today&apos;s Deliveries
            </CardTitle>
          </CardHeader>
          <CardContent className="min-w-0">
            <p className="text-[clamp(1.125rem,1.6vw,1.5rem)] leading-tight font-semibold [overflow-wrap:anywhere]">{isLoading ? "..." : todayDeliveries.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">Tasks dated for today</p>
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader className="pb-3">
            <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium leading-tight [overflow-wrap:anywhere]">
              <Ship className="h-4 w-4 text-emerald-600" />
              Assigned Vehicle
            </CardTitle>
          </CardHeader>
          <CardContent className="min-w-0">
            <p className="text-base leading-tight font-semibold [overflow-wrap:anywhere]">{isLoading ? "..." : assignedVehicle}</p>
            <p className="mt-1 text-xs text-muted-foreground">Current vehicle allocation</p>
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader className="pb-3">
            <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium leading-tight [overflow-wrap:anywhere]">
              <Fuel className="h-4 w-4 text-amber-600" />
              Weekly Fuel Consumption
            </CardTitle>
          </CardHeader>
          <CardContent className="min-w-0">
            <p className="text-[clamp(1.125rem,1.6vw,1.5rem)] leading-tight font-semibold [overflow-wrap:anywhere]">{isLoading ? "..." : `${weeklyFuelConsumption.toFixed(1)} L`}</p>
            <p className="mt-1 text-xs text-muted-foreground">Stored in driver settings</p>
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader className="pb-3">
            <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium leading-tight [overflow-wrap:anywhere]">
              <PackageCheck className="h-4 w-4 text-violet-600" />
              Completed This Month
            </CardTitle>
          </CardHeader>
          <CardContent className="min-w-0">
            <p className="text-[clamp(1.125rem,1.6vw,1.5rem)] leading-tight font-semibold [overflow-wrap:anywhere]">{isLoading ? "..." : monthlyCompleted.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">Successful monthly deliveries</p>
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader className="pb-3">
            <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium leading-tight [overflow-wrap:anywhere]">
              <Wallet className="h-4 w-4 text-rose-600" />
              Active Assignments
            </CardTitle>
          </CardHeader>
          <CardContent className="min-w-0">
            <p className="text-[clamp(1.125rem,1.6vw,1.5rem)] leading-tight font-semibold [overflow-wrap:anywhere]">{isLoading ? "..." : activeAssignments}</p>
            <p className="mt-1 text-xs text-muted-foreground">Assigned and in-transit deliveries</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>Recent Delivery Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading deliveries...</p>
            ) : recentDeliveries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No deliveries assigned yet.</p>
            ) : (
              <>
                {recentDeliveries.map((delivery) => (
                  <div
                    key={delivery.id}
                    className="flex flex-col gap-3 rounded-xl border border-border/70 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{delivery.custom_tracking_number || "-"}</p>
                        <Badge variant="outline" className="text-xs">
                          {delivery.customer?.code || "Client"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {delivery.customer?.full_name || "Client"} -{" "}
                        {formatDriverServiceType(delivery.service_type)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {delivery.receiver?.full_name || "Receiver"} -{" "}
                        {delivery.receiver?.phone || "No phone"}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2 sm:items-center sm:justify-end">
                      <StatusBadge status={delivery.status} />
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(delivery.updated_at || delivery.created_at), "MMM d, yyyy HH:mm")}
                      </span>
                    </div>
                  </div>
                ))}
                {/* Notifications section */}
                {notifications.map((note) => (
                  <div key={note.id} className="rounded-xl border border-border/70 p-3">
                    <div className="flex items-start gap-2">
                      <Bell className="mt-0.5 h-4 w-4 text-stat-blue" />
                      <div className="space-y-1">
                        <p className="text-sm font-semibold">{note.title}</p>
                        <p className="text-xs leading-5 text-muted-foreground">{note.message}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {format(new Date(note.created_at), "PP p")}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DriverDashboard;
