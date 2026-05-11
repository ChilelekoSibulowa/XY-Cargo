import { format, startOfDay, startOfMonth, startOfQuarter, startOfWeek, startOfYear, subDays, subMonths, subYears } from "date-fns";

export type FinanceShipmentLike = {
  total_cost: number | null;
  shipping_cost: number | null;
  paid_amount?: number | null;
};

export type FinanceInvoiceLike = {
  amount: number | null;
  status: string | null;
  shipment_id?: string | null;
  customer_id?: string | null;
  shipment_total_cost?: number | null;
  shipment_shipping_cost?: number | null;
};

export type PortalInvoiceRow = {
  id: string;
  code: string;
  amount: number;
  status: string | null;
  due_date: string | null;
  notes: string | null;
  created_at: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_code: string | null;
  customer_phone?: string | null;
  shipment_id: string | null;
  shipment_code: string | null;
  shipment_tracking_no: string | null;
  shipment_description: string | null;
  shipment_paid_amount: number | null;
  shipment_total_cost: number | null;
  shipment_shipping_cost: number | null;
  shipment_status: string | null;
};

export const toNumber = (value: unknown, fallback = 0) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  if (value === null || value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const getShipmentBillingAmount = (
  shipment: Pick<FinanceShipmentLike, "total_cost" | "shipping_cost">,
) => {
  const shippingFee = toNumber(shipment.shipping_cost);
  if (shippingFee > 0) return shippingFee;
  return toNumber(shipment.total_cost);
};

export const getShipmentInvoiceTotal = (shipment: Pick<FinanceShipmentLike, "total_cost" | "shipping_cost">) =>
  getShipmentBillingAmount(shipment);

export const getInvoiceBillingAmount = (
  invoice: Pick<FinanceInvoiceLike, "amount" | "shipment_total_cost" | "shipment_shipping_cost">,
  shipment?: Partial<FinanceShipmentLike> | null,
) => {
  const explicitInvoiceAmount = toNumber(invoice.amount);
  if (explicitInvoiceAmount > 0) {
    return explicitInvoiceAmount;
  }

  const linkedShipment = shipment || {
    total_cost: invoice.shipment_total_cost ?? null,
    shipping_cost: invoice.shipment_shipping_cost ?? null,
  };
  return getShipmentBillingAmount(linkedShipment as Pick<FinanceShipmentLike, "shipping_cost" | "total_cost">);
};

export const getShipmentOutstandingBalance = (
  shipment: Pick<FinanceShipmentLike, "total_cost" | "shipping_cost" | "paid_amount">,
) => Math.max(getShipmentInvoiceTotal(shipment) - toNumber(shipment.paid_amount), 0);

export const getInvoicePaidAmount = (
  invoice: Pick<FinanceInvoiceLike, "amount" | "shipment_total_cost" | "shipment_shipping_cost">,
  shipment?: Partial<FinanceShipmentLike> | null,
  fallbackPaidAmount = 0,
) => {
  const paidAmount = shipment ? toNumber(shipment.paid_amount) : toNumber(fallbackPaidAmount);
  return Math.min(getInvoiceBillingAmount(invoice, shipment), paidAmount);
};

export const getInvoiceOutstandingBalance = (
  invoice: Pick<FinanceInvoiceLike, "amount" | "shipment_total_cost" | "shipment_shipping_cost">,
  shipment?: Partial<FinanceShipmentLike> | null,
  fallbackPaidAmount = 0,
) => Math.max(getInvoiceBillingAmount(invoice, shipment) - getInvoicePaidAmount(invoice, shipment, fallbackPaidAmount), 0);

export const getInvoicePaymentState = (
  invoice: Pick<FinanceInvoiceLike, "amount" | "shipment_total_cost" | "shipment_shipping_cost">,
  shipment?: Partial<FinanceShipmentLike> | null,
  fallbackPaidAmount = 0,
) => {
  const paidAmount = getInvoicePaidAmount(invoice, shipment, fallbackPaidAmount);
  const invoiceAmount = getInvoiceBillingAmount(invoice, shipment);

  if (invoiceAmount > 0 && paidAmount >= invoiceAmount) {
    return "paid";
  }

  if (paidAmount > 0) {
    return "partial";
  }

  return "unpaid";
};

export const isFinanceInvoiceVisible = (status: string | null | undefined) =>
  ["sent", "approved", "paid"].includes((status || "").toLowerCase());

export const mapPortalInvoiceRow = (row: any): PortalInvoiceRow => ({
  amount:
    (() => {
      const shipmentShippingCost = Array.isArray(row.shipment)
        ? row.shipment[0]?.shipping_cost ?? null
        : row.shipment?.shipping_cost ?? null;
      const shipmentTotalCost = Array.isArray(row.shipment)
        ? row.shipment[0]?.total_cost ?? null
        : row.shipment?.total_cost ?? null;
      return getInvoiceBillingAmount({
        amount: toNumber(row.amount),
        shipment_shipping_cost: shipmentShippingCost,
        shipment_total_cost: shipmentTotalCost,
      });
    })(),
  id: row.id,
  code: row.code,
  status: row.status || "draft",
  due_date: row.due_date || null,
  notes: row.notes || null,
  created_at: row.created_at,
  customer_id: row.customer_id || null,
  customer_name: Array.isArray(row.customer)
    ? row.customer[0]?.full_name || null
    : row.customer?.full_name || null,
  customer_code: Array.isArray(row.customer)
    ? row.customer[0]?.code || null
    : row.customer?.code || null,
  customer_phone: Array.isArray(row.customer)
    ? row.customer[0]?.phone || null
    : row.customer?.phone || null,
  shipment_id: row.shipment_id || null,
  shipment_code: Array.isArray(row.shipment)
    ? row.shipment[0]?.code || null
    : row.shipment?.code || null,
  shipment_tracking_no: Array.isArray(row.shipment)
    ? row.shipment[0]?.custom_tracking_number || null
    : row.shipment?.custom_tracking_number || null,
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
});

export const getPortalInvoiceReference = (
  invoice: Pick<PortalInvoiceRow, "shipment_tracking_no" | "shipment_code">,
) => invoice.shipment_tracking_no || invoice.shipment_code || "-";

export const downloadCsv = (filename: string, headers: string[], rows: Array<Array<string | number>>) => {
  const escapeCell = (value: string | number) => {
    const text = String(value ?? "");
    if (/[",\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const csv = [headers, ...rows]
    .map((row) => row.map(escapeCell).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const openPrintWindow = (title: string, bodyHtml: string, logoUrl?: string) => {
  const win = window.open("", "_blank", "width=960,height=760");
  if (!win) return false;

  const logoHtml = logoUrl
    ? `<div style="margin-bottom:16px;"><img src="${logoUrl}" alt="XY Cargo" style="max-height:60px;max-width:200px;object-fit:contain;" /></div>`
    : "";

  const html = `
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
          h1 { margin: 0 0 8px; font-size: 24px; }
          p { margin: 4px 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th, td { border: 1px solid #dbe2ea; padding: 8px; text-align: left; }
          th { background: #f8fafc; }
          .muted { color: #64748b; }
        </style>
      </head>
      <body>
        ${logoHtml}
        ${bodyHtml}
      </body>
    </html>
  `;

  win.document.write(html);
  win.document.close();
  win.focus();
  return true;
};

export type FinanceDetailItem = {
  label: string;
  value: string | number | null | undefined;
};

export const openFinanceDetailWindow = (
  title: string,
  heading: string,
  items: FinanceDetailItem[],
  extraHtml?: string,
  logoUrl?: string,
) => {
  const rows = items
    .map(
      (item) =>
        `<tr><th>${escapeHtml(item.label)}</th><td>${escapeHtml(
          item.value === null || item.value === undefined || item.value === "" ? "-" : String(item.value),
        )}</td></tr>`,
    )
    .join("");

  return openPrintWindow(
    title,
    `<h1>${escapeHtml(heading)}</h1><table><tbody>${rows}</tbody></table>${extraHtml || ""}`,
    logoUrl,
  );
};

export const formatFinancePaymentMethod = (value: string | null | undefined) => {
  switch ((value || "").toLowerCase()) {
    case "mobile_money":
      return "Mobile Money";
    case "bank_transfer":
      return "Bank Transfer";
    case "lipila":
      return "Lipila";
    case "wallet":
    case "agent_wallet":
      return "Customer or Agent Wallet";
    case "cash":
      return "Cash";
    default:
      return value ? value.replace(/_/g, " ") : "-";
  }
};

export type TimeFilter = "today" | "week" | "month" | "quarter" | "year";
export type FinanceDateFilter = "all" | "today" | "yesterday" | "week" | "month" | "year" | "last_six_months" | "custom";
export type FinanceCustomDateRange = {
  startDate?: string;
  endDate?: string;
};

export const financeDateFilterOptions: Array<{ value: FinanceDateFilter; label: string }> = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "year", label: "This year" },
  { value: "last_six_months", label: "Last 6 months" },
  { value: "custom", label: "Custom range" },
];

const endOfDayLocal = (date: Date) => {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
};

const parseDateInput = (value?: string, endOfDay = false) => {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return endOfDay ? endOfDayLocal(parsed) : parsed;
};

export const getFinanceDateRange = (
  filter: FinanceDateFilter,
  customRange: FinanceCustomDateRange = {},
) => {
  const now = new Date();
  const today = startOfDay(now);

  switch (filter) {
    case "today":
      return { start: today, end: endOfDayLocal(now) };
    case "yesterday": {
      const yesterday = subDays(today, 1);
      return { start: yesterday, end: endOfDayLocal(yesterday) };
    }
    case "week":
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfDayLocal(now) };
    case "month":
      return { start: startOfMonth(now), end: endOfDayLocal(now) };
    case "year":
      return { start: startOfYear(now), end: endOfDayLocal(now) };
    case "last_six_months":
      return { start: subMonths(today, 6), end: endOfDayLocal(now) };
    case "custom":
      return {
        start: parseDateInput(customRange.startDate),
        end: parseDateInput(customRange.endDate, true),
      };
    case "all":
    default:
      return { start: null, end: null };
  }
};

export const isWithinFinanceDateRange = (
  value: string | null | undefined,
  range: { start: Date | null; end: Date | null },
) => {
  if (!range.start && !range.end) return true;
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  if (range.start && date < range.start) return false;
  if (range.end && date > range.end) return false;
  return true;
};

export const getPeriodStart = (filter: TimeFilter) => {
  const now = new Date();
  switch (filter) {
    case "today":
      return startOfDay(now);
    case "week":
      return startOfWeek(now, { weekStartsOn: 1 });
    case "quarter":
      return startOfQuarter(now);
    case "year":
      return startOfYear(now);
    case "month":
    default:
      return startOfMonth(now);
  }
};

export const buildRecentMonthSeries = (
  values: Array<{ created_at: string; amount: number }>,
  months = 6,
) => {
  const buckets = Array.from({ length: months }, (_, index) => {
    const date = subMonths(startOfMonth(new Date()), months - 1 - index);
    return {
      key: format(date, "yyyy-MM"),
      label: format(date, "MMM"),
      amount: 0,
    };
  });

  values.forEach((entry) => {
    const key = format(new Date(entry.created_at), "yyyy-MM");
    const bucket = buckets.find((item) => item.key === key);
    if (bucket) bucket.amount += toNumber(entry.amount);
  });

  return buckets;
};

export const buildRecentYearSeries = (
  values: Array<{ created_at: string; amount: number }>,
  years = 5,
) => {
  const buckets = Array.from({ length: years }, (_, index) => {
    const date = subYears(startOfYear(new Date()), years - 1 - index);
    return {
      key: format(date, "yyyy"),
      label: format(date, "yyyy"),
      amount: 0,
    };
  });

  values.forEach((entry) => {
    const key = format(new Date(entry.created_at), "yyyy");
    const bucket = buckets.find((item) => item.key === key);
    if (bucket) bucket.amount += toNumber(entry.amount);
  });

  return buckets;
};

export const buildPaymentTrendSeries = (
  payments: Array<{ created_at: string; amount: number; status: string | null }>,
  outstandingAmount: number,
  filter: TimeFilter,
) => {
  const now = new Date();

  if (filter === "today") {
    const labels = ["00:00", "04:00", "08:00", "12:00", "16:00", "20:00"];
    const series = labels.map((label) => ({ label, received: 0, failed: 0, outstanding: outstandingAmount }));

    payments.forEach((payment) => {
      const date = new Date(payment.created_at);
      if (date < startOfDay(now)) return;
      const bucket = Math.min(5, Math.floor(date.getHours() / 4));
      if (payment.status === "completed") series[bucket].received += toNumber(payment.amount);
      if (payment.status === "failed") series[bucket].failed += toNumber(payment.amount);
    });

    return series;
  }

  if (filter === "week") {
    const series = Array.from({ length: 7 }, (_, index) => {
      const date = subDays(startOfDay(now), 6 - index);
      return { key: format(date, "yyyy-MM-dd"), label: format(date, "EEE"), received: 0, failed: 0, outstanding: outstandingAmount };
    });

    payments.forEach((payment) => {
      const key = format(new Date(payment.created_at), "yyyy-MM-dd");
      const bucket = series.find((item) => item.key === key);
      if (!bucket) return;
      if (payment.status === "completed") bucket.received += toNumber(payment.amount);
      if (payment.status === "failed") bucket.failed += toNumber(payment.amount);
    });

    return series;
  }

  if (filter === "month") {
    const series = Array.from({ length: 4 }, (_, index) => ({
      label: `Week ${index + 1}`,
      received: 0,
      failed: 0,
      outstanding: outstandingAmount,
      start: startOfWeek(subDays(now, (3 - index) * 7), { weekStartsOn: 1 }),
    }));

    payments.forEach((payment) => {
      const date = new Date(payment.created_at);
      const bucket = [...series].reverse().find((item) => date >= item.start);
      if (!bucket) return;
      if (payment.status === "completed") bucket.received += toNumber(payment.amount);
      if (payment.status === "failed") bucket.failed += toNumber(payment.amount);
    });

    return series.map(({ label, received, failed, outstanding }) => ({ label, received, failed, outstanding }));
  }

  if (filter === "quarter") {
    const series = Array.from({ length: 3 }, (_, index) => {
      const date = subMonths(startOfMonth(now), 2 - index);
      return { key: format(date, "yyyy-MM"), label: format(date, "MMM"), received: 0, failed: 0, outstanding: outstandingAmount };
    });

    payments.forEach((payment) => {
      const key = format(new Date(payment.created_at), "yyyy-MM");
      const bucket = series.find((item) => item.key === key);
      if (!bucket) return;
      if (payment.status === "completed") bucket.received += toNumber(payment.amount);
      if (payment.status === "failed") bucket.failed += toNumber(payment.amount);
    });

    return series;
  }

  const series = Array.from({ length: 5 }, (_, index) => {
    const date = subMonths(startOfMonth(now), 4 - index);
    return { key: format(date, "yyyy-MM"), label: format(date, "MMM"), received: 0, failed: 0, outstanding: outstandingAmount };
  });

  payments.forEach((payment) => {
    const key = format(new Date(payment.created_at), "yyyy-MM");
    const bucket = series.find((item) => item.key === key);
    if (!bucket) return;
    if (payment.status === "completed") bucket.received += toNumber(payment.amount);
    if (payment.status === "failed") bucket.failed += toNumber(payment.amount);
  });

  return series;
};
