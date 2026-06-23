import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ArrowRight, CreditCard, DollarSign, Eye, FileText, Loader2, TrendingDown, TrendingUp, Plane, UsersRound } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/components/auth/AuthContext";
import { useDefaultCurrency } from "@/hooks/useDefaultCurrency";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { getRoleLandingRoute } from "@/lib/portalLanding";
import { getActiveConsolidatedShipmentIds } from "@/lib/consolidationShipments";
import {
  isWarehouseAllShipmentsRow,
  mapConsolidationStatusToShipmentStatus,
  normalizeConsolidationStatus,
  normalizeShipmentStatus,
} from "@/lib/warehouseTabFilters";
import { extractNoteValue, getShipmentCbmValue, getWarehouseTrackingNumber, resolveTrackingByStatus } from "@/lib/shipmentNotes";
import {
  formatFinancePaymentMethod,
  getInvoiceBillingAmount,
  getShipmentInvoiceTotal,
  getShipmentOutstandingBalance,
  getInvoiceOutstandingBalance,
  isFinanceInvoiceVisible,
  openFinanceDetailWindow,
  toNumber,
} from "@/lib/financePortal";
import { formatCurrencyDisplay, removeMinorWholeAmountDrift, roundCurrencyAmount } from "@/lib/currencyDisplay";
import { fetchLogo } from "@/hooks/useLogo";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type ShipmentRow = {
  id: string;
  code: string;
  custom_tracking_number: string | null;
  status: string;
  service_type: string | null;
  shipping_cost: number | null;
  payment_status: string | null;
  paid_amount: number | null;
  total_cost: number;
  customer_id: string | null;
  customer_name: string | null;
  customer_code: string | null;
  branch_name: string | null;
  created_at: string;
  updated_at: string;
  weight: number | null;
  cbm: number | null;
  notes: string | null;
};

type PaymentRow = {
  id: string;
  code: string;
  amount: number;
  status: string | null;
  payment_provider: string;
  created_at: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_code: string | null;
  shipment_id: string | null;
};

type InvoiceRow = {
  id: string;
  code: string;
  amount: number;
  status: string | null;
  created_at: string;
  due_date: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_code: string | null;
  shipment_id: string | null;
  shipment_tracking_no: string | null;
  shipment_paid_amount: number | null;
  shipment_total_cost: number | null;
  shipment_shipping_cost: number | null;
};

type ExpenseRow = {
  id: string;
  code: string;
  expense_date: string;
  expense_type: string;
  description: string | null;
  amount: number;
  original_amount: number | null;
  original_currency: string | null;
};

type RefundRow = {
  id: string;
  requested_amount: number;
  status: string | null;
  created_at: string;
};

type ParcelRow = {
  id: string;
  rowType: "shipment" | "consolidation";
  isConsolidatedChild?: boolean;
  customer_name: string;
  service_type: string | null;
  tracking: string | null;
  weight: number | null;
  cbm: number | null;
  status: string;
  created_at: string;
  branch_name?: string | null;
  shipping_cost?: number;
  invoice_total?: number;
  payment_status?: string | null;
};

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: "blue" | "green" | "yellow" | "red" | "orange" | "sky";
  link: string;
}

const StatCard = ({ title, value, icon, color, link }: StatCardProps) => {
  const colorClasses = {
    blue: "stat-card-blue",
    green: "stat-card-green",
    yellow: "stat-card-yellow",
    red: "stat-card-red",
    orange: "bg-orange-500 text-white",
    sky: "bg-sky-500 text-white",
  };

  return (
    <div className={`stat-card ${colorClasses[color]}`}>
      <div className="relative z-10 min-w-0">
        <div className="truncate text-lg font-bold md:text-xl">{value}</div>
        <div className="text-sm opacity-90">{title}</div>
      </div>
      <div className="stat-card-icon">{icon}</div>
      <Link
        to={link}
        className="flex items-center gap-1 border-t border-current/20 pt-3 text-sm font-medium hover:underline"
      >
        View more <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
};

const formatClientLabel = (customerName: string | null | undefined, customerCode: string | null | undefined) => {
  const name = (customerName || "").trim();
  const code = (customerCode || "").trim();
  if (name && code) return `${name} (${code})`;
  if (name) return name;
  if (code) return code;
  return "Client";
};

const dashboardShipmentStatusLabel: Record<string, string> = {
  saved_pickup: "Created",
  saved_dropoff: "Incoming",
  received: "Need Action",
  requested_pickup: "Submitted",
  approved: "Confirm Shipment",
  assigned: "Outgoing Parcel",
  supplied: "In Transit",
  delivered: "Ready for Collection",
  closed: "Collected",
};

const formatDashboardServiceType = (type: string | null) => {
  if (type === "consolidated") return "Consolidated";
  if (type === "air") return "Air Freight";
  if (type === "sea") return "Sea Freight";
  return type || "-";
};

const Dashboard = () => {
  const { userRole, isLoading: isContextLoading } = useAuthContext();
  const navigate = useNavigate();
  const { formatAmount, code, symbol, convert } = useDefaultCurrency();

  const [customerCount, setCustomerCount] = useState(0);
  const [driverCount, setDriverCount] = useState(0);
  const [shipments, setShipments] = useState<ShipmentRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [refunds, setRefunds] = useState<RefundRow[]>([]);
  const [parcels, setParcels] = useState<ParcelRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);

    try {
      const [shipmentsRes, paymentsRes, invoicesRes, expensesRes, refundsRes, consolidationsRes, consolidatedIds] = await Promise.all([
        supabase
          .from("shipments")
          .select(
            "id, code, custom_tracking_number, status, service_type, shipping_cost, payment_status, paid_amount, total_cost, customer_id, created_at, updated_at, weight, cbm, notes, customers(full_name, code), branches!shipments_branch_id_fkey(name)",
          )
          .order("updated_at", { ascending: false })
          .limit(300),
        supabase
          .from("payments")
          .select(
            "id, code, amount, status, payment_provider, created_at, customer_id, shipment_id, customers(full_name, code)",
          )
          .order("created_at", { ascending: false })
          .limit(300),
        supabase
          .from("invoices")
          .select(
            "id, code, amount, status, created_at, due_date, customer_id, shipment_id, customers(full_name, code), shipment:shipments(paid_amount, total_cost, shipping_cost, status)",
          )
          .order("created_at", { ascending: false })
          .limit(300),
        supabase
          .from("finance_expenses")
          .select("id, code, expense_date, expense_type, description, amount, original_amount, original_currency")
          .order("expense_date", { ascending: false })
          .limit(300),
        supabase
          .from("customer_claims")
          .select("id, requested_amount, status, created_at")
          .eq("request_type", "refund")
          .in("status", ["approved", "refunded"] as any)
          .order("created_at", { ascending: false })
          .limit(300),
        supabase
          .from("consolidations")
          .select(
            "id, code, status, tracking_code, created_at, customers(full_name, code), consolidation_shipments(shipment_id, shipment:shipments(service_type, weight, cbm, notes, custom_tracking_number, status))",
          )
          .order("created_at", { ascending: false })
          .limit(300),
        getActiveConsolidatedShipmentIds(),
      ]);

      if (shipmentsRes.error) throw shipmentsRes.error;
      if (paymentsRes.error) throw paymentsRes.error;
      if (invoicesRes.error) throw invoicesRes.error;
      if (expensesRes.error) throw expensesRes.error;
      if (refundsRes.error) throw refundsRes.error;
      if (consolidationsRes.error) throw consolidationsRes.error;

      setCustomerCount(0);
      setDriverCount(0);

      const shipmentRows = ((shipmentsRes.data || []) as any[]).map((row) => ({
        id: row.id,
        code: row.code,
        custom_tracking_number: row.custom_tracking_number || null,
        status: row.status,
        service_type: row.service_type || null,
        shipping_cost: row.shipping_cost === null ? null : toNumber(row.shipping_cost),
        payment_status: row.payment_status || null,
        paid_amount: row.paid_amount === null ? null : toNumber(row.paid_amount),
        total_cost: toNumber(row.total_cost),
        customer_id: row.customer_id || null,
        customer_name: Array.isArray(row.customers) ? row.customers[0]?.full_name || null : row.customers?.full_name || null,
        customer_code: Array.isArray(row.customers) ? row.customers[0]?.code || null : row.customers?.code || null,
        branch_name: Array.isArray(row.branches) ? row.branches[0]?.name || null : row.branches?.name || null,
        created_at: row.created_at,
        updated_at: row.updated_at,
        weight: row.weight === null ? null : toNumber(row.weight),
        cbm: row.cbm === null ? null : toNumber(row.cbm),
        notes: row.notes || null,
      })) as ShipmentRow[];

      const allConsolidationShipmentIds = new Set<string>();
      const activeConsolidationCodes = new Set<string>();
      const shipmentsByConsolidationCode = new Map<string, ShipmentRow[]>();

      shipmentRows.forEach((shipment) => {
        const consolidationCode = extractNoteValue(shipment.notes, "Consolidation")?.trim().toLowerCase();
        if (!consolidationCode) return;
        const existing = shipmentsByConsolidationCode.get(consolidationCode) || [];
        existing.push(shipment);
        shipmentsByConsolidationCode.set(consolidationCode, existing);
      });

      ((consolidationsRes.data || []) as any[]).forEach((row) => {
        const normalizedConsolidationStatus = normalizeConsolidationStatus(row.status);
        if (normalizedConsolidationStatus !== "cancelled" && normalizedConsolidationStatus !== "canceled") {
          activeConsolidationCodes.add((row.code || "").trim().toLowerCase());
        }
        (row.consolidation_shipments || []).forEach((entry: any) => {
          if (entry.shipment_id) {
            allConsolidationShipmentIds.add(entry.shipment_id);
          }
        });
      });

      const visibleShipmentParcels = shipmentRows.filter((shipment) => {
        const consolidationCode = extractNoteValue(shipment.notes, "Consolidation")?.trim().toLowerCase();
        const isExcludedByConsolidation = consolidatedIds.has(shipment.id) || (consolidationCode && activeConsolidationCodes.has(consolidationCode));

        return !isExcludedByConsolidation && isWarehouseAllShipmentsRow({
          rowType: "shipment",
          status: shipment.status,
          isConsolidatedChild: allConsolidationShipmentIds.has(shipment.id),
          notes: shipment.notes,
          handling_method: null // We don't have handling_method easily accessible here without extra join, but status filtering should suffice
        });
      });

      const consolidationParcels = ((consolidationsRes.data || []) as any[]).map((row) => {
        const shipmentsInConsolidationById = new Map<string, any>();

        (row.consolidation_shipments || [])
          .map((entry: any) => entry.shipment)
          .filter(Boolean)
          .forEach((shipment: any) => shipmentsInConsolidationById.set(shipment.id, shipment));

        (shipmentsByConsolidationCode.get((row.code || "").trim().toLowerCase()) || []).forEach((shipment) => {
          if (!shipmentsInConsolidationById.has(shipment.id)) {
            shipmentsInConsolidationById.set(shipment.id, shipment);
          }
        });

        const shipmentsInConsolidation = Array.from(shipmentsInConsolidationById.values());

        const serviceTypes = Array.from(
          new Set(
            shipmentsInConsolidation
              .map((shipment: any) => (shipment.service_type || "").toLowerCase().trim())
              .filter(Boolean),
          ),
        );

        const serviceType =
          serviceTypes.length === 1
            ? serviceTypes[0]
            : serviceTypes.length > 1
              ? "mixed"
              : null;

        const totalWeight = shipmentsInConsolidation.reduce(
          (sum: number, shipment: any) => sum + toNumber(shipment.weight || 0),
          0,
        );
        const totalCbm = shipmentsInConsolidation.reduce(
          (sum: number, shipment: any) => sum + toNumber(getShipmentCbmValue(shipment) || 0),
          0,
        );
        const firstTracking = (() => {
          for (const s of shipmentsInConsolidation) {
            const wt = getWarehouseTrackingNumber(s.notes || null);
            if (wt) return wt;
          }
          return null;
        })();
        const mappedStatus = mapConsolidationStatusToShipmentStatus[normalizeConsolidationStatus(row.status)] || "requested_pickup";

        return {
          id: `consolidation-${row.id}`,
          rowType: "consolidation",
          customer_name: formatClientLabel(
            Array.isArray(row.customers) ? row.customers[0]?.full_name : row.customers?.full_name,
            Array.isArray(row.customers) ? row.customers[0]?.code : row.customers?.code,
          ),
          service_type: serviceType,
          tracking: row.tracking_code?.trim() || firstTracking || null,
          weight: totalWeight,
          cbm: totalCbm,
          status: mappedStatus,
          created_at: row.created_at,
          branch_name: null,
          shipping_cost: 0,
          invoice_total: 0,
          payment_status: null,
        } as ParcelRow;
      });

      setShipments(shipmentRows);

      const shipmentParcelRows: ParcelRow[] = visibleShipmentParcels.map((shipment) => ({
        id: shipment.id,
        rowType: "shipment",
        isConsolidatedChild: allConsolidationShipmentIds.has(shipment.id),
        customer_name: formatClientLabel(shipment.customer_name, shipment.customer_code),
        service_type: shipment.service_type,
        tracking: getWarehouseTrackingNumber(shipment.notes) || "Tracking pending",
        weight: shipment.weight,
        cbm: getShipmentCbmValue(shipment),
        status: normalizeShipmentStatus(shipment.status),
        created_at: shipment.created_at,
        branch_name: shipment.branch_name || "-",
        shipping_cost: shipment.shipping_cost || 0,
        invoice_total: getShipmentInvoiceTotal(shipment),
        payment_status: shipment.payment_status,
      }));
      const parcelRows = [...shipmentParcelRows, ...consolidationParcels].sort(
        (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
      );

      setParcels(parcelRows);

      setPayments(
        ((paymentsRes.data || []) as any[]).map((row) => ({
          id: row.id,
          code: row.code,
          amount: toNumber(row.amount),
          status: row.status || null,
          payment_provider: row.payment_provider || "manual",
          created_at: row.created_at,
          customer_id: row.customer_id || null,
          customer_name: Array.isArray(row.customers) ? row.customers[0]?.full_name || null : row.customers?.full_name || null,
          customer_code: Array.isArray(row.customers) ? row.customers[0]?.code || null : row.customers?.code || null,
          shipment_id: row.shipment_id || null,
        })),
      );

      setInvoices(
        ((invoicesRes.data || []) as any[]).map((row) => {
          const s = Array.isArray(row.shipment) ? row.shipment[0] : row.shipment;
          return {
            id: row.id,
            code: row.code,
            amount: getInvoiceBillingAmount({
              amount: toNumber(row.amount),
              shipment_total_cost: s?.total_cost ?? null,
              shipment_shipping_cost: s?.shipping_cost ?? null,
            }),
            status: row.status || "draft",
            created_at: row.created_at,
            due_date: row.due_date || null,
            customer_id: row.customer_id || null,
            customer_name: Array.isArray(row.customers) ? row.customers[0]?.full_name || null : row.customers?.full_name || null,
            customer_code: Array.isArray(row.customers) ? row.customers[0]?.code || null : row.customers?.code || null,
            shipment_id: row.shipment_id || null,
            shipment_tracking_no: null,
            shipment_paid_amount: s?.paid_amount ?? null,
            shipment_total_cost: s?.total_cost ?? null,
            shipment_shipping_cost: s?.shipping_cost ?? null,
            shipment: s, // Keep the raw shipment for easier calculation later
          };
        }),
      );

      setExpenses(
        ((expensesRes.data || []) as any[]).map((row) => ({
          id: row.id,
          code: row.code,
          expense_date: row.expense_date,
          expense_type: row.expense_type,
          description: row.description || null,
          amount: toNumber(row.amount),
          original_amount: row.original_amount == null ? null : toNumber(row.original_amount),
          original_currency: row.original_currency || null,
        })),
      );

      setRefunds(
        ((refundsRes.data || []) as any[]).map((row) => ({
          id: row.id,
          requested_amount: toNumber(row.requested_amount),
          status: row.status || null,
          created_at: row.created_at,
        })),
      );
    } catch (err: any) {
      toast.error(`Dashboard Error: ${err.message || "Unknown error"}`);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  useEffect(() => {
    let channels: any[] = [];

    const redirectNonAdmin = async () => {
      if (isContextLoading || !userRole || userRole === "admin") return false;

      let assignedPortals: string[] = [];
      if (userRole === "staff" || userRole === "branch_manager") {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        if (userId) {
          const { data: assignments } = await supabase
            .from("staff_portal_assignments")
            .select("portal_id")
            .eq("user_id", userId)
            .order("created_at", { ascending: true });
          assignedPortals = (assignments || []).map((item) => item.portal_id);
        }
      }

      navigate(getRoleLandingRoute(userRole, assignedPortals), { replace: true });
      return true;
    };

    const init = async () => {
      const redirected = await redirectNonAdmin();
      if (redirected) return;

      await fetchData(true);

      const queueRefresh = () => {
        void fetchData(false);
      };

      const tables = ["customers", "drivers", "shipments", "payments", "invoices", "finance_expenses", "customer_claims", "consolidations", "consolidation_shipments"];

      tables.forEach((table) => {
        const channel = supabase
          .channel(`admin-dashboard-${table}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table,
            },
            queueRefresh,
          )
          .subscribe();
        channels.push(channel);
      });
    };

    void init();

    return () => {
      channels.forEach((channel) => {
        supabase.removeChannel(channel);
      });
    };
  }, [navigate, userRole]);

  const invoiceByShipmentId = useMemo(() => {
    const next = new Map<string, InvoiceRow>();
    invoices.forEach((invoice) => {
      if (!invoice.shipment_id || next.has(invoice.shipment_id)) return;
      next.set(invoice.shipment_id, invoice);
    });
    return next;
  }, [invoices]);

  const getExpenseDisplayAmount = (row: ExpenseRow) => {
    if (row.original_amount != null && row.original_currency) {
      return roundCurrencyAmount(convert(row.original_amount, row.original_currency));
    }
    return removeMinorWholeAmountDrift(convert(row.amount));
  };

  const expenseDisplayAmount = useMemo(
    () => roundCurrencyAmount(expenses.reduce((sum, row) => sum + getExpenseDisplayAmount(row), 0)),
    [convert, expenses],
  );

  const expenseAmount = useMemo(
    () => roundCurrencyAmount(expenses.reduce((sum, row) => sum + row.amount, 0)),
    [expenses],
  );

  const refundExpenseAmount = useMemo(
    () => roundCurrencyAmount(refunds.reduce((sum, row) => sum + row.requested_amount, 0)),
    [refunds],
  );

  const totalExpenses = expenseDisplayAmount;

  const outstandingPayments = useMemo(() => {
    return invoices
      .filter((invoice) => isFinanceInvoiceVisible(invoice.status))
      .reduce((sum, invoice) => {
        return sum + getInvoiceOutstandingBalance(invoice, (invoice as any).shipment);
      }, 0);
  }, [invoices]);

  const outstandingPaymentsDisplay = useMemo(
    () => removeMinorWholeAmountDrift(convert(outstandingPayments)),
    [convert, outstandingPayments],
  );

  const totalPayments = useMemo(
    () => payments.reduce((sum, row) => sum + row.amount, 0),
    [payments],
  );

  const completedPaymentAmount = useMemo(
    () => roundCurrencyAmount(payments.filter((row) => row.status === "completed").reduce((sum, row) => sum + row.amount, 0)),
    [payments],
  );

  // Synchronized with FinanceDashboard: Net Profit = Completed Payments - Refunds - Expenses
  const netProfit = roundCurrencyAmount(completedPaymentAmount - refundExpenseAmount - expenseAmount);
  const netProfitDisplay = removeMinorWholeAmountDrift(convert(netProfit));

  const recentTransactions = useMemo(() => payments.slice(0, 10), [payments]);
  const recentInvoices = useMemo(() => invoices.slice(0, 10), [invoices]);
  const expenseHistory = useMemo(() => expenses.slice(0, 10), [expenses]);
  const allParcels = useMemo(() => parcels.slice(0, 10), [parcels]);

  const renderLoaderRow = (colSpan: number) => (
    <TableRow>
      <TableCell colSpan={colSpan} className="py-10 text-center">
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
      </TableCell>
    </TableRow>
  );

  const renderEmptyRow = (label: string, colSpan: number) => (
    <TableRow>
      <TableCell colSpan={colSpan} className="py-10 text-center text-sm text-muted-foreground">
        {label}
      </TableCell>
    </TableRow>
  );

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Admin Dashboard"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          title="All Customers"
          value={customerCount}
          icon={<UsersRound className="h-14 w-14" />}
          color="yellow"
          link="/customers"
        />
        <StatCard
          title="All Drivers"
          value={driverCount}
          icon={<Plane className="h-14 w-14" />}
          color="red"
          link="/drivers"
        />

        <StatCard
          title="Net Profit"
          value={formatCurrencyDisplay(netProfitDisplay, code, symbol)}
          icon={<TrendingUp className="h-14 w-14" />}
          color="green"
          link="/finance/dashboard"
        />
        <StatCard
          title="Total Expenses"
          value={formatCurrencyDisplay(totalExpenses, code, symbol)}
          icon={<TrendingDown className="h-14 w-14" />}
          color="orange"
          link="/finance/reports"
        />
        <StatCard
          title="Outstanding Payments"
          value={formatCurrencyDisplay(outstandingPaymentsDisplay, code, symbol)}
          icon={<DollarSign className="h-14 w-14" />}
          color="sky"
          link="/finance/dashboard"
        />
        <StatCard
          title="Total Payments"
          value={formatAmount(totalPayments)}
          icon={<CreditCard className="h-14 w-14" />}
          color="blue"
          link="/finance/payments"
        />
      </div>

      <div className="grid gap-6">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/60">
            <CardTitle className="text-lg">Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <Table className="min-w-max">
              <TableHeader className="[&_th]:whitespace-nowrap">
                <TableRow>
                  <TableHead>Payment Code</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Invoice No.</TableHead>
                  <TableHead>Payment Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="[&_td]:whitespace-nowrap">
                {isLoading ? (
                  renderLoaderRow(8)
                ) : recentTransactions.length === 0 ? (
                  renderEmptyRow("No recent transactions found", 8)
                ) : (
                  recentTransactions.map((payment) => {
                    const invoiceCode = payment.shipment_id ? invoiceByShipmentId.get(payment.shipment_id)?.code || "-" : "-";
                    return (
                      <TableRow key={payment.id}>
                        <TableCell className="font-mono text-xs">{payment.code}</TableCell>
                        <TableCell>{formatClientLabel(payment.customer_name, payment.customer_code)}</TableCell>
                        <TableCell>{invoiceCode}</TableCell>
                        <TableCell>{formatFinancePaymentMethod(payment.payment_provider)}</TableCell>
                        <TableCell>{formatAmount(payment.amount)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              payment.status === "completed"
                                ? "default"
                                : payment.status === "failed"
                                  ? "destructive"
                                  : "secondary"
                            }
                          >
                            {payment.status || "pending"}
                          </Badge>
                        </TableCell>
                        <TableCell>{format(new Date(payment.created_at), "PP")}</TableCell>
                        <TableCell>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            title="View transaction"
                            onClick={async () =>
                              openFinanceDetailWindow(`Payment ${payment.code}`, "Transaction Details", [
                                { label: "Payment Code", value: payment.code },
                                { label: "Client", value: formatClientLabel(payment.customer_name, payment.customer_code) },
                                { label: "Invoice No.", value: invoiceCode },
                                { label: "Payment Type", value: formatFinancePaymentMethod(payment.payment_provider) },
                                { label: "Amount", value: formatAmount(payment.amount) },
                                { label: "Status", value: payment.status || "pending" },
                                { label: "Date", value: format(new Date(payment.created_at), "PPp") },
                              ], undefined, await fetchLogo())
                            }
                          >
                            <Eye className="h-4 w-4 text-blue-600" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
          <CardFooter className="justify-end border-t border-border/60">
            <Link to="/finance/dashboard" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              View more
            </Link>
          </CardFooter>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/60">
            <CardTitle className="text-lg">Recent Invoices</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <Table className="min-w-max">
              <TableHeader className="[&_th]:whitespace-nowrap">
                <TableRow>
                  <TableHead>Invoice No.</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Shipment ID</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Invoice Status</TableHead>
                  <TableHead>Payment Progress</TableHead>
                  <TableHead>Due Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="[&_td]:whitespace-nowrap">
                {isLoading ? (
                  renderLoaderRow(7)
                ) : recentInvoices.length === 0 ? (
                  renderEmptyRow("No recent invoices found", 7)
                ) : (
                  recentInvoices.map((invoice) => {
                    const paid = Math.max(0, toNumber(invoice.shipment_paid_amount ?? 0));
                    const balance = Math.max(0, invoice.amount - paid);
                    const progress = balance <= 0 ? "paid" : paid > 0 ? "partial" : "unpaid";

                    return (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-mono text-xs">{invoice.code}</TableCell>
                        <TableCell>{formatClientLabel(invoice.customer_name, invoice.customer_code)}</TableCell>
                        <TableCell>{invoice.shipment_tracking_no || "-"}</TableCell>
                        <TableCell>{formatAmount(invoice.amount)}</TableCell>
                        <TableCell>
                          <StatusBadge status={invoice.status || "draft"} />
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <StatusBadge status={progress} />
                            <div className="text-xs text-muted-foreground">
                              {formatAmount(paid)} paid / {formatAmount(balance)} balance
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{invoice.due_date ? format(new Date(invoice.due_date), "dd MMM yyyy") : "-"}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
          <CardFooter className="justify-end border-t border-border/60">
            <Link to="/finance/invoices" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              View more
            </Link>
          </CardFooter>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/60">
            <CardTitle className="text-lg">Expense History</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <Table className="min-w-max">
              <TableHeader className="[&_th]:whitespace-nowrap">
                <TableRow>
                  <TableHead>Expense Code</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="[&_td]:whitespace-nowrap">
                {isLoading ? (
                  renderLoaderRow(5)
                ) : expenseHistory.length === 0 ? (
                  renderEmptyRow("No expense history found", 5)
                ) : (
                  expenseHistory.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell className="font-mono text-xs">{expense.code}</TableCell>
                      <TableCell>{format(new Date(expense.expense_date), "dd MMM yyyy")}</TableCell>
                      <TableCell>{expense.expense_type}</TableCell>
                      <TableCell className="max-w-[320px] truncate">{expense.description || "-"}</TableCell>
                      <TableCell>{formatAmount(expense.amount)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
          <CardFooter className="justify-end border-t border-border/60">
            <Link to="/finance/reports" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              View more
            </Link>
          </CardFooter>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/60">
            <CardTitle className="text-lg">All Shipments</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <Table className="min-w-max">
              <TableHeader className="[&_th]:whitespace-nowrap">
                <TableRow>
                  <TableHead>Customer ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Service Type</TableHead>
                  <TableHead>Tracking No.</TableHead>
                  <TableHead>WT</TableHead>
                  <TableHead>CBM</TableHead>
                  <TableHead>Shipping Cost</TableHead>
                  <TableHead>Departure Date</TableHead>
                  <TableHead>Payment Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="[&_td]:whitespace-nowrap">
                {isLoading ? (
                  renderLoaderRow(12)
                ) : allParcels.length === 0 ? (
                  renderEmptyRow("No shipments found", 12)
                ) : (
                  allParcels.map((parcel) => (
                    <TableRow key={parcel.id}>
                      <TableCell className="font-mono text-xs">
                        {parcel.customer_name.match(/\(([^)]+)\)$/)?.[1] || "-"}
                      </TableCell>
                      <TableCell>{parcel.customer_name.replace(/\s*\([^)]+\)$/, "")}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{dashboardShipmentStatusLabel[parcel.status] || parcel.status}</Badge>
                      </TableCell>
                      <TableCell>{parcel.branch_name || "-"}</TableCell>
                      <TableCell>{formatDashboardServiceType(parcel.service_type)}</TableCell>
                      <TableCell className="font-mono text-xs">{parcel.tracking || "Tracking pending"}</TableCell>
                      <TableCell>{parcel.weight ?? 0}kg</TableCell>
                      <TableCell>{parcel.cbm == null ? "-" : parcel.cbm.toFixed(2)}</TableCell>
                      <TableCell>{formatAmount(parcel.shipping_cost || 0)}</TableCell>
                      <TableCell>{format(new Date(parcel.created_at), "dd MMM yyyy")}</TableCell>
                      <TableCell>
                        <Badge variant={parcel.payment_status === "completed" ? "default" : "destructive"}>
                          {parcel.payment_status === "completed" ? "Paid" : "Unpaid"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          title="View shipment"
                          onClick={() => navigate("/warehouse/shipments")}
                        >
                          <Eye className="h-4 w-4 text-blue-600" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
          <CardFooter className="justify-end border-t border-border/60">
            <Link to="/warehouse/shipments" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              View more
            </Link>
          </CardFooter>
        </Card>


      </div>

      <div className="flex items-center gap-2">
        <Link to="/finance/dashboard" className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted">
          <CreditCard className="h-4 w-4" /> Finance Dashboard
        </Link>
        <Link to="/finance/invoices" className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted">
          <FileText className="h-4 w-4" /> Finance Invoices
        </Link>
      </div>
    </div>
  );
};

export default Dashboard;
