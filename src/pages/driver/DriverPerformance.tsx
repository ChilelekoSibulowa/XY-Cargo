import { useEffect, useMemo, useState } from "react";
import { format, subDays } from "date-fns";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, Column } from "@/components/shared/DataTable";
import { toast } from "sonner";
import {
  DriverDelivery,
  fetchDriverDeliveries,
  getCurrentDriverContext,
  isFailedDelivery,
  isSuccessfulDelivery,
} from "@/lib/driverPortal";

type WeeklyRow = {
  id: string;
  day: string;
  successful: number;
  failed: number;
  total: number;
};

const formatPercent = (value: number) => `${value.toFixed(1)}%`;

const DriverPerformance = () => {
  const [deliveries, setDeliveries] = useState<DriverDelivery[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadPerformance = async () => {
      try {
        const { driver } = await getCurrentDriverContext();
        if (!driver?.id) {
          setDeliveries([]);
          setIsLoading(false);
          return;
        }

        const rows = await fetchDriverDeliveries(driver.id, 300);
        setDeliveries(rows);
      } catch (error: any) {
        toast.error(error?.message || "Failed to load performance data.");
        setDeliveries([]);
      } finally {
        setIsLoading(false);
      }
    };

    void loadPerformance();
  }, []);

  const successfulDeliveries = useMemo(
    () => deliveries.filter((delivery) => isSuccessfulDelivery(delivery.status)),
    [deliveries],
  );
  const failedDeliveries = useMemo(
    () => deliveries.filter((delivery) => isFailedDelivery(delivery.status)),
    [deliveries],
  );

  const totalMeasured = successfulDeliveries.length + failedDeliveries.length;
  const deliverySuccessRate = totalMeasured === 0 ? 0 : (successfulDeliveries.length / totalMeasured) * 100;
  const failedDeliveryRate = totalMeasured === 0 ? 0 : (failedDeliveries.length / totalMeasured) * 100;

  const timedDeliveries = useMemo(
    () =>
      successfulDeliveries.filter(
        (delivery) => !!delivery.delivery_request_completed_at && !!delivery.estimated_delivery_date,
      ),
    [successfulDeliveries],
  );

  const onTimeCount = timedDeliveries.filter((delivery) => {
    const actual = new Date(delivery.delivery_request_completed_at || "");
    const estimated = new Date(delivery.estimated_delivery_date || "");
    return actual.getTime() <= estimated.getTime();
  }).length;

  const lateCount = Math.max(timedDeliveries.length - onTimeCount, 0);
  const onTimeRate = timedDeliveries.length === 0 ? 0 : (onTimeCount / timedDeliveries.length) * 100;
  const lateRate = timedDeliveries.length === 0 ? 0 : (lateCount / timedDeliveries.length) * 100;

  const weeklyRows = useMemo<WeeklyRow[]>(() => {
    return Array.from({ length: 7 }).map((_, index) => {
      const day = subDays(new Date(), 6 - index);
      const key = format(day, "yyyy-MM-dd");
      const sameDay = (value: string | null | undefined) =>
        value ? format(new Date(value), "yyyy-MM-dd") === key : false;
      const successful = successfulDeliveries.filter((delivery) =>
        sameDay(delivery.delivery_request_completed_at || delivery.updated_at),
      ).length;
      const failed = failedDeliveries.filter((delivery) =>
        sameDay(delivery.updated_at || delivery.created_at),
      ).length;

      return {
        id: key,
        day: format(day, "EEE, dd MMM"),
        successful,
        failed,
        total: successful + failed,
      };
    });
  }, [failedDeliveries, successfulDeliveries]);

  const weeklyColumns: Column<WeeklyRow>[] = [
    { key: "day", label: "Day" },
    { key: "successful", label: "Successful" },
    { key: "failed", label: "Failed" },
    { key: "total", label: "Total" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Performance"
        
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-border/70">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Delivery Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{isLoading ? "..." : formatPercent(deliverySuccessRate)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Successful vs failed deliveries</p>
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Failed Delivery Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{isLoading ? "..." : formatPercent(failedDeliveryRate)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Returned and failed drop-offs</p>
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">On-Time Delivery %</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{isLoading ? "..." : formatPercent(onTimeRate)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Completed against ETA</p>
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Late Delivery %</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{isLoading ? "..." : formatPercent(lateRate)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Measured completed deliveries only</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>Weekly Performance Report</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={weeklyColumns}
            data={weeklyRows}
            isLoading={isLoading}
            searchable={false}
            enablePagination={false}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default DriverPerformance;

