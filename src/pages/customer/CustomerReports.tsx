import { useEffect, useMemo, useState } from "react";
import { escapeHtml } from "@/lib/financePortal";
import { format } from "date-fns";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, Box, Download, Eye, FileText, Package, Ship, Weight } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { CustomerProfileGate } from "@/components/customer/CustomerProfileGate";
import { useCustomerRecord } from "@/hooks/useCustomerRecord";
import { useDefaultCurrency } from "@/hooks/useDefaultCurrency";
import { extractNoteValue, getProductType, getShipmentCbmValue, getWarehouseTrackingNumber, resolveTrackingByStatus } from "@/lib/shipmentNotes";

type ShipmentRow = {
  id: string;
  code: string;
  status: string;
  total_cost: number;
  shipping_cost: number;
  weight: number;
  cbm: number | null;
  service_type: string;
  created_at: string;
  pickup_date: string | null;
  estimated_delivery_date: string | null;
  actual_delivery_date: string | null;
  custom_tracking_number: string | null;
  notes: string | null;
  description: string | null;
};

type ServiceKey = "air" | "sea";

type ServiceSummaryRow = {
  name: string;
  value: number;
  suffix: string;
};

type MonthlySummaryRow = {
  month: string;
  month_key: string;
  air: number;
  sea: number;
};

const SERVICE_COLORS: Record<ServiceKey, string> = {
  air: "hsl(217, 91%, 60%)",
  sea: "hsl(142, 71%, 45%)",
};

const STATUS_LABELS: Record<string, string> = {
  saved_pickup: "Created",
  saved_dropoff: "Incoming",
  received: "Need Action",
  requested_pickup: "Submitted",
  approved: "Confirm Shipment",
  assigned: "Outgoing",
  supplied: "In Transit",
  delivered: "Ready",
  closed: "Collected",
};

const getServiceKey = (value: string): ServiceKey | null => {
  const normalized = (value || "").toLowerCase();
  if (normalized.includes("air")) return "air";
  if (normalized.includes("sea")) return "sea";
  return null;
};

const formatServiceLabel = (value: string) => {
  const serviceKey = getServiceKey(value);
  if (serviceKey === "air") return "Air";
  if (serviceKey === "sea") return "Sea";
  return "-";
};

const formatDateValue = (value: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : format(date, "PP");
};

const formatStatus = (value: string) => STATUS_LABELS[value] || value || "-";

const getOutgoingAwareTrackingNumber = (
  status: string,
  notes: string | null,
  customTrackingNumber: string | null,
) => resolveTrackingByStatus(status, notes, customTrackingNumber) || "Tracking pending";

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const { name, value, payload: row } = payload[0];
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2 text-sm shadow-lg">
      <p className="font-medium text-foreground">{name}</p>
      <p className="text-muted-foreground">
        {value} {row?.suffix || "shipments"}
      </p>
    </div>
  );
};

const CustomerReports = () => {
  const { customer } = useCustomerRecord();
  const { formatAmount } = useDefaultCurrency();
  const [shipments, setShipments] = useState<ShipmentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedShipment, setSelectedShipment] = useState<ShipmentRow | null>(null);

  useEffect(() => {
    const fetchShipments = async () => {
      if (!customer) {
        setShipments([]);
        setIsLoading(false);
        return;
      }

      const { data } = await supabase
        .from("shipments")
        .select(
          "id, code, status, total_cost, shipping_cost, weight, cbm, service_type, created_at, pickup_date, estimated_delivery_date, actual_delivery_date, custom_tracking_number, notes, description"
        )
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: false });

      setShipments((data || []) as ShipmentRow[]);
      setIsLoading(false);
    };

    fetchShipments();
  }, [customer]);

  const stats = useMemo(() => {
    const totals = shipments.reduce(
      (acc, shipment) => {
        const serviceKey = getServiceKey(shipment.service_type);
        if (serviceKey === "air") acc.air += 1;
        if (serviceKey === "sea") acc.sea += 1;
        acc.total += 1;
        acc.shippingFee += shipment.shipping_cost || shipment.total_cost || 0;
        acc.weight += shipment.weight || 0;
        acc.cbm += shipment.cbm || 0;
        return acc;
      },
      { total: 0, air: 0, sea: 0, shippingFee: 0, weight: 0, cbm: 0 }
    );

    return totals;
  }, [shipments]);

  const serviceChartData = useMemo<ServiceSummaryRow[]>(() => {
    const rows: ServiceSummaryRow[] = [
      { name: "Air", value: stats.air, suffix: "shipments" },
      { name: "Sea", value: stats.sea, suffix: "shipments" },
    ];
    return rows.filter((row) => row.value > 0);
  }, [stats.air, stats.sea]);

  const spendByServiceData = useMemo<ServiceSummaryRow[]>(() => {
    const totals: Record<ServiceKey, number> = { air: 0, sea: 0 };

    shipments.forEach((shipment) => {
      const serviceKey = getServiceKey(shipment.service_type);
      if (!serviceKey) return;
      totals[serviceKey] += shipment.shipping_cost || shipment.total_cost || 0;
    });

    return [
      { name: "Air", value: Math.round(totals.air * 100) / 100, suffix: "value" },
      { name: "Sea", value: Math.round(totals.sea * 100) / 100, suffix: "value" },
    ].filter((row) => row.value > 0);
  }, [shipments]);

  const monthlySummary = useMemo<MonthlySummaryRow[]>(() => {
    const monthMap = new Map<string, MonthlySummaryRow>();

    shipments.forEach((shipment) => {
      const serviceKey = getServiceKey(shipment.service_type);
      if (!serviceKey) return;

      const sourceDate = shipment.pickup_date || shipment.created_at;
      const monthKey = format(new Date(sourceDate), "yyyy-MM");
      const current =
        monthMap.get(monthKey) ||
        {
          month: format(new Date(sourceDate), "MMM yyyy"),
          month_key: monthKey,
          air: 0,
          sea: 0,
        };

      current[serviceKey] += 1;
      monthMap.set(monthKey, current);
    });

    return Array.from(monthMap.values())
      .sort((a, b) => a.month_key.localeCompare(b.month_key))
      .slice(-6);
  }, [shipments]);

  const historyRows = useMemo(
    () =>
      shipments.map((shipment) => ({
        id: shipment.id,
        trackingNumber: getOutgoingAwareTrackingNumber(
          shipment.status,
          shipment.notes,
          shipment.custom_tracking_number,
        ),
        serviceType: formatServiceLabel(shipment.service_type),
        productType: getProductType(shipment.notes, shipment.description),
        weight: shipment.weight || 0,
        cbm: getShipmentCbmValue(shipment) || 0,
        shippingFee: shipment.shipping_cost || 0,
        departureDate: shipment.pickup_date || shipment.created_at,
        status: formatStatus(shipment.status),
        arrivalDate: shipment.actual_delivery_date || shipment.estimated_delivery_date,
        shipment,
      })),
    [shipments]
  );

  const downloadCsv = () => {
    const headers = [
      "Tracking No.",
      "Service Type",
      "Product Type",
      "Weight",
      "CBM",
      "Shipping Fee",
      "Departure Date",
      "Status",
      "Arrival Date",
    ];
    const rows = historyRows.map((row) => [
      row.trackingNumber,
      row.serviceType,
      row.productType,
      row.weight.toFixed(2),
      row.cbm.toFixed(4),
      row.shippingFee.toFixed(2),
      formatDateValue(row.departureDate),
      row.status,
      formatDateValue(row.arrivalDate),
    ]);
    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "shipment-history.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadPdf = () => {
    const safe = (v: string | null | undefined) => escapeHtml(v ?? "");
    const html = `
      <html>
        <head>
          <title>Shipment History Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; }
            th { background: #f9fafb; }
          </style>
        </head>
        <body>
          <h2>Shipment History Report</h2>
          <p>Total Shipments: ${stats.total}</p>
          <table>
            <thead>
              <tr>
                <th>Tracking No.</th>
                <th>Service Type</th>
                <th>Product Type</th>
                <th>Weight</th>
                <th>CBM</th>
                <th>Shipping Fee</th>
                <th>Departure Date</th>
                <th>Status</th>
                <th>Arrival Date</th>
              </tr>
            </thead>
            <tbody>
              ${historyRows
                .map(
                  (row) => `
                    <tr>
                      <td>${safe(row.trackingNumber)}</td>
                      <td>${safe(row.serviceType)}</td>
                      <td>${safe(row.productType)}</td>
                      <td>${row.weight.toFixed(2)}</td>
                      <td>${row.cbm.toFixed(4)}</td>
                      <td>${formatAmount(row.shippingFee)}</td>
                      <td>${formatDateValue(row.departureDate)}</td>
                      <td>${safe(row.status)}</td>
                      <td>${formatDateValue(row.arrivalDate)}</td>
                    </tr>
                  `
                )
                .join("")}
            </tbody>
          </table>
        </body>
      </html>`;

    const popup = window.open("", "_blank");
    if (!popup) return;
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    popup.print();
  };

  const statCards = [
    { label: "Total Shipments", value: stats.total, icon: Package, tone: "text-primary" },
    { label: "Air Shipments", value: stats.air, icon: BarChart3, tone: "text-blue-600" },
    { label: "Sea Shipments", value: stats.sea, icon: Ship, tone: "text-emerald-600" },
    {
      label: "Shipping Fees",
      value: formatAmount(stats.shippingFee),
      icon: FileText,
      tone: "text-amber-600",
    },
    { label: "Total Weight", value: `${stats.weight.toFixed(1)} kg`, icon: Weight, tone: "text-sky-600" },
    { label: "Total CBM", value: stats.cbm.toFixed(2), icon: Box, tone: "text-rose-600" },
  ];

  return (
    <CustomerProfileGate>
      <div className="space-y-6">
        <PageHeader title="Reports"  />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <Card key={card.label} className="border-border/50">
                <CardContent className="flex flex-col items-start gap-1 p-4">
                  <div className="flex items-center gap-2">
                    <div className={`rounded-lg bg-muted p-1.5 ${card.tone}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-xs text-muted-foreground">{card.label}</span>
                  </div>
                  <p className="text-2xl font-bold tracking-tight">{isLoading ? "..." : card.value}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Service Type</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              {serviceChartData.length === 0 ? (
                <p className="py-8 text-sm text-muted-foreground">No service data available.</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={serviceChartData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={92} paddingAngle={3}>
                      {serviceChartData.map((row) => (
                        <Cell key={row.name} fill={row.name === "Air" ? SERVICE_COLORS.air : SERVICE_COLORS.sea} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Spend by Service</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              {spendByServiceData.length === 0 ? (
                <p className="py-8 text-sm text-muted-foreground">No spend data available.</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={spendByServiceData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={92} paddingAngle={3}>
                      {spendByServiceData.map((row) => (
                        <Cell key={row.name} fill={row.name === "Air" ? SERVICE_COLORS.air : SERVICE_COLORS.sea} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Monthly Summary</CardTitle>
          </CardHeader>
          <CardContent>
            {monthlySummary.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No monthly shipment data available.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={monthlySummary} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "0.5rem",
                      fontSize: "0.875rem",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="air" name="Air" fill={SERVICE_COLORS.air} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="sea" name="Sea" fill={SERVICE_COLORS.sea} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">Shipment History</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={downloadCsv}>
                <Download className="mr-2 h-4 w-4" />
                CSV
              </Button>
              <Button variant="outline" size="sm" onClick={downloadPdf}>
                <FileText className="mr-2 h-4 w-4" />
                PDF
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Loading report...</p>
            ) : historyRows.length === 0 ? (
              <p className="text-muted-foreground">No shipment history available.</p>
            ) : (
              <div className="-mx-4 overflow-x-auto sm:mx-0">
                <table className="min-w-[1040px] w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-3 text-left font-medium">Tracking No.</th>
                      <th className="p-3 text-left font-medium">Service Type</th>
                      <th className="p-3 text-left font-medium">Product Type</th>
                      <th className="p-3 text-left font-medium">Weight</th>
                      <th className="p-3 text-left font-medium">CBM</th>
                      <th className="p-3 text-left font-medium">Shipping Fee</th>
                      <th className="p-3 text-left font-medium">Departure Date</th>
                      <th className="p-3 text-left font-medium">Status</th>
                      <th className="p-3 text-left font-medium">Arrival Date</th>
                      <th className="p-3 text-left font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyRows.map((row) => (
                      <tr key={row.id} className="border-b transition-colors hover:bg-muted/30">
                        <td className="p-3 font-mono text-xs">{row.trackingNumber}</td>
                        <td className="p-3">{row.serviceType}</td>
                        <td className="p-3">{row.productType}</td>
                        <td className="p-3">{row.weight.toFixed(2)} kg</td>
                        <td className="p-3">{row.cbm.toFixed(4)}</td>
                        <td className="p-3">
                          {formatAmount(row.shippingFee)}
                        </td>
                        <td className="p-3">{formatDateValue(row.departureDate)}</td>
                        <td className="p-3">{row.status}</td>
                        <td className="p-3">{formatDateValue(row.arrivalDate)}</td>
                        <td className="p-3">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => setSelectedShipment(row.shipment)}
                            title="View details"
                          >
                            <Eye className="h-4 w-4 text-blue-600" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!selectedShipment} onOpenChange={(open) => !open && setSelectedShipment(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Shipment Details</DialogTitle>
              
            </DialogHeader>
            {selectedShipment ? (
              <div className="space-y-3 text-sm">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Tracking No.</p>
                    <p className="font-medium">
                      {getOutgoingAwareTrackingNumber(
                        selectedShipment.status,
                        selectedShipment.notes,
                        selectedShipment.custom_tracking_number,
                      )}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Status</p>
                    <p className="font-medium">{formatStatus(selectedShipment.status)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Service Type</p>
                    <p className="font-medium">{formatServiceLabel(selectedShipment.service_type)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Product Type</p>
                    <p className="font-medium">{getProductType(selectedShipment.notes, selectedShipment.description)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Weight</p>
                    <p className="font-medium">{(selectedShipment.weight || 0).toFixed(2)} kg</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">CBM</p>
                    <p className="font-medium">{(selectedShipment.cbm || 0).toFixed(4)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Item Value</p>
                    <p className="font-medium">{formatAmount(selectedShipment.total_cost || 0)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Shipping Fee</p>
                    <p className="font-medium">{formatAmount(selectedShipment.shipping_cost || 0)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Departure Date</p>
                    <p className="font-medium">{formatDateValue(selectedShipment.pickup_date || selectedShipment.created_at)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Arrival Date</p>
                    <p className="font-medium">{formatDateValue(selectedShipment.actual_delivery_date || selectedShipment.estimated_delivery_date)}</p>
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Description</p>
                  <p className="font-medium">{selectedShipment.description || "Shipment"}</p>
                </div>
                {selectedShipment.notes ? (
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Notes</p>
                    <p className="whitespace-pre-wrap text-muted-foreground">{selectedShipment.notes}</p>
                  </div>
                ) : null}
              </div>
            ) : null}
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedShipment(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </CustomerProfileGate>
  );
};

export default CustomerReports;

