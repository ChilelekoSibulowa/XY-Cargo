import { supabase } from "@/integrations/supabase/client";

export const SUPPORT_TICKET_CATEGORIES = [
  "general",
  "shipment_issue",
  "payment",
  "customs",
  "delivery",
  "damage",
  "missing_item",
  "claim",
  "other",
  "delivery_issue",
  "accident",
  "customer_dispute",
] as const;

export const DRIVER_INCIDENT_CATEGORIES = [
  "delivery_issue",
  "accident",
  "customer_dispute",
] as const;

export const SUPPORT_TICKET_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export const SUPPORT_TICKET_STATUSES = ["open", "in_progress", "resolved", "closed"] as const;
export const SUPPORT_TICKET_DEPARTMENTS = [
  "support",
  "finance",
  "warehouse",
  "operations",
  "compliance",
  "management",
  "driver",
] as const;

export type SupportTicketCategory = (typeof SUPPORT_TICKET_CATEGORIES)[number];
export type SupportTicketPriority = (typeof SUPPORT_TICKET_PRIORITIES)[number];
export type SupportTicketStatus = (typeof SUPPORT_TICKET_STATUSES)[number];
export type SupportTicketDepartment = (typeof SUPPORT_TICKET_DEPARTMENTS)[number];

export type SupportTicketMessageRow = {
  id: string;
  ticket_id: string;
  sender_user_id: string | null;
  sender_role: string;
  sender_name: string | null;
  message: string;
  attachment_url: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
  is_internal: boolean;
  created_at: string;
};

export type SupportTicketRow = {
  id: string;
  ticket_code: string;
  customer_id: string | null;
  shipment_id: string | null;
  sourcing_request_id?: string | null;
  supplier_payment_request_id?: string | null;
  subject: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  assigned_to: string | null;
  resolution_notes: string | null;
  created_by: string | null;
  escalated_to_department: string | null;
  escalated_at: string | null;
  created_at: string;
  updated_at: string;
  customer?: {
    full_name: string | null;
    code: string | null;
    user_id?: string | null;
    agent_id?: string | null;
  } | null;
  shipment?: {
    code: string | null;
    custom_tracking_number: string | null;
  } | null;
  requester_name?: string;
  requester_role?: string;
  assigned_name?: string | null;
};

export type SupportStaffOption = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: string;
};

export const formatSupportLabel = (value: string | null | undefined) => {
  if (!value) return "-";
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

export const isDriverIncidentCategory = (value: string | null | undefined) =>
  DRIVER_INCIDENT_CATEGORIES.includes((value || "").toLowerCase() as (typeof DRIVER_INCIDENT_CATEGORIES)[number]);

export const buildSupportTicketCode = (prefix = "TKT") =>
  `${prefix}-${Date.now().toString(36).toUpperCase()}`;

export const isSupportTicketClosed = (status: string | null | undefined) =>
  ["resolved", "closed"].includes((status || "").toLowerCase());

export const getDepartmentRouteLabel = (department: string) => {
  const normalized = (department || "support").toLowerCase();
  if (normalized === "warehouse") return "Warehouse Tickets";
  if (normalized === "operations") return "Operations Tickets";
  if (normalized === "finance") return "Finance Tickets";
  if (normalized === "compliance") return "Compliance Tickets";
  if (normalized === "management") return "Management Tickets";
  if (normalized === "driver") return "Driver Tickets";
  return "Support Tickets";
};

export const uploadSupportAttachment = async (
  ticketId: string,
  userId: string,
  file: File,
) => {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${ticketId}/${userId}-${Date.now()}-${safeName}`;

  const { error } = await supabase.storage
    .from("support-attachments")
    .upload(path, file, { upsert: false });

  if (error) throw error;

  const { data } = supabase.storage.from("support-attachments").getPublicUrl(path);

  return {
    attachment_url: data.publicUrl,
    attachment_name: file.name,
    attachment_type: file.type || null,
  };
};

export const fetchSupportStaffOptions = async () => {
  const [{ data: profiles, error: profileError }, { data: roles, error: roleError }] =
    await Promise.all([
      supabase.from("profiles").select("user_id, full_name, email"),
      supabase.from("user_roles").select("user_id, role").in("role", ["admin", "staff", "driver"]),
    ]);

  if (profileError) throw profileError;
  if (roleError) throw roleError;

  const profileMap = new Map(
    (profiles || []).map((profile) => [profile.user_id, profile]),
  );

  return ((roles || []) as { user_id: string; role: string }[])
    .map((role) => ({
      user_id: role.user_id,
      full_name: profileMap.get(role.user_id)?.full_name || null,
      email: profileMap.get(role.user_id)?.email || null,
      role: role.role,
    }))
    .sort((a, b) =>
      (a.full_name || a.email || "").localeCompare(b.full_name || b.email || ""),
    ) as SupportStaffOption[];
};
