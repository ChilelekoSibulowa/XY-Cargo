import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { DateRangeFilter } from "@/components/shared/DateRangeFilter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, Column } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDefaultCurrency } from "@/hooks/useDefaultCurrency";
import {
  type FinanceDateFilter,
  downloadCsv,
  getFinanceDateRange,
  getInvoiceBillingAmount,
  isWithinFinanceDateRange,
  openPrintWindow,
  toNumber,
} from "@/lib/financePortal";
import { fetchLogo } from "@/hooks/useLogo";
import { format } from "date-fns";
import { Download, Edit2, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type PaymentRow = { id: string; code: string; amount: number; payment_provider: string; status: string | null; created_at: string; shipment_id: string | null; customer_id: string | null; customer_name?: string };
type InvoiceRow = { id: string; code: string; amount: number; created_at: string; shipment_id: string | null; customer_id: string | null; customer_name?: string; shipment_total_cost: number | null; shipment_shipping_cost: number | null };
type Row = { id: string; client: string; invoice: string; invoice_amount: number; bank_amount: number; balance: number; status: string; created_at: string; shipment_id: string | null };

const FinanceReconciliation = () => {
  const { formatAmount } = useDefaultCurrency();
  const sb = supabase as any;
  const [rows, setRows] = useState<Row[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [selectedRow, setSelectedRow] = useState<Row | null>(null);
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentNotes, setAdjustmentNotes] = useState("");
  const [dateFilter, setDateFilter] = useState<FinanceDateFilter>("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  const fetchData = async () => {
    setIsLoading(true);
    const [paymentsRes, invoicesRes] = await Promise.all([
      supabase
        .from("payments")
        .select("id, code, amount, currency, payment_provider, status, created_at, shipment_id, customer_id, customers(full_name)")
        .order("created_at", { ascending: false }),
      sb
        .from("invoices")
        .select("id, code, amount, created_at, shipment_id, customer_id, customer:customers(full_name), shipment:shipments(total_cost, shipping_cost)")
        .order("created_at", { ascending: false }),
    ]);

    const paymentRows = ((paymentsRes.data || []) as any[]).map((row) => ({
      id: row.id,
      code: row.code,
      amount: toNumber(row.amount),
      payment_provider: row.payment_provider || "unknown",
      status: row.status || "pending",
      created_at: row.created_at,
      shipment_id: row.shipment_id || null,
      customer_id: row.customer_id || null,
      customer_name: row.customers?.full_name || null,
    })) as PaymentRow[];

    const invoiceRows = ((invoicesRes.data || []) as any[]).map((row) => ({
      id: row.id,
      code: row.code,
      amount: getInvoiceBillingAmount({
        amount: toNumber(row.amount),
        shipment_total_cost: Array.isArray(row.shipment) ? row.shipment[0]?.total_cost ?? null : row.shipment?.total_cost ?? null,
        shipment_shipping_cost: Array.isArray(row.shipment) ? row.shipment[0]?.shipping_cost ?? null : row.shipment?.shipping_cost ?? null,
      }),
      created_at: row.created_at,
      shipment_id: row.shipment_id || null,
      customer_id: row.customer_id || null,
      customer_name: row.customer?.full_name || null,
      shipment_total_cost: Array.isArray(row.shipment) ? row.shipment[0]?.total_cost ?? null : row.shipment?.total_cost ?? null,
      shipment_shipping_cost: Array.isArray(row.shipment) ? row.shipment[0]?.shipping_cost ?? null : row.shipment?.shipping_cost ?? null,
    })) as InvoiceRow[];

    const reconciliationRows = invoiceRows.map((invoice) => {
      const relatedPayments = paymentRows.filter((payment) => payment.status === "completed")
        .filter((payment) => {
          if (invoice.shipment_id) return payment.shipment_id === invoice.shipment_id;
          return payment.customer_id === invoice.customer_id;
        });
      const bankAmount = relatedPayments.reduce((sum, payment) => sum + payment.amount, 0);
      const balance = bankAmount - invoice.amount;
      const status = bankAmount === invoice.amount
        ? "reconciled"
        : bankAmount === 0
          ? "unmatched"
          : bankAmount < invoice.amount
            ? "partial"
            : "overpaid";

      return {
        id: invoice.id,
        client: invoice.customer_name || "Client",
        invoice: invoice.code,
        invoice_amount: invoice.amount,
        bank_amount: bankAmount,
        balance,
        status,
        created_at: invoice.created_at,
        shipment_id: invoice.shipment_id,
      };
    });

    setRows(reconciliationRows);
    setIsLoading(false);
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const handleManualAdjustment = async () => {
    if (!selectedRow || !selectedRow.shipment_id) return;
    const amount = Number(adjustmentAmount);
    if (isNaN(amount) || amount < 0) {
      toast.error("Please enter a valid amount.");
      return;
    }

    setIsAdjusting(true);
    try {
      const { error } = await supabase
        .from("shipments")
        .update({
          paid_amount: amount,
          payment_status: amount >= selectedRow.invoice_amount ? "completed" : amount > 0 ? "partial" : "unpaid",
        })
        .eq("id", selectedRow.shipment_id);

      if (error) throw error;

      // Optional: Record this adjustment as a custom payment for audit trail
      await supabase.from("payments").insert({
        amount,
        status: "completed",
        payment_provider: "manual_adjustment",
        shipment_id: selectedRow.shipment_id,
        customer_id: rows.find(r => r.id === selectedRow.id)?.client ? null : null, // placeholder
        callback_data: { manual_adjustment: true, notes: adjustmentNotes, original_bank_amount: selectedRow.bank_amount }
      } as any);

      toast.success("Reconciliation adjusted successfully.");
      setSelectedRow(null);
      setAdjustmentAmount("");
      setAdjustmentNotes("");
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to adjust reconciliation.");
    } finally {
      setIsAdjusting(false);
    }
  };

  const dateRange = useMemo(
    () => getFinanceDateRange(dateFilter, { startDate: customStartDate, endDate: customEndDate }),
    [customEndDate, customStartDate, dateFilter],
  );

  const dateFilteredRows = useMemo(
    () => rows.filter((row) => isWithinFinanceDateRange(row.created_at, dateRange)),
    [dateRange, rows],
  );

  const matched = dateFilteredRows.filter((r) => r.status === "reconciled").length;
  const partial = dateFilteredRows.filter((r) => r.status === "partial").length;
  const unmatched = dateFilteredRows.filter((r) => r.status === "unmatched").length;
  const overpaid = dateFilteredRows.filter((r) => r.status === "overpaid").length;

  const totals = useMemo(
    () => ({
      invoices: dateFilteredRows.reduce((sum, row) => sum + row.invoice_amount, 0),
      bank: dateFilteredRows.reduce((sum, row) => sum + row.bank_amount, 0),
      variance: dateFilteredRows.reduce((sum, row) => sum + row.balance, 0),
    }),
    [dateFilteredRows],
  );

  const exportRows = () => {
    downloadCsv(
      "finance-reconciliation.csv",
      ["Date", "Client", "Invoice", "Invoice Amount", "Bank Amount", "Balance", "Status"],
      dateFilteredRows.map((row) => [
        new Date(row.created_at).toISOString(),
        row.client,
        row.invoice,
        row.invoice_amount.toFixed(2),
        row.bank_amount.toFixed(2),
        row.balance.toFixed(2),
        row.status,
      ]),
    );
  };

  const columns: Column<Row>[] = [
    { key: "client", label: "Client" },
    { key: "invoice", label: "Invoice", render: (r) => <span className="font-mono text-xs">{r.invoice}</span> },
    { key: "invoice_amount", label: "Invoice Amount", align: "center", render: (r) => formatAmount(r.invoice_amount) },
    { key: "bank_amount", label: "Bank Amount", align: "center", render: (r) => formatAmount(r.bank_amount) },
    { key: "balance", label: "Balance", align: "center", render: (r) => <span className={r.balance === 0 ? "text-emerald-600" : "text-red-600"}>{formatAmount(r.balance)}</span> },
    { key: "status", label: "Status", render: (r) => <Badge variant={r.status === "reconciled" ? "default" : r.status === "overpaid" ? "secondary" : "destructive"}>{r.status}</Badge> },
    { key: "created_at", label: "Date", render: (r) => format(new Date(r.created_at), "PP") },
    {
      key: "action",
      label: "Action",
      render: (r) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 p-0"
            title="Export record"
            onClick={async () =>
              openPrintWindow(
                `Reconciliation ${r.invoice}`,
                `<h1>Reconciliation Record</h1><p><strong>Client:</strong> ${r.client}</p><p><strong>Invoice:</strong> ${r.invoice}</p><p><strong>Invoice Amount:</strong> ${formatAmount(r.invoice_amount)}</p><p><strong>Bank Amount:</strong> ${formatAmount(r.bank_amount)}</p><p><strong>Balance:</strong> ${formatAmount(r.balance)}</p><p><strong>Status:</strong> ${r.status}</p><p><strong>Date:</strong> ${new Date(r.created_at).toLocaleString()}</p>`,
                await fetchLogo(),
              )
            }
          >
            <Download className="h-4 w-4 text-blue-600" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 p-0"
            title="Manual adjust"
            onClick={() => {
              setSelectedRow(r);
              setAdjustmentAmount(r.bank_amount.toString());
              setAdjustmentNotes("");
            }}
          >
            <Edit2 className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Payment Reconciliation"  />
      <DateRangeFilter
        value={dateFilter}
        onValueChange={setDateFilter}
        startDate={customStartDate}
        endDate={customEndDate}
        onStartDateChange={setCustomStartDate}
        onEndDateChange={setCustomEndDate}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total Invoices</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{dateFilteredRows.length}</p></CardContent></Card>
        <Card className="border-l-4 border-l-green-500"><CardHeader className="pb-2"><CardTitle className="text-sm">Reconciled</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{matched}</p></CardContent></Card>
        <Card className="border-l-4 border-l-yellow-500"><CardHeader className="pb-2"><CardTitle className="text-sm">Partial</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{partial}</p></CardContent></Card>
        <Card className="border-l-4 border-l-red-500"><CardHeader className="pb-2"><CardTitle className="text-sm">Unmatched</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{unmatched}</p></CardContent></Card>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Invoice Total</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{formatAmount(totals.invoices)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Bank Total</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{formatAmount(totals.bank)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Variance</CardTitle></CardHeader><CardContent><p className={`text-2xl font-bold ${totals.variance === 0 ? "text-emerald-600" : "text-red-600"}`}>{formatAmount(totals.variance)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Overpaid</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{overpaid}</p></CardContent></Card>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-sm">Bank vs System Summary</CardTitle>
          <Button variant="outline" size="icon" onClick={exportRows} title="Export reconciliation">
            <Download className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm"><span>Total Invoices Issued</span><span>{formatAmount(totals.invoices)}</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: "100%" }} /></div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm"><span>Total Payments Recorded</span><span>{formatAmount(totals.bank)}</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${totals.invoices > 0 ? Math.min((totals.bank / totals.invoices) * 100, 100) : 0}%` }} /></div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm"><span>Balance Difference</span><span>{formatAmount(totals.variance)}</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-red-500" style={{ width: `${totals.invoices > 0 ? Math.min((Math.abs(totals.variance) / totals.invoices) * 100, 100) : 0}%` }} /></div>
          </div>
        </CardContent>
      </Card>
      <DataTable columns={columns} data={dateFilteredRows} isLoading={isLoading} searchPlaceholder="Search payments..." />

      <Dialog open={!!selectedRow} onOpenChange={(open) => !open && setSelectedRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manual Reconciliation Adjustment</DialogTitle>
            
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="adjustment-amount">Corrected Paid Amount</Label>
              <Input
                id="adjustment-amount"
                type="number"
                step="0.01"
                value={adjustmentAmount}
                onChange={(e) => setAdjustmentAmount(e.target.value)}
                placeholder="0.00"
              />
              <p className="text-xs text-muted-foreground">
                Current bank amount: {selectedRow ? formatAmount(selectedRow.bank_amount) : "-"}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="adjustment-notes">Reason / Notes</Label>
              <Textarea
                id="adjustment-notes"
                value={adjustmentNotes}
                onChange={(e) => setAdjustmentNotes(e.target.value)}
                placeholder="Why is this manual adjustment being made?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedRow(null)}>
              Cancel
            </Button>
            <Button onClick={handleManualAdjustment} disabled={isAdjusting}>
              {isAdjusting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Adjustment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FinanceReconciliation;


