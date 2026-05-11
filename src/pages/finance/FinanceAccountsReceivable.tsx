import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { PageHeader } from "@/components/shared/PageHeader";
import { DateRangeFilter } from "@/components/shared/DateRangeFilter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, Column } from "@/components/shared/DataTable";
import { supabase } from "@/integrations/supabase/client";
import { useDefaultCurrency } from "@/hooks/useDefaultCurrency";
import {
  type FinanceDateFilter,
  downloadCsv,
  getFinanceDateRange,
  getInvoiceBillingAmount,
  isWithinFinanceDateRange,
  openFinanceDetailWindow,
  openPrintWindow,
  toNumber,
} from "@/lib/financePortal";
import { getWarehouseTrackingNumber, resolveTrackingByStatus } from "@/lib/shipmentNotes";
import { fetchLogo } from "@/hooks/useLogo";
import { toast } from "sonner";
import { Download, Eye } from "lucide-react";

type InvoiceRow = {
  id: string;
  code: string;
  amount: number;
  status: string | null;
  due_date: string | null;
  created_at: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_code: string | null;
  shipment_id: string | null;
  shipment_code: string | null;
  tracking_no: string | null;
  paid_amount: number;
  balance: number;
};

type ClientRow = {
  customer_id: string | null;
  customer_name: string;
  customer_code: string;
  open_invoices: number;
  outstanding: number;
  oldest_invoice: string;
  invoice_codes: string[];
};

type CreditNoteRow = {
  id: string;
  code: string;
  amount: number;
  status: string | null;
  created_at: string;
  customer_name: string | null;
  customer_code: string | null;
  invoice_code: string | null;
  reason: string | null;
};

const FinanceAccountsReceivable = () => {
  const { formatAmount } = useDefaultCurrency();
  const sb = supabase as any;
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [creditNotes, setCreditNotes] = useState<CreditNoteRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<FinanceDateFilter>("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  const fetchData = async () => {
    setIsLoading(true);
    const [invoiceRes, creditRes] = await Promise.all([
      sb
        .from("invoices")
        .select(
          "id, code, amount, status, due_date, created_at, customer_id, shipment_id, customer:customers(full_name, code), shipment:shipments(code, custom_tracking_number, notes, paid_amount, total_cost, shipping_cost, status)",
        )
        .order("created_at", { ascending: false }),
      sb
        .from("credit_notes")
        .select("id, code, amount, status, reason, created_at, customer:customers(full_name, code), invoice:invoices(code)")
        .order("created_at", { ascending: false }),
    ]);

    if (invoiceRes.error || creditRes.error) {
      toast.error("Failed to load accounts receivable data.");
      setInvoices([]);
      setCreditNotes([]);
      setIsLoading(false);
      return;
    }

    setInvoices(
      ((invoiceRes.data || []) as any[]).map((row) => {
        const shipment = Array.isArray(row.shipment) ? row.shipment[0] : row.shipment;
        const paidAmount = toNumber(shipment?.paid_amount);
        const amount = getInvoiceBillingAmount(
          {
            amount: toNumber(row.amount),
            shipment_total_cost: shipment?.total_cost ?? null,
            shipment_shipping_cost: shipment?.shipping_cost ?? null,
          },
          shipment
            ? {
                total_cost: shipment?.total_cost ?? null,
                shipping_cost: shipment?.shipping_cost ?? null,
              }
            : null,
        );
        return {
          id: row.id,
          code: row.code,
          amount,
          status: row.status || "draft",
          due_date: row.due_date || null,
          created_at: row.created_at,
          customer_id: row.customer_id || null,
          customer_name: Array.isArray(row.customer)
            ? row.customer[0]?.full_name || null
            : row.customer?.full_name || null,
          customer_code: Array.isArray(row.customer)
            ? row.customer[0]?.code || null
            : row.customer?.code || null,
          shipment_id: row.shipment_id || null,
          shipment_code: shipment?.code || null,
          tracking_no: resolveTrackingByStatus(shipment?.status || null, shipment?.notes || null, shipment?.custom_tracking_number || null) || null,
          paid_amount: row.shipment_id ? paidAmount : 0,
          balance: Math.max(amount - (row.shipment_id ? paidAmount : 0), 0),
        };
      }),
    );

    setCreditNotes(
      ((creditRes.data || []) as any[]).map((row) => ({
        id: row.id,
        code: row.code,
        amount: toNumber(row.amount),
        status: row.status || "pending",
        created_at: row.created_at,
        customer_name: Array.isArray(row.customer)
          ? row.customer[0]?.full_name || null
          : row.customer?.full_name || null,
        customer_code: Array.isArray(row.customer)
          ? row.customer[0]?.code || null
          : row.customer?.code || null,
        invoice_code: Array.isArray(row.invoice) ? row.invoice[0]?.code || null : row.invoice?.code || null,
        reason: row.reason || null,
      })),
    );
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const dateRange = useMemo(
    () => getFinanceDateRange(dateFilter, { startDate: customStartDate, endDate: customEndDate }),
    [customEndDate, customStartDate, dateFilter],
  );

  const dateFilteredInvoices = useMemo(
    () => invoices.filter((invoice) => isWithinFinanceDateRange(invoice.created_at, dateRange)),
    [dateRange, invoices],
  );

  const dateFilteredCreditNotes = useMemo(
    () => creditNotes.filter((creditNote) => isWithinFinanceDateRange(creditNote.created_at, dateRange)),
    [creditNotes, dateRange],
  );

  const outstandingInvoices = useMemo(
    () => dateFilteredInvoices.filter((invoice) => invoice.balance > 0 || invoice.status !== "paid"),
    [dateFilteredInvoices],
  );

  const totalOutstanding = useMemo(
    () => outstandingInvoices.reduce((sum, invoice) => sum + invoice.balance, 0),
    [outstandingInvoices],
  );

  const agingBuckets = useMemo(() => {
    const now = Date.now();
    const buckets = { current: 0, thirty: 0, sixty: 0, ninety: 0 };

    outstandingInvoices.forEach((invoice) => {
      const baseDate = invoice.due_date ? new Date(invoice.due_date) : new Date(invoice.created_at);
      const age = (now - baseDate.getTime()) / 86400000;
      if (age <= 30) buckets.current += invoice.balance;
      else if (age <= 60) buckets.thirty += invoice.balance;
      else if (age <= 90) buckets.sixty += invoice.balance;
      else buckets.ninety += invoice.balance;
    });

    return buckets;
  }, [outstandingInvoices]);

  const clientRows = useMemo<ClientRow[]>(() => {
    const map = new Map<string, ClientRow>();

    outstandingInvoices.forEach((invoice) => {
      const key = invoice.customer_id || invoice.customer_code || invoice.customer_name || invoice.id;
      const existing = map.get(key);
      const baseDate = invoice.due_date || invoice.created_at;

      if (!existing) {
        map.set(key, {
          customer_id: invoice.customer_id,
          customer_name: invoice.customer_name || "Customer",
          customer_code: invoice.customer_code || "-",
          open_invoices: 1,
          outstanding: invoice.balance,
          oldest_invoice: baseDate,
          invoice_codes: [invoice.code],
        });
        return;
      }

      existing.open_invoices += 1;
      existing.outstanding += invoice.balance;
      existing.invoice_codes.push(invoice.code);
      if (new Date(baseDate) < new Date(existing.oldest_invoice)) {
        existing.oldest_invoice = baseDate;
      }
    });

    return Array.from(map.values()).sort((a, b) => b.outstanding - a.outstanding);
  }, [outstandingInvoices]);

  const downloadClientStatement = (client: ClientRow) => {
    const clientInvoices = outstandingInvoices.filter(
      (invoice) =>
        invoice.customer_id === client.customer_id ||
        `${invoice.customer_name || "Customer"}|${invoice.customer_code || "-"}` ===
          `${client.customer_name}|${client.customer_code}`,
    );

    downloadCsv(
      `accounts-receivable-${client.customer_code || "client"}.csv`,
      ["Invoice No.", "Tracking No.", "Amount", "Status", "Balance", "Date"],
      clientInvoices.map((invoice) => [
        invoice.code,
        invoice.tracking_no || "-",
        invoice.amount.toFixed(2),
        invoice.status || "pending",
        invoice.balance.toFixed(2),
        format(new Date(invoice.due_date || invoice.created_at), "yyyy-MM-dd"),
      ]),
    );
  };

  const downloadInvoiceStatement = async (invoice: InvoiceRow) => {
    const html = `
      <h1>Outstanding Invoice</h1>
      <p><strong>Invoice No.:</strong> ${invoice.code}</p>
      <p><strong>Client:</strong> ${invoice.customer_name || "Customer"}${invoice.customer_code ? ` (${invoice.customer_code})` : ""}</p>
      <p><strong>Shipment No.:</strong> ${invoice.shipment_code || "-"}</p>
      <p><strong>Tracking No.:</strong> ${invoice.tracking_no || "-"}</p>
      <table>
        <tbody>
          <tr><th>Invoice Amount</th><td>${formatAmount(invoice.amount)}</td></tr>
          <tr><th>Balance</th><td>${formatAmount(invoice.balance)}</td></tr>
          <tr><th>Status</th><td>${invoice.status || "pending"}</td></tr>
          <tr><th>Date</th><td>${format(new Date(invoice.created_at), "PP")}</td></tr>
          <tr><th>Due</th><td>${invoice.due_date ? format(new Date(invoice.due_date), "PP") : "-"}</td></tr>
        </tbody>
      </table>
      <script>window.print();</script>
    `;

    if (!openPrintWindow(`Outstanding Invoice ${invoice.code}`, html, await fetchLogo())) {
      toast.error("Popup blocked. Allow popups to download statements.");
    }
  };

  const clientColumns: Column<ClientRow>[] = [
    {
      key: "customer_name",
      label: "Customer",
      render: (row) => `${row.customer_name}${row.customer_code ? ` (${row.customer_code})` : ""}`,
    },
    { key: "open_invoices", label: "Open Invoices" },
    {
      key: "outstanding",
      label: "Outstanding",
      align: "center",
      
      render: (row) => formatAmount(row.outstanding),
    },
    {
      key: "oldest_invoice",
      label: "Oldest Invoice",
      render: (row) => format(new Date(row.oldest_invoice), "PP"),
    },
    {
      key: "action",
      label: "Action",
      render: (row) => (
        <Button
          size="icon"
          variant="outline"
          title="View details"
          onClick={async () =>
            openFinanceDetailWindow(`Client ${row.customer_code}`, "Outstanding Invoice Details", [
              { label: "Customer", value: row.customer_name },
              { label: "Customer Code", value: row.customer_code },
              { label: "Open Invoices", value: row.open_invoices },
              { label: "Outstanding", value: formatAmount(row.outstanding) },
              { label: "Oldest Invoice", value: format(new Date(row.oldest_invoice), "PP") },
              { label: "Invoice No(s)", value: row.invoice_codes.join(", ") },
            ], undefined, await fetchLogo())
          }
        >
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
    {
      key: "download",
      label: "Download",
      render: (row) => (
        <Button size="icon" variant="outline" onClick={() => downloadClientStatement(row)} title="Download statement">
          <Download className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  const invoiceColumns: Column<InvoiceRow>[] = [
    {
      key: "customer_name",
      label: "Client",
      render: (row) =>
        row.customer_name
          ? `${row.customer_name}${row.customer_code ? ` (${row.customer_code})` : ""}`
          : "-",
    },
    {
      key: "tracking_no",
      label: "Tracking No.",
      render: (row) => row.tracking_no || "-",
    },
    { key: "code", label: "Invoice No." },
    {
      key: "amount",
      label: "Amount",
      align: "center",
      
      render: (row) => formatAmount(row.amount),
    },
    {
      key: "status",
      label: "Status",
      render: (row) => (
        <Badge variant={row.status === "paid" ? "default" : "secondary"}>
          {row.status || "pending"}
        </Badge>
      ),
    },
    {
      key: "balance",
      label: "Balance",
      align: "center",
      
      render: (row) => formatAmount(row.balance),
    },
    {
      key: "action",
      label: "Action",
      render: (row) => (
        <Button
          size="icon"
          variant="outline"
          title="View details"
          onClick={async () =>
            openFinanceDetailWindow(`Invoice ${row.code}`, "Outstanding Invoice Details", [
              { label: "Client", value: row.customer_name || "Customer" },
              { label: "Customer Code", value: row.customer_code || "-" },
              { label: "Shipment No.", value: row.shipment_code || "-" },
              { label: "Tracking No.", value: row.tracking_no || "-" },
              { label: "Invoice No.", value: row.code },
              { label: "Amount", value: formatAmount(row.amount) },
              { label: "Balance", value: formatAmount(row.balance) },
              { label: "Status", value: row.status || "pending" },
              { label: "Date", value: format(new Date(row.created_at), "PP") },
            ], undefined, await fetchLogo())
          }
        >
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
    {
      key: "download",
      label: "Download",
      render: (row) => (
        <Button size="icon" variant="outline" onClick={() => downloadInvoiceStatement(row)} title="Download statement">
          <Download className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  const creditColumns: Column<CreditNoteRow>[] = [
    {
      key: "customer_name",
      label: "Client",
      render: (row) =>
        row.customer_name
          ? `${row.customer_name}${row.customer_code ? ` (${row.customer_code})` : ""}`
          : "-",
    },
    {
      key: "invoice_code",
      label: "Invoice No.",
      render: (row) => row.invoice_code || "-",
    },
    {
      key: "amount",
      label: "Amount",
      align: "center",
      
      render: (row) => formatAmount(row.amount),
    },
    {
      key: "status",
      label: "Status",
      render: (row) => row.status || "pending",
    },
    {
      key: "created_at",
      label: "Date",
      render: (row) => format(new Date(row.created_at), "PP"),
    },
    {
      key: "reason",
      label: "Reason",
      render: (row) => row.reason || "-",
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Accounts Receivable"
        
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
        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{isLoading ? "..." : formatAmount(totalOutstanding)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">0-30 Days</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-semibold">{formatAmount(agingBuckets.current)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">31-60 Days</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-semibold">{formatAmount(agingBuckets.thirty)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">61-90 Days</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-semibold">{formatAmount(agingBuckets.sixty)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">90+ Days</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-semibold text-destructive">{formatAmount(agingBuckets.ninety)}</p></CardContent>
        </Card>
      </div>

      <Tabs defaultValue="clients">
        <TabsList className="mb-4 flex flex-wrap">
          <TabsTrigger value="clients">Outstanding Client</TabsTrigger>
          <TabsTrigger value="invoices">Outstanding Invoice</TabsTrigger>
          <TabsTrigger value="credits">Credit Note</TabsTrigger>
        </TabsList>
        <TabsContent value="clients">
          <DataTable
            columns={clientColumns}
            data={clientRows}
            isLoading={isLoading}
            searchPlaceholder="Search outstanding clients..."
          />
        </TabsContent>
        <TabsContent value="invoices">
          <DataTable
            columns={invoiceColumns}
            data={outstandingInvoices}
            isLoading={isLoading}
            searchPlaceholder="Search outstanding invoices..."
          />
        </TabsContent>
        <TabsContent value="credits">
          <DataTable
            columns={creditColumns}
            data={dateFilteredCreditNotes}
            isLoading={isLoading}
            searchPlaceholder="Search credit notes..."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FinanceAccountsReceivable;

