import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { PageHeader } from "@/components/shared/PageHeader";
import { DateRangeFilter } from "@/components/shared/DateRangeFilter";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDefaultCurrency } from "@/hooks/useDefaultCurrency";
import {
  type FinanceDateFilter,
  downloadCsv,
  formatFinancePaymentMethod,
  getFinanceDateRange,
  getInvoiceBillingAmount,
  getInvoiceOutstandingBalance,
  getInvoicePaidAmount,
  getShipmentInvoiceTotal,
  getShipmentOutstandingBalance,
  isFinanceInvoiceVisible,
  isWithinFinanceDateRange,
  openFinanceDetailWindow,
  toNumber,
} from "@/lib/financePortal";
import { getWarehouseTrackingNumber, resolveTrackingByStatus } from "@/lib/shipmentNotes";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertCircle, CreditCard, DollarSign, Eye, FileText, TrendingUp } from "lucide-react";
import { fetchLogo } from "@/hooks/useLogo";
import { formatCurrencyDisplay, removeMinorWholeAmountDrift, roundCurrencyAmount } from "@/lib/currencyDisplay";

type ShipmentRow = {
  id: string;
  code: string;
  status: string;
  payment_status: string | null;
  paid_amount: number | null;
  total_cost: number;
  shipping_cost: number | null;
  custom_tracking_number: string | null;
  service_type: string | null;
  description: string | null;
  weight: number | null;
  cbm: number | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_code: string | null;
  created_at: string;
};

type PaymentRow = {
  id: string;
  code: string;
  amount: number;
  status: string | null;
  payment_provider: string;
  provider_reference: string | null;
  created_at: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_code: string | null;
  shipment_id: string | null;
  shipment_code: string | null;
  tracking_no: string | null;
  reason?: string;
};

type InvoiceLookupRow = {
  id: string;
  code: string;
  shipment_id: string | null;
  customer_id: string | null;
  amount: number;
  status: string | null;
  created_at: string;
  shipment_paid_amount: number | null;
  shipment_total_cost: number | null;
  shipment_shipping_cost: number | null;
};

type ExpenseRow = {
  id: string;
  amount: number;
  expense_date: string | null;
  original_amount: number | null;
  original_currency: string | null;
};

const formatClientLabel = (customerName: string | null | undefined, customerCode: string | null | undefined) => {
  const name = (customerName || "").trim();
  const code = (customerCode || "").trim();
  if (name && code) return `${name} (${code})`;
  if (name) return name;
  if (code) return code;
  return "Client";
};

const FinanceDashboard = () => {
  const navigate = useNavigate();
  const { formatAmount, code, symbol, convert } = useDefaultCurrency();
  const [shipments, setShipments] = useState<ShipmentRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceLookupRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [refunds, setRefunds] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<FinanceDateFilter>("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  const fetchData = async () => {
    setIsLoading(true);
    const [shipmentsRes, paymentsRes, invoicesRes, expensesRes, refundsRes] = await Promise.all([
      supabase
        .from("shipments")
        .select(
          "id, code, status, payment_status, paid_amount, total_cost, shipping_cost, custom_tracking_number, notes, service_type, description, weight, cbm, customer_id, created_at, customer:customers(full_name, code)",
        )
        .order("updated_at", { ascending: false })
        .range(0, 10000),
      supabase
        .from("payments")
        .select(
          "id, code, amount, status, payment_provider, provider_reference, callback_data, created_at, customer_id, shipment_id, description, customer:customers(full_name, code), shipment:shipments(code, custom_tracking_number, notes, status)",
        )
        .order("created_at", { ascending: false })
        .range(0, 10000),
      supabase
        .from("invoices")
        .select("id, code, shipment_id, customer_id, amount, status, created_at, shipment:shipments(paid_amount, total_cost, shipping_cost)")
        .order("created_at", { ascending: false }),
      supabase.from("finance_expenses").select("id, amount, expense_date, original_amount, original_currency"),
      supabase
        .from("customer_claims")
        .select("id, shipment_code, description, requested_amount, status, created_at, requested_by_role, customer:customers(full_name, code), shipment:shipments(code, custom_tracking_number, notes, status)")
        .eq("request_type", "refund")
        .order("created_at", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);

    if (shipmentsRes.error || paymentsRes.error || invoicesRes.error || expensesRes.error || refundsRes.error) {
      toast.error("Failed to load finance dashboard data.");
      setShipments([]);
      setPayments([]);
      setInvoices([]);
      setExpenses([]);
      setRefunds([]);
      setIsLoading(false);
      return;
    }

    setShipments(
      ((shipmentsRes.data || []) as any[]).map((row) => ({
        id: row.id,
        code: row.code,
        status: row.status,
        payment_status: row.payment_status || null,
        paid_amount: row.paid_amount === null ? null : toNumber(row.paid_amount),
        total_cost: toNumber(row.total_cost),
        shipping_cost: row.shipping_cost === null ? null : toNumber(row.shipping_cost),
        custom_tracking_number: resolveTrackingByStatus(row.status, row.notes || null, row.custom_tracking_number) || null,
        service_type: row.service_type || null,
        description: row.description || null,
        weight: row.weight === null ? null : toNumber(row.weight),
        cbm: row.cbm === null ? null : toNumber(row.cbm),
        customer_id: row.customer_id || null,
        customer_name: Array.isArray(row.customer)
          ? row.customer[0]?.full_name || null
          : row.customer?.full_name || null,
        customer_code: Array.isArray(row.customer)
          ? row.customer[0]?.code || null
          : row.customer?.code || null,
        created_at: row.created_at,
      })),
    );
    setPayments(
      ((paymentsRes.data || []) as any[]).map((row) => ({
        id: row.id,
        code: row.code,
        amount: toNumber(row.amount),
        status: row.status || null,
        payment_provider: row.payment_provider || "manual",
        provider_reference: row.provider_reference || null,
        created_at: row.created_at,
        customer_id: row.customer_id || null,
        customer_name: Array.isArray(row.customer)
          ? row.customer[0]?.full_name || null
          : row.customer?.full_name || null,
        customer_code: Array.isArray(row.customer)
          ? row.customer[0]?.code || null
          : row.customer?.code || null,
        shipment_id: row.shipment_id || null,
        shipment_code: Array.isArray(row.shipment)
          ? row.shipment[0]?.code || null
          : row.shipment?.code || null,
        tracking_no: (() => {
          const shipment = Array.isArray(row.shipment) ? row.shipment[0] : row.shipment;
          return resolveTrackingByStatus(shipment?.status || null, shipment?.notes || null, shipment?.custom_tracking_number || null) || null;
        })(),
        reason: (() => {
          const cb = row.callback_data as any;
          const status = row.status;

          // Try to extract a meaningful message from common gateway structures
          const msg = cb?.response?.message ||
            cb?.response?.error ||
            cb?.error?.message ||
            cb?.error ||
            cb?.status_message ||
            row.provider_reference;

          if (msg && msg !== row.provider_reference) return msg;

          if (status === "processing") return "Still processing at gateway";
          if (status === "failed") return msg || "Payment failed or was cancelled";
          return row.provider_reference || "-";
        })(),
      })),
    );
    setInvoices(
      ((invoicesRes.data || []) as any[]).map((row) => ({
        id: row.id,
        code: row.code,
        shipment_id: row.shipment_id || null,
        customer_id: row.customer_id || null,
        amount: getInvoiceBillingAmount({
          amount: toNumber(row.amount),
          shipment_total_cost: Array.isArray(row.shipment) ? row.shipment[0]?.total_cost ?? null : row.shipment?.total_cost ?? null,
          shipment_shipping_cost: Array.isArray(row.shipment) ? row.shipment[0]?.shipping_cost ?? null : row.shipment?.shipping_cost ?? null,
        }),
        status: row.status || null,
        created_at: row.created_at,
        shipment_paid_amount: (() => {
          const paidAmount = Array.isArray(row.shipment) ? row.shipment[0]?.paid_amount ?? null : row.shipment?.paid_amount ?? null;
          return paidAmount === null ? null : toNumber(paidAmount);
        })(),
        shipment_total_cost: Array.isArray(row.shipment) ? row.shipment[0]?.total_cost ?? null : row.shipment?.total_cost ?? null,
        shipment_shipping_cost: Array.isArray(row.shipment) ? row.shipment[0]?.shipping_cost ?? null : row.shipment?.shipping_cost ?? null,
      })),
    );
    setExpenses(
      ((expensesRes.data || []) as any[]).map((row) => ({
        id: row.id,
        amount: toNumber(row.amount),
        expense_date: row.expense_date || null,
        original_amount: row.original_amount == null ? null : toNumber(row.original_amount),
        original_currency: row.original_currency || null,
      })),
    );
    setRefunds(refundsRes.data || []);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const shipmentById = useMemo(
    () => new Map(shipments.map((shipment) => [shipment.id, shipment])),
    [shipments],
  );

  const invoiceCodeFor = (shipmentId: string | null, customerId: string | null) => {
    const byShipment = invoices.find((invoice) => invoice.shipment_id && invoice.shipment_id === shipmentId);
    if (byShipment) return byShipment.code;
    const byCustomer = invoices.find((invoice) => !invoice.shipment_id && invoice.customer_id === customerId);
    return byCustomer?.code || "-";
  };

  const dateRange = useMemo(
    () => getFinanceDateRange(dateFilter, { startDate: customStartDate, endDate: customEndDate }),
    [customEndDate, customStartDate, dateFilter],
  );

  const filteredShipments = useMemo(
    () => shipments.filter((shipment) => isWithinFinanceDateRange(shipment.created_at, dateRange)),
    [dateRange, shipments],
  );

  const filteredPayments = useMemo(
    () => payments.filter((payment) => isWithinFinanceDateRange(payment.created_at, dateRange) && payment.status === "completed"),
    [dateRange, payments],
  );

  const filteredInvoices = useMemo(
    () => invoices.filter((invoice) => isWithinFinanceDateRange(invoice.created_at, dateRange)),
    [dateRange, invoices],
  );

  const filteredExpenses = useMemo(
    () => expenses.filter((expense) => isWithinFinanceDateRange(expense.expense_date, dateRange)),
    [dateRange, expenses],
  );

  const filteredRefunds = useMemo(
    () => refunds.filter((refund) => isWithinFinanceDateRange(refund.created_at, dateRange)),
    [dateRange, refunds],
  );

  const totalInvoiced = useMemo(
    () => filteredInvoices.filter(inv => isFinanceInvoiceVisible(inv.status)).reduce((sum, invoice) => sum + invoice.amount, 0),
    [filteredInvoices],
  );

  const getInvoiceDashboardPaidAmount = (invoice: InvoiceLookupRow) => {
    if ((invoice.status || "").toLowerCase() === "paid" && invoice.shipment_paid_amount === null) {
      return invoice.amount;
    }

    return getInvoicePaidAmount(invoice, { paid_amount: invoice.shipment_paid_amount });
  };

  const getInvoiceDashboardBalance = (invoice: InvoiceLookupRow) => {
    if ((invoice.status || "").toLowerCase() === "paid") {
      return 0;
    }

    return getInvoiceOutstandingBalance(invoice, { paid_amount: invoice.shipment_paid_amount });
  };

  const paidInvoices = useMemo(
    () =>
      filteredInvoices.filter(
        (invoice) =>
          (invoice.status || "").toLowerCase() === "paid" ||
          (invoice.amount > 0 && getInvoiceDashboardPaidAmount(invoice) >= invoice.amount),
      ),
    [filteredInvoices],
  );

  const paidInvoiceAmount = useMemo(
    () => paidInvoices.reduce((sum, invoice) => sum + Math.min(invoice.amount, getInvoiceDashboardPaidAmount(invoice)), 0),
    [paidInvoices],
  );

  const outstandingInvoices = useMemo(
    () => filteredInvoices.filter((invoice) => isFinanceInvoiceVisible(invoice.status) && getInvoiceDashboardBalance(invoice) > 0),
    [filteredInvoices],
  );

  const outstandingInvoiceAmount = useMemo(
    () => outstandingInvoices.reduce((sum, invoice) => sum + getInvoiceDashboardBalance(invoice), 0),
    [outstandingInvoices],
  );

  const outstandingInvoiceDisplayAmount = useMemo(
    () => removeMinorWholeAmountDrift(convert(outstandingInvoiceAmount)),
    [convert, outstandingInvoiceAmount],
  );

  const completedPayments = useMemo(
    () => filteredPayments.filter((payment) => payment.status === "completed"),
    [filteredPayments],
  );

  const completedPaymentAmount = useMemo(
    () => completedPayments.reduce((sum, payment) => sum + payment.amount, 0),
    [completedPayments],
  );

  const failedPayments = useMemo(
    () => [], // Explicitly empty as per requirement to ignore failed payments
    [],
  );

  const outstandingQueue = useMemo(() => {
    return outstandingInvoices.map(invoice => {
      const shipment = Array.isArray(invoice.shipment) ? invoice.shipment[0] : invoice.shipment;
      return {
        id: invoice.id,
        code: invoice.code,
        customer_id: invoice.customer_id,
        customer_name: shipmentById.get(invoice.shipment_id || "")?.customer_name || "Customer",
        customer_code: shipmentById.get(invoice.shipment_id || "")?.customer_code,
        custom_tracking_number: shipmentById.get(invoice.shipment_id || "")?.custom_tracking_number,
        payment_status: invoice.status,
        amount: invoice.amount,
        balance: getInvoiceDashboardBalance(invoice),
        shipment_id: invoice.shipment_id
      };
    });
  }, [outstandingInvoices, shipmentById]);

  const getExpenseDisplayAmount = (row: ExpenseRow) => {
    if (row.original_amount != null && row.original_currency) {
      return roundCurrencyAmount(convert(row.original_amount, row.original_currency));
    }
    return removeMinorWholeAmountDrift(convert(row.amount));
  };

  const totalExpenses = useMemo(
    () => roundCurrencyAmount(filteredExpenses.reduce((sum, row) => sum + getExpenseDisplayAmount(row), 0)),
    [convert, filteredExpenses],
  );

  const totalExpenseBaseAmount = useMemo(
    () => roundCurrencyAmount(filteredExpenses.reduce((sum, row) => sum + row.amount, 0)),
    [filteredExpenses],
  );

  const totalRefundAmount = useMemo(
    () => filteredRefunds
      .filter((r) => r.status === "refunded" || r.status === "approved")
      .reduce((sum, r) => sum + toNumber(r.requested_amount), 0),
    [filteredRefunds],
  );

  const netProfit = completedPaymentAmount - totalRefundAmount - totalExpenseBaseAmount;
  const netProfitDisplay = removeMinorWholeAmountDrift(convert(netProfit));

  const recentTransactions = filteredPayments.slice(0, 15);
  const failedPaymentList: any[] = [];

  const openShipmentFinanceView = async ({
    title,
    shipment,
    amount,
    reason,
    payment,
  }: {
    title: string;
    shipment: ShipmentRow | undefined;
    amount: number;
    reason?: string;
    payment?: PaymentRow;
  }) => {
    openFinanceDetailWindow(title, "Shipment Finance Details", [
      {
        label: "Client",
        value: formatClientLabel(
          shipment?.customer_name || payment?.customer_name,
          shipment?.customer_code || payment?.customer_code,
        ),
      },
      { label: "Shipment No.", value: shipment?.code || payment?.shipment_code || "-" },
      { label: "Tracking No.", value: shipment?.custom_tracking_number || payment?.tracking_no || "-" },
      { label: "Invoice No.", value: invoiceCodeFor(shipment?.id || payment?.shipment_id || null, shipment?.customer_id || payment?.customer_id || null) },
      { label: "Service Type", value: shipment?.service_type || "-" },
      { label: "Description", value: shipment?.description || "-" },
      { label: "Weight", value: shipment?.weight === null || shipment?.weight === undefined ? "-" : shipment.weight.toFixed(2) },
      { label: "CBM", value: shipment?.cbm === null || shipment?.cbm === undefined ? "-" : shipment.cbm.toFixed(2) },
      { label: "Amount", value: formatAmount(amount) },
      { label: "Balance", value: shipment ? formatAmount(getShipmentOutstandingBalance(shipment)) : "-" },
      { label: "Status", value: shipment?.payment_status || payment?.status || "pending" },
      { label: "Payment Type", value: payment ? formatFinancePaymentMethod(payment.payment_provider) : "-" },
      { label: "Reason", value: reason || "-" },
      { label: "Date", value: payment ? format(new Date(payment.created_at), "PPp") : "-" },
    ], undefined, await fetchLogo());
  };

  const exportRecentTransactions = () => {
    downloadCsv(
      "finance-dashboard-recent-transactions.csv",
      ["Payment Code", "Client", "Invoice No.", "Payment Type", "Amount", "Status", "Date"],
      recentTransactions.map((payment) => [
        payment.code,
        formatClientLabel(payment.customer_name, payment.customer_code),
        invoiceCodeFor(payment.shipment_id, payment.customer_id),
        formatFinancePaymentMethod(payment.payment_provider),
        payment.amount.toFixed(2),
        payment.status || "pending",
        format(new Date(payment.created_at), "yyyy-MM-dd HH:mm"),
      ]),
    );
  };

  const exportOutstandingQueue = () => {
    downloadCsv(
      "finance-dashboard-outstanding-queue.csv",
      ["Client", "Tracking No.", "Invoice No.", "Amount", "Status", "Balance"],
      outstandingQueue.map((shipment) => [
        formatClientLabel(shipment.customer_name, shipment.customer_code),
        shipment.custom_tracking_number || "-",
        invoiceCodeFor(shipment.id, shipment.customer_id),
        getShipmentInvoiceTotal(shipment).toFixed(2),
        shipment.payment_status || "pending",
        getShipmentOutstandingBalance(shipment).toFixed(2),
      ]),
    );
  };



  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Finance Overview"
      />
      <DateRangeFilter
        value={dateFilter}
        onValueChange={setDateFilter}
        startDate={customStartDate}
        endDate={customEndDate}
        onStartDateChange={setCustomStartDate}
        onEndDateChange={setCustomEndDate}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-500" /> Total Invoices
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="break-words text-lg font-semibold leading-tight">{isLoading ? "..." : filteredInvoices.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">{formatAmount(totalInvoiced)}</p>
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4 text-emerald-600" /> Paid Invoices
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="break-words text-lg font-semibold leading-tight">{isLoading ? "..." : paidInvoices.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">{formatAmount(paidInvoiceAmount)}</p>
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-emerald-600" /> Payment Received
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="break-words text-lg font-semibold leading-tight">{isLoading ? "..." : completedPayments.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">{formatAmount(completedPaymentAmount)}</p>
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-orange-500" /> Outstanding Invoices
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="break-words text-lg font-semibold leading-tight">{isLoading ? "..." : outstandingInvoices.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">{formatCurrencyDisplay(outstandingInvoiceDisplayAmount, code, symbol)}</p>
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-rose-500" /> Refunds
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="break-words text-lg font-semibold leading-tight">
              {isLoading ? "..." : filteredRefunds.filter(r => r.status === 'refunded' || r.status === 'approved').length}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{formatAmount(totalRefundAmount)}</p>
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-amber-500" /> Total Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="break-words text-lg font-semibold leading-tight">{isLoading ? "..." : formatCurrencyDisplay(totalExpenses, code, symbol)}</p>
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Net Profit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`break-words text-lg font-semibold leading-tight ${netProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {isLoading ? "..." : formatCurrencyDisplay(netProfitDisplay, code, symbol)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Transaction</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="p-3 text-left">Payment Code</th>
                <th className="p-3 text-left">Client</th>
                <th className="p-3 text-left">Invoice No.</th>
                <th className="p-3 text-left">Payment Type</th>
                <th className="p-3 text-left">Amount</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Date</th>
                <th className="p-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {recentTransactions.map((payment) => {
                const shipment = payment.shipment_id ? shipmentById.get(payment.shipment_id) : undefined;
                return (
                  <tr key={payment.id} className="border-b last:border-0">
                    <td className="p-3 font-mono text-xs">{payment.code}</td>
                    <td className="p-3">{formatClientLabel(payment.customer_name, payment.customer_code)}</td>
                    <td className="p-3">{invoiceCodeFor(payment.shipment_id, payment.customer_id)}</td>
                    <td className="p-3">{formatFinancePaymentMethod(payment.payment_provider)}</td>
                    <td className="p-3">{formatAmount(payment.amount)}</td>
                    <td className="p-3">
                      <Badge variant={payment.status === "completed" ? "default" : payment.status === "failed" ? "destructive" : "secondary"}>
                        {payment.status || "pending"}
                      </Badge>
                    </td>
                    <td className="p-3">{format(new Date(payment.created_at), "PP")}</td>
                    <td className="p-3">
                      <Button
                        size="icon"
                        variant="outline"
                        title="View payment"
                        onClick={() =>
                          openShipmentFinanceView({
                            title: `Payment ${payment.code}`,
                            shipment,
                            amount: payment.amount,
                            payment,
                          })
                        }
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {recentTransactions.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    No recent transactions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Outstanding Payment Queue</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="p-3 text-left">Client</th>
                <th className="p-3 text-left">Tracking No.</th>
                <th className="p-3 text-left">Invoice No.</th>
                <th className="p-3 text-left">Amount</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Balance</th>
                <th className="p-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {outstandingQueue.map((row) => (
                <tr key={row.id} className="border-b last:border-0">
                  <td className="p-3">{formatClientLabel(row.customer_name, row.customer_code)}</td>
                  <td className="p-3">{row.custom_tracking_number || "-"}</td>
                  <td className="p-3">{row.code}</td>
                  <td className="p-3">{formatAmount(row.amount)}</td>
                  <td className="p-3">
                    <StatusBadge status={row.payment_status || "pending"} />
                  </td>
                  <td className="p-3">{formatAmount(row.balance)}</td>
                  <td className="p-3">
                    <Button
                      size="icon"
                      variant="outline"
                      title="View outstanding record"
                      onClick={() =>
                        openShipmentFinanceView({
                          title: `Invoice ${row.code}`,
                          shipment: row.shipment_id ? shipmentById.get(row.shipment_id) : undefined,
                          amount: row.amount,
                        })
                      }
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
              {outstandingQueue.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    No outstanding shipment balances found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>



      <div className="grid gap-3 md:grid-cols-3">
        <Button asChild variant="outline">
          <Link to="/finance/invoices">
            <FileText className="mr-2 h-4 w-4" /> Invoices
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/finance/payments">
            <CreditCard className="mr-2 h-4 w-4" /> Payments
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/finance/reports">
            <TrendingUp className="mr-2 h-4 w-4" /> Financial Reports
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Refund Request Monitoring</CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/finance/claims")}
          >
            Manage Claims
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="p-3 text-left">Client</th>
                <th className="p-3 text-left">Shipment</th>
                <th className="p-3 text-left">Requested Amount</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Requested By</th>
                <th className="p-3 text-left">Date</th>
                <th className="p-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRefunds.map((refund) => (
                <tr key={refund.id} className="border-b last:border-0">
                  <td className="p-3">
                    {refund.customer?.full_name || "Customer"}
                    {refund.customer?.code && <span className="ml-1 text-xs text-muted-foreground">({refund.customer.code})</span>}
                  </td>
                  <td className="p-3">
                    {resolveTrackingByStatus(
                      refund.shipment?.status || null,
                      refund.shipment?.notes || null,
                      refund.shipment?.custom_tracking_number || null
                    ) || refund.shipment_code || "-"}
                  </td>
                  <td className="p-3 font-medium">{formatAmount(toNumber(refund.requested_amount))}</td>
                  <td className="p-3">
                    <Badge variant={
                      refund.status === "refunded" ? "default" :
                        refund.status === "approved" ? "secondary" :
                          refund.status === "rejected" ? "destructive" : "outline"
                    }>
                      {refund.status || "submitted"}
                    </Badge>
                  </td>
                  <td className="p-3 capitalize">{refund.requested_by_role || "customer"}</td>
                  <td className="p-3">{format(new Date(refund.created_at), "PP")}</td>
                  <td className="p-3">
                    <Button
                      size="icon"
                      variant="outline"
                      title="Manage refund"
                      onClick={() => navigate("/finance/claims")}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
              {filteredRefunds.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    No recent refund requests found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
};

export default FinanceDashboard;
