import { supabase } from "@/integrations/supabase/client";
import { remapNotificationsToWarehouseTracking } from "@/lib/notifications";

export const DEFAULT_AGENT_COMMISSION_RATE_KG = 0.5;
export const DEFAULT_AGENT_COMMISSION_RATE_CBM = 10.0;

export const AGENT_STATUS_LABELS: Record<string, string> = {
  saved_pickup: "Created",
  saved_dropoff: "Incoming Parcels",
  received: "Need Action",
  requested_pickup: "Submitted",
  approved: "Confirm Shipment",
  assigned: "Outgoing Parcel",
  supplied: "In Transit",
  delivered: "Ready for Collection",
  closed: "Collected",
  returned: "Problem Parcel",
  returned_stock: "Returned to Stock",
  returned_delivered: "Returned & Delivered",
};

export type AgentShipmentTabKey =
  | "all_parcels"
  | "all_shipments"
  | "incoming"
  | "need_action"
  | "submitted"
  | "confirm"
  | "outgoing"
  | "in_transit"
  | "arrived"
  | "collected"
  | "unpaid"
  | "paid"
  | "problem"
  | "claim";

export const AGENT_SHIPMENT_TABS: { key: AgentShipmentTabKey; label: string }[] = [
  { key: "all_parcels", label: "All Parcels" },
  { key: "all_shipments", label: "All Shipments" },
  { key: "incoming", label: "Incoming Parcels" },
  { key: "need_action", label: "Need Action" },
  { key: "submitted", label: "Submitted" },
  { key: "confirm", label: "Confirm Shipment" },
  { key: "outgoing", label: "Outgoing Parcel" },
  { key: "in_transit", label: "In Transit" },
  { key: "arrived", label: "Ready for Collection" },
  { key: "collected", label: "Collected" },
  { key: "unpaid", label: "Unpaid" },
  { key: "paid", label: "Paid" },
  { key: "problem", label: "Problem Parcels" },
  { key: "claim", label: "Claim Parcels" },
];

export type AgentCustomerRow = {
  id: string;
  code: string;
  full_name: string;
  phone: string;
  email: string | null;
  city: string | null;
  wallet_balance: number | null;
  created_at: string;
};

export type AgentShipmentRow = {
  id: string;
  code: string;
  customer_id: string;
  status: string;
  payment_status: string | null;
  paid_amount: number | null;
  total_cost: number | null;
  shipping_cost: number | null;
  service_type: string;
  product_type?: string | null;
  description: string | null;
  notes: string | null;
  custom_tracking_number: string | null;
  handling_method?: string | null;
  created_at: string;
  updated_at: string;
  weight: number | null;
  cbm: number | null;
  consolidation_id?: string | null;
  estimated_delivery_date: string | null;
  actual_delivery_date: string | null;
  customer: {
    code: string | null;
    full_name: string | null;
  } | null;
  receiver: {
    full_name: string | null;
    phone: string | null;
    address: string | null;
  } | null;
};

export type AgentPaymentRow = {
  id: string;
  code: string;
  amount: number;
  status: string | null;
  payment_provider: string;
  created_at: string;
  customer_id: string | null;
  shipment_id: string | null;
};

export type AgentSupportTicketRow = {
  id: string;
  ticket_code: string;
  subject: string;
  status: string;
  priority: string;
  category: string;
  created_at: string;
  updated_at: string;
  customer_id: string | null;
  created_by: string | null;
  resolution_notes: string | null;
  customer: {
    code: string | null;
    full_name: string | null;
  } | null;
};

export type AgentSourcingRow = {
  id: string;
  product_name: string;
  quantity: number;
  budget: number | null;
  status: string;
  created_at: string;
  customer_id: string;
  customer: {
    code: string | null;
    full_name: string | null;
  } | null;
};

export type AgentNotificationRow = {
  id: string;
  title: string;
  message: string;
  created_at: string;
};

export type AgentWalletProfile = {
  user_id: string;
  wallet_balance: number | null;
};

export const formatAgentStatus = (status: string) =>
  AGENT_STATUS_LABELS[status] || status.replace(/_/g, " ");

export const formatServiceType = (serviceType: string | null | undefined) => {
  const normalized = (serviceType || "").trim().toLowerCase();
  if (normalized === "air") return "Air Freight";
  if (normalized === "sea") return "Sea Freight";
  return normalized ? normalized.replace(/\b\w/g, (char) => char.toUpperCase()) : "-";
};

export const toCurrencyNumber = (value: number | null | undefined) => Number(value || 0);

export const getShipmentItemValue = (shipment: Pick<AgentShipmentRow, "total_cost">) =>
  toCurrencyNumber(shipment.total_cost);

export const getShipmentShippingFee = (shipment: Pick<AgentShipmentRow, "shipping_cost">) =>
  toCurrencyNumber(shipment.shipping_cost);

export const getShipmentInvoiceTotal = (
  shipment: Pick<AgentShipmentRow, "total_cost" | "shipping_cost">,
) => {
  const shippingFee = getShipmentShippingFee(shipment);
  if (shippingFee > 0) return shippingFee;
  return getShipmentItemValue(shipment);
};

export const getShipmentCommissionBase = (
  shipment: Pick<AgentShipmentRow, "total_cost" | "shipping_cost">,
) => {
  const shippingFee = getShipmentShippingFee(shipment);
  return shippingFee > 0 ? shippingFee : getShipmentInvoiceTotal(shipment);
};

export const calculateAgentCommission = (
  shipment: Pick<AgentShipmentRow, "weight" | "cbm">,
  rateKg: number = DEFAULT_AGENT_COMMISSION_RATE_KG,
  rateCbm: number = DEFAULT_AGENT_COMMISSION_RATE_CBM,
) => {
  const weight = Number(shipment.weight || 0);
  const cbm = Number(shipment.cbm || 0);

  // Commission = (Weight * Rate/KG) + (CBM * Rate/CBM)
  return (weight * rateKg) + (cbm * rateCbm);
};

export const getShipmentOutstandingBalance = (
  shipment: Pick<AgentShipmentRow, "total_cost" | "shipping_cost" | "paid_amount">,
) => {
  const total = getShipmentInvoiceTotal(shipment);
  const paid = toCurrencyNumber(shipment.paid_amount);
  return Math.max(total - paid, 0);
};

export const isAgentBillableShipment = (
  shipment: Pick<AgentShipmentRow, "status">,
) => ["delivered", "closed"].includes(shipment.status);

export const matchesAgentShipmentTab = (
  shipment: Pick<AgentShipmentRow, "status" | "payment_status">,
  tab: AgentShipmentTabKey,
) => {
  switch (tab) {
    case "all_parcels":
      return true;
    case "all_shipments":
      return ["assigned", "supplied", "delivered", "closed"].includes(shipment.status);
    case "incoming":
      return shipment.status === "saved_dropoff";
    case "need_action":
      return shipment.status === "received";
    case "submitted":
      return shipment.status === "requested_pickup";
    case "confirm":
      return shipment.status === "approved";
    case "outgoing":
      return shipment.status === "assigned";
    case "in_transit":
      return shipment.status === "supplied";
    case "arrived":
      return shipment.status === "delivered";
    case "collected":
      return shipment.status === "closed";
    case "unpaid":
      return ["delivered", "closed"].includes(shipment.status) && shipment.payment_status !== "completed";
    case "paid":
      return ["delivered", "closed"].includes(shipment.status) && shipment.payment_status === "completed";
    case "problem":
      return ["returned", "returned_stock", "returned_delivered"].includes(shipment.status);
    case "claim":
      return ["returned", "returned_delivered"].includes(shipment.status);
    default:
      return true;
  }
};

export const getMonthKey = (dateString: string) => {
  const date = new Date(dateString);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}`;
};

export const getCurrentMonthKey = () => getMonthKey(new Date().toISOString());

export const getCurrentAgentId = async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id || null;
};

export const fetchAgentCustomers = async (agentId: string) => {
  const { data, error } = await supabase
    .from("customers")
    .select("id, code, full_name, phone, email, city, wallet_balance, created_at")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as AgentCustomerRow[];
};

export const fetchAgentShipments = async (agentId: string, limit = 500) => {
  const customers = await fetchAgentCustomers(agentId);
  const customerIds = customers.map((customer) => customer.id);

  if (customerIds.length === 0) {
    return {
      customers,
      customerIds,
      shipments: [] as AgentShipmentRow[],
    };
  }

  const { data, error } = await supabase
    .from("shipments")
    .select(
      "id, code, customer_id, status, payment_status, paid_amount, total_cost, shipping_cost, service_type, description, notes, custom_tracking_number, handling_method, weight, cbm, created_at, updated_at, estimated_delivery_date, actual_delivery_date, consolidation_id, customer:customers(code, full_name), receiver:receivers(full_name, phone, address)",
    )
    .in("customer_id", customerIds)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return {
    customers,
    customerIds,
    shipments: (data || []) as AgentShipmentRow[],
  };
};

export const fetchAgentPayments = async (customerIds: string[], limit = 200) => {
  if (customerIds.length === 0) return [] as AgentPaymentRow[];

  const { data, error } = await supabase
    .from("payments")
    .select("id, code, amount, status, payment_provider, created_at, customer_id, shipment_id")
    .in("customer_id", customerIds)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return ((data || []) as AgentPaymentRow[]).map((row) => ({
    ...row,
    amount: Number(row.amount || 0),
  }));
};

export const fetchAgentSupportTickets = async (
  agentId: string,
  customerIds: string[],
  limit = 100,
) => {
  const baseSelect =
    "id, ticket_code, subject, status, priority, category, created_at, updated_at, customer_id, created_by, resolution_notes, customer:customers(code, full_name)";

  const [ownedRes, customerRes] = await Promise.all([
    supabase
      .from("support_tickets")
      .select(baseSelect)
      .eq("created_by", agentId)
      .order("created_at", { ascending: false })
      .limit(limit),
    customerIds.length > 0
      ? supabase
        .from("support_tickets")
        .select(baseSelect)
        .in("customer_id", customerIds)
        .order("created_at", { ascending: false })
        .limit(limit)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (ownedRes.error) throw ownedRes.error;
  if (customerRes.error) throw customerRes.error;

  const merged = new Map<string, AgentSupportTicketRow>();
  [...(ownedRes.data || []), ...((customerRes.data as AgentSupportTicketRow[] | null) || [])].forEach((row) => {
    merged.set(row.id, row as AgentSupportTicketRow);
  });

  return Array.from(merged.values())
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);
};

export const fetchAgentSourcingRequests = async (customerIds: string[], limit = 100) => {
  if (customerIds.length === 0) return [] as AgentSourcingRow[];

  const { data, error } = await supabase
    .from("sourcing_requests")
    .select(
      "id, product_name, quantity, budget, status, created_at, customer_id, customer:customers(code, full_name)",
    )
    .in("customer_id", customerIds)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return ((data || []) as AgentSourcingRow[]).map((row) => ({
    ...row,
    budget: row.budget === null ? null : Number(row.budget || 0),
  }));
};

export const fetchAgentNotifications = async (limit = 8) => {
  const agentId = await getCurrentAgentId();
  if (!agentId) return [] as AgentNotificationRow[];

  const { data, error } = await supabase
    .from("notifications")
    .select("id, title, message, created_at, reference_id")
    .eq("user_id", agentId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  const normalized = await remapNotificationsToWarehouseTracking(
    (data || []) as Array<AgentNotificationRow & { reference_id?: string | null }>,
  );

  return normalized.map(({ reference_id, ...row }) => row);
};

export const fetchAgentWalletBalance = async (agentUserId: string) => {
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, wallet_balance")
    .eq("user_id", agentUserId)
    .maybeSingle();

  if (error) throw error;

  return ((data || { user_id: agentUserId, wallet_balance: 0 }) as AgentWalletProfile).wallet_balance || 0;
};
