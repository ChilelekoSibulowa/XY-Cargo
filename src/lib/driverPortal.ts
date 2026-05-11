import { supabase } from "@/integrations/supabase/client";
import {
  getAirwayBillNumber,
  getProductType,
  getWarehouseTrackingNumber,
  resolveTrackingByStatus,
} from "@/lib/shipmentNotes";
import { remapNotificationsToWarehouseTracking } from "@/lib/notifications";

export type DriverProfile = {
  id: string;
  code: string;
  full_name: string;
  phone: string;
  email: string | null;
  vehicle_type: string | null;
  vehicle_plate: string | null;
  wallet_balance: number | null;
  is_active: boolean | null;
};

export type DriverReceiver = {
  id: string;
  full_name: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
};

export type DriverDelivery = {
  id: string;
  row_type?: "shipment" | "consolidation";
  consolidation_id?: string | null;
  child_shipment_ids?: string[];
  code: string;
  customer_id: string;
  receiver_id: string;
  status: string;
  service_type: string;
  notes: string | null;
  custom_tracking_number: string | null;
  description?: string | null;
  total_cost?: number | null;
  shipping_cost?: number | null;
  created_at: string;
  updated_at: string;
  pickup_date: string | null;
  estimated_delivery_date: string | null;
  actual_delivery_date: string | null;
  delivery_request_requested_at: string | null;
  delivery_request_assigned_at: string | null;
  delivery_request_completed_at: string | null;
  weight: number | null;
  cbm: number | null;
  customer: {
    id: string;
    code: string | null;
    full_name: string | null;
    phone: string | null;
    address: string | null;
  } | null;
  receiver: DriverReceiver | null;
  receivers?: DriverReceiver[];
};

export type DriverIncident = {
  id: string;
  ticket_code: string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  description: string;
  resolution_notes: string | null;
  created_at: string;
  shipment_id: string | null;
  shipment?: {
    id: string;
    code: string;
    custom_tracking_number: string | null;
    notes: string | null;
    status: string;
  } | null;
};

export const DRIVER_STATUS_LABELS: Record<string, string> = {
  requested: "Requested",
  assigned: "Assigned",
  successful: "Successful Delivery",
  failed: "Failed Delivery",
};

export const DRIVER_DELIVERY_TABS = [
  { key: "assigned", label: "Assigned Deliveries" },
  { key: "all", label: "All Deliveries" },
  { key: "successful", label: "Successful Deliveries" },
  { key: "failed", label: "Failed Deliveries" },
] as const;

export type DriverDeliveryTabKey = (typeof DRIVER_DELIVERY_TABS)[number]["key"];

const isMissingDriverOptionalColumnsError = (message: string | null | undefined) =>
  /mfa_enabled|weekly_fuel_consumption/i.test(message || "");

export const getCurrentDriverContext = async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return { user: null, driver: null };
  }

  let driverData: any = null;
  let driverError: { message?: string } | null = null;

  const driverQuery = await supabase
    .from("drivers")
    .select(
      "id, code, full_name, phone, email, vehicle_type, vehicle_plate, wallet_balance, is_active",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  driverData = driverQuery.data;
  driverError = driverQuery.error;

  if (driverError && isMissingDriverOptionalColumnsError(driverError.message)) {
    const fallbackQuery = await supabase
      .from("drivers")
      .select(
        "id, code, full_name, phone, email, vehicle_type, vehicle_plate, wallet_balance, is_active",
      )
      .eq("user_id", user.id)
      .maybeSingle();

    driverData = fallbackQuery.data;
    driverError = fallbackQuery.error;
  }

  if (driverError) {
    throw driverError;
  }

  // Auto-create driver record if it doesn't exist
  if (!driverData) {
    const profileQuery = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileQuery.data) {
      const { data: newDriver } = await supabase
        .from("drivers")
        .insert({
          user_id: user.id,
          code: `DRV-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
          full_name: profileQuery.data.full_name || user.email,
          email: user.email,
          phone: profileQuery.data.phone || "Pending",
          is_active: true
        })
        .select("id, code, full_name, phone, email, vehicle_type, vehicle_plate, wallet_balance, is_active")
        .maybeSingle();

      if (newDriver) {
        driverData = newDriver;
      }
    }
  }

  return {
    user,
    driver: (driverData || null) as DriverProfile | null,
  };
};

const normalizeTrackingNumber = (value: string | null | undefined) => {
  const trimmed = (value || "").trim();
  return trimmed || null;
};

const resolveDisplayTrackingNumber = (
  status: string | null | undefined,
  notes: string | null | undefined,
  primaryTrackingNumber: string | null | undefined,
  fallbackTrackingNumber?: string | null | undefined,
) =>
  normalizeTrackingNumber(resolveTrackingByStatus(status || '', notes || null, primaryTrackingNumber || null)) ||
  normalizeTrackingNumber(fallbackTrackingNumber);

const joinUniqueValues = (values: Array<string | null | undefined>, separator = " | ") => {
  const unique = Array.from(
    new Set(
      values
        .map((value) => (value || "").trim())
        .filter(Boolean),
    ),
  );
  return unique.length > 0 ? unique.join(separator) : null;
};

const getDriverReceiverAddress = (receiver: DriverReceiver | null | undefined) =>
  joinUniqueValues([receiver?.address, receiver?.city, receiver?.country], ", ");

const collectDriverReceivers = (
  rows: Array<Pick<DriverDelivery, "receiver_id" | "receiver">>,
): DriverReceiver[] => {
  const receivers = new Map<string, DriverReceiver>();

  rows.forEach((row) => {
    const receiver = row.receiver;
    if (!receiver && !row.receiver_id) return;

    const receiverRecord: DriverReceiver = {
      id: receiver?.id || row.receiver_id,
      full_name: receiver?.full_name || null,
      phone: receiver?.phone || null,
      address: receiver?.address || null,
      city: receiver?.city || null,
      country: receiver?.country || null,
    };
    const key = [
        receiverRecord.full_name,
        receiverRecord.phone,
        receiverRecord.address,
        receiverRecord.city,
        receiverRecord.country,
      ]
        .map((value) => (value || "").trim().toLowerCase())
        .join("|");

    if (!receivers.has(key)) {
      receivers.set(key, receiverRecord);
    }
  });

  return Array.from(receivers.values());
};

const collapseDriverReceivers = (receivers: DriverReceiver[]) => {
  if (receivers.length === 0) return null;
  if (receivers.length === 1) return receivers[0];

  return {
    id: joinUniqueValues(receivers.map((receiver) => receiver.id)) || receivers[0].id,
    full_name: joinUniqueValues(receivers.map((receiver) => receiver.full_name)),
    phone: joinUniqueValues(receivers.map((receiver) => receiver.phone)),
    address: joinUniqueValues(receivers.map((receiver) => getDriverReceiverAddress(receiver))),
    city: null,
    country: null,
  };
};

export const fetchDriverDeliveries = async (driverId: string, limit = 300) => {
  const baseShipmentSelect =
    "id, code, customer_id, receiver_id, service_type, notes, description, total_cost, shipping_cost, custom_tracking_number, status, created_at, updated_at, pickup_date, estimated_delivery_date, actual_delivery_date, delivery_request_status, delivery_request_requested_at, delivery_request_assigned_at, delivery_request_completed_at, delivery_request_assigned_driver_id, weight, cbm, customer:customers(id, code, full_name, phone, address), receiver:receivers(id, full_name, phone, address, city, country)";
  const baseConsolidationSelect =
    "id, code, customer_id, status, delivery_request_status, delivery_request_assigned_driver_id, notes, total_cost, total_weight, total_cbm, tracking_code, delivery_request_assigned_at, delivery_request_requested_at, delivery_request_completed_at, created_at, updated_at";

  const [shipmentsRes, consolidationsRes] = await Promise.all([
    supabase
      .from("shipments")
      .select(baseShipmentSelect)
      .eq("delivery_request_assigned_driver_id", driverId)
      .not("delivery_request_status", "is", null)
      .order("updated_at", { ascending: false })
      .limit(limit),
    supabase
      .from("consolidations")
      .select(baseConsolidationSelect)
      .eq("delivery_request_assigned_driver_id", driverId)
      .not("delivery_request_status", "is", null)
      .order("updated_at", { ascending: false })
      .limit(limit),
  ]);

  if (shipmentsRes.error) throw shipmentsRes.error;
  if (consolidationsRes.error) throw consolidationsRes.error;

  const rawShipments = (shipmentsRes.data || []) as any[];
  const rawConsolidations = (consolidationsRes.data || []) as any[];

  if (rawShipments.length === 0 && rawConsolidations.length === 0) {
    return [];
  }

  if (rawShipments.length === 0 && rawConsolidations.length === 0) {
    return [];
  }

  const shipmentIds = rawShipments.map((s) => s.id);
  const consolidationIds = rawConsolidations.map((c) => c.id);

  // 1. Initial link fetch to identify all involved consolidations
  let initialLinksQuery = supabase
    .from("consolidation_shipments")
    .select("consolidation_id");

  if (shipmentIds.length > 0 && consolidationIds.length > 0) {
    initialLinksQuery = initialLinksQuery.or(`shipment_id.in.(${shipmentIds.join(",")}),consolidation_id.in.(${consolidationIds.join(",")})`);
  } else if (shipmentIds.length > 0) {
    initialLinksQuery = initialLinksQuery.in("shipment_id", shipmentIds);
  } else if (consolidationIds.length > 0) {
    initialLinksQuery = initialLinksQuery.in("consolidation_id", consolidationIds);
  }

  const { data: initialLinks } = await initialLinksQuery;
  const involvedConsolidationIds = Array.from(new Set([
    ...consolidationIds,
    ...(initialLinks || []).map(l => l.consolidation_id)
  ]));

  // 2. Fetch ALL links and sibling shipments for these consolidations
  let linkRows: Array<{ shipment_id: string; consolidation_id: string; created_at: string }> = [];
  if (involvedConsolidationIds.length > 0) {
    const { data: allLinks } = await supabase
      .from("consolidation_shipments")
      .select("shipment_id, consolidation_id, created_at")
      .in("consolidation_id", involvedConsolidationIds);
    linkRows = (allLinks || []) as any[];
  }

  // 3. Fetch all missing data (extra consolidations and extra shipments)
  const allConsolidationIds = Array.from(new Set(involvedConsolidationIds));
  const allChildShipmentIds = Array.from(new Set(linkRows.map(l => l.shipment_id)));

  const missingConsolidationIds = allConsolidationIds.filter(id => !consolidationIds.includes(id));
  const missingShipmentIds = allChildShipmentIds.filter(id => !shipmentIds.includes(id));

  let extraConsolidations: any[] = [];
  if (missingConsolidationIds.length > 0) {
    const { data } = await supabase
      .from("consolidations")
      .select(baseConsolidationSelect)
      .in("id", missingConsolidationIds);
    extraConsolidations = data || [];
  }

  let extraShipments: any[] = [];
  if (missingShipmentIds.length > 0) {
    const { data } = await supabase
      .from("shipments")
      .select(baseShipmentSelect)
      .in("id", missingShipmentIds);
    extraShipments = data || [];
  }

  const allConsolidations = [...rawConsolidations, ...extraConsolidations];
  const allShipments = [...rawShipments, ...extraShipments];
  
  const shipmentById = new Map(allShipments.map(s => [s.id, s]));
  const consolidationById = new Map(allConsolidations.map(c => [c.id, c]));

  // Grouping logic
  const shipmentIdsByConsolidation = new Map<string, string[]>();
  linkRows.forEach(link => {
    if (!shipmentById.has(link.shipment_id)) return;
    const current = shipmentIdsByConsolidation.get(link.consolidation_id) || [];
    current.push(link.shipment_id);
    shipmentIdsByConsolidation.set(link.consolidation_id, current);
  });

  const consumedShipmentIds = new Set<string>();
  const results: DriverDelivery[] = [];

  // 1. Process Explicit Consolidations
  shipmentIdsByConsolidation.forEach((childIds, consolidationId) => {
    const consolidation = consolidationById.get(consolidationId);
    if (!consolidation) return;

    const childShipments = childIds.map(id => shipmentById.get(id)).filter(Boolean);
    if (childShipments.length === 0) return;

    childShipments.forEach(s => consumedShipmentIds.add(s!.id));

    const first = childShipments[0]!;
    const combinedWeight = childShipments.reduce((sum, s) => sum + Number(s!.weight || 0), 0);
    const combinedCbm = childShipments.reduce((sum, s) => sum + Number(s!.cbm || 0), 0);
    const combinedCost = childShipments.reduce((sum, s) => sum + Number(s!.total_cost || 0), 0);
    const combinedShipping = childShipments.reduce((sum, s) => sum + Number(s!.shipping_cost || 0), 0);
    
    const serviceTypes = new Set(childShipments.map(s => (s!.service_type || "").toLowerCase().trim()).map(t => (t === "air" || t === "air freight" || t === "air_freight") ? "air" : (t === "sea" || t === "sea freight" || t === "sea_freight") ? "sea" : t).filter(Boolean));
    const receivers = collectDriverReceivers(childShipments.map(s => ({ receiver_id: s!.receiver_id, receiver: s!.receiver })));

    results.push({
      id: `consolidation-${consolidationId}`,
      row_type: "consolidation",
      consolidation_id: consolidationId,
      child_shipment_ids: childIds,
      code: consolidation.code || `CON-${consolidationId.slice(0, 8).toUpperCase()}`,
      customer_id: first.customer_id,
      receiver_id: first.receiver_id,
      status: consolidation.delivery_request_status || first.delivery_request_status || "requested",
      service_type: serviceTypes.size > 1 ? "mixed" : first.service_type,
      notes: consolidation.notes || first.notes,
      description: consolidation.notes || first.description || null,
      custom_tracking_number: resolveDisplayTrackingNumber(
        consolidation.delivery_request_status || first.delivery_request_status || first.status,
        consolidation.notes,
        consolidation.tracking_code,
        first.custom_tracking_number
      ),
      total_cost: Number(consolidation.total_cost ?? combinedCost),
      shipping_cost: combinedShipping,
      weight: Number(consolidation.total_weight ?? combinedWeight),
      cbm: Number(consolidation.total_cbm ?? combinedCbm),
      created_at: consolidation.created_at || first.created_at,
      updated_at: consolidation.updated_at || first.updated_at,
      pickup_date: first.pickup_date,
      estimated_delivery_date: first.estimated_delivery_date,
      actual_delivery_date: first.actual_delivery_date,
      delivery_request_requested_at: consolidation.delivery_request_requested_at || first.delivery_request_requested_at,
      delivery_request_assigned_at: consolidation.delivery_request_assigned_at || first.delivery_request_assigned_at,
      delivery_request_completed_at: consolidation.delivery_request_completed_at || first.delivery_request_completed_at,
      customer: first.customer,
      receiver: collapseDriverReceivers(receivers) as any,
      receivers,
    });
  });

  // 2. Auto-Group Remaining Shipments by Tracking Number
  const remainingShipments = allShipments.filter(s => !consumedShipmentIds.has(s.id) && s.delivery_request_assigned_driver_id === driverId);
  const shipmentsByTracking = new Map<string, any[]>();
  
  remainingShipments.forEach(s => {
    const displayTracking = resolveDisplayTrackingNumber(
      s.status,
      s.notes,
      s.custom_tracking_number
    );
    
    const trackingKey = displayTracking 
      ? [s.customer_id, displayTracking.trim().toLowerCase()].join(":") 
      : `single-${s.id}`;
      
    const current = shipmentsByTracking.get(trackingKey) || [];
    current.push({ ...s, _resolvedTracking: displayTracking });
    shipmentsByTracking.set(trackingKey, current);
  });

  shipmentsByTracking.forEach((group, trackingKey) => {
    if (group.length > 1) {
      const first = group[0];
      const combinedWeight = group.reduce((sum, s) => sum + Number(s.weight || 0), 0);
      const combinedCbm = group.reduce((sum, s) => sum + Number(s.cbm || 0), 0);
      const combinedCost = group.reduce((sum, s) => sum + Number(s.total_cost || 0), 0);
      const combinedShipping = group.reduce((sum, s) => sum + Number(s.shipping_cost || 0), 0);
      const serviceTypes = new Set(group.map(s => (s.service_type || "").toLowerCase().trim()).map(t => (t === "air" || t === "air freight" || t === "air_freight") ? "air" : (t === "sea" || t === "sea freight" || t === "sea_freight") ? "sea" : t).filter(Boolean));
      const receivers = collectDriverReceivers(group.map(s => ({ receiver_id: s.receiver_id, receiver: s.receiver })));

      results.push({
        id: `tracking-group-${first.id}`,
        row_type: "consolidation",
        consolidation_id: null,
        child_shipment_ids: group.map(s => s.id),
        code: `GRP-${first.id.slice(0, 8).toUpperCase()}`,
        customer_id: first.customer_id,
        receiver_id: first.receiver_id,
        status: first.delivery_request_status || "requested",
        service_type: serviceTypes.size > 1 ? "mixed" : (serviceTypes.has("sea") ? "sea" : "air"),
        notes: first.notes,
        description: first.description,
        custom_tracking_number: first._resolvedTracking,
        total_cost: combinedCost,
        shipping_cost: combinedShipping,
        weight: combinedWeight,
        cbm: combinedCbm,
        created_at: first.created_at,
        updated_at: first.updated_at,
        pickup_date: first.pickup_date,
        estimated_delivery_date: first.estimated_delivery_date,
        actual_delivery_date: first.actual_delivery_date,
        delivery_request_requested_at: first.delivery_request_requested_at,
        delivery_request_assigned_at: first.delivery_request_assigned_at,
        delivery_request_completed_at: first.delivery_request_completed_at,
        customer: first.customer,
        receiver: collapseDriverReceivers(receivers) as any,
        receivers,
      });
    } else {
      const shipment = group[0];
      results.push({
        ...shipment,
        row_type: "shipment",
        consolidation_id: null,
        child_shipment_ids: [shipment.id],
        status: shipment.delivery_request_status || "requested",
        custom_tracking_number: shipment._resolvedTracking,
        weight: shipment.weight === null ? null : Number(shipment.weight || 0),
        cbm: shipment.cbm === null ? null : Number(shipment.cbm || 0),
        total_cost: shipment.total_cost === null ? null : Number(shipment.total_cost || 0),
        shipping_cost: shipment.shipping_cost === null ? null : Number(shipment.shipping_cost || 0),
        receivers: shipment.receiver ? [shipment.receiver] : [],
      });
    }
  });

  return results.sort(
    (left, right) =>
      new Date(right.updated_at || right.created_at).getTime() -
      new Date(left.updated_at || left.created_at).getTime(),
  );
};

export const fetchDriverNotifications = async (userId: string, limit = 8) => {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, title, message, created_at, reference_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  const notifications = ((data || []) as Array<{
    id: string;
    title: string;
    message: string;
    created_at: string;
    reference_id: string | null;
  }>) || [];

  const normalized = await remapNotificationsToWarehouseTracking(notifications);

  return normalized.map(({ reference_id, ...row }) => row);
};

export const fetchDriverIncidents = async (userId: string, limit = 100) => {
  const { data, error } = await supabase
    .from("support_tickets")
    .select(
      "id, ticket_code, subject, category, status, priority, description, resolution_notes, created_at, shipment_id, shipment:shipments(id, code, custom_tracking_number, notes, status)",
    )
    .eq("created_by", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  
  return (data || []).map((ticket: any) => ({
    ...ticket,
    shipment: ticket.shipment ? {
      ...ticket.shipment,
      custom_tracking_number: getWarehouseTrackingNumber(ticket.shipment.notes) || null,
    } : null,
  })) as DriverIncident[];
};

export const formatDriverStatus = (status: string) =>
  DRIVER_STATUS_LABELS[status] || status.replace(/_/g, " ");

export const formatServiceType = (serviceType: string | null | undefined) => {
  const normalized = (serviceType || "").toLowerCase().trim();
  if (normalized === "air") return "Air Freight";
  if (normalized === "sea") return "Sea Freight";
  if (normalized === "mixed" || normalized === "consolidated") return "Mixed Service";
  return "Air Freight"; // Default fallback to ensure it's never blank
};

export const formatDriverServiceType = (value: string | null | undefined) => {
  const normalized = (value || "").toLowerCase().trim();
  if (normalized === "air" || normalized === "air freight" || normalized === "air_freight") {
    return "Air Freight";
  }
  if (normalized === "sea" || normalized === "sea freight" || normalized === "sea_freight") {
    return "Sea Freight";
  }
  if (normalized === "mixed" || normalized === "consolidated") {
    return "Mixed Service";
  }
  return "Air Freight"; // Default fallback
};

export const getDriverProductType = (delivery: Pick<DriverDelivery, "notes">) =>
  getProductType(delivery.notes);

export const getDriverAwbNumber = (delivery: Pick<DriverDelivery, "notes">) =>
  getAirwayBillNumber(delivery.notes) || "-";

export const getDriverReceiverLocation = (
  delivery: Pick<DriverDelivery, "receiver">,
) => {
  return getDriverReceiverAddress(delivery.receiver) || "-";
};

export const getDriverReceivers = (
  delivery: Pick<DriverDelivery, "receiver" | "receivers">,
) => {
  if (delivery.receivers && delivery.receivers.length > 0) {
    return delivery.receivers;
  }
  return delivery.receiver ? [delivery.receiver] : [];
};

export const isAssignedDelivery = (status: string) => status === "assigned";

export const isSuccessfulDelivery = (status: string) => status === "successful";

export const isFailedDelivery = (status: string) => status === "failed";

export const isToday = (dateString: string | null | undefined) => {
  if (!dateString) return false;
  const input = new Date(dateString);
  const today = new Date();
  return (
    input.getFullYear() === today.getFullYear() &&
    input.getMonth() === today.getMonth() &&
    input.getDate() === today.getDate()
  );
};

export const isCurrentMonth = (dateString: string | null | undefined) => {
  if (!dateString) return false;
  const input = new Date(dateString);
  const today = new Date();
  return (
    input.getFullYear() === today.getFullYear() &&
    input.getMonth() === today.getMonth()
  );
};
