import { useEffect, useMemo, useState } from "react";
import { endOfDay, endOfMonth, endOfYear, format, startOfDay, startOfMonth, startOfYear, subDays, subYears } from "date-fns";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { DataTable, Column } from "@/components/shared/DataTable";
import { supabase } from "@/integrations/supabase/client";
import { useDefaultCurrency } from "@/hooks/useDefaultCurrency";
import { useAuthContext } from "@/components/auth/AuthContext";
import {
  buildRecentMonthSeries,
  downloadCsv,
  getShipmentOutstandingBalance,
  openFinanceDetailWindow,
  toNumber,
} from "@/lib/financePortal";
import { toast } from "sonner";
import { Eye, Trash, Download } from "lucide-react";
import { fetchLogo } from "@/hooks/useLogo";

type TransactionRow = {
  amount: number;
  created_at: string;
  status: string | null;
  transaction_type: string;
};

type ShipmentRow = {
  total_cost: number;
  shipping_cost: number | null;
  paid_amount: number | null;
  payment_status: string | null;
};

type ProfileRow = {
  user_id: string;
  full_name: string;
  email: string;
};

type ExpenseRow = {
  id: string;
  code: string;
  expense_date: string;
  expense_type: string;
  description: string | null;
  amount: number;
  approved_by: string | null;
  approved_by_name: string;
  created_at: string;
  original_amount?: number | null;
  original_currency?: string | null;
};

type SeriesRow = {
  label: string;
  revenue: number;
  expenses: number;
};

const FinanceReports = () => {
  const { formatAmount, code, symbol, convertFromSelected } = useDefaultCurrency();
  const { user } = useAuthContext();
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [shipments, setShipments] = useState<ShipmentRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showExpenseDialog, setShowExpenseDialog] = useState(false);
  const [isSavingExpense, setIsSavingExpense] = useState(false);
  const [dateFilterPreset, setDateFilterPreset] = useState<"today" | "yesterday" | "this_month" | "this_year" | "last_year" | "custom">("this_month");
  const [customFromDate, setCustomFromDate] = useState("");
  const [customToDate, setCustomToDate] = useState("");
  const [expenseForm, setExpenseForm] = useState({
    expense_date: format(new Date(), "yyyy-MM-dd"),
    expense_type: "",
    description: "",
    amount: "",
  });

  const fetchData = async () => {
    setIsLoading(true);

    const [transactionsRes, shipmentsRes, expensesRes] = await Promise.all([
      supabase.from("transactions").select("amount, created_at, status, transaction_type"),
      supabase
        .from("shipments")
        .select("total_cost, shipping_cost, paid_amount, payment_status"),
      supabase
        .from("finance_expenses")
        .select("*")
        .order("expense_date", { ascending: false }),
    ]);

    if (transactionsRes.error || shipmentsRes.error || expensesRes.error) {
      toast.error("Failed to load financial report data.");
      setTransactions([]);
      setShipments([]);
      setExpenses([]);
      setIsLoading(false);
      return;
    }

    const expenseRows = ((expensesRes.data || []) as any[]).map((row) => ({
      id: row.id,
      code: row.code,
      expense_date: row.expense_date,
      expense_type: row.expense_type,
      description: row.description || null,
      amount: toNumber(row.amount),
      approved_by: row.approved_by || null,
      approved_by_name: "Finance Officer",
      created_at: row.created_at,
      original_amount: row.original_amount != null ? toNumber(row.original_amount) : null,
      original_currency: row.original_currency || null,
    }));

    const approverIds = expenseRows
      .map((row) => row.approved_by)
      .filter((value): value is string => Boolean(value));

    let profileMap = new Map<string, ProfileRow>();
    if (approverIds.length > 0) {
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", approverIds);

      profileMap = new Map(
        ((profilesData || []) as ProfileRow[]).map((profile) => [profile.user_id, profile]),
      );
    }

    setTransactions(
      ((transactionsRes.data || []) as any[]).map((row) => ({
        amount: toNumber(row.amount),
        created_at: row.created_at,
        status: row.status || null,
        transaction_type: row.transaction_type,
      })),
    );
    setShipments(
      ((shipmentsRes.data || []) as any[]).map((row) => ({
        total_cost: toNumber(row.total_cost),
        shipping_cost: row.shipping_cost === null ? null : toNumber(row.shipping_cost),
        paid_amount: row.paid_amount === null ? null : toNumber(row.paid_amount),
        payment_status: row.payment_status || null,
      })),
    );
    setExpenses(
      expenseRows.map((row) => ({
        ...row,
        approved_by_name:
          profileMap.get(row.approved_by || "")?.full_name ||
          profileMap.get(row.approved_by || "")?.email ||
          "Finance Officer",
      })),
    );
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const activeDateRange = useMemo(() => {
    const now = new Date();
    if (dateFilterPreset === "custom") {
      const start = customFromDate ? startOfDay(new Date(customFromDate)) : null;
      const end = customToDate ? endOfDay(new Date(customToDate)) : null;
      return { start, end };
    }
    if (dateFilterPreset === "today") {
      return { start: startOfDay(now), end: endOfDay(now) };
    }
    if (dateFilterPreset === "yesterday") {
      const yesterday = subDays(now, 1);
      return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
    }
    if (dateFilterPreset === "this_year") {
      return { start: startOfYear(now), end: endOfYear(now) };
    }
    if (dateFilterPreset === "last_year") {
      const lastYear = subYears(now, 1);
      return { start: startOfYear(lastYear), end: endOfYear(lastYear) };
    }
    return { start: startOfMonth(now), end: endOfMonth(now) };
  }, [dateFilterPreset, customFromDate, customToDate]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((row) => {
      const value = new Date(row.created_at);
      if (Number.isNaN(value.getTime())) return false;
      if (activeDateRange.start && value < activeDateRange.start) return false;
      if (activeDateRange.end && value > activeDateRange.end) return false;
      return true;
    });
  }, [transactions, activeDateRange]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((row) => {
      const value = new Date(`${row.expense_date}T00:00:00`);
      if (Number.isNaN(value.getTime())) return false;
      if (activeDateRange.start && value < activeDateRange.start) return false;
      if (activeDateRange.end && value > activeDateRange.end) return false;
      return true;
    });
  }, [expenses, activeDateRange]);

  const completedPayments = useMemo(
    () =>
      filteredTransactions.filter(
        (row) => row.status === "completed" && row.transaction_type === "payment",
      ),
    [filteredTransactions],
  );

  const totalRevenue = useMemo(
    () => completedPayments.reduce((sum, row) => sum + row.amount, 0),
    [completedPayments],
  );

  const totalExpenses = useMemo(
    () => filteredExpenses.reduce((sum, row) => sum + row.amount, 0),
    [filteredExpenses],
  );

  const monthlyExpense = useMemo(() => {
    const monthStart = startOfMonth(new Date());
    return filteredExpenses
      .filter((row) => new Date(row.expense_date) >= monthStart)
      .reduce((sum, row) => sum + row.amount, 0);
  }, [filteredExpenses]);

  const outstandingBalance = useMemo(
    () =>
      shipments
        .filter((row) => row.payment_status !== "completed")
        .reduce((sum, row) => sum + getShipmentOutstandingBalance(row), 0),
    [shipments],
  );

  const paymentReceivedAmount = useMemo(
    () => completedPayments.reduce((sum, row) => sum + row.amount, 0),
    [completedPayments],
  );

  const paymentReceivedCount = completedPayments.length;
  const netProfit = totalRevenue - totalExpenses;

  const monthlySeries = useMemo<SeriesRow[]>(() => {
    const revenueSeries = buildRecentMonthSeries(
      completedPayments.map((row) => ({
        created_at: row.created_at,
        amount: row.amount,
      })),
      6,
    );
    const expenseSeries = buildRecentMonthSeries(
      filteredExpenses.map((row) => ({
        created_at: `${row.expense_date}T00:00:00`,
        amount: row.amount,
      })),
      6,
    );

    return revenueSeries.map((row, index) => ({
      label: row.label,
      revenue: row.amount,
      expenses: expenseSeries[index]?.amount || 0,
    }));
  }, [completedPayments, filteredExpenses]);

  const handleSaveExpense = async () => {
    const amount = Number(expenseForm.amount);
    if (!expenseForm.expense_type.trim()) {
      toast.error("Expense type is required.");
      return;
    }
    if (Number.isNaN(amount) || amount <= 0) {
      toast.error("Enter a valid expense amount.");
      return;
    }

    setIsSavingExpense(true);
    const { data: codeData } = await supabase.rpc("generate_code", { prefix: "EXP" });

    // Convert the entered amount from the selected currency to the system's base currency
    const baseAmount = convertFromSelected(amount);

    const { error } = await supabase.from("finance_expenses").insert({
      code: codeData || `EXP-${Date.now()}`,
      expense_date: expenseForm.expense_date,
      expense_type: expenseForm.expense_type.trim(),
      description: expenseForm.description.trim() || null,
      amount: baseAmount,
      original_amount: amount,
      original_currency: code,
      approved_by: user?.id || null,
    });

    if (error) {
      toast.error(error.message || "Failed to save expense.");
      setIsSavingExpense(false);
      return;
    }

    toast.success("Expense saved.");
    setExpenseForm({
      expense_date: format(new Date(), "yyyy-MM-dd"),
      expense_type: "",
      description: "",
      amount: "",
    });
    setShowExpenseDialog(false);
    await fetchData();
    setIsSavingExpense(false);
  };

  const exportExpenseHistory = () => {
    downloadCsv(
      "finance-expense-history.csv",
      ["Date", "Expense Type", "Description", "Amount", "Approved By"],
      filteredExpenses.map((row) => [
        row.expense_date,
        row.expense_type,
        row.description || "-",
        row.amount.toFixed(2),
        row.approved_by_name,
      ]),
    );
  };

  const exportSummary = () => {
    downloadCsv(
      "finance-report-summary.csv",
      ["Metric", "Value"],
      [
        ["Total Revenue", totalRevenue.toFixed(2)],
        ["Outstanding Balance", outstandingBalance.toFixed(2)],
        ["Payments Received Count", String(paymentReceivedCount)],
        ["Payments Received Amount", paymentReceivedAmount.toFixed(2)],
        ["Total Expenses", totalExpenses.toFixed(2)],
        ["Monthly Expense", monthlyExpense.toFixed(2)],
        ["Net Profit", netProfit.toFixed(2)],
      ],
    );
  };

  const handleDeleteExpense = async (row: ExpenseRow) => {
    const { error } = await supabase.from("finance_expenses").delete().eq("id", row.id);
    if (error) {
      toast.error(error.message || "Failed to delete expense.");
      return;
    }
    toast.success("Expense deleted.");
    await fetchData();
  };

  const expenseColumns: Column<ExpenseRow>[] = [
    {
      key: "expense_date",
      label: "Date",
      render: (row) => format(new Date(row.expense_date), "PP"),
    },
    { key: "expense_type", label: "Expense Type" },
    {
      key: "description",
      label: "Description",
      render: (row) => row.description || "-",
    },
    {
      key: "amount",
      label: "Amount",
      align: "center",
      render: (row) => {
        const hasOriginal = row.original_amount != null && row.original_currency;

        // If we have an original amount, and it's in the same currency as what's selected (or equivalent like K/ZMW/ZK),
        // we show the original amount directly to ensure perfect precision.
        const isEquivalent = hasOriginal && (
          row.original_currency === code ||
          (row.original_currency === "ZMW" && (code === "ZK" || code === "K")) ||
          (row.original_currency === "ZK" && (code === "ZMW" || code === "K")) ||
          (row.original_currency === "K" && (code === "ZMW" || code === "ZK"))
        );

        if (hasOriginal && isEquivalent) {
          return (
            <div>
              <p>{symbol}{toNumber(row.original_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
          );
        }

        // Otherwise, show the converted amount and the original as a sub-text if they differ
        const isDifferent = hasOriginal && (
          !isEquivalent ||
          Math.abs(toNumber(row.amount) - toNumber(row.original_amount)) > 0.01
        );

        return (
          <div>
            <p>{formatAmount(row.amount)}</p>
            {hasOriginal && isDifferent && (
              <p className="text-[10px] text-muted-foreground whitespace-nowrap">
                Original: {formatAmount(row.original_amount!, row.original_currency!)}
              </p>
            )}
          </div>
        );
      },
    },
    {
      key: "approved_by_name",
      label: "Approved By",
    },
    {
      key: "action",
      label: "Action",
      render: (row) => (
        <div className="flex gap-1">
          <Button
            size="icon"
            variant="outline"
            title="View expense"
            onClick={async () =>
              openFinanceDetailWindow(`Expense ${row.code}`, "Expense Details", [
                { label: "Expense Code", value: row.code },
                { label: "Date", value: format(new Date(row.expense_date), "PP") },
                { label: "Expense Type", value: row.expense_type },
                { label: "Amount", value: formatAmount(row.amount) },
                { label: "Approved By", value: row.approved_by_name },
                { label: "Description", value: row.description || "-" },
              ], undefined, await fetchLogo())
            }
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            title="Delete expense"
            onClick={() => handleDeleteExpense(row)}
          >
            <Trash className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const chartConfig = {
    revenue: {
      label: "Revenue",
      color: "hsl(var(--stat-green))",
    },
    expenses: {
      label: "Expenses",
      color: "hsl(var(--destructive))",
    },
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Financial Reports"
        
      />

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-white border p-1 h-auto gap-1">
          <TabsTrigger
            value="overview"
            className="px-6 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-md transition-all text-sm font-semibold rounded-md"
          >
            Financial Overview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex flex-wrap justify-end gap-2">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button variant="outline" onClick={exportSummary} className="flex-1 sm:flex-none">
                <Download className="mr-2 h-4 w-4" />
                Summary
              </Button>
              <Button variant="outline" onClick={exportExpenseHistory} className="flex-1 sm:flex-none">
                <Download className="mr-2 h-4 w-4" />
                History
              </Button>
            </div>
            <Button onClick={() => setShowExpenseDialog(true)} className="w-full sm:w-auto shadow-md">Add Expense</Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Date Filters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Button variant={dateFilterPreset === "today" ? "default" : "outline"} size="sm" onClick={() => setDateFilterPreset("today")}>Today</Button>
                <Button variant={dateFilterPreset === "yesterday" ? "default" : "outline"} size="sm" onClick={() => setDateFilterPreset("yesterday")}>Yesterday</Button>
                <Button variant={dateFilterPreset === "this_month" ? "default" : "outline"} size="sm" onClick={() => setDateFilterPreset("this_month")}>This Month</Button>
                <Button variant={dateFilterPreset === "this_year" ? "default" : "outline"} size="sm" onClick={() => setDateFilterPreset("this_year")}>This Year</Button>
                <Button variant={dateFilterPreset === "last_year" ? "default" : "outline"} size="sm" onClick={() => setDateFilterPreset("last_year")}>Last Year</Button>
                <Button variant={dateFilterPreset === "custom" ? "default" : "outline"} size="sm" onClick={() => setDateFilterPreset("custom")}>Custom Range</Button>
              </div>
              {dateFilterPreset === "custom" ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="report-from-date">From</Label>
                    <Input id="report-from-date" type="date" value={customFromDate} onChange={(event) => setCustomFromDate(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="report-to-date">To</Label>
                    <Input id="report-to-date" type="date" value={customToDate} onChange={(event) => setCustomToDate(event.target.value)} />
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Total Revenue</CardTitle>
              </CardHeader>
              <CardContent className="min-w-0">
                <p className="text-[clamp(1.25rem,2vw,1.875rem)] leading-tight font-semibold [overflow-wrap:anywhere]">
                  {isLoading ? "..." : formatAmount(totalRevenue)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Outstanding Balance</CardTitle>
              </CardHeader>
              <CardContent className="min-w-0">
                <p className="text-[clamp(1.25rem,2vw,1.875rem)] leading-tight font-semibold [overflow-wrap:anywhere]">
                  {isLoading ? "..." : formatAmount(outstandingBalance)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Payments Received</CardTitle>
              </CardHeader>
              <CardContent className="min-w-0">
                <p className="text-[clamp(1.25rem,2vw,1.875rem)] leading-tight font-semibold [overflow-wrap:anywhere]">{isLoading ? "..." : paymentReceivedCount}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {isLoading ? "..." : formatAmount(paymentReceivedAmount)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Total Expenses</CardTitle>
              </CardHeader>
              <CardContent className="min-w-0">
                <p className="text-[clamp(1.25rem,2vw,1.875rem)] leading-tight font-semibold [overflow-wrap:anywhere]">
                  {isLoading ? "..." : formatAmount(totalExpenses)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Monthly Expense</CardTitle>
              </CardHeader>
              <CardContent className="min-w-0">
                <p className="text-[clamp(1.25rem,2vw,1.875rem)] leading-tight font-semibold [overflow-wrap:anywhere]">
                  {isLoading ? "..." : formatAmount(monthlyExpense)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Net Profit</CardTitle>
              </CardHeader>
              <CardContent className="min-w-0">
                <p className={`text-[clamp(1.25rem,2vw,1.875rem)] leading-tight font-semibold [overflow-wrap:anywhere] ${netProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {isLoading ? "..." : formatAmount(netProfit)}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Monthly Revenue vs Expense</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading chart...</p>
              ) : (
                <ChartContainer config={chartConfig} className="h-[320px]">
                  <BarChart data={monthlySeries} margin={{ left: 12, right: 12, top: 12, bottom: 20 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} />
                    <ChartTooltip
                      cursor={false}
                      content={
                        <ChartTooltipContent
                          formatter={(value) => formatAmount(Number(value))}
                        />
                      }
                    />
                    <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="expenses" fill="var(--color-expenses)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Expense History</CardTitle>
              <Button variant="outline" size="sm" onClick={exportExpenseHistory}>
                Export
              </Button>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={expenseColumns}
                data={filteredExpenses}
                isLoading={isLoading}
                searchPlaceholder="Search expense history..."
              />
            </CardContent>
          </Card>

          <Dialog open={showExpenseDialog} onOpenChange={setShowExpenseDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Expense</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="expense_date">Date</Label>
                  <Input
                    id="expense_date"
                    type="date"
                    value={expenseForm.expense_date}
                    onChange={(event) =>
                      setExpenseForm((prev) => ({ ...prev, expense_date: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expense_type">Expense Type</Label>
                  <Select
                    value={expenseForm.expense_type}
                    onValueChange={(value) =>
                      setExpenseForm((prev) => ({ ...prev, expense_type: value }))
                    }
                  >
                    <SelectTrigger id="expense_type">
                      <SelectValue placeholder="Select expense type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Fuel">Fuel</SelectItem>
                      <SelectItem value="Marketing">Marketing</SelectItem>
                      <SelectItem value="Warehouse Rent">Warehouse Rent</SelectItem>
                      <SelectItem value="Office Supplies">Office Supplies</SelectItem>
                      <SelectItem value="Salaries">Salaries</SelectItem>
                      <SelectItem value="Utilities">Utilities</SelectItem>
                      <SelectItem value="Insurance">Insurance</SelectItem>
                      <SelectItem value="Maintenance">Maintenance</SelectItem>
                      <SelectItem value="Custom Duty">Custom Duty</SelectItem>
                      <SelectItem value="Miscellaneous">Miscellaneous</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expense_amount">Amount ({symbol})</Label>
                  <Input
                    id="expense_amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={expenseForm.amount}
                    onChange={(event) =>
                      setExpenseForm((prev) => ({ ...prev, amount: event.target.value }))
                    }
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expense_description">Description</Label>
                  <Textarea
                    id="expense_description"
                    value={expenseForm.description}
                    onChange={(event) =>
                      setExpenseForm((prev) => ({ ...prev, description: event.target.value }))
                    }
                    placeholder="Enter expense details..."
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowExpenseDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveExpense} disabled={isSavingExpense}>
                  {isSavingExpense ? "Saving..." : "Save Expense"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

      </Tabs>
    </div>
  );
};

export default FinanceReports;

