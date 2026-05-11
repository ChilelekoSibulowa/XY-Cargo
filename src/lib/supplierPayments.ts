import { supabase } from "@/integrations/supabase/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SupplierPaymentRequest = {
  id: string;
  request_code: string;
  customer_id: string;
  submitted_by: string;
  submitted_by_role: string;
  status: string;

  supplier_name: string;
  company_name: string;
  supplier_country: string;
  whatsapp_wechat: string;
  supplier_email: string | null;
  supplier_address: string | null;

  payment_method: string;

  bank_name: string | null;
  bank_country: string | null;
  account_name: string | null;
  swift_code: string | null;
  account_number_iban: string | null;
  branch: string | null;

  currency: string;
  amount: number;
  purpose: string;
  description: string | null;

  documents: SupplierDocument[];

  exchange_rate: number | null;
  total_payable: number | null;
  payable_currency: string | null;

  declaration_accepted: boolean;

  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  support_response_message: string | null;
  support_response_at: string | null;
  support_responded_by: string | null;

  // Joined relations
  customer?: { id: string; full_name: string; phone: string | null; code: string } | null;
};

export type SupplierDocument = {
  name: string;
  url: string;
  type: string;
  size: number;
};

export type SupplierPaymentFormData = {
  supplier_name: string;
  company_name: string;
  supplier_country: string;
  whatsapp_wechat: string;
  supplier_email: string;
  supplier_address: string;

  payment_method: string;

  bank_name: string;
  bank_country: string;
  account_name: string;
  swift_code: string;
  account_number_iban: string;
  branch: string;

  currency: string;
  amount: string;
  purpose: string;
  description: string;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SUPPLIER_COUNTRIES = [
  { value: "China", label: "China" },
  { value: "Dubai", label: "Dubai (UAE)" },
] as const;

export const PAYMENT_METHODS = [
  { value: "alipay", label: "Alipay" },
  { value: "wechat", label: "WeChat Pay" },
  { value: "bank_transfer", label: "Bank Transfer" },
] as const;

export const PAYMENT_CURRENCIES = [
  { value: "USD", label: "USD (US Dollar)" },
  { value: "ZMW", label: "ZMW (Zambian Kwacha)" },
  { value: "CNY", label: "CNY (Chinese Yuan)" },
  { value: "AED", label: "AED (UAE Dirham)" },
] as const;

export const PAYMENT_PURPOSES = [
  { value: "payment_of_goods", label: "Payment of Goods" },
] as const;

export const STATUS_OPTIONS = [
  { value: "draft", label: "Draft", color: "secondary" },
  { value: "pending_review", label: "Pending Review", color: "default" },
  { value: "processing", label: "Processing", color: "default" },
  { value: "completed", label: "Completed", color: "default" },
  { value: "rejected", label: "Rejected", color: "destructive" },
] as const;

export const ACCEPTED_FILE_TYPES = ["application/pdf", "image/jpeg", "image/png"];
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export const getStatusLabel = (status: string) =>
  STATUS_OPTIONS.find((s) => s.value === status)?.label || status.replace(/_/g, " ");

export const getStatusColor = (status: string) =>
  STATUS_OPTIONS.find((s) => s.value === status)?.color || "secondary";

export const getPaymentMethodLabel = (method: string) =>
  PAYMENT_METHODS.find((m) => m.value === method)?.label || method;

export const emptyFormData = (): SupplierPaymentFormData => ({
  supplier_name: "",
  company_name: "",
  supplier_country: "",
  whatsapp_wechat: "",
  supplier_email: "",
  supplier_address: "",
  payment_method: "",
  bank_name: "",
  bank_country: "",
  account_name: "",
  swift_code: "",
  account_number_iban: "",
  branch: "",
  currency: "",
  amount: "",
  purpose: "payment_of_goods",
  description: "",
});

export const generateRequestCode = () => {
  const seq = Date.now().toString().slice(-6);
  return `XY-PAY-${seq}`;
};

// ---------------------------------------------------------------------------
// File Upload
// ---------------------------------------------------------------------------

export const uploadSupplierDocument = async (
  requestId: string,
  file: File,
): Promise<SupplierDocument> => {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `supplier-payments/${requestId}/${Date.now()}-${safeName}`;

  // Try dedicated bucket first; fall back to sourcing-attachments which already exists
  let uploadError: Error | null = null;
  let bucketUsed = "supplier-documents";

  const { error: primaryError } = await supabase.storage
    .from("supplier-documents")
    .upload(path, file, { upsert: false });

  if (primaryError) {
    bucketUsed = "sourcing-attachments";
    const { error: fallbackError } = await supabase.storage
      .from("sourcing-attachments")
      .upload(path, file, { upsert: false });
    if (fallbackError) {
      uploadError = fallbackError;
    }
  }

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(bucketUsed).getPublicUrl(path);

  return {
    name: file.name,
    url: data.publicUrl,
    type: file.type,
    size: file.size,
  };
};

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

const SUPPLIER_REQUEST_SELECT =
  "id, request_code, customer_id, submitted_by, submitted_by_role, status, supplier_name, company_name, supplier_country, whatsapp_wechat, supplier_email, supplier_address, payment_method, bank_name, bank_country, account_name, swift_code, account_number_iban, branch, currency, amount, purpose, description, documents, exchange_rate, total_payable, payable_currency, declaration_accepted, created_at, updated_at, reviewed_at, reviewed_by, support_response_message, support_response_at, support_responded_by, customer:customers(id, full_name, phone, code)";

export const fetchSupplierPaymentRequests = async (
  filters?: { customer_id?: string; submitted_by?: string; limit?: number },
) => {
  let query = supabase
    .from("supplier_payment_requests")
    .select(SUPPLIER_REQUEST_SELECT)
    .order("created_at", { ascending: false });

  if (filters?.customer_id) {
    query = query.eq("customer_id", filters.customer_id);
  }
  if (filters?.submitted_by) {
    query = query.eq("submitted_by", filters.submitted_by);
  }
  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as unknown as SupplierPaymentRequest[];
};

export const fetchAllSupplierPaymentRequests = async (limit = 500) => {
  const { data, error } = await supabase
    .from("supplier_payment_requests")
    .select(SUPPLIER_REQUEST_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as unknown as SupplierPaymentRequest[];
};

export const createSupplierPaymentRequest = async (
  payload: Record<string, unknown>,
) => {
  const { data, error } = await supabase
    .from("supplier_payment_requests")
    .insert(payload as any)
    .select("id, request_code")
    .single();

  if (error) throw error;
  return data as { id: string; request_code: string };
};

export const deleteSupplierPaymentRequest = async (id: string) => {
  const { error } = await supabase
    .from("supplier_payment_requests")
    .delete()
    .eq("id", id);

  if (error) throw error;
};

export const updateSupplierPaymentRequestStatus = async (
  id: string,
  status: string,
  reviewedBy?: string,
) => {
  const updates: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (reviewedBy) {
    updates.reviewed_by = reviewedBy;
    updates.reviewed_at = new Date().toISOString();
  }
  const { error } = await supabase
    .from("supplier_payment_requests")
    .update(updates)
    .eq("id", id);

  if (error) throw error;
};

export const updateSupplierPaymentRequestResponse = async (
  id: string,
  message: string,
  respondedBy?: string,
) => {
  const { error } = await supabase
    .from("supplier_payment_requests" as any)
    .update({
      support_response_message: message,
      support_response_at: new Date().toISOString(),
      support_responded_by: respondedBy || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw error;
};
