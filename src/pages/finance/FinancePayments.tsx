import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { Check, CheckCircle, Clock, Download, Eye, Loader2, Pencil, XCircle } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import SearchableSelect, { type SearchableSelectOption } from "@/components/shared/SearchableSelect";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { DateRangeFilter } from "@/components/shared/DateRangeFilter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useDefaultCurrency } from "@/hooks/useDefaultCurrency";
import {
  type FinanceDateFilter,
  downloadCsv,
  formatFinancePaymentMethod,
  getFinanceDateRange,
  getInvoiceBillingAmount,
  getInvoiceOutstandingBalance,
  getInvoicePaidAmount,
  getInvoicePaymentState,
  getShipmentInvoiceTotal,
  getShipmentOutstandingBalance,
  isWithinFinanceDateRange,
  openFinanceDetailWindow,
  toNumber,
} from "@/lib/financePortal";
import { getWarehouseTrackingNumber, resolveTrackingByStatus } from "@/lib/shipmentNotes";
import { notifyPaymentReceived } from "@/lib/notifications";
import { toast } from "sonner";
import { fetchLogo } from "@/hooks/useLogo";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

type CustomerOption = {
  id: string;
  code: string;
  full_name: string;
  phone: string | null;
};

type ShipmentOption = {
  id: string;
  code: string;
  custom_tracking_number: string | null;
  customer_id: string;
  customer_name: string | null;
  customer_code: string | null;
  customer_phone: string | null;
  total_cost: number;
  shipping_cost: number | null;
  paid_amount: number | null;
  payment_status: string | null;
  status: string;
};

type InvoiceLookupRow = {
  id: string;
  code: string;
  shipment_id: string | null;
  customer_id: string | null;
  amount: number;
  currency?: string | null;
  status: string | null;
  due_date: string | null;
  created_at: string;
};

type PaymentRow = {
  id: string;
  code: string;
  amount: number;
  currency?: string | null;
  status: string | null;
  payment_provider: string;
  payment_method?: string | null;
  payment_type?: string | null;
  description?: string | null;
  provider_reference: string | null;
  phone_number: string | null;
  callback_data: Record<string, any> | null;
  created_at: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_code: string | null;
  shipment_id: string | null;
  shipment_code: string | null;
  tracking_no: string | null;
  agent_user_id?: string | null;
  payer_label?: string | null;
};

const getPaymentCallbackData = (row: any): Record<string, unknown> => {
  if (!row?.callback_data) return {};
  if (typeof row.callback_data === "string") {
    try {
      return JSON.parse(row.callback_data);
    } catch {
      return {};
    }
  }
  return (row.callback_data as Record<string, unknown>) || {};
};

const isCustomPaymentRecord = (row: any) => {
  if (row.shipment_id) return false;
  const cb = getPaymentCallbackData(row);
  if (cb.payment_type === "custom_payment" || row.payment_type === "custom_payment") return true;
  // Heuristic for older records where payment_type was not persisted:
  // exclude wallet topups and supplier payments by inspecting callback metadata.
  const req = (cb.request as Record<string, unknown> | undefined) || {};
  const walletOwner = (cb.wallet_owner_type as string | undefined) || (req.wallet_owner_type as string | undefined) || null;
  if (walletOwner) return false;
  const narration = String(req.narration || "").toLowerCase();
  if (narration.startsWith("wallet top-up") || narration.startsWith("agent wallet top-up")) return false;
  if (narration.startsWith("supplier payment")) return false;
  // Anything else without a shipment is treated as a custom payment.
  return true;
};

type PaymentTableRow = {
  id: string;
  code: string;
  customer_label: string;
  shipment_ref: string;
  invoice_code: string;
  payment_provider: string;
  payment_provider_label: string;
  provider_reference: string;
  status: string;
  amount: number;
  currency?: string | null;
  balance_before: number;
  balance_after: number;
  created_at: string;
  phone_number: string;
  notes: string;
  payment: PaymentRow;
};

type PaymentFormState = {
  customer_id: string;
  shipment_id: string;
  amount: string;
  payment_provider: string;
  status: string;
  provider_reference: string;
  phone_number: string;
  notes: string;
};

const paymentProviders = [
  "visa_credit_card",
  "cash",
  "bank_transfer",
  "mobile_money",
  "wallet",
  "agent_wallet",
  "lipila",
] as const;

const paymentStatuses = ["pending", "processing", "completed", "failed"] as const;

const emptyForm: PaymentFormState = {
  customer_id: "",
  shipment_id: "",
  amount: "",
  payment_provider: "cash",
  status: "completed",
  provider_reference: "",
  phone_number: "",
  notes: "",
};

const getFinancePaymentGroupKey = (shipment: Pick<ShipmentOption, "id" | "custom_tracking_number">) => {
  const warehouseTracking = shipment.custom_tracking_number?.trim();
  if (warehouseTracking) return `tracking:${warehouseTracking}`;
  return `shipment:${shipment.id}`;
};

const mergeFinancePaymentShipments = (
  rows: ShipmentOption[],
  invoices: InvoiceLookupRow[],
) => {
  const invoiceShipmentIds = new Set(
    invoices
      .map((invoice) => invoice.shipment_id)
      .filter((shipmentId): shipmentId is string => Boolean(shipmentId)),
  );
  const grouped = new Map<string, ShipmentOption>();

  rows.forEach((shipment) => {
    const key = getFinancePaymentGroupKey(shipment);
    const existing = grouped.get(key);

    if (!existing) {
      const initialAmount = getShipmentInvoiceTotal(shipment);
      grouped.set(key, {
        ...shipment,
        shipping_cost: initialAmount,
        total_cost: initialAmount,
      });
      return;
    }

    const shouldPromoteRepresentative =
      !invoiceShipmentIds.has(existing.id) && invoiceShipmentIds.has(shipment.id);
    const representative = shouldPromoteRepresentative ? { ...shipment } : existing;
    const sibling = shouldPromoteRepresentative ? existing : shipment;
    const nextInvoiceTotal = getShipmentInvoiceTotal(representative) + getShipmentInvoiceTotal(sibling);
    const nextPaidAmount = toNumber(representative.paid_amount) + toNumber(sibling.paid_amount);

    grouped.set(key, {
      ...representative,
      shipping_cost: nextInvoiceTotal,
      total_cost: nextInvoiceTotal,
      paid_amount: nextPaidAmount,
    });
  });

  return Array.from(grouped.values());
};

const FinancePayments = () => {
  const { formatAmount, code, defaultCode, convert, convertFromSelected } = useDefaultCurrency();
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [shipments, setShipments] = useState<ShipmentOption[]>([]);
  const [invoices, setInvoices] = useState<InvoiceLookupRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [customPayments, setCustomPayments] = useState<any[]>([]);
  const [customPaymentsLoading, setCustomPaymentsLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("history");
  const [form, setForm] = useState<PaymentFormState>(emptyForm);
  const [editingPayment, setEditingPayment] = useState<PaymentRow | null>(null);
  const [editForm, setEditForm] = useState<PaymentFormState>(emptyForm);

  const reconciliationRanRef = useRef(false);
  const [dateFilter, setDateFilter] = useState<FinanceDateFilter>("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  const dateRange = useMemo(
    () => getFinanceDateRange(dateFilter, { startDate: customStartDate, endDate: customEndDate }),
    [customEndDate, customStartDate, dateFilter],
  );

  const fetchCustomPayments = useCallback(async () => {
    setCustomPaymentsLoading(true);
    const { data, error } = await (supabase as any)
      .from("payments")
      .select("id, code, amount, currency, status, payment_provider, payment_method, payment_type, description, phone_number, provider_reference, callback_data, created_at, customer_id, shipment_id, customer:customers(full_name, code)")
      .order("created_at", { ascending: false })
      .range(0, 10000);

    if (error) {
      toast.error("Failed to load custom payments.");
    } else {
      const paymentRows = ((data || []) as any[]).filter(isCustomPaymentRecord);
      const agentUserIds = Array.from(
        new Set(
          paymentRows
            .map((row) => getPaymentCallbackData(row).agent_user_id)
            .filter((id): id is string => typeof id === "string" && id.trim().length > 0),
        ),
      );

      let profileByUserId = new Map<string, { full_name: string | null; email: string | null }>();

      if (agentUserIds.length > 0) {
        const { data: profileRows } = await (supabase as any)
          .from("profiles")
          .select("user_id, full_name, email")
          .in("user_id", agentUserIds);

        profileByUserId = new Map(
          ((profileRows || []) as any[]).map((profile) => [
            profile.user_id,
            { full_name: profile.full_name || null, email: profile.email || null },
          ]),
        );
      }

      setCustomPayments(
        paymentRows
          .map((row) => {
            const callbackData = getPaymentCallbackData(row);
            const agentUserId = typeof callbackData.agent_user_id === "string" ? callbackData.agent_user_id : null;
            const agentProfile = agentUserId ? profileByUserId.get(agentUserId) || null : null;

            const customerName = Array.isArray(row.customer)
              ? row.customer[0]?.full_name || null
              : row.customer?.full_name || null;
            const customerCode = Array.isArray(row.customer)
              ? row.customer[0]?.code || null
              : row.customer?.code || null;

            const payerLabel = customerName
              ? `${customerName}${customerCode ? ` (${customerCode})` : ""}`
              : agentProfile?.full_name
                ? `${agentProfile.full_name}${agentProfile.email ? ` (${agentProfile.email})` : ""}`
                : agentUserId
                  ? `Agent (${agentUserId.slice(-8).toUpperCase()})`
                  : "Guest / Unknown";

            return {
              id: row.id,
              code: row.code,
              amount: toNumber(row.amount),
              currency: row.currency || null,
              status: row.status || null,
              payment_provider: row.payment_provider || "lipila",
              payment_method: row.payment_method || callbackData.payment_method || null,
              payment_type: row.payment_type || callbackData.payment_type || null,
              description: row.description || callbackData.description || null,
              phone_number: row.phone_number || null,
              provider_reference: row.provider_reference || null,
              callback_data: (row.callback_data as Record<string, unknown> | null) || null,
              created_at: row.created_at,
              customer_id: row.customer_id || null,
              shipment_id: row.shipment_id || null,
              agent_user_id: agentUserId,
              payer_label: payerLabel,
              customer_name: customerName,
              customer_code: customerCode,
            };
          }),
      );
    }
    setCustomPaymentsLoading(false);
  }, []);

  const fetchData = useCallback(async () => {
    setIsLoading(true);

    const [customersRes, shipmentsRes, invoicesRes, paymentsRes] = await Promise.all([
      supabase.from("customers").select("id, code, full_name, phone").order("full_name"),
      supabase
        .from("shipments")
        .select(
          "id, code, custom_tracking_number, notes, customer_id, total_cost, shipping_cost, paid_amount, payment_status, status, customer:customers(full_name, code, phone)",
        )
        .order("updated_at", { ascending: false })
        .limit(400),
      supabase
        .from("invoices")
        .select("id, code, shipment_id, customer_id, amount, status, due_date, created_at, shipment:shipments(total_cost, shipping_cost)")
        .order("created_at", { ascending: false })
        .limit(400),
      supabase
        .from("payments")
        .select(
          "id, code, amount, currency, status, payment_provider, provider_reference, phone_number, callback_data, created_at, customer_id, shipment_id, customer:customers(full_name, code), shipment:shipments(code, custom_tracking_number, notes, status)",
        )
        .order("created_at", { ascending: false })
        .limit(400),
    ]);

    if (customersRes.error || shipmentsRes.error || invoicesRes.error || paymentsRes.error) {
      toast.error("Failed to load finance payment data.");
      setIsLoading(false);
      return;
    }

    const mappedInvoices = ((invoicesRes.data || []) as any[]).map((row) => ({
      id: row.id,
      code: row.code,
      shipment_id: row.shipment_id || null,
      customer_id: row.customer_id || null,
      amount: getInvoiceBillingAmount({
        amount: toNumber(row.amount),
        shipment_total_cost: Array.isArray(row.shipment)
          ? row.shipment[0]?.total_cost ?? null
          : row.shipment?.total_cost ?? null,
        shipment_shipping_cost: Array.isArray(row.shipment)
          ? row.shipment[0]?.shipping_cost ?? null
          : row.shipment?.shipping_cost ?? null,
      }),
      status: row.status || null,
      due_date: row.due_date || null,
      created_at: row.created_at,
    }));

    const mappedShipments = ((shipmentsRes.data || []) as any[]).map((row) => ({
        id: row.id,
        code: row.code,
        custom_tracking_number: resolveTrackingByStatus(row.status, row.notes || null, row.custom_tracking_number) || null,
        customer_id: row.customer_id,
        customer_name: Array.isArray(row.customer)
          ? row.customer[0]?.full_name || null
          : row.customer?.full_name || null,
        customer_code: Array.isArray(row.customer)
          ? row.customer[0]?.code || null
          : row.customer?.code || null,
        customer_phone: Array.isArray(row.customer)
          ? row.customer[0]?.phone || null
          : row.customer?.phone || null,
        total_cost: toNumber(row.total_cost),
        shipping_cost: row.shipping_cost === null ? null : toNumber(row.shipping_cost),
        paid_amount: row.paid_amount === null ? null : toNumber(row.paid_amount),
        payment_status: row.payment_status || null,
        status: row.status,
      }));

    setCustomers((customersRes.data as CustomerOption[] | null) || []);
    setShipments(mergeFinancePaymentShipments(mappedShipments, mappedInvoices));
    setInvoices(mappedInvoices);
    setPayments(
      ((paymentsRes.data || []) as any[]).map((row) => ({
        id: row.id,
        code: row.code,
        amount: toNumber(row.amount),
          currency: row.currency || "ZMW",
        status: row.status || "pending",
        payment_provider: row.payment_provider || "cash",
        provider_reference: row.provider_reference || null,
        phone_number: row.phone_number || null,
        callback_data: (row.callback_data as Record<string, any> | null) || null,
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
      })),
    );

    setIsLoading(false);

    // Auto-reconcile: compare actual completed payment totals vs shipment paid_amount
    // Only run once per mount to avoid loops
    if (reconciliationRanRef.current) return;
    reconciliationRanRef.current = true;

    try {
      const completedPayments = ((paymentsRes.data || []) as any[]).filter(
        (p) => p.status === "completed" && p.shipment_id,
      );
      const paidByShipment = new Map<string, number>();
      completedPayments.forEach((p) => {
        paidByShipment.set(p.shipment_id, (paidByShipment.get(p.shipment_id) || 0) + toNumber(p.amount));
      });

      const shipmentMap = new Map(
        ((shipmentsRes.data || []) as any[]).map((s) => [s.id, s]),
      );

      // Build invoice lookup by shipment_id for correct billing amounts
      const invoiceByShipment = new Map<string, number>();
      ((invoicesRes.data || []) as any[]).forEach((inv) => {
        if (inv.shipment_id && !invoiceByShipment.has(inv.shipment_id)) {
          const shipment = shipmentMap.get(inv.shipment_id);
          invoiceByShipment.set(
            inv.shipment_id,
            getInvoiceBillingAmount(
              { amount: toNumber(inv.amount) },
              shipment
                ? { total_cost: toNumber(shipment.total_cost), shipping_cost: shipment.shipping_cost === null ? null : toNumber(shipment.shipping_cost) }
                : null,
            ),
          );
        }
      });

      const fixes: Array<{ id: string; paid_amount: number;
  currency?: string | null; payment_status: string }> = [];
      for (const [shipmentId, actualPaid] of paidByShipment.entries()) {
        const shipment = shipmentMap.get(shipmentId);
        if (!shipment) continue;
        const currentPaid = toNumber(shipment.paid_amount);

        // Use invoice billing amount if an invoice exists, otherwise use shipment cost
        const total = invoiceByShipment.has(shipmentId)
          ? invoiceByShipment.get(shipmentId)!
          : getShipmentInvoiceTotal({
              total_cost: toNumber(shipment.total_cost),
              shipping_cost: shipment.shipping_cost === null ? null : toNumber(shipment.shipping_cost),
            });

        const correctPaid = Math.max(0, Math.min(total, Number(actualPaid.toFixed(2))));
        if (Math.abs(correctPaid - currentPaid) >= 0.01) {
          fixes.push({
            id: shipmentId,
            paid_amount: correctPaid,
            payment_status: correctPaid <= 0 ? "pending" : correctPaid >= total ? "completed" : "partial",
          });
        }
      }

      if (fixes.length > 0) {
        await Promise.all(
          fixes.map((fix) =>
            supabase
              .from("shipments")
              .update({ paid_amount: fix.paid_amount, payment_status: fix.payment_status })
              .eq("id", fix.id),
          ),
        );
        // Refresh to show corrected data (reconciliation won't re-run due to ref guard)
        void fetchData();
      }
    } catch {
      // Reconciliation errors are non-critical
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (activeTab === "custom") {
      void fetchCustomPayments();
    }
  }, [activeTab, fetchCustomPayments]);

  const shipmentById = useMemo(
    () => new Map(shipments.map((shipment) => [shipment.id, shipment])),
    [shipments],
  );

  const customerById = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer])),
    [customers],
  );

  const invoiceByShipmentId = useMemo(() => {
    const map = new Map<string, InvoiceLookupRow>();
    invoices.forEach((invoice) => {
      if (invoice.shipment_id && !map.has(invoice.shipment_id)) {
        map.set(invoice.shipment_id, invoice);
      }
    });
    return map;
  }, [invoices]);

  const getShipmentInvoice = (shipmentId: string | null | undefined) =>
    shipmentId ? invoiceByShipmentId.get(shipmentId) || null : null;

  const getShipmentDueAmount = (shipmentId: string | null | undefined, ignoredPayment?: PaymentRow | null) => {
    if (!shipmentId) return 0;

    const shipment = shipmentById.get(shipmentId);
    if (!shipment) return 0;

    const invoice = getShipmentInvoice(shipmentId);
    const shipmentPaid = toNumber(shipment.paid_amount);
    const ignoredAmount =
      ignoredPayment?.shipment_id === shipmentId && ignoredPayment.status === "completed"
        ? ignoredPayment.amount
        : 0;

    if (invoice) {
      return getInvoiceOutstandingBalance(invoice, { paid_amount: shipmentPaid }) + ignoredAmount;
    }

    return getShipmentOutstandingBalance(shipment) + ignoredAmount;
  };

  const customerOptions = useMemo<SearchableSelectOption[]>(
    () =>
      customers.map((customer) => ({
        value: customer.id,
        label: `${customer.full_name} (${customer.code})`,
        keywords: `${customer.full_name} ${customer.code} ${customer.phone || ""}`,
      })),
    [customers],
  );

  const buildShipmentOptions = (customerId: string) => {
    const rows = customerId
      ? shipments.filter((shipment) => shipment.customer_id === customerId)
      : shipments;

    return rows
      .filter((shipment) => getShipmentDueAmount(shipment.id) > 0)
      .map<SearchableSelectOption>((shipment) => ({
        value: shipment.id,
        label: shipment.custom_tracking_number?.trim() || "Tracking pending",
        keywords: `${shipment.custom_tracking_number || ""} ${shipment.code} ${shipment.customer_name || ""} ${shipment.customer_code || ""}`,
        description: `${shipment.customer_name || "Customer"}${shipment.customer_code ? ` (${shipment.customer_code})` : ""} | ${formatAmount(getShipmentDueAmount(shipment.id))} due`,
      }));
  };

  const shipmentOptions = useMemo(
    () => buildShipmentOptions(form.customer_id),
    [form.customer_id, shipments, invoices, formatAmount],
  );

  const editShipmentOptions = useMemo(
    () => buildShipmentOptions(editForm.customer_id),
    [editForm.customer_id, shipments, invoices, formatAmount],
  );

  const selectedShipment = useMemo(
    () => shipmentById.get(form.shipment_id) || null,
    [form.shipment_id, shipmentById],
  );

  const selectedInvoice = useMemo(
    () => getShipmentInvoice(form.shipment_id),
    [form.shipment_id, invoiceByShipmentId],
  );

  const selectedDueAmount = useMemo(
    () => getShipmentDueAmount(form.shipment_id),
    [form.shipment_id, shipmentById, invoiceByShipmentId],
  );

  const editSelectedShipment = useMemo(
    () => shipmentById.get(editForm.shipment_id) || null,
    [editForm.shipment_id, shipmentById],
  );

  const editSelectedInvoice = useMemo(
    () => getShipmentInvoice(editForm.shipment_id),
    [editForm.shipment_id, invoiceByShipmentId],
  );

  const editDueAmount = useMemo(
    () => getShipmentDueAmount(editForm.shipment_id, editingPayment),
    [editForm.shipment_id, editingPayment, shipmentById, invoiceByShipmentId],
  );

  const getPaymentNotes = (payment: PaymentRow) => {
    const notes = payment.callback_data?.finance_notes;
    return typeof notes === "string" ? notes : "";
  };

  const formatAmountInput = (amountInDefaultCurrency: number) =>
    Number(convert(amountInDefaultCurrency).toFixed(2)).toFixed(2);

  const handleCustomerChange = (customerId: string) => {
    setForm((prev) => {
      const keepShipment =
        prev.shipment_id && shipmentById.get(prev.shipment_id)?.customer_id === customerId;

      const nextShipmentId = keepShipment ? prev.shipment_id : "";
      const nextShipment = nextShipmentId ? shipmentById.get(nextShipmentId) || null : null;
      const nextCustomer = customerById.get(customerId) || null;

      return {
        ...prev,
        customer_id: customerId,
        shipment_id: nextShipmentId,
        phone_number:
          prev.phone_number ||
          nextShipment?.customer_phone ||
          nextCustomer?.phone ||
          "",
        amount: nextShipmentId ? formatAmountInput(getShipmentDueAmount(nextShipmentId)) : prev.amount,
      };
    });
  };

  const handleShipmentChange = (shipmentId: string) => {
    const shipment = shipmentById.get(shipmentId);
    if (!shipment) return;

    setForm((prev) => ({
      ...prev,
      shipment_id: shipmentId,
      customer_id: shipment.customer_id,
      amount: formatAmountInput(getShipmentDueAmount(shipmentId)),
      phone_number: prev.phone_number || shipment.customer_phone || "",
    }));
  };

  const handleEditCustomerChange = (customerId: string) => {
    setEditForm((prev) => {
      const keepShipment =
        prev.shipment_id && shipmentById.get(prev.shipment_id)?.customer_id === customerId;

      const nextShipmentId = keepShipment ? prev.shipment_id : "";
      const nextShipment = nextShipmentId ? shipmentById.get(nextShipmentId) || null : null;
      const nextCustomer = customerById.get(customerId) || null;

      return {
        ...prev,
        customer_id: customerId,
        shipment_id: nextShipmentId,
        amount: nextShipmentId ? formatAmountInput(getShipmentDueAmount(nextShipmentId, editingPayment)) : prev.amount,
        phone_number:
          prev.phone_number ||
          nextShipment?.customer_phone ||
          nextCustomer?.phone ||
          "",
      };
    });
  };

  const handleEditShipmentChange = (shipmentId: string) => {
    const shipment = shipmentById.get(shipmentId);
    if (!shipment) return;

    setEditForm((prev) => ({
      ...prev,
      shipment_id: shipmentId,
      customer_id: shipment.customer_id,
      amount: formatAmountInput(getShipmentDueAmount(shipmentId, editingPayment)),
      phone_number: prev.phone_number || shipment.customer_phone || "",
    }));
  };

  const paymentRows = useMemo<PaymentTableRow[]>(
    () =>
      payments
        .filter((payment) => payment.status === "completed")
        .map((payment) => {
          const shipment = payment.shipment_id ? shipmentById.get(payment.shipment_id) : null;
          const invoice = getShipmentInvoice(payment.shipment_id);
          const balanceAfter = payment.shipment_id ? getShipmentDueAmount(payment.shipment_id) : 0;
          const balanceBefore = balanceAfter + payment.amount;

          return {
            id: payment.id,
            code: payment.code,
            customer_label:
              payment.customer_name
                ? `${payment.customer_name}${payment.customer_code ? ` (${payment.customer_code})` : ""}`
                : payment.customer_code || "Customer",
            shipment_ref:
              shipment?.custom_tracking_number ||
              payment.tracking_no ||
              shipment?.code ||
              payment.shipment_code ||
              "-",
            invoice_code: invoice?.code || "-",
            payment_provider: payment.payment_provider,
            payment_provider_label: formatFinancePaymentMethod(payment.payment_provider),
            provider_reference: payment.provider_reference || "-",
            status: payment.status || "completed",
            amount: payment.amount,
            balance_before: balanceBefore,
            balance_after: balanceAfter,
            created_at: payment.created_at,
            phone_number: payment.phone_number || "-",
            notes: getPaymentNotes(payment),
            payment,
          };
        }),
    [payments, shipmentById, invoiceByShipmentId],
  );

  const pendingInvoiceRows = useMemo<PaymentTableRow[]>(() => {
    return invoices
      .filter((inv) => ["sent", "approved"].includes(inv.status || ""))
      .map((inv) => {
        const shipment = inv.shipment_id ? shipmentById.get(inv.shipment_id) : null;
        const balance = getInvoiceOutstandingBalance(inv, { paid_amount: shipment?.paid_amount });
        
        if (balance <= 0) return null;

        return {
          id: inv.id,
          code: inv.code,
          customer_label: (inv as any).customer_name ? `${(inv as any).customer_name}${(inv as any).customer_code ? ` (${(inv as any).customer_code})` : ""}` : "-",
          shipment_ref: shipment?.custom_tracking_number || shipment?.code || "-",
          invoice_code: inv.code,
          payment_provider: "pending",
          payment_provider_label: "Awaiting Payment",
          provider_reference: "-",
          status: "pending",
          amount: inv.amount,
          balance_before: inv.amount,
          balance_after: balance,
          created_at: inv.created_at,
          phone_number: "-",
          notes: "Invoice sent and awaiting payment",
          payment: {
            id: inv.id,
            code: inv.code,
            amount: inv.amount,
            status: "pending",
            payment_provider: "manual",
            created_at: inv.created_at,
            customer_id: inv.customer_id,
            shipment_id: inv.shipment_id,
            provider_reference: null,
            phone_number: null,
            callback_data: null,
            customer_name: (inv as any).customer_name,
            customer_code: (inv as any).customer_code,
            shipment_code: shipment?.code || null,
            tracking_no: shipment?.custom_tracking_number || null,
          } as any,
        };
      })
      .filter((row): row is PaymentTableRow => row !== null);
  }, [invoices, shipmentById]);

  const summary = useMemo(() => {
    const totalAmount = paymentRows.reduce((sum, payment) => sum + payment.amount, 0);
    const bankRows = paymentRows.filter((payment) => payment.payment_provider === "bank_transfer");
    const mobileRows = paymentRows.filter(
      (payment) => payment.payment_provider === "mobile_money" || payment.payment_provider === "lipila",
    );

    return {
      totalAmount,
      totalCount: paymentRows.length,
      pendingAmount: pendingInvoiceRows.reduce((sum, row) => sum + row.balance_after, 0),
      pendingCount: pendingInvoiceRows.length,
      bankAmount: bankRows.reduce((sum, payment) => sum + payment.amount, 0),
      bankCount: bankRows.length,
      mobileAmount: mobileRows.reduce((sum, payment) => sum + payment.amount, 0),
      mobileCount: mobileRows.length,
      cashAmount: paymentRows.filter(p => p.payment_provider === "cash").reduce((sum, p) => sum + p.amount, 0),
      cashCount: paymentRows.filter(p => p.payment_provider === "cash").length,
    };
  }, [paymentRows, pendingInvoiceRows]);

  const historyRows = paymentRows;
  const pendingRows = pendingInvoiceRows;
  const bankRows = useMemo(
    () => paymentRows.filter((payment) => payment.payment_provider === "bank_transfer"),
    [paymentRows],
  );
  const mobileRows = useMemo(
    () =>
      paymentRows.filter(
        (payment) => payment.payment_provider === "mobile_money" || payment.payment_provider === "lipila",
      ),
    [paymentRows],
  );
  const cashRows = useMemo(
    () => paymentRows.filter((payment) => payment.payment_provider === "cash"),
    [paymentRows],
  );

  const filteredCustomPayments = useMemo(
    () => customPayments.filter((payment) => isWithinFinanceDateRange(payment.created_at, dateRange)),
    [customPayments, dateRange],
  );

  const customPaymentSummary = useMemo(
    () => ({
      count: filteredCustomPayments.length,
      amount: filteredCustomPayments.reduce((sum, payment) => sum + payment.amount, 0),
    }),
    [filteredCustomPayments],
  );

  // Reconciliation: build list of shipments with payment mismatches
  type ReconciliationRow = {
    shipmentId: string;
    trackingNo: string;
    customerLabel: string;
    totalBilling: number;
    recordedPaid: number;
    currentPaidAmount: number;
  currency?: string | null;
    difference: number;
    status: string;
  };

  const reconciliationRows = useMemo<ReconciliationRow[]>(() => {
    const paidByShipment = new Map<string, number>();
    payments.forEach((p) => {
      if (p.status === "completed" && p.shipment_id) {
        paidByShipment.set(p.shipment_id, (paidByShipment.get(p.shipment_id) || 0) + p.amount);
      }
    });

    const rows: ReconciliationRow[] = [];
    shipments.forEach((shipment) => {
      const invoice = getShipmentInvoice(shipment.id);
      const totalBilling = invoice ? invoice.amount : getShipmentInvoiceTotal(shipment);
      const currentPaidAmount = toNumber(shipment.paid_amount);
      const recordedPaid = paidByShipment.get(shipment.id) || 0;
      const difference = recordedPaid - currentPaidAmount;

      if (Math.abs(difference) >= 0.01 || recordedPaid > totalBilling) {
        const customer = shipment.customer_id ? customerById.get(shipment.customer_id) : null;
        rows.push({
          shipmentId: shipment.id,
          trackingNo: shipment.custom_tracking_number || shipment.code,
          customerLabel: customer
            ? `${customer.full_name}${customer.code ? ` (${customer.code})` : ""}`
            : shipment.customer_name
              ? `${shipment.customer_name}${shipment.customer_code ? ` (${shipment.customer_code})` : ""}`
              : "Customer",
          totalBilling,
          recordedPaid,
          currentPaidAmount,
          difference,
          status: recordedPaid > totalBilling ? "overpaid" : Math.abs(difference) >= 0.01 ? "mismatch" : "ok",
        });
      }
    });

    return rows;
  }, [shipments, payments, invoiceByShipmentId, customerById]);

  const reconciliationSummary = useMemo(
    () => ({
      count: reconciliationRows.length,
      amount: reconciliationRows.reduce((sum, row) => sum + Math.abs(row.difference), 0),
    }),
    [reconciliationRows],
  );

  const handleReconcileShipment = async (row: ReconciliationRow) => {
    setIsSaving(true);
    try {
      const correctPaid = Math.max(0, Math.min(row.totalBilling, Number(row.recordedPaid.toFixed(2))));
      const paymentStatus = correctPaid <= 0 ? "pending" : correctPaid >= row.totalBilling ? "completed" : "partial";

      const { error } = await supabase
        .from("shipments")
        .update({ paid_amount: correctPaid, payment_status: paymentStatus })
        .eq("id", row.shipmentId);
      if (error) throw error;

      if (paymentStatus === "completed") {
        await supabase
          .from("invoices")
          .update({ status: "paid" })
          .eq("shipment_id", row.shipmentId)
          .in("status", ["sent", "approved"]);
      }

      toast.success(`Reconciled ${row.trackingNo}: paid_amount set to ${formatAmount(correctPaid)}`);
      await fetchData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to reconcile.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReconcileAll = async () => {
    if (reconciliationRows.length === 0) return;
    setIsSaving(true);
    try {
      for (const row of reconciliationRows) {
        const correctPaid = Math.max(0, Math.min(row.totalBilling, Number(row.recordedPaid.toFixed(2))));
        const paymentStatus = correctPaid <= 0 ? "pending" : correctPaid >= row.totalBilling ? "completed" : "partial";

        await supabase
          .from("shipments")
          .update({ paid_amount: correctPaid, payment_status: paymentStatus })
          .eq("id", row.shipmentId);

        if (paymentStatus === "completed") {
          await supabase
            .from("invoices")
            .update({ status: "paid" })
            .eq("shipment_id", row.shipmentId)
            .in("status", ["sent", "approved"]);
        }
      }

      toast.success(`Reconciled ${reconciliationRows.length} shipment(s).`);
      await fetchData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to reconcile.");
    } finally {
      setIsSaving(false);
    }
  };

  const reconciliationColumns: Column<ReconciliationRow>[] = [
    { key: "trackingNo", label: "Shipment ID" },
    { key: "customerLabel", label: "Customer" },
    { key: "totalBilling", label: "Billing Total", align: "center", render: (row) => formatAmount(row.totalBilling) },
    { key: "recordedPaid", label: "Payments Recorded", align: "center", render: (row) => formatAmount(row.recordedPaid) },
    { key: "currentPaidAmount", label: "Current Paid Amount", align: "center", render: (row) => formatAmount(row.currentPaidAmount) },
    { key: "difference", label: "Difference", align: "center", render: (row) => (
      <span className={row.difference > 0 ? "text-green-600 font-medium" : row.difference < 0 ? "text-red-600 font-medium" : ""}>
        {row.difference > 0 ? "+" : ""}{formatAmount(row.difference)}
      </span>
    )},
    { key: "status", label: "Status", render: (row) => (
      <Badge variant={row.status === "overpaid" ? "destructive" : row.status === "mismatch" ? "secondary" : "default"}>
        {row.status === "overpaid" ? "Overpaid" : row.status === "mismatch" ? "Mismatch" : "OK"}
      </Badge>
    )},
    { key: "action", label: "Action", render: (row) => (
      <Button size="sm" variant="outline" onClick={() => handleReconcileShipment(row)} disabled={isSaving}>
        Reconcile
      </Button>
    )},
  ];

  const exportPaymentHistory = (rows: PaymentTableRow[], filename = "finance-payment-history.csv") => {
    downloadCsv(
      filename,
      [
        "Payment Ref",
        "Customer",
        "Shipment ID",
        "Invoice No",
        "Method",
        "Provider Reference",
        "Status",
        "Amount",
        "Balance Before",
        "Balance Remaining",
        "Phone Number",
        "Date Time",
        "Notes",
      ],
      rows.map((row) => [
        row.code,
        row.customer_label,
        row.shipment_ref,
        row.invoice_code,
        row.payment_provider_label,
        row.provider_reference,
        row.status,
        formatAmount(row.amount, row.payment?.currency || "ZMW"),
        row.balance_before.toFixed(2),
        row.balance_after.toFixed(2),
        row.phone_number,
        format(new Date(row.created_at), "PPpp"),
        row.notes || "-",
      ]),
    );
  };

  const downloadPaymentTransaction = (row: PaymentTableRow) => {
    exportPaymentHistory([row], `payment-${row.code}.csv`);
  };

  const buildPaymentStatus = (paidAmount: number, invoiceTotal: number) => {
    if (paidAmount <= 0) return "pending";
    if (paidAmount >= invoiceTotal) return "completed";
    return "partial";
  };

  const syncShipmentPaymentStatus = async (shipmentId: string, deltaAmount: number) => {
    // Fetch the target shipment with its notes to find tracking number
    const { data: targetShipment, error } = await supabase
      .from("shipments")
      .select("id, total_cost, shipping_cost, paid_amount, notes, custom_tracking_number")
      .eq("id", shipmentId)
      .maybeSingle();

    if (error || !targetShipment) {
      throw error || new Error("Shipment not found.");
    }

    // Determine warehouse tracking number to find sibling shipments
    const warehouseTracking = getWarehouseTrackingNumber(targetShipment.notes || null)?.trim();

    // If there's a warehouse tracking number, find ALL sibling shipments sharing it
    let siblingShipments: Array<{ id: string; total_cost: number; shipping_cost: number | null; paid_amount: number | null }> = [];
    if (warehouseTracking) {
      const { data: allShipments } = await supabase
        .from("shipments")
        .select("id, total_cost, shipping_cost, paid_amount, notes")
        .or(`custom_tracking_number.eq.${warehouseTracking},notes.ilike.%${warehouseTracking}%`);

      siblingShipments = ((allShipments || []) as any[]).filter((s) => {
        const sTracking = getWarehouseTrackingNumber(s.notes || null)?.trim();
        return sTracking === warehouseTracking;
      });
    }

    // If no siblings found (single shipment), apply directly like before
    if (siblingShipments.length <= 1) {
      const { data: invoice } = await supabase
        .from("invoices")
        .select("amount")
        .eq("shipment_id", shipmentId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const total = invoice
        ? getInvoiceBillingAmount(
            { amount: toNumber(invoice.amount) },
            { total_cost: targetShipment.total_cost, shipping_cost: targetShipment.shipping_cost },
          )
        : getShipmentInvoiceTotal(targetShipment);

      const nextPaidAmount = Math.max(
        0,
        Math.min(total, Number((toNumber(targetShipment.paid_amount) + deltaAmount).toFixed(2))),
      );

      const { error: updateError } = await supabase
        .from("shipments")
        .update({
          paid_amount: nextPaidAmount,
          payment_status: buildPaymentStatus(nextPaidAmount, total),
        })
        .eq("id", shipmentId);

      if (updateError) throw updateError;
      return;
    }

    // Distribute payment across siblings proportionally
    // First compute total group billing and total group already paid
    const siblingInvoiceIds = siblingShipments.map((s) => s.id);
    const { data: siblingInvoices } = await supabase
      .from("invoices")
      .select("amount, shipment_id")
      .in("shipment_id", siblingInvoiceIds)
      .order("created_at", { ascending: false });

    const invoiceByShipment = new Map<string, number>();
    ((siblingInvoices || []) as any[]).forEach((inv) => {
      if (inv.shipment_id && !invoiceByShipment.has(inv.shipment_id)) {
        invoiceByShipment.set(inv.shipment_id, toNumber(inv.amount));
      }
    });

    const getSiblingBillingTotal = (s: { id: string; total_cost: number; shipping_cost: number | null }) => {
      const invAmount = invoiceByShipment.get(s.id);
      if (invAmount && invAmount > 0) return invAmount;
      return getShipmentInvoiceTotal(s);
    };

    const groupBillingTotal = siblingShipments.reduce((sum, s) => sum + getSiblingBillingTotal(s), 0);
    const groupCurrentPaid = siblingShipments.reduce((sum, s) => sum + toNumber(s.paid_amount), 0);
    const groupNewPaid = Math.max(0, Math.min(groupBillingTotal, Number((groupCurrentPaid + deltaAmount).toFixed(2))));

    // Distribute the new total paid across siblings, filling each up to its billing amount
    let remaining = groupNewPaid;
    const updates: Array<{ id: string; paid_amount: number;
  currency?: string | null; total: number }> = [];
    for (const sibling of siblingShipments) {
      const siblingTotal = getSiblingBillingTotal(sibling);
      const allocated = Math.min(siblingTotal, remaining);
      updates.push({ id: sibling.id, paid_amount: Number(allocated.toFixed(2)), total: siblingTotal });
      remaining = Number(Math.max(0, remaining - allocated).toFixed(2));
    }

    // Update each sibling shipment
    for (const update of updates) {
      const { error: updateError } = await supabase
        .from("shipments")
        .update({
          paid_amount: update.paid_amount,
          payment_status: buildPaymentStatus(update.paid_amount, update.total),
        })
        .eq("id", update.id);

      if (updateError) throw updateError;
    }
  };

  const applyPaymentImpact = async (
    previousPayment: Pick<PaymentRow, "shipment_id" | "status" | "amount"> | null,
    nextPayment: Pick<PaymentRow, "shipment_id" | "status" | "amount"> | null,
  ) => {
    const deltas = new Map<string, number>();

    if (previousPayment?.shipment_id && previousPayment.status === "completed") {
      deltas.set(
        previousPayment.shipment_id,
        (deltas.get(previousPayment.shipment_id) || 0) - previousPayment.amount,
      );
    }

    if (nextPayment?.shipment_id && nextPayment.status === "completed") {
      deltas.set(
        nextPayment.shipment_id,
        (deltas.get(nextPayment.shipment_id) || 0) + nextPayment.amount,
      );
    }

    for (const [shipmentId, delta] of deltas.entries()) {
      if (Math.abs(delta) < 0.001) continue;
      await syncShipmentPaymentStatus(shipmentId, delta);
    }
  };

  const createPaymentCode = async () => {
    const { data, error } = await supabase.rpc("generate_code", { prefix: "PAY" });
    if (error || !data) {
      return `PAY-${Date.now()}`;
    }
    return data;
  };

  const handleRecordPayment = async () => {
    if (!form.shipment_id) {
      toast.error("Search and select a shipment.");
      return;
    }

    const inputAmount = Number(form.amount);
    if (Number.isNaN(inputAmount) || inputAmount <= 0) {
      toast.error("Enter a valid payment amount.");
      return;
    }

    const shipment = shipmentById.get(form.shipment_id);
    if (!shipment) {
      toast.error("Selected shipment was not found.");
      return;
    }

    // Convert the user's input (entered in the currently selected currency)
    // back to the system base/default currency so it matches invoice amounts.
    const amount = code === defaultCode
      ? inputAmount
      : Number(convertFromSelected(inputAmount).toFixed(2));

    const customerId = form.customer_id || shipment.customer_id;
    const dueAmount = getShipmentDueAmount(form.shipment_id);
    if (dueAmount <= 0) {
      toast.error("This shipment is already fully paid. No further payments can be recorded.");
      return;
    }
    if (amount > dueAmount + 0.01) {
      toast.error("Amount exceeds the outstanding balance.");
      return;
    }

    setIsSaving(true);

    try {
      const paymentCode = await createPaymentCode();
      const { error } = await supabase.from("payments").insert({
        code: paymentCode,
        customer_id: customerId,
        shipment_id: form.shipment_id,
        amount,
        currency: defaultCode,
        payment_provider: form.payment_provider,
        provider_reference: form.provider_reference || null,
        phone_number: form.phone_number || null,
        status: form.status,
        callback_data: {
          manual_entry: true,
          finance_notes: form.notes || null,
          recorded_at: new Date().toISOString(),
          entered_amount: inputAmount,
          entered_currency: code,
        },
      });

      if (error) {
        throw error;
      }

      await applyPaymentImpact(null, {
        shipment_id: form.shipment_id,
        amount,
        status: form.status,
      });

      toast.success("Payment recorded.");

      if (customerId && form.status === "completed") {
        const trackingNumber = resolveTrackingByStatus(shipment.status, (shipment as any).notes || null, shipment.custom_tracking_number) || shipment.code;
        notifyPaymentReceived(customerId, String(amount), trackingNumber);
      }

      setForm(emptyForm);

      const { data: refreshedPayments } = await supabase
        .from("payments")
        .select(
          "id, code, amount, currency, status, payment_provider, provider_reference, phone_number, callback_data, created_at, customer_id, shipment_id, customer:customers(full_name, code), shipment:shipments(code, custom_tracking_number, notes, status)",
        )
        .order("created_at", { ascending: false })
        .limit(400);

      if (refreshedPayments) {
        setPayments(
          (refreshedPayments as any[]).map((row) => ({
            id: row.id,
            code: row.code,
            amount: toNumber(row.amount),
          currency: row.currency || "ZMW",
            status: row.status || "pending",
            payment_provider: row.payment_provider || "cash",
            provider_reference: row.provider_reference || null,
            phone_number: row.phone_number || null,
            callback_data: (row.callback_data as Record<string, any> | null) || null,
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
          })),
        );
      }
      const { data: refreshedShipments } = await supabase
        .from("shipments")
        .select(
          "id, code, custom_tracking_number, notes, customer_id, total_cost, shipping_cost, paid_amount, payment_status, status, customer:customers(full_name, code, phone)",
        )
        .order("updated_at", { ascending: false })
        .limit(400);

      if (refreshedShipments) {
        setShipments(
          mergeFinancePaymentShipments((refreshedShipments as any[]).map((row) => ({
            id: row.id,
            code: row.code,
            custom_tracking_number: resolveTrackingByStatus(row.status, row.notes || null, row.custom_tracking_number) || null,
            customer_id: row.customer_id,
            customer_name: Array.isArray(row.customer)
              ? row.customer[0]?.full_name || null
              : row.customer?.full_name || null,
            customer_code: Array.isArray(row.customer)
              ? row.customer[0]?.code || null
              : row.customer?.code || null,
            customer_phone: Array.isArray(row.customer)
              ? row.customer[0]?.phone || null
              : row.customer?.phone || null,
            total_cost: toNumber(row.total_cost),
            shipping_cost: row.shipping_cost === null ? null : toNumber(row.shipping_cost),
            paid_amount: row.paid_amount === null ? null : toNumber(row.paid_amount),
            payment_status: row.payment_status || null,
            status: row.status,
          })), invoices),
        );
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to record payment.");
    } finally {
      setIsSaving(false);
    }
  };

  const openEditDialog = (payment: PaymentRow) => {
    const shipment = payment.shipment_id ? shipmentById.get(payment.shipment_id) : null;
    setEditingPayment(payment);
    setEditForm({
      customer_id: payment.customer_id || shipment?.customer_id || "",
      shipment_id: payment.shipment_id || "",
      amount: formatAmountInput(payment.amount),
      payment_provider: payment.payment_provider,
      status: payment.status || "pending",
      provider_reference: payment.provider_reference || "",
      phone_number: payment.phone_number || shipment?.customer_phone || "",
      notes: getPaymentNotes(payment),
    });
  };

  const closeEditDialog = () => {
    setEditingPayment(null);
    setEditForm(emptyForm);
  };

  const handleSaveEdit = async () => {
    if (!editingPayment) return;
    if (!editForm.shipment_id) {
      toast.error("Search and select a shipment.");
      return;
    }

    const inputAmount = Number(editForm.amount);
    if (Number.isNaN(inputAmount) || inputAmount <= 0) {
      toast.error("Enter a valid payment amount.");
      return;
    }

    const shipment = shipmentById.get(editForm.shipment_id);
    if (!shipment) {
      toast.error("Selected shipment was not found.");
      return;
    }

    const amount = code === defaultCode
      ? inputAmount
      : Number(convertFromSelected(inputAmount).toFixed(2));

    const dueAmount = getShipmentDueAmount(editForm.shipment_id, editingPayment);
    if (amount > dueAmount) {
      toast.error("Amount exceeds the outstanding balance.");
      return;
    }

    setIsSaving(true);

    try {
      const nextCustomerId = editForm.customer_id || shipment.customer_id;
      const nextCallbackData = {
        ...(editingPayment.callback_data || {}),
        manual_entry: true,
        finance_notes: editForm.notes || null,
        edited_at: new Date().toISOString(),
        entered_amount: inputAmount,
        entered_currency: code,
      };

      const { error } = await supabase
        .from("payments")
        .update({
          customer_id: nextCustomerId,
          shipment_id: editForm.shipment_id,
          amount,
          currency: defaultCode,
          payment_provider: editForm.payment_provider,
          provider_reference: editForm.provider_reference || null,
          phone_number: editForm.phone_number || null,
          status: editForm.status,
          callback_data: nextCallbackData,
        })
        .eq("id", editingPayment.id);

      if (error) {
        throw error;
      }

      await applyPaymentImpact(
        {
          shipment_id: editingPayment.shipment_id,
          amount: editingPayment.amount,
          status: editingPayment.status,
        },
        {
          shipment_id: editForm.shipment_id,
          amount,
          status: editForm.status,
        },
      );

      toast.success("Payment updated.");
      closeEditDialog();
      await fetchData();
    } catch (error: any) {
      toast.error(error?.message || "Failed to update payment.");
    } finally {
      setIsSaving(false);
    }
  };



  const handleConfirmPendingPayment = async (payment: PaymentRow) => {
    if (!payment.shipment_id) {
      toast.error("This payment is not linked to a shipment.");
      return;
    }

    if (payment.status === "completed") {
      toast.error("This payment has already been confirmed.");
      return;
    }

    setIsSaving(true);

    try {
      const { error } = await supabase
        .from("payments")
        .update({
          status: "completed",
          callback_data: {
            ...(payment.callback_data || {}),
            confirmed_by_finance: true,
            confirmed_at: new Date().toISOString(),
          },
        })
        .eq("id", payment.id);

      if (error) {
        throw error;
      }

      await applyPaymentImpact(
        {
          shipment_id: payment.shipment_id,
          amount: payment.amount,
          status: payment.status,
        },
        {
          shipment_id: payment.shipment_id,
          amount: payment.amount,
          status: "completed",
        },
      );

      toast.success("Payment confirmed.");
      await fetchData();
    } catch (error: any) {
      toast.error(error?.message || "Failed to confirm payment.");
    } finally {
      setIsSaving(false);
    }
  };

  const openPaymentView = async (row: PaymentTableRow) => {
    const shipment = row.payment.shipment_id ? shipmentById.get(row.payment.shipment_id) : null;
    const invoice = getShipmentInvoice(row.payment.shipment_id);
    const invoicePaymentState = invoice
      ? getInvoicePaymentState(invoice, { paid_amount: shipment?.paid_amount })
      : "unpaid";
    const invoicePaidAmount = invoice
      ? getInvoicePaidAmount(invoice, { paid_amount: shipment?.paid_amount })
      : 0;
    const invoiceBalance = invoice
      ? getInvoiceOutstandingBalance(invoice, { paid_amount: shipment?.paid_amount })
      : row.balance_after;

    openFinanceDetailWindow(`Payment ${row.code}`, "Payment Details", [
      { label: "Payment Ref", value: row.code },
      { label: "Customer", value: row.customer_label },
      { label: "Shipment ID", value: row.shipment_ref },
      { label: "System Shipment No.", value: shipment?.code || row.payment.shipment_code || "-" },
      { label: "Invoice No.", value: row.invoice_code },
      { label: "Invoice Amount", value: invoice ? formatAmount(invoice.amount) : "-" },
      { label: "Paid Against Invoice", value: invoice ? formatAmount(invoicePaidAmount) : "-" },
      { label: "Invoice Balance", value: formatAmount(invoiceBalance) },
      { label: "Invoice Progress", value: invoice ? invoicePaymentState : "-" },
      { label: "Payment Method", value: row.payment_provider_label },
      { label: "Provider Reference", value: row.provider_reference },
      { label: "Phone Number", value: row.phone_number },
      { label: "Recorded Amount", value: formatAmount(row.amount, row.payment?.currency || "ZMW") },
      { label: "Balance Before", value: formatAmount(row.balance_before) },
      { label: "Balance Remaining", value: formatAmount(row.balance_after) },
      { label: "Status", value: row.status },
      { label: "Notes", value: row.notes || "-" },
      { label: "Date", value: format(new Date(row.created_at), "PPpp") },
    ], undefined, await fetchLogo());
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="default">
            <CheckCircle className="mr-1 h-3 w-3" />
            Completed
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive">
            <XCircle className="mr-1 h-3 w-3" />
            Failed
          </Badge>
        );
      case "processing":
        return (
          <Badge variant="secondary">
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            Processing
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <Clock className="mr-1 h-3 w-3" />
            Pending
          </Badge>
        );
    }
  };

  const columns: Column<PaymentTableRow>[] = [
    { key: "code", label: "Payment Ref" },
    { key: "customer_label", label: "Customer" },
    { key: "shipment_ref", label: "Shipment ID" },
    { key: "invoice_code", label: "Invoice No." },
    {
      key: "payment_provider",
      label: "Method",
      render: (row) => row.payment_provider_label,
    },
    {
      key: "amount",
      label: "Amount",
      align: "center",
      
      render: (row) => formatAmount(row.amount, row.payment?.currency || "ZMW"),
    },
    {
      key: "balance_after",
      label: "Balance",
      render: (row) => formatAmount(row.balance_after),
    },
    {
      key: "status",
      label: "Status",
      render: (row) => getStatusBadge(row.status),
    },
    {
      key: "created_at",
      label: "Date",
      render: (row) => format(new Date(row.created_at), "PPpp"),
    },
    {
      key: "actions",
      label: "Action",
      render: (row) => (
        <div className="flex gap-2 whitespace-nowrap">
          <Button size="icon" variant="outline" onClick={() => openPaymentView(row)} title="View payment">
            <Eye className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="outline" onClick={() => openEditDialog(row.payment)} title="Edit payment">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="outline" onClick={() => downloadPaymentTransaction(row)} title="Download payment">
            <Download className="h-4 w-4" />
          </Button>
          {["pending", "processing"].includes(row.status) ? (
            <Button size="icon" onClick={() => handleConfirmPendingPayment(row.payment)} disabled={isSaving} title="Confirm payment">
              <Check className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Payments"
        
        actions={
          <Button variant="outline" onClick={() => exportPaymentHistory(historyRows)}>
            Export Payment History
          </Button>
        }
      />

      <DateRangeFilter
        value={dateFilter}
        onValueChange={setDateFilter}
        startDate={customStartDate}
        endDate={customEndDate}
        onStartDateChange={setCustomStartDate}
        onEndDateChange={setCustomEndDate}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Payment History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{isLoading ? "..." : summary.totalCount}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatAmount(summary.totalAmount)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Pending Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{isLoading ? "..." : summary.pendingCount}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatAmount(summary.pendingAmount)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Bank Transfer</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{isLoading ? "..." : summary.bankCount}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatAmount(summary.bankAmount)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Mobile Money Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{isLoading ? "..." : summary.mobileCount}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatAmount(summary.mobileAmount)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Cash Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{isLoading ? "..." : summary.cashCount}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatAmount(summary.cashAmount)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Reconciliation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{isLoading ? "..." : reconciliationSummary.count}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatAmount(reconciliationSummary.amount)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Custom Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{customPaymentsLoading ? "..." : customPaymentSummary.count}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatAmount(customPaymentSummary.amount)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Record Payment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label>Customer</Label>
              <SearchableSelect
                value={form.customer_id}
                onValueChange={handleCustomerChange}
                options={customerOptions}
                placeholder="Search customer by name or ID"
                searchPlaceholder="Search customer name or customer ID..."
              />
            </div>
            <div className="space-y-2">
              <Label>Shipment</Label>
              <SearchableSelect
                value={form.shipment_id}
                onValueChange={handleShipmentChange}
                options={shipmentOptions}
                placeholder="Search shipment by custom ID"
                searchPlaceholder="Search custom shipment ID or system shipment code..."
                emptyMessage="No shipment found."
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select
                value={form.payment_provider}
                onValueChange={(value) => setForm((prev) => ({ ...prev, payment_provider: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {paymentProviders.map((method) => (
                    <SelectItem key={method} value={method}>
                      {formatFinancePaymentMethod(method)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(value) => setForm((prev) => ({ ...prev, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {paymentStatuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount ({code})</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Provider Reference</Label>
              <Input
                value={form.provider_reference}
                onChange={(event) => setForm((prev) => ({ ...prev, provider_reference: event.target.value }))}
                placeholder="Reference / approval code"
              />
            </div>
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input
                value={form.phone_number}
                onChange={(event) => setForm((prev) => ({ ...prev, phone_number: event.target.value }))}
                placeholder="Customer phone number"
              />
            </div>
            <div className="space-y-2 lg:col-span-2">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                placeholder="Payment notes..."
              />
            </div>
          </div>

          <div className="grid gap-3 rounded-xl border border-border/70 bg-muted/20 p-4 md:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Shipment ID</p>
              <p className="mt-1 font-medium">
                {selectedShipment?.custom_tracking_number?.trim() || "Tracking pending"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Invoice Amount</p>
              <p className="mt-1 font-medium">
                {selectedInvoice
                  ? formatAmount(selectedInvoice.amount)
                  : selectedShipment
                    ? formatAmount(getShipmentInvoiceTotal(selectedShipment))
                    : "-"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Paid</p>
              <p className="mt-1 font-medium">
                {selectedInvoice
                  ? formatAmount(getInvoicePaidAmount(selectedInvoice, { paid_amount: selectedShipment?.paid_amount }))
                  : selectedShipment
                    ? formatAmount(toNumber(selectedShipment.paid_amount))
                    : "-"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Balance Due</p>
              <p className="mt-1 font-medium">
                {selectedShipment ? formatAmount(selectedDueAmount) : "-"}
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2">

            <Button onClick={handleRecordPayment} disabled={isSaving}>
              {isSaving ? "Saving..." : "Record Payment"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4 flex w-full justify-start gap-1 overflow-x-auto overflow-y-hidden h-auto whitespace-nowrap scrollbar-thin pb-1">
          <TabsTrigger value="history">Payment History</TabsTrigger>
          <TabsTrigger value="pending">Pending Payments</TabsTrigger>
          <TabsTrigger value="bank">Bank Transfer</TabsTrigger>
          <TabsTrigger value="mobile">Mobile Money Transactions</TabsTrigger>
          <TabsTrigger value="cash">Cash Payments</TabsTrigger>
          <TabsTrigger value="reconciliation">
            Reconciliation
            {reconciliationRows.length > 0 && (
              <Badge variant="destructive" className="ml-1.5 px-1.5 py-0 text-xs">{reconciliationRows.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="custom">Custom Payments</TabsTrigger>
        </TabsList>

        <TabsContent value="history">
          <DataTable
            columns={columns}
            data={historyRows}
            isLoading={isLoading}
            searchPlaceholder="Search payment ref, customer, invoice, or shipment ID..."
          />
        </TabsContent>
        <TabsContent value="pending">
          <DataTable
            columns={columns}
            data={pendingRows}
            isLoading={isLoading}
            searchPlaceholder="Search pending payment ref, customer, or shipment ID..."
          />
        </TabsContent>
        <TabsContent value="bank">
          <DataTable
            columns={columns}
            data={bankRows}
            isLoading={isLoading}
            searchPlaceholder="Search bank transfer records..."
          />
        </TabsContent>
        <TabsContent value="mobile">
          <DataTable
            columns={columns}
            data={mobileRows}
            isLoading={isLoading}
            searchPlaceholder="Search mobile money records..."
          />
        </TabsContent>
        <TabsContent value="cash">
          <DataTable
            columns={columns}
            data={cashRows}
            isLoading={isLoading}
            searchPlaceholder="Search cash payment records..."
          />
        </TabsContent>
        <TabsContent value="reconciliation">
          <div className="space-y-4">
            {reconciliationRows.length > 0 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {reconciliationRows.length} shipment(s) with payment discrepancies found.
                  Reconciling will sync paid_amount on each shipment to match actual recorded payments.
                </p>
                <Button onClick={handleReconcileAll} disabled={isSaving} variant="default">
                  {isSaving ? "Reconciling..." : `Reconcile All (${reconciliationRows.length})`}
                </Button>
              </div>
            )}
            <DataTable
              columns={reconciliationColumns}
              data={reconciliationRows}
              isLoading={isLoading}
              searchPlaceholder="Search by shipment ID or customer..."
            />
            {reconciliationRows.length === 0 && !isLoading && (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="mx-auto h-8 w-8 mb-2 text-green-500" />
                <p>All payments are in sync. No reconciliation needed.</p>
              </div>
            )}
          </div>
        </TabsContent>
        <TabsContent value="custom">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payment Code</TableHead>
                  <TableHead>Payer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Phone Number</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customPaymentsLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 10 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filteredCustomPayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                      No custom payments found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCustomPayments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.code}</TableCell>
                      <TableCell>{p.payer_label}</TableCell>
                      <TableCell>{format(new Date(p.created_at), "PP")}</TableCell>
                      <TableCell>{format(new Date(p.created_at), "p")}</TableCell>
                      <TableCell className="max-w-[360px] whitespace-normal">{p.description || "-"}</TableCell>
                      <TableCell>{formatAmount(p.amount, p.currency || "ZMW")}</TableCell>
                      <TableCell>{formatFinancePaymentMethod(p.payment_method || p.payment_provider)}</TableCell>
                      <TableCell className="font-mono text-xs">{p.phone_number || "-"}</TableCell>
                      <TableCell>{p.provider_reference || "-"}</TableCell>
                      <TableCell><StatusBadge status={p.status || "pending"} /></TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(editingPayment)} onOpenChange={(open) => (!open ? closeEditDialog() : null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit Payment</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label>Customer</Label>
              <SearchableSelect
                value={editForm.customer_id}
                onValueChange={handleEditCustomerChange}
                options={customerOptions}
                placeholder="Search customer by name or ID"
                searchPlaceholder="Search customer name or customer ID..."
              />
            </div>
            <div className="space-y-2">
              <Label>Shipment</Label>
              <SearchableSelect
                value={editForm.shipment_id}
                onValueChange={handleEditShipmentChange}
                options={editShipmentOptions}
                placeholder="Search shipment by custom ID"
                searchPlaceholder="Search custom shipment ID or system shipment code..."
                emptyMessage="No shipment found."
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select
                value={editForm.payment_provider}
                onValueChange={(value) => setEditForm((prev) => ({ ...prev, payment_provider: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {paymentProviders.map((method) => (
                    <SelectItem key={method} value={method}>
                      {formatFinancePaymentMethod(method)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={editForm.status}
                onValueChange={(value) => setEditForm((prev) => ({ ...prev, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {paymentStatuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount ({editingPayment?.currency || "ZMW"})</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={editForm.amount}
                onChange={(event) => setEditForm((prev) => ({ ...prev, amount: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Provider Reference</Label>
              <Input
                value={editForm.provider_reference}
                onChange={(event) => setEditForm((prev) => ({ ...prev, provider_reference: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input
                value={editForm.phone_number}
                onChange={(event) => setEditForm((prev) => ({ ...prev, phone_number: event.target.value }))}
              />
            </div>
            <div className="space-y-2 lg:col-span-2">
              <Label>Notes</Label>
              <Textarea
                value={editForm.notes}
                onChange={(event) => setEditForm((prev) => ({ ...prev, notes: event.target.value }))}
              />
            </div>
          </div>

          <div className="grid gap-3 rounded-xl border border-border/70 bg-muted/20 p-4 md:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Shipment ID</p>
              <p className="mt-1 font-medium">
                {editSelectedShipment?.custom_tracking_number?.trim() || "Tracking pending"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Invoice Amount</p>
              <p className="mt-1 font-medium">
                {editSelectedInvoice
                  ? formatAmount(editSelectedInvoice.amount)
                  : editSelectedShipment
                    ? formatAmount(getShipmentInvoiceTotal(editSelectedShipment))
                    : "-"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Paid</p>
              <p className="mt-1 font-medium">
                {editSelectedInvoice
                  ? formatAmount(getInvoicePaidAmount(editSelectedInvoice, { paid_amount: editSelectedShipment?.paid_amount }))
                  : editSelectedShipment
                    ? formatAmount(toNumber(editSelectedShipment.paid_amount))
                    : "-"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Balance Available</p>
              <p className="mt-1 font-medium">
                {editSelectedShipment ? formatAmount(editDueAmount) : "-"}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeEditDialog}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


    </div>
  );
};

export default FinancePayments;


