import { useEffect, useMemo, useState } from "react";
import { useDefaultCurrency } from "@/hooks/useDefaultCurrency";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Clock, DollarSign, Package, TrendingUp } from "lucide-react";
import { formatCurrencyDisplay, roundCurrencyAmount } from "@/lib/currencyDisplay";

type ManualCustomsRecord = {
  id: string;
  awb_bl_number: string;
  service_type: string;
  status: "pending_customs" | "customs_cleared" | "flagged";
  compliance_notes: string | null;
  created_at: string;
};

type ChargeRow = {
  id: string;
  charge_type: string;
  amount: number;
  currency: string;
  created_at: string;
};

const formatChargeSummary = (
  charges: ChargeRow[],
  chargeType: string,
  convert: (amount: number, fromCode?: string) => number,
  currencyCode: string,
  currencySymbol: string,
) => {
  const aliases =
    chargeType === "custom_duty"
      ? new Set(["custom_duty", "customs_duty", "duty"])
      : new Set([chargeType]);
  const filtered = charges.filter((charge) => aliases.has((charge.charge_type || "").toLowerCase()));
  const total = filtered.reduce(
    (sum, charge) => sum + roundCurrencyAmount(convert(Number(charge.amount || 0), charge.currency)),
    0,
  );
  return formatCurrencyDisplay(total, currencyCode, currencySymbol);
};

const isWithinDateFilter = (value: string, fromDate: string, toDate: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  if (fromDate) {
    const start = new Date(`${fromDate}T00:00:00`);
    if (date < start) return false;
  }

  if (toDate) {
    const end = new Date(`${toDate}T23:59:59.999`);
    if (date > end) return false;
  }

  return true;
};

const getStatusClasses = (status: ManualCustomsRecord["status"]) => {
  if (status === "customs_cleared") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "flagged") return "border-red-200 bg-red-50 text-red-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
};

const ComplianceDashboard = () => {
  const [manualRecords, setManualRecords] = useState<ManualCustomsRecord[]>([]);
  const [charges, setCharges] = useState<ChargeRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    const fetchData = async (showLoading = true) => {
      if (showLoading) setIsLoading(true);

      const [customsRes, chargesRes] = await Promise.all([
        supabase
          .from("manual_customs_records")
          .select("id, awb_bl_number, service_type, status, compliance_notes, created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("compliance_charges")
          .select("id, charge_type, amount, currency, created_at")
          .order("created_at", { ascending: false }),
      ]);

      if (customsRes.error) {
        toast.error("Failed to load manual customs records.");
        setManualRecords([]);
      } else {
        setManualRecords((customsRes.data || []) as ManualCustomsRecord[]);
      }

      if (chargesRes.error) {
        toast.error("Failed to load compliance charges.");
        setCharges([]);
      } else {
        setCharges((chargesRes.data || []) as ChargeRow[]);
      }

      if (showLoading) setIsLoading(false);
    };

    void fetchData(true);

    const customsChannel = supabase
      .channel("compliance-dashboard-customs")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "manual_customs_records" },
        () => void fetchData(false),
      )
      .subscribe();

    const chargesChannel = supabase
      .channel("compliance-dashboard-charges")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "compliance_charges" },
        () => void fetchData(false),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(customsChannel);
      supabase.removeChannel(chargesChannel);
    };
  }, []);

  const filteredManualRecords = useMemo(
    () => manualRecords.filter((record) => isWithinDateFilter(record.created_at, fromDate, toDate)),
    [manualRecords, fromDate, toDate],
  );

  const filteredCharges = useMemo(
    () => charges.filter((charge) => isWithinDateFilter(charge.created_at, fromDate, toDate)),
    [charges, fromDate, toDate],
  );

  const latestUpdates = useMemo(() => {
    return [...filteredManualRecords]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 8);
  }, [filteredManualRecords]);

  const pendingCustoms = filteredManualRecords.filter((record) => record.status === "pending_customs").length;
  const customsCleared = filteredManualRecords.filter((record) => record.status === "customs_cleared").length;
  const flaggedParcels = filteredManualRecords.filter((record) => record.status === "flagged").length;
  const totalShipments = filteredManualRecords.length;
  const { convert, code: selectedCurrency, symbol: selectedCurrencySymbol } = useDefaultCurrency();
  const dutyCharges = formatChargeSummary(filteredCharges, "custom_duty", convert, selectedCurrency, selectedCurrencySymbol);
  const miscCharges = formatChargeSummary(filteredCharges, "miscellaneous", convert, selectedCurrency, selectedCurrencySymbol);

  const stats = [
    {
      title: "Pending Customs",
      value: isLoading ? "..." : pendingCustoms,
      icon: Clock,
      color: "text-amber-500",
      bg: "bg-amber-50 dark:bg-amber-950/30",
    },
    {
      title: "Customs Cleared",
      value: isLoading ? "..." : customsCleared,
      icon: CheckCircle2,
      color: "text-emerald-500",
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
    },
    {
      title: "Flagged Parcels",
      value: isLoading ? "..." : flaggedParcels,
      icon: AlertTriangle,
      color: "text-red-500",
      bg: "bg-red-50 dark:bg-red-950/30",
    },
    {
      title: "Duty Charges",
      value: isLoading ? "..." : dutyCharges,
      icon: DollarSign,
      color: "text-blue-500",
      bg: "bg-blue-50 dark:bg-blue-950/30",
    },
    {
      title: "Misc. Charges",
      value: isLoading ? "..." : miscCharges,
      icon: TrendingUp,
      color: "text-orange-500",
      bg: "bg-orange-50 dark:bg-orange-950/30",
    },
    {
      title: "Total Shipments",
      value: isLoading ? "..." : totalShipments,
      icon: Package,
      color: "text-slate-500",
      bg: "bg-slate-50 dark:bg-slate-950/30",
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Compliance Dashboard"
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Date Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <div className="space-y-2">
              <Label htmlFor="compliance-from-date">From</Label>
              <Input
                id="compliance-from-date"
                type="date"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="compliance-to-date">To</Label>
              <Input
                id="compliance-to-date"
                type="date"
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
              />
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setFromDate("");
                setToDate("");
              }}
            >
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map(({ title, value, icon: Icon, color, bg }) => (
          <Card key={title}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{title}</p>
                  <p className={`mt-1 text-2xl font-bold leading-tight ${color}`}>{value}</p>
                </div>
                <div className={`rounded-lg p-2.5 ${bg}`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-1">
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle className="text-base">Latest Customs Updates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : latestUpdates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No customs records available.</p>
            ) : (
              latestUpdates.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between border-b border-border/60 pb-3 last:border-b-0 last:pb-0"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm text-foreground">({item.awb_bl_number})</p>
                      <Badge variant="outline" className="text-xs capitalize">
                        {item.service_type}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(item.created_at), "PPp")}
                      {item.compliance_notes ? ` • ${item.compliance_notes}` : " • No compliance notes"}
                    </p>
                  </div>
                  <Badge className={`whitespace-nowrap text-xs capitalize ml-2 ${getStatusClasses(item.status)}`}>
                    {item.status.replace(/_/g, " ")}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ComplianceDashboard;
