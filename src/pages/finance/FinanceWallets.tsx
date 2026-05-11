import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { DateRangeFilter } from "@/components/shared/DateRangeFilter";
import { DataTable, Column } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, CheckCircle2, AlertCircle, ShieldCheck } from "lucide-react";
import { useDefaultCurrency } from "@/hooks/useDefaultCurrency";
import {
  type FinanceDateFilter,
  downloadCsv,
  getFinanceDateRange,
  getShipmentOutstandingBalance,
  isWithinFinanceDateRange,
  openPrintWindow,
  toNumber,
} from "@/lib/financePortal";
import { fetchLogo } from "@/hooks/useLogo";
import { toast } from "sonner";

type Row = {
  id: string;
  code: string;
  full_name: string;
  phone: string;
  email: string | null;
  wallet_balance: number | null;
  is_active: boolean | null;
  outstanding_due: number;
  coverage: number;
  created_at: string;
};

type ShipmentRow = {
  customer_id: string;
  total_cost: number;
  shipping_cost: number | null;
  paid_amount: number | null;
  payment_status: string | null;
  status: string;
  created_at: string;
};

const FinanceWallets = () => {
  const { formatAmount } = useDefaultCurrency();
  const [rows, setRows] = useState<Row[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<FinanceDateFilter>("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  const dateRange = useMemo(
    () => getFinanceDateRange(dateFilter, { startDate: customStartDate, endDate: customEndDate }),
    [customEndDate, customStartDate, dateFilter],
  );

  useEffect(() => {
    const fetch = async () => {
      const [customersRes, shipmentsRes] = await Promise.all([
        supabase
          .from("customers")
          .select("id, code, full_name, phone, email, wallet_balance, is_active, created_at")
          .order("full_name"),
        supabase
          .from("shipments")
          .select("customer_id, total_cost, shipping_cost, paid_amount, payment_status, status, created_at"),
      ]);

      if (customersRes.error || shipmentsRes.error) {
        toast.error("Failed to load client wallets.");
        setRows([]);
      } else {
        const shipmentRows = ((shipmentsRes.data || []) as ShipmentRow[])
          .filter((shipment) => isWithinFinanceDateRange(shipment.created_at, dateRange))
          .map((shipment) => ({
            ...shipment,
            total_cost: toNumber(shipment.total_cost),
            shipping_cost: shipment.shipping_cost === null ? null : toNumber(shipment.shipping_cost),
            paid_amount: shipment.paid_amount === null ? null : toNumber(shipment.paid_amount),
          }));
        const customerRows = ((customersRes.data as Omit<Row, "outstanding_due" | "coverage">[] | null) || []).map((row) => {
          const outstandingDue = shipmentRows
            .filter((shipment) => shipment.customer_id === row.id)
            .filter((shipment) => ["delivered", "closed"].includes(shipment.status))
            .reduce((sum, shipment) => sum + getShipmentOutstandingBalance(shipment), 0);
          const walletBalance = row.wallet_balance === null ? null : toNumber(row.wallet_balance);
          return {
            ...row,
            wallet_balance: walletBalance,
            outstanding_due: outstandingDue,
            coverage: Math.max((walletBalance || 0) - outstandingDue, 0),
          };
        });

        setRows(customerRows);
      }
      setIsLoading(false);
    };
    fetch();
  }, [dateRange]);

  const totalBalance = useMemo(
    () => rows.reduce((sum, row) => sum + (row.wallet_balance || 0), 0),
    [rows],
  );
  const zeroBalanceCount = useMemo(
    () => rows.filter((row) => !row.wallet_balance || row.wallet_balance <= 0).length,
    [rows],
  );
  const activeWallets = useMemo(
    () => rows.filter((row) => row.is_active).length,
    [rows],
  );
  const walletCoverageCount = useMemo(
    () => rows.filter((row) => (row.wallet_balance || 0) >= row.outstanding_due && row.outstanding_due > 0).length,
    [rows],
  );

  const exportWallets = () => {
    downloadCsv(
      "finance-wallets.csv",
      ["Customer ID", "Name", "Phone", "Email", "Wallet Balance", "Outstanding Due", "Coverage", "Status"],
      rows.map((row) => [
        row.code,
        row.full_name,
        row.phone,
        row.email || "",
        (row.wallet_balance || 0).toFixed(2),
        row.outstanding_due.toFixed(2),
        row.coverage.toFixed(2),
        row.is_active ? "Active" : "Inactive",
      ]),
    );
  };

  const printWalletSummary = async () => {
    const rowsHtml = rows.map((row) => `
      <tr>
        <td>${row.code}</td>
        <td>${row.full_name}</td>
        <td>${formatAmount(row.wallet_balance || 0)}</td>
        <td>${formatAmount(row.outstanding_due)}</td>
        <td>${formatAmount(row.coverage)}</td>
        <td>${row.is_active ? "Active" : "Inactive"}</td>
      </tr>
    `).join("");
    openPrintWindow(
      "Client Wallet Summary",
      `<h1>Client Wallet Summary</h1><p><strong>Total Wallet Balance:</strong> ${formatAmount(totalBalance)}</p><table><thead><tr><th>Customer ID</th><th>Name</th><th>Wallet Balance</th><th>Outstanding Due</th><th>Coverage</th><th>Status</th></tr></thead><tbody>${rowsHtml}</tbody></table>`,
      await fetchLogo(),
    );
  };

  const columns: Column<Row>[] = [
    { key: "code", label: "Customer ID", render: (r) => <span className="font-mono text-xs">{r.code}</span> },
    { key: "full_name", label: "Name" },
    { key: "phone", label: "Phone" },
    { key: "email", label: "Email", render: (r) => r.email || "-" },
    {
      key: "wallet_balance",
      label: "Wallet Balance",
      render: (r) => formatAmount(r.wallet_balance || 0),
    },
    {
      key: "outstanding_due",
      label: "Outstanding Due",
      render: (r) => formatAmount(r.outstanding_due),
    },
    {
      key: "coverage",
      label: "Coverage",
      render: (r) => formatAmount(r.coverage),
    },
    {
      key: "is_active",
      label: "Status",
      render: (r) => (
        <Badge variant={r.is_active ? "default" : "secondary"}>
          {r.is_active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Client Wallets"
        
      />
      <DateRangeFilter
        value={dateFilter}
        onValueChange={setDateFilter}
        startDate={customStartDate}
        endDate={customEndDate}
        onStartDateChange={setCustomStartDate}
        onEndDateChange={setCustomEndDate}
      />
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={exportWallets}>Export CSV</Button>
        <Button variant="outline" onClick={printWalletSummary}>Print</Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" /> Total Wallet Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{isLoading ? "..." : formatAmount(totalBalance)}</div>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Active Wallets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{isLoading ? "..." : activeWallets}</div>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-500" /> Zero / Empty Wallets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{isLoading ? "..." : zeroBalanceCount}</div>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-blue-500" /> Wallet Covers Due
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{isLoading ? "..." : walletCoverageCount}</div>
          </CardContent>
        </Card>
      </div>
      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        searchPlaceholder="Search clients..."
      />
    </div>
  );
};

export default FinanceWallets;

