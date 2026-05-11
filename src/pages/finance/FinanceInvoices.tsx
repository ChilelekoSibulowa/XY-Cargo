import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { PageHeader } from "@/components/shared/PageHeader";
import { DateRangeFilter } from "@/components/shared/DateRangeFilter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable, Column } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import SearchableSelect, { type SearchableSelectOption } from "@/components/shared/SearchableSelect";
import { supabase } from "@/integrations/supabase/client";
import { useDefaultCurrency } from "@/hooks/useDefaultCurrency";
import {
  type FinanceDateFilter,
  getInvoiceBillingAmount,
  getInvoiceOutstandingBalance,
  getInvoicePaidAmount,
  getInvoicePaymentState,
  getFinanceDateRange,
  getShipmentInvoiceTotal,
  isWithinFinanceDateRange,
  openFinanceDetailWindow,
  toNumber,
} from "@/lib/financePortal";
import { getWarehouseTrackingNumber, resolveTrackingByStatus } from "@/lib/shipmentNotes";
import { fetchLogo } from "@/hooks/useLogo";
import { toast } from "sonner";
import { Download, Eye, Pencil } from "lucide-react";
import { generateInvoicePdf } from "@/lib/invoicePdfGenerator";
import { notifyInvoiceIssued, notifyInvoicePaid } from "@/lib/notifications";

const statusOptions = ["draft", "sent", "approved", "paid"];

type InvoiceRow = {
  id: string;
  code: string;
  amount: number;
  status: string | null;
  created_at: string;
  due_date: string | null;
  notes: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_code: string | null;
  shipment_id: string | null;
  shipment_code: string | null;
  shipment_tracking_no: string | null;
  shipment_description: string | null;
  shipment_paid_amount: number | null;
  shipment_total_cost: number | null;
  shipment_shipping_cost: number | null;
  shipment_status: string | null;
  receiver_name: string | null;
  receiver_phone: string | null;
  receiver_address: string | null;
};

type CustomerOption = {
  id: string;
  code: string;
  full_name: string;
};

type ShipmentOption = {
  id: string;
  code: string;
  custom_tracking_number: string | null;
  consolidation_id: string | null;
  consolidation_code: string | null;
  consolidation_tracking_number: string | null;
  consolidation_total_cost?: number | null;
  description: string | null;
  total_cost: number;
  shipping_cost: number | null;
  paid_amount: number | null;
  customer_id: string;
  customer_name: string | null;
  customer_code: string | null;
  status: string;
};

type InvoiceFormState = {
  customer_id: string;
  shipment_id: string;
  amount: string;
  status: string;
  due_date: string;
  notes: string;
};

const emptyForm: InvoiceFormState = {
  customer_id: "",
  shipment_id: "",
  amount: "",
  status: "draft",
  due_date: "",
  notes: "",
};

const uniqueText = (values: Array<string | null | undefined>) =>
  Array.from(
    new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  );

const getShipmentBillingGroupKey = (
  shipment: Pick<ShipmentOption, "id" | "custom_tracking_number" | "consolidation_id">,
) => {
  const warehouseTracking = shipment.custom_tracking_number?.trim();
  if (warehouseTracking) return `tracking:${warehouseTracking}`;
  if (shipment.consolidation_id) return `consolidation:${shipment.consolidation_id}`;
  return `shipment:${shipment.id}`;
};

const mergeShipmentOptionsByBillingGroup = (rows: ShipmentOption[]) => {
  const grouped = new Map<string, ShipmentOption>();

  rows.forEach((shipment) => {
    const key = getShipmentBillingGroupKey(shipment);
    const existing = grouped.get(key);

    if (!existing) {
      const initialAmount = getShipmentInvoiceTotal(shipment);
      const fallbackConsolidationTotal = toNumber(shipment.consolidation_total_cost);
      grouped.set(key, {
        ...shipment,
        shipping_cost: initialAmount > 0 ? initialAmount : fallbackConsolidationTotal,
        total_cost: initialAmount > 0 ? initialAmount : fallbackConsolidationTotal,
      });
      return;
    }

    const nextInvoiceTotal = getShipmentInvoiceTotal(existing) + getShipmentInvoiceTotal(shipment);
    const nextPaidAmount = toNumber(existing.paid_amount) + toNumber(shipment.paid_amount);
    const fallbackConsolidationTotal = Math.max(
      toNumber(existing.consolidation_total_cost),
      toNumber(shipment.consolidation_total_cost),
    );

    grouped.set(key, {
      ...existing,
      shipping_cost: nextInvoiceTotal > 0 ? nextInvoiceTotal : fallbackConsolidationTotal,
      total_cost: nextInvoiceTotal > 0 ? nextInvoiceTotal : fallbackConsolidationTotal,
      paid_amount: nextPaidAmount,
      description:
        existing.description && shipment.description && existing.description !== shipment.description
          ? "Mixed Products"
          : existing.description || shipment.description,
    });
  });

  return Array.from(grouped.values());
};

const buildShipmentDescriptionMap = async (shipmentIds: string[]) => {
  const uniqueShipmentIds = Array.from(new Set(shipmentIds.filter(Boolean)));
  if (uniqueShipmentIds.length === 0) return {} as Record<string, string[]>;

  const [{ data: directShipments }, { data: shipmentLinks }] = await Promise.all([
    supabase
      .from("shipments")
      .select("id, description, code")
      .in("id", uniqueShipmentIds),
    supabase
      .from("consolidation_shipments")
      .select("shipment_id, consolidation_id")
      .in("shipment_id", uniqueShipmentIds),
  ]);

  const descriptionMap: Record<string, string[]> = {};

  (directShipments || []).forEach((shipment: any) => {
    descriptionMap[shipment.id] = uniqueText([shipment.description, shipment.code]);
  });

  const consolidationIds = Array.from(
    new Set(((shipmentLinks || []) as Array<{ consolidation_id: string }>).map((row) => row.consolidation_id)),
  );

  if (consolidationIds.length === 0) {
    return descriptionMap;
  }

  const { data: consolidationItems } = await supabase
    .from("consolidation_shipments")
    .select("consolidation_id, shipment:shipments(id, description, code)")
    .in("consolidation_id", consolidationIds);

  const groupedDescriptions = new Map<string, string[]>();
  ((consolidationItems || []) as any[]).forEach((row) => {
    const shipment = Array.isArray(row.shipment) ? row.shipment[0] : row.shipment;
    const nextDescriptions = uniqueText([
      ...(groupedDescriptions.get(row.consolidation_id) || []),
      shipment?.description,
      shipment?.code,
    ]);
    groupedDescriptions.set(row.consolidation_id, nextDescriptions);
  });

  ((shipmentLinks || []) as Array<{ shipment_id: string; consolidation_id: string }>).forEach((row) => {
    const grouped = groupedDescriptions.get(row.consolidation_id);
    if (grouped && grouped.length > 0) {
      descriptionMap[row.shipment_id] = grouped;
    }
  });

  return descriptionMap;
};

const FinanceInvoices = () => {
  const { code, convert, convertFromSelected, formatAmount } = useDefaultCurrency();
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [shipments, setShipments] = useState<ShipmentOption[]>([]);
  const [shipmentDescriptions, setShipmentDescriptions] = useState<Record<string, string[]>>({});
  const [activeTab, setActiveTab] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<InvoiceFormState>(emptyForm);
  const [editingInvoice, setEditingInvoice] = useState<InvoiceRow | null>(null);
  const [editForm, setEditForm] = useState<InvoiceFormState>(emptyForm);
  const [dateFilter, setDateFilter] = useState<FinanceDateFilter>("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  const toSelectedAmount = (value: string) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return "";
    return convert(parsed).toFixed(2);
  };

  const fromSelectedAmount = (value: string) => {
    if (!value.trim()) return "";
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return "";
    return convertFromSelected(parsed).toFixed(2);
  };

  const fetchInvoices = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("invoices")
      .select(
        "id, code, amount, status, due_date, notes, created_at, customer_id, shipment_id, customer:customers(full_name, code), shipment:shipments(code, custom_tracking_number, notes, description, paid_amount, total_cost, shipping_cost, status, receiver:receivers(full_name, phone, address))",
      )
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load invoices.");
      setInvoices([]);
      setIsLoading(false);
      return;
    }

    setInvoices(
      ((data || []) as any[]).map((row) => ({
        id: row.id,
        code: row.code,
        amount: getInvoiceBillingAmount({
          amount: toNumber(row.amount),
          shipment_total_cost: Array.isArray(row.shipment)
            ? row.shipment[0]?.total_cost ?? null
            : row.shipment?.total_cost ?? null,
          shipment_shipping_cost: Array.isArray(row.shipment)
            ? row.shipment[0]?.shipping_cost ?? null
            : row.shipment?.shipping_cost ?? null,
        }),
        status: row.status || "draft",
        created_at: row.created_at,
        due_date: row.due_date || null,
        notes: row.notes || null,
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
        shipment_tracking_no: (() => {
          const shipment = Array.isArray(row.shipment) ? row.shipment[0] : row.shipment;
          return resolveTrackingByStatus(shipment?.status || null, shipment?.notes || null, shipment?.custom_tracking_number || null) || null;
        })(),
        shipment_description: Array.isArray(row.shipment)
          ? row.shipment[0]?.description || null
          : row.shipment?.description || null,
        shipment_paid_amount: Array.isArray(row.shipment)
          ? row.shipment[0]?.paid_amount ?? null
          : row.shipment?.paid_amount ?? null,
        shipment_total_cost: Array.isArray(row.shipment)
          ? row.shipment[0]?.total_cost ?? null
          : row.shipment?.total_cost ?? null,
        shipment_shipping_cost: Array.isArray(row.shipment)
          ? row.shipment[0]?.shipping_cost ?? null
          : row.shipment?.shipping_cost ?? null,
        shipment_status: Array.isArray(row.shipment)
          ? row.shipment[0]?.status || null
          : row.shipment?.status || null,
        receiver_name: Array.isArray(row.shipment)
          ? row.shipment[0]?.receiver?.full_name || null
          : row.shipment?.receiver?.full_name || null,
        receiver_phone: Array.isArray(row.shipment)
          ? row.shipment[0]?.receiver?.phone || null
          : row.shipment?.receiver?.phone || null,
        receiver_address: Array.isArray(row.shipment)
          ? row.shipment[0]?.receiver?.address || null
          : row.shipment?.receiver?.address || null,
      })),
    );
    setIsLoading(false);

    // Auto-sync: mark invoices as "paid" in DB when payment is fully cleared
    const paidButNotMarked = ((data || []) as any[]).filter((row) => {
      const shipment = Array.isArray(row.shipment) ? row.shipment[0] : row.shipment;
      const invoiceAmount = getInvoiceBillingAmount({
        amount: toNumber(row.amount),
        shipment_total_cost: shipment?.total_cost ?? null,
        shipment_shipping_cost: shipment?.shipping_cost ?? null,
      });
      const paidAmount = toNumber(shipment?.paid_amount);
      return invoiceAmount > 0 && paidAmount >= invoiceAmount && row.status !== "paid";
    });

    if (paidButNotMarked.length > 0) {
      const ids = paidButNotMarked.map((row) => row.id);
      await supabase.from("invoices").update({ status: "paid" }).in("id", ids);
      paidButNotMarked.forEach((row) => {
        if (row.customer_id) {
          notifyInvoicePaid(row.customer_id, row.code, formatAmount(toNumber(row.amount)), row.id);
        }
      });
    }
  };

  const fetchOptions = async () => {
    const [customersRes, shipmentsRes] = await Promise.all([
      supabase.from("customers").select("id, code, full_name").order("full_name"),
      supabase
        .from("shipments")
        .select(
          "id, code, custom_tracking_number, notes, description, total_cost, shipping_cost, paid_amount, customer_id, status, customer:customers(full_name, code)",
        )
        .order("created_at", { ascending: false })
        .limit(300),
    ]);

    const shipmentRows = ((shipmentsRes.data || []) as any[]).filter((shipment) =>
      ["approved", "assigned", "supplied", "delivered", "closed"].includes(shipment.status),
    );

    const shipmentIds = shipmentRows.map((shipment) => shipment.id).filter(Boolean);
    const consolidationByShipment = new Map<
      string,
      { id: string; code: string | null; tracking_code: string | null; total_cost: number | null }
    >();

    if (shipmentIds.length > 0) {
      const { data: shipmentLinks } = await supabase
        .from("consolidation_shipments")
        .select("shipment_id, consolidation:consolidations(id, code, tracking_code, total_cost)")
        .in("shipment_id", shipmentIds);

      ((shipmentLinks || []) as any[]).forEach((row) => {
        const consolidation = Array.isArray(row.consolidation) ? row.consolidation[0] : row.consolidation;
        if (!row.shipment_id || !consolidation) return;
        consolidationByShipment.set(row.shipment_id, {
          id: consolidation.id,
          code: consolidation.code || null,
          tracking_code: consolidation.tracking_code || null,
          total_cost: consolidation.total_cost === null ? null : toNumber(consolidation.total_cost),
        });
      });
    }

    setCustomers((customersRes.data as CustomerOption[] | null) || []);
    setShipments(
      shipmentRows.map((shipment) => {
        const linkedConsolidation = consolidationByShipment.get(shipment.id);
        const directShippingFee =
          shipment.shipping_cost === null ? null : toNumber(shipment.shipping_cost);

        return {
          id: shipment.id,
          code: shipment.code,
          custom_tracking_number:
            linkedConsolidation?.tracking_code ||
            resolveTrackingByStatus(shipment.status || null, shipment.notes || null, shipment.custom_tracking_number || null) ||
            null,
          consolidation_id: linkedConsolidation?.id || null,
          consolidation_code: linkedConsolidation?.code || null,
          consolidation_tracking_number: linkedConsolidation?.tracking_code || null,
          consolidation_total_cost: linkedConsolidation?.total_cost ?? null,
          description: shipment.description || null,
          total_cost: toNumber(shipment.total_cost),
          shipping_cost: directShippingFee,
          paid_amount: shipment.paid_amount === null ? null : toNumber(shipment.paid_amount),
          customer_id: shipment.customer_id,
          customer_name: Array.isArray(shipment.customer)
            ? shipment.customer[0]?.full_name || null
            : shipment.customer?.full_name || null,
          customer_code: Array.isArray(shipment.customer)
            ? shipment.customer[0]?.code || null
            : shipment.customer?.code || null,
          status: shipment.status,
        };
      }) as ShipmentOption[],
    );
  };

  useEffect(() => {
    void fetchInvoices();
    void fetchOptions();
  }, []);

  useEffect(() => {
    const shipmentIds = uniqueText([
      ...shipments.map((shipment) => shipment.id),
      ...invoices.map((invoice) => invoice.shipment_id || ""),
    ]);

    if (shipmentIds.length === 0) {
      setShipmentDescriptions({});
      return;
    }

    let isActive = true;
    buildShipmentDescriptionMap(shipmentIds).then((map) => {
      if (isActive) {
        setShipmentDescriptions(map);
      }
    });

    return () => {
      isActive = false;
    };
  }, [invoices, shipments]);

  const groupedShipments = useMemo(
    () => mergeShipmentOptionsByBillingGroup(shipments),
    [shipments],
  );

  const shipmentById = useMemo(
    () => new Map(groupedShipments.map((shipment) => [shipment.id, shipment])),
    [groupedShipments],
  );

  const getShipmentLineDescription = (shipmentId: string | null | undefined, fallback?: string | null) => {
    const descriptions = shipmentId ? shipmentDescriptions[shipmentId] || [] : [];
    if (descriptions.length > 0) return descriptions.join(", ");
    return fallback || "";
  };

  const getInvoiceDisplayDescription = (
    shipmentId: string | null | undefined,
    fallback?: string | null,
    notes?: string | null,
  ) => {
    const trimmedNotes = notes?.trim();
    if (trimmedNotes) return trimmedNotes;
    return getShipmentLineDescription(shipmentId, fallback) || "-";
  };

  const customerSearchOptions = useMemo<SearchableSelectOption[]>(
    () =>
      customers.map((customer) => ({
        value: customer.id,
        label: `${customer.full_name} (${customer.code})`,
        keywords: `${customer.full_name} ${customer.code}`,
      })),
    [customers],
  );

  // Shipment IDs that already have active invoices (sent/approved/paid)
  const invoicedShipmentIds = useMemo(() => {
    const ids = new Set<string>();
    invoices.forEach((inv) => {
      const status = inv.status || "draft";
      if (inv.shipment_id && ["sent", "approved", "paid"].includes(status)) {
        ids.add(inv.shipment_id);
      }
    });
    return ids;
  }, [invoices]);

  const createShipmentOptions = useMemo<SearchableSelectOption[]>(() => {
    const rows = form.customer_id
      ? groupedShipments.filter((shipment) => shipment.customer_id === form.customer_id)
      : groupedShipments;

    return rows
      .filter((shipment) => !invoicedShipmentIds.has(shipment.id))
      .map((shipment) => ({
      value: shipment.id,
      label: shipment.custom_tracking_number?.trim() || shipment.consolidation_tracking_number || "Tracking pending",
      keywords: `${shipment.custom_tracking_number || ""} ${shipment.consolidation_tracking_number || ""} ${shipment.code} ${shipment.consolidation_code || ""} ${shipment.customer_name || ""} ${shipment.customer_code || ""}`,
      description: `${shipment.customer_name || "Customer"}${shipment.customer_code ? ` (${shipment.customer_code})` : ""} | Invoice Total: ${formatAmount(getShipmentInvoiceTotal(shipment))}`,
    }));
  }, [form.customer_id, groupedShipments, formatAmount, invoicedShipmentIds]);

  const normalizedStatus = (status: string | null) => status || "draft";

  const getInvoicePaid = (invoice: InvoiceRow) =>
    normalizedStatus(invoice.status) === "paid"
      ? invoice.amount
      : getInvoicePaidAmount(invoice, { paid_amount: invoice.shipment_paid_amount });

  const getInvoiceBalance = (invoice: InvoiceRow) =>
    normalizedStatus(invoice.status) === "paid"
      ? 0
      : getInvoiceOutstandingBalance(invoice, { paid_amount: invoice.shipment_paid_amount });

  const getInvoicePaymentProgress = (invoice: InvoiceRow) =>
    normalizedStatus(invoice.status) === "paid"
      ? "paid"
      : getInvoicePaymentState(invoice, { paid_amount: invoice.shipment_paid_amount });

  const getInvoiceDisplayStatus = (invoice: InvoiceRow) =>
    getInvoicePaymentProgress(invoice) === "paid" ? "paid" : normalizedStatus(invoice.status);

  const dateRange = useMemo(
    () => getFinanceDateRange(dateFilter, { startDate: customStartDate, endDate: customEndDate }),
    [customEndDate, customStartDate, dateFilter],
  );

  const dateFilteredInvoices = useMemo(
    () => invoices.filter((invoice) => isWithinFinanceDateRange(invoice.created_at, dateRange)),
    [dateRange, invoices],
  );

  const filteredInvoices = useMemo(() => {
    if (activeTab === "all") return dateFilteredInvoices;
    if (activeTab === "paid") {
      return dateFilteredInvoices.filter((invoice) => getInvoiceDisplayStatus(invoice) === "paid");
    }
    return dateFilteredInvoices.filter((invoice) => normalizedStatus(invoice.status) === activeTab);
  }, [activeTab, dateFilteredInvoices]);

  const invoiceStats = useMemo(
    () => {
      const paidInvoices = dateFilteredInvoices.filter((invoice) => getInvoiceDisplayStatus(invoice) === "paid");
      const outstandingInvoices = dateFilteredInvoices.filter((invoice) => getInvoiceBalance(invoice) > 0);
      const sentInvoices = dateFilteredInvoices.filter((invoice) => normalizedStatus(invoice.status) === "sent");

      return {
        totalCount: dateFilteredInvoices.length,
        totalRaised: dateFilteredInvoices.reduce((sum, invoice) => sum + invoice.amount, 0),
        paidCount: paidInvoices.length,
        paidAmount: paidInvoices.reduce((sum, invoice) => sum + getInvoicePaid(invoice), 0),
        outstandingCount: outstandingInvoices.length,
        outstandingAmount: outstandingInvoices.reduce((sum, invoice) => sum + getInvoiceBalance(invoice), 0),
        sent: sentInvoices.length,
        sentAmount: sentInvoices.reduce((sum, invoice) => sum + invoice.amount, 0),
      };
    },
    [dateFilteredInvoices],
  );

  const handleCustomerChange = (customerId: string) => {
    setForm((prev) => {
      const keepShipment =
        prev.shipment_id && shipmentById.get(prev.shipment_id)?.customer_id === customerId;

      return {
        ...prev,
        customer_id: customerId,
        shipment_id: keepShipment ? prev.shipment_id : "",
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
      amount: getShipmentInvoiceTotal(shipment).toFixed(2),
    }));
  };

  const handleCreateInvoice = async () => {
    if (!form.amount) {
      toast.error("Amount is required.");
      return;
    }

    const amount = Number(form.amount);
    if (Number.isNaN(amount) || amount <= 0) {
      toast.error("Enter a valid invoice amount.");
      return;
    }

    const customerId =
      form.customer_id ||
      shipmentById.get(form.shipment_id)?.customer_id ||
      null;

    // Prevent duplicate invoices for the same shipment
    if (form.shipment_id) {
      const existingInvoice = invoices.find(
        (inv) => inv.shipment_id === form.shipment_id && ["sent", "approved", "paid"].includes(normalizedStatus(inv.status)),
      );
      if (existingInvoice) {
        toast.error(`Invoice ${existingInvoice.code} has already been sent for this shipment. Each shipment should only be invoiced once.`);
        setIsSaving(false);
        return;
      }
    }
    const shipment = form.shipment_id ? shipmentById.get(form.shipment_id) || null : null;
    const shipmentLineDescription = getShipmentLineDescription(form.shipment_id, shipment?.description);
    const trimmedNotes = form.notes.trim();
    const invoiceNotes = trimmedNotes
      ? shipmentLineDescription && trimmedNotes !== shipmentLineDescription
        ? `${shipmentLineDescription}\n\n${trimmedNotes}`
        : trimmedNotes
      : shipmentLineDescription || "Invoice raised by finance";

    if (!customerId) {
      toast.error("Search and select a customer or shipment.");
      return;
    }

    setIsSaving(true);
    const { data: codeData } = await supabase.rpc("generate_code", { prefix: "INV" });

    const invoiceCode = codeData || `INV-${Date.now()}`;
    const { data: inserted, error } = await supabase.from("invoices").insert({
      code: invoiceCode,
      amount,
      status: form.status,
      due_date: form.due_date || null,
      customer_id: customerId,
      shipment_id: form.shipment_id || null,
      notes: invoiceNotes,
    }).select("id").single();

    if (error) {
      toast.error(error.message || "Failed to create invoice.");
      setIsSaving(false);
      return;
    }

    if (form.status === "sent" && customerId && inserted?.id) {
      notifyInvoiceIssued(customerId, invoiceCode, formatAmount(amount), inserted.id);
    }

    toast.success("Invoice created.");
    setForm(emptyForm);
    await fetchInvoices();
    setIsSaving(false);
  };

  const openEditDialog = (invoice: InvoiceRow) => {
    setEditingInvoice(invoice);
    setEditForm({
      customer_id: invoice.customer_id || "",
      shipment_id: invoice.shipment_id || "",
      amount: invoice.amount.toFixed(2),
      status: normalizedStatus(invoice.status),
      due_date: invoice.due_date || "",
      notes: invoice.notes || "",
    });
  };

  const closeEditDialog = () => {
    setEditingInvoice(null);
    setEditForm(emptyForm);
  };

  const handleSaveEdit = async () => {
    if (!editingInvoice) return;

    const amount = Number(editForm.amount);
    if (Number.isNaN(amount) || amount <= 0) {
      toast.error("Enter a valid invoice amount.");
      return;
    }

    const previousStatus = normalizedStatus(editingInvoice.status);
    setIsSaving(true);
    const { error } = await supabase
      .from("invoices")
      .update({
        amount,
        status: editForm.status,
        due_date: editForm.due_date || null,
        notes: editForm.notes || null,
      })
      .eq("id", editingInvoice.id);

    if (error) {
      toast.error(error.message || "Failed to update invoice.");
      setIsSaving(false);
      return;
    }

    if (editForm.status === "sent" && previousStatus !== "sent" && editingInvoice.customer_id) {
      notifyInvoiceIssued(editingInvoice.customer_id, editingInvoice.code, formatAmount(amount), editingInvoice.id);
    }
    if (editForm.status === "paid" && previousStatus !== "paid" && editingInvoice.customer_id) {
      notifyInvoicePaid(editingInvoice.customer_id, editingInvoice.code, formatAmount(amount), editingInvoice.id);
    }

    toast.success("Invoice updated.");
    closeEditDialog();
    await fetchInvoices();
    setIsSaving(false);
  };

  const openInvoicePdf = async (row: InvoiceRow) => {
    const paidAmount = getInvoicePaid(row);
    const balance = getInvoiceBalance(row);
    try {
      const logoUrl = await fetchLogo();

      await generateInvoicePdf({
        logoUrl,
        companyName: "XY Cargo Logistics",
        invoiceTitle: "INVOICE",
        invoiceNumber: row.code,
        trackingNumber: row.shipment_tracking_no || row.shipment_code || undefined,
        billTo: row.customer_name || "Customer",
        billToId: row.customer_code || undefined,
        date: format(new Date(row.created_at), "PPpp"),
        description: getInvoiceDisplayDescription(row.shipment_id, row.shipment_description, row.notes),
        amount: formatAmount(row.amount),
        paid: formatAmount(paidAmount),
        balance: formatAmount(balance),
        filename: `invoice-${row.code}.pdf`,
        bankInstitution: "Access Bank Zambia",
        bankName: "MIQLAT ENTERPRISES COMPANY LIMITED",
        bankAccount: "0020110000181",
        bankBranch: "Longacres",
      });
    } catch (error) {
      console.error("Error generating invoice PDF:", error);
      toast.error("Failed to generate invoice PDF.");
    }
  };

  const columns: Column<InvoiceRow>[] = [
    { key: "code", label: "Invoice No." },
    {
      key: "customer_name",
      label: "Customer",
      render: (row) =>
        row.customer_name
          ? `${row.customer_name}${row.customer_code ? ` (${row.customer_code})` : ""}`
          : "-",
    },
    {
      key: "shipment_tracking_no",
      label: "Shipment ID",
      render: (row) => row.shipment_tracking_no || row.shipment_code || "-",
    },
    {
      key: "receiver",
      label: "Receiver",
      render: (row) => row.receiver_name ? `${row.receiver_name}${row.receiver_phone ? ` (${row.receiver_phone})` : ""}` : "-",
    },
    {
      key: "amount",
      label: "Invoice Amount",
      align: "center",
      render: (row) => formatAmount(row.amount),
    },
    {
      key: "paid",
      label: "Paid",
      align: "center",
      render: (row) => formatAmount(getInvoicePaid(row)),
    },
    {
      key: "balance",
      label: "Balance",
      align: "center",
      
      render: (row) => formatAmount(getInvoiceBalance(row)),
    },
    {
      key: "status",
      label: "Invoice Status",
      render: (row) => (
        <Badge variant={getInvoiceDisplayStatus(row) === "paid" ? "default" : "secondary"}>
          {getInvoiceDisplayStatus(row)}
        </Badge>
      ),
    },
    {
      key: "payment_progress",
      label: "Payment Progress",
      render: (row) => {
        const paymentState = getInvoicePaymentProgress(row);
        return (
          <Badge
            variant={
              paymentState === "paid"
                ? "default"
                : paymentState === "partial"
                  ? "secondary"
                  : "outline"
            }
          >
            {paymentState}
          </Badge>
        );
      },
    },
    {
      key: "due_date",
      label: "Due",
      render: (row) => (row.due_date ? format(new Date(row.due_date), "PP") : "-"),
    },
    {
      key: "download",
      label: "Download",
      render: (row) => (
        <Button variant="ghost" size="icon" className="h-8 w-8 p-0" onClick={() => openInvoicePdf(row)} title="Download invoice">
          <Download className="h-4 w-4 text-blue-600" />
        </Button>
      ),
    },
    {
      key: "action",
      label: "Action",
      render: (row) => (
        <div className="flex gap-1 whitespace-nowrap">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 p-0"
            title="View invoice"
            onClick={async () =>
              openFinanceDetailWindow(`Invoice ${row.code}`, "Invoice Details", [
                { label: "Invoice No.", value: row.code },
                {
                  label: "Customer",
                  value: row.customer_name
                    ? `${row.customer_name}${row.customer_code ? ` (${row.customer_code})` : ""}`
                    : row.customer_code || "Customer",
                },
                { label: "Shipment ID", value: row.shipment_tracking_no || row.shipment_code || "-" },
                { label: "System Shipment No.", value: row.shipment_code || "-" },
                { label: "Receiver", value: row.receiver_name || "-" },
                { label: "Receiver Phone", value: row.receiver_phone || "-" },
                { label: "Receiver Address", value: row.receiver_address || "-" },
                { label: "Invoice Amount", value: formatAmount(row.amount) },
                { label: "Paid", value: formatAmount(getInvoicePaid(row)) },
                { label: "Balance", value: formatAmount(getInvoiceBalance(row)) },
                { label: "Invoice Status", value: normalizedStatus(row.status) },
                { label: "Payment Progress", value: getInvoicePaymentProgress(row) },
                { label: "Date", value: format(new Date(row.created_at), "PP") },
                { label: "Due Date", value: row.due_date ? format(new Date(row.due_date), "PP") : "-" },
                {
                  label: "Description",
                  value: getInvoiceDisplayDescription(row.shipment_id, row.shipment_description, row.notes),
                },
              ], undefined, await fetchLogo())
            }
          >
            <Eye className="h-4 w-4 text-blue-600" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 p-0" onClick={() => openEditDialog(row)} title="Edit invoice" disabled={getInvoiceDisplayStatus(row) === "paid"}>
            <Pencil className="h-4 w-4 text-blue-600" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Invoices"
        
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
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{invoiceStats.totalCount}</div>
            <p className="mt-1 text-xs text-muted-foreground">{formatAmount(invoiceStats.totalRaised)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Paid Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{invoiceStats.paidCount}</div>
            <p className="mt-1 text-xs text-muted-foreground">{formatAmount(invoiceStats.paidAmount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Outstanding Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{invoiceStats.outstandingCount}</div>
            <p className="mt-1 text-xs text-muted-foreground">{formatAmount(invoiceStats.outstandingAmount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Sent Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{invoiceStats.sent}</div>
            <p className="mt-1 text-xs text-muted-foreground">{formatAmount(invoiceStats.sentAmount)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create Invoice</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Customer</Label>
              <SearchableSelect
                value={form.customer_id}
                onValueChange={handleCustomerChange}
                options={customerSearchOptions}
                placeholder="Search customer by name or ID"
                searchPlaceholder="Search customer name or customer ID..."
              />
            </div>
            <div className="space-y-2">
              <Label>Shipment</Label>
              <SearchableSelect
                value={form.shipment_id}
                onValueChange={handleShipmentChange}
                options={createShipmentOptions}
                placeholder="Search shipment by custom ID"
                searchPlaceholder="Search custom shipment ID or system shipment code..."
                emptyMessage="No shipments found."
              />
            </div>
            <div className="space-y-2">
              <Label>Amount ({code})</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.amount ? toSelectedAmount(form.amount) : ""}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, amount: fromSelectedAmount(event.target.value) }))
                }
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input
                type="date"
                value={form.due_date}
                onChange={(event) => setForm((prev) => ({ ...prev, due_date: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(value) => setForm((prev) => ({ ...prev, status: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                placeholder="Invoice notes..."
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleCreateInvoice} disabled={isSaving}>
              {isSaving ? "Saving..." : "Create Invoice"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4 flex flex-wrap">
          <TabsTrigger value="all">All Invoices</TabsTrigger>
          <TabsTrigger value="draft">Draft Invoices</TabsTrigger>
          <TabsTrigger value="sent">Sent Invoices</TabsTrigger>
          <TabsTrigger value="approved">Approved Invoices</TabsTrigger>
          <TabsTrigger value="paid">Paid Invoices</TabsTrigger>
        </TabsList>
        <TabsContent value={activeTab}>
          <DataTable
            columns={columns}
            data={filteredInvoices}
            isLoading={isLoading}
            searchPlaceholder="Search invoices, customers, or shipment IDs..."
          />
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(editingInvoice)} onOpenChange={(open) => (!open ? closeEditDialog() : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Invoice</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Customer</Label>
              <Input
                value={
                  editingInvoice
                    ? `${editingInvoice.customer_name || "Customer"}${editingInvoice.customer_code ? ` (${editingInvoice.customer_code})` : ""}`
                    : ""
                }
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label>Shipment ID</Label>
              <Input
                value={editingInvoice?.shipment_tracking_no || editingInvoice?.shipment_code || "-"}
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label>Amount ({code})</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={editForm.amount ? toSelectedAmount(editForm.amount) : ""}
                onChange={(event) =>
                  setEditForm((prev) => ({ ...prev, amount: fromSelectedAmount(event.target.value) }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={editForm.status} onValueChange={(value) => setEditForm((prev) => ({ ...prev, status: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input
                type="date"
                value={editForm.due_date}
                onChange={(event) => setEditForm((prev) => ({ ...prev, due_date: event.target.value }))}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Notes</Label>
              <Textarea
                value={editForm.notes}
                onChange={(event) => setEditForm((prev) => ({ ...prev, notes: event.target.value }))}
              />
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

export default FinanceInvoices;

