import { supabase } from "@/integrations/supabase/client";
import { fetchAgentCustomers } from "@/lib/agentPortal";
import {
  getAirwayBillNumber,
  getShipmentCbmValue,
  getWarehouseTrackingNumber,
} from "@/lib/shipmentNotes";

export type TrackingItem = {
  id: string;
  code: string;
  tracking_number: string;
  description: string;
  service_type: string;
  quantity: number;
  weight: number;
  cbm: number;
  item_value: number;
  shipping_fee: number;
  status: string;
  airway_bill_number?: string | null;
};

export type TrackingEvent = {
  title: string;
  message: string;
  created_at: string;
};

export type TrackingDetails = {
  kind: "shipment" | "consolidation";
  id: string;
  code: string;
  status: string;
  tracking_number: string;
  airway_bill_number?: string | null;
  created_at: string;
  pickup_date: string | null;
  estimated_delivery_date: string | null;
  actual_delivery_date: string | null;
  origin: string | null;
  destination: string | null;
  weight: number;
  cbm: number;
  shipping_fee: number;
  item_value: number;
  item_count: number;
  status_message: string;
  events: TrackingEvent[];
  items: TrackingItem[];
  carrier_query?: string | null;
  shipsgo_transport?: string | null;
};

export type ShipsGoData = {
  containers?: Array<{
    containerNumber?: string;
    containerSize?: string;
    movements?: Array<{
      location?: string;
      date?: string;
      description?: string;
      isActual?: boolean;
    }>;
  }>;
  mapPoints?: Array<{
    lat?: number;
    lng?: number;
    title?: string;
  }>;
  vesselName?: string;
  shippingLine?: string;
  pol?: string;
  pod?: string;
  departureDate?: string;
  arrivalDate?: string;
  eta?: string;
  raw?: unknown;
  [key: string]: unknown;
};

export type ShipsGoTransport = "air" | "ocean";
export const DEFAULT_SHIPSGO_LIVE_MAP_QUERY = "TEST1234567";
const CONTAINER_CODE_PATTERN = /^[A-Z]{4}\d{7}$/i;
const AIRWAY_BILL_PATTERN = /^\d{3}-?\d{8}$/;

const cleanValue = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

type TrackingBranchRow = {
  city: string | null;
  name: string | null;
} | null;

type TrackingShipmentFallbackRow = {
  id: string;
  code: string;
  status: string;
  payment_status?: string | null;
  custom_tracking_number: string | null;
  awb_number: string | null;
  bl_number: string | null;
  created_at: string;
  updated_at: string;
  pickup_date: string | null;
  estimated_delivery_date: string | null;
  actual_delivery_date: string | null;
  service_type: string;
  description: string | null;
  quantity: number | null;
  weight: number | null;
  cbm: number | null;
  total_cost: number | null;
  shipping_cost: number | null;
  notes: string | null;
  branch: TrackingBranchRow;
  destination_branch: TrackingBranchRow;
};

type TrackingConsolidationShipmentLinkRow = {
  shipment_id: string;
  shipment: TrackingShipmentFallbackRow | null;
};

type TrackingConsolidationFallbackRow = {
  id: string;
  code: string;
  status: string;
  tracking_code: string | null;
  notes: string | null;
  item_count: number | null;
  total_weight: number | null;
  total_cbm: number | null;
  total_cost: number | null;
  created_at: string;
  updated_at: string;
  consolidation_shipments: TrackingConsolidationShipmentLinkRow[] | null;
};

type TrackingNotificationRow = {
  reference_id: string | null;
  title: string | null;
  message: string | null;
  created_at: string;
};

export const DEFAULT_SHIPSGO_EMBED_TOKEN =
  cleanValue(import.meta.env.VITE_SHIPSGO_EMBED_TOKEN) ||
  "6f57787d-cb66-46d0-a6cd-3b930b506078";

const normalizeTransport = (
  value: string | null | undefined,
): ShipsGoTransport | null => {
  const normalized = cleanValue(value)?.toLowerCase();
  if (!normalized) return null;
  if (
    normalized === "air" ||
    normalized === "air freight" ||
    normalized === "air_freight"
  )
    return "air";
  if (
    normalized === "sea" ||
    normalized === "sea freight" ||
    normalized === "sea_freight" ||
    normalized === "ocean" ||
    normalized === "ocean freight" ||
    normalized === "ocean_freight"
  ) {
    return "ocean";
  }
  return null;
};

export const parseShipsGoTransport = (value: string | null | undefined) =>
  normalizeTransport(value);

const getUniqueValues = (values: Array<string | null | undefined>) => {
  const unique = Array.from(
    new Set(values.map(cleanValue).filter(Boolean)),
  ) as string[];
  return unique.length === 1 ? unique[0] : null;
};

export const formatTrackingServiceType = (
  serviceType: string | null | undefined,
) => {
  const normalized = cleanValue(serviceType)?.toLowerCase();
  if (normalized === "air") return "Air Freight";
  if (normalized === "sea") return "Sea Freight";
  if (normalized === "mixed") return "Mixed Freight";
  return normalized
    ? normalized.replace(/\b\w/g, (char) => char.toUpperCase())
    : "-";
};

export const getShipsGoEmbedParams = (
  details: TrackingDetails | null | undefined,
): { transport: ShipsGoTransport; query: string } | null => {
  if (!details) return null;

  const topLevelTracking = cleanValue(details.tracking_number);
  const topLevelAirwayBill = cleanValue(details.airway_bill_number);
  const uniqueAirwayBill = getUniqueValues(
    (details.items || []).map((item) => item.airway_bill_number),
  );
  const uniqueContainerTracking = getUniqueValues(
    [
      topLevelTracking,
      ...(details.items || []).map((item) => item.tracking_number),
    ].filter((value) => CONTAINER_CODE_PATTERN.test((value || "").trim())),
  );

  const transport =
    normalizeTransport(details.shipsgo_transport) ||
    (() => {
      const itemTransports = Array.from(
        new Set(
          (details.items || [])
            .map((item) => normalizeTransport(item.service_type))
            .filter(Boolean),
        ),
      ) as ShipsGoTransport[];
      if (itemTransports.length === 1) return itemTransports[0];
      if (topLevelAirwayBill || uniqueAirwayBill) return "air";
      if (uniqueContainerTracking) return "ocean";
      if (topLevelTracking && AIRWAY_BILL_PATTERN.test(topLevelTracking))
        return "air";
      return null;
    })();

  if (!transport) return null;

  const carrierQuery = (() => {
    if (transport === "air") {
      return (
        topLevelAirwayBill ||
        uniqueAirwayBill ||
        (topLevelTracking && AIRWAY_BILL_PATTERN.test(topLevelTracking)
          ? topLevelTracking
          : null)
      );
    }

    return uniqueContainerTracking || topLevelAirwayBill || uniqueAirwayBill;
  })();

  if (!carrierQuery) return null;

  return {
    transport,
    query: CONTAINER_CODE_PATTERN.test(carrierQuery)
      ? carrierQuery.toUpperCase()
      : carrierQuery,
  };
};

export const guessShipsGoEmbedParamsFromQuery = (
  query: string | null | undefined,
): { transport: ShipsGoTransport; query: string } | null => {
  const normalizedQuery = cleanValue(query);
  if (!normalizedQuery) return null;

  if (/^\d{3}-\d{8}$/.test(normalizedQuery)) {
    return { transport: "air", query: normalizedQuery };
  }

  if (/^[A-Z]{4}\d{7}$/i.test(normalizedQuery)) {
    return { transport: "ocean", query: normalizedQuery.toUpperCase() };
  }

  return null;
};

export const buildTrackingLookupCandidates = (
  query: string | null | undefined,
) => {
  const trimmed = cleanValue(query);
  if (!trimmed) return [] as string[];

  const candidates = [
    trimmed,
    trimmed.replace(/\s*-\s*/g, "-"),
    trimmed.replace(/-{2,}/g, "-"),
    trimmed
      .replace(/[\s_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
    trimmed.replace(/[\s_-]+/g, ""),
    trimmed.replace(/[^a-z0-9]+/gi, ""),
  ]
    .map((value) => value.trim())
    .filter(Boolean);

  return Array.from(new Set(candidates));
};

export const normalizeTrackingLookupText = (value: string | null | undefined) =>
  cleanValue(value)
    ?.toLowerCase()
    .replace(/[^a-z0-9]+/g, "") || null;

export const trackingLookupMatches = (
  candidate: string | null | undefined,
  lookup: string | null | undefined,
) => {
  const rawLookup = cleanValue(lookup);
  if (!rawLookup) return false;

  const rawCandidate = cleanValue(candidate);
  if (rawCandidate && rawCandidate.toLowerCase() === rawLookup.toLowerCase()) {
    return true;
  }

  const normalizedLookup = normalizeTrackingLookupText(rawLookup);
  const normalizedCandidate = normalizeTrackingLookupText(rawCandidate);

  if (normalizedLookup && normalizedCandidate) {
    if (normalizedCandidate === normalizedLookup) {
      return true;
    }

    if (
      normalizedLookup.length >= 6 &&
      normalizedCandidate.includes(normalizedLookup)
    ) {
      return true;
    }

    if (
      normalizedCandidate.length >= 6 &&
      normalizedLookup.includes(normalizedCandidate)
    ) {
      return true;
    }
  }

  return false;
};

const getUniqueValue = (values: Array<string | null | undefined>) => {
  const unique = Array.from(
    new Set(values.map(cleanValue).filter(Boolean)),
  ) as string[];
  return unique.length === 1 ? unique[0] : null;
};

const getFirstValue = (values: Array<string | null | undefined>) => {
  for (const value of values) {
    const cleaned = cleanValue(value);
    if (cleaned) return cleaned;
  }
  return null;
};

const getShipmentTrackingReference = (shipment: TrackingShipmentFallbackRow) =>
  cleanValue(getWarehouseTrackingNumber(shipment.notes)) ||
  cleanValue(shipment.code);

const getShipmentAirwayReference = (shipment: TrackingShipmentFallbackRow) =>
  cleanValue(shipment.awb_number) ||
  cleanValue(shipment.bl_number) ||
  cleanValue(getAirwayBillNumber(shipment.notes));

const getShipmentOrigin = (shipment: TrackingShipmentFallbackRow) =>
  cleanValue(shipment.branch?.city) || cleanValue(shipment.branch?.name);

const getShipmentDestination = (shipment: TrackingShipmentFallbackRow) =>
  cleanValue(shipment.destination_branch?.city) ||
  cleanValue(shipment.destination_branch?.name);

const getConsolidationTrackingReference = (
  consolidation: TrackingConsolidationFallbackRow,
) =>
  cleanValue(getWarehouseTrackingNumber(consolidation.notes)) ||
  cleanValue(consolidation.tracking_code) ||
  cleanValue(consolidation.code);

const getConsolidationWarehouseTrackingReference = (
  consolidation: TrackingConsolidationFallbackRow,
) =>
  cleanValue(getWarehouseTrackingNumber(consolidation.notes)) ||
  cleanValue(consolidation.tracking_code);

const CONSOLIDATION_STAGE_ORDER = [
  "submitted",
  "confirmed",
  "outgoing",
  "in_transit",
  "arrived",
  "collected",
];

const CONSOLIDATION_STAGE_EVENT_COPY: Record<string, { title: string; message: string }> = {
  submitted: {
    title: "Shipment Submitted",
    message: "Your parcels have been consolidated successfully.",
  },
  confirmed: {
    title: "Confirm Shipment",
    message: "Your shipment is awaiting confirmation.",
  },
  outgoing: {
    title: "Shipment Confirmed",
    message: "Your shipment has been confirmed successfully.",
  },
  in_transit: {
    title: "Shipment In Transit",
    message: "Your shipment is now in transit.",
  },
  arrived: {
    title: "Ready for Collection",
    message: "Your shipment has arrived at the destination warehouse and is awaiting collection.",
  },
  collected: {
    title: "Shipment Collected",
    message: "Your shipment has been collected successfully.",
  },
};

const SHIPMENT_TO_CONSOLIDATION_STATUS: Record<string, string> = {
  requested_pickup: "submitted",
  approved: "confirmed",
  assigned: "outgoing",
  supplied: "in_transit",
  delivered: "arrived",
  closed: "collected",
};

const normalizeConsolidationTrackingStatus = (status: string | null | undefined) => {
  const normalized = (status || "").toLowerCase().trim();
  return SHIPMENT_TO_CONSOLIDATION_STATUS[normalized] || normalized;
};

const hasEventTitle = (events: TrackingEvent[], title: string) =>
  events.some((event) => (event.title || "").toLowerCase().trim() === title.toLowerCase());

const buildConsolidationStageEventMessage = (
  baseMessage: string,
  trackingReference: string | null,
) =>
  trackingReference
    ? `Shipment ${trackingReference}: ${baseMessage}`
    : `Consolidated shipment: ${baseMessage}`;

const addConsolidationLifecycleEvents = (
  events: TrackingEvent[],
  consolidation: TrackingConsolidationFallbackRow,
  shipments: TrackingShipmentFallbackRow[],
  trackingReference: string | null,
) => {
  const normalizedStatus = normalizeConsolidationTrackingStatus(consolidation.status);
  const currentStageIndex = CONSOLIDATION_STAGE_ORDER.indexOf(normalizedStatus);
  if (currentStageIndex < 0) return events;

  const nextEvents = [...events];
  CONSOLIDATION_STAGE_ORDER.slice(0, currentStageIndex + 1).forEach((stage, index) => {
    const copy = CONSOLIDATION_STAGE_EVENT_COPY[stage];
    if (!copy || hasEventTitle(nextEvents, copy.title)) return;
    nextEvents.push({
      title: copy.title,
      message: buildConsolidationStageEventMessage(copy.message, trackingReference),
      created_at:
        stage === normalizedStatus
          ? consolidation.updated_at || consolidation.created_at
          : index === 0
            ? consolidation.created_at
            : consolidation.updated_at || consolidation.created_at,
    });
  });

  const paymentStatuses = shipments
    .map((shipment) => (shipment.payment_status || "").toLowerCase().trim())
    .filter(Boolean);
  if (paymentStatuses.length > 0) {
    const allPaid = paymentStatuses.every((status) => status === "completed" || status === "paid");
    const paymentTitle = allPaid ? "Paid" : "Unpaid";
    if (!hasEventTitle(nextEvents, paymentTitle)) {
      nextEvents.push({
        title: paymentTitle,
        message: buildConsolidationStageEventMessage(
          allPaid ? "Payment has been received successfully." : "Payment is pending.",
          trackingReference,
        ),
        created_at: consolidation.updated_at || consolidation.created_at,
      });
    }
  }

  return nextEvents.sort(
    (left, right) =>
      new Date(left.created_at).getTime() - new Date(right.created_at).getTime(),
  );
};

const deduplicateTrackingEvents = (
  events: TrackingEvent[] | undefined,
): TrackingEvent[] => {
  if (!events || !Array.isArray(events)) return [];
  const seen = new Set<string>();
  return events.filter((event) => {
    const key = `${event.title}|${event.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const buildTrackingEvents = (
  notifications: TrackingNotificationRow[],
  isConsolidation: boolean = false,
  trackingNumber?: string | null,
): TrackingEvent[] => {
  let events = notifications
    .slice()
    .sort(
      (left, right) =>
        new Date(left.created_at).getTime() -
        new Date(right.created_at).getTime(),
    )
    .map((row) => ({
      title: cleanValue(row.title) || "Status Update",
      message: cleanValue(row.message) || "Tracking details updated.",
      created_at: row.created_at,
    }));

  events = deduplicateTrackingEvents(events);

  // Always replace codes with the tracking number if provided
  const parcelPattern = /(?:Parcel|Shipment)\s+[A-Z0-9-]+\s+for\s+/i;
  const replacement = trackingNumber ? `Shipment ${trackingNumber} for ` : (isConsolidation ? "Consolidated items for " : null);

  if (replacement) {
    events = events.map(e => {
      if (parcelPattern.test(e.message)) {
        return { ...e, message: e.message.replace(parcelPattern, replacement) };
      }
      return e;
    });
  }

  if (isConsolidation) {
    const grouped: TrackingEvent[] = [];
    const processed = new Set<number>();

    for (let i = 0; i < events.length; i++) {
      if (processed.has(i)) continue;
      const current = events[i];
      const similar = [current];
      processed.add(i);

      for (let j = i + 1; j < events.length; j++) {
        if (processed.has(j)) continue;
        const other = events[j];
        const timeDiff = Math.abs(
          new Date(current.created_at).getTime() -
          new Date(other.created_at).getTime(),
        );
        // Group similar events within a 15-minute window
        if (current.title === other.title && timeDiff < 15 * 60 * 1000) {
          similar.push(other);
          processed.add(j);
        }
      }

      if (similar.length > 1) {
        let msg = current.message;
        // If it's a grouped message but didn't have the parcel pattern, 
        // ensure it sounds like multiple items
        if (!parcelPattern.test(msg)) {
          if (!msg.toLowerCase().includes("items") && !msg.toLowerCase().includes("parcels")) {
            msg = trackingNumber ? `Shipment ${trackingNumber}: ${msg}` : `Multiple items: ${msg}`;
          }
        }
        grouped.push({ ...current, message: msg });
      } else {
        grouped.push(current);
      }
    }
    return grouped;
  }

  return events;
};

const buildTrackingItem = (
  shipment: TrackingShipmentFallbackRow,
): TrackingItem => ({
  id: shipment.id,
  code: shipment.code,
  tracking_number: getShipmentTrackingReference(shipment) || shipment.code,
  airway_bill_number: getShipmentAirwayReference(shipment),
  description: cleanValue(shipment.description) || shipment.code,
  service_type: shipment.service_type,
  quantity: Number(shipment.quantity || 1),
  weight: Number(shipment.weight || 0),
  cbm: Number(
    getShipmentCbmValue({ cbm: shipment.cbm, notes: shipment.notes }) || 0,
  ),
  item_value: Number(shipment.total_cost || 0),
  shipping_fee: Number(shipment.shipping_cost || 0),
  status: shipment.status,
});

const buildCombinedTrackingItem = (
  shipments: TrackingShipmentFallbackRow[],
  options: {
    id: string;
    code: string;
    tracking_number: string;
    airway_bill_number?: string | null;
    description?: string | null;
    status: string;
    service_type?: string | null;
  },
): TrackingItem => {
  const totalQuantity = shipments.reduce(
    (sum, shipment) => sum + Number(shipment.quantity || 1),
    0,
  );
  const totalWeight = shipments.reduce(
    (sum, shipment) => sum + Number(shipment.weight || 0),
    0,
  );
  const totalCbm = shipments.reduce(
    (sum, shipment) =>
      sum +
      Number(getShipmentCbmValue({ cbm: shipment.cbm, notes: shipment.notes }) || 0),
    0,
  );
  const totalItemValue = shipments.reduce(
    (sum, shipment) => sum + Number(shipment.total_cost || 0),
    0,
  );
  const totalShippingFee = shipments.reduce(
    (sum, shipment) => sum + Number(shipment.shipping_cost || 0),
    0,
  );

  const uniqueServiceTypes = Array.from(
    new Set(
      shipments
        .map((shipment) => cleanValue(shipment.service_type))
        .filter(Boolean),
    ),
  ) as string[];

  return {
    id: options.id,
    code: options.code,
    tracking_number: options.tracking_number,
    airway_bill_number: options.airway_bill_number || null,
    description:
      options.description ||
      `Mixed shipment (${shipments.length} items)`,
    service_type:
      options.service_type ||
      (uniqueServiceTypes.length === 1 ? uniqueServiceTypes[0] : "mixed"),
    quantity: totalQuantity,
    weight: totalWeight,
    cbm: totalCbm,
    item_value: totalItemValue,
    shipping_fee: totalShippingFee,
    status: options.status,
  };
};

const buildSingleShipmentTrackingDetails = (
  shipment: TrackingShipmentFallbackRow,
  notifications: TrackingNotificationRow[],
): TrackingDetails => {
  const events = buildTrackingEvents(notifications);

  return {
    kind: "shipment",
    id: shipment.id,
    code: shipment.code,
    status: shipment.status,
    tracking_number: getShipmentTrackingReference(shipment) || shipment.code,
    airway_bill_number: getShipmentAirwayReference(shipment),
    created_at: shipment.created_at,
    pickup_date: shipment.pickup_date,
    estimated_delivery_date: shipment.estimated_delivery_date,
    actual_delivery_date: shipment.actual_delivery_date,
    origin: getShipmentOrigin(shipment),
    destination: getShipmentDestination(shipment),
    weight: Number(shipment.weight || 0),
    cbm: Number(
      getShipmentCbmValue({ cbm: shipment.cbm, notes: shipment.notes }) || 0,
    ),
    shipping_fee: Number(shipment.shipping_cost || 0),
    item_value: Number(shipment.total_cost || 0),
    item_count: Number(shipment.quantity || 1),
    status_message: events.at(-1)?.message || "Tracking details loaded.",
    events,
    items: [buildTrackingItem(shipment)],
    carrier_query:
      getShipmentAirwayReference(shipment) ||
      getShipmentTrackingReference(shipment) ||
      cleanValue(shipment.code),
    shipsgo_transport: normalizeTransport(shipment.service_type),
  };
};

const buildGroupedShipmentTrackingDetails = (
  query: string,
  shipments: TrackingShipmentFallbackRow[],
  notifications: TrackingNotificationRow[],
): TrackingDetails => {
  const sortedByLatest = shipments
    .slice()
    .sort(
      (left, right) =>
        new Date(right.updated_at || right.created_at).getTime() -
        new Date(left.updated_at || left.created_at).getTime() ||
        new Date(right.created_at).getTime() -
        new Date(left.created_at).getTime() ||
        right.code.localeCompare(left.code),
    );
  const sortedForItems = shipments
    .slice()
    .sort(
      (left, right) =>
        new Date(left.created_at).getTime() -
        new Date(right.created_at).getTime() ||
        left.code.localeCompare(right.code),
    );
  const uniqueTrackingReference = getUniqueValue(
    shipments.map(getShipmentTrackingReference),
  );
  const events = buildTrackingEvents(notifications, true, uniqueTrackingReference || query);
  const uniqueAirwayReference = getUniqueValue(
    shipments.map(getShipmentAirwayReference),
  );
  const uniqueOrigin = getUniqueValue(shipments.map(getShipmentOrigin));
  const uniqueDestination = getUniqueValue(
    shipments.map(getShipmentDestination),
  );
  const uniqueTransport = getUniqueValue(
    shipments.map((shipment) => normalizeTransport(shipment.service_type)),
  );
  const latestShipment = sortedByLatest[0] || shipments[0];

  return {
    kind: "consolidation",
    id: latestShipment.id,
    code: query,
    status: latestShipment.status,
    tracking_number: uniqueTrackingReference || query,
    airway_bill_number: uniqueAirwayReference,
    created_at: sortedForItems[0]?.created_at || latestShipment.created_at,
    pickup_date:
      getFirstValue(
        sortedForItems
          .map((shipment) => shipment.pickup_date)
          .sort(
            (left, right) =>
              new Date(left || 0).getTime() - new Date(right || 0).getTime(),
          ),
      ) || null,
    estimated_delivery_date:
      getFirstValue(
        sortedByLatest
          .map((shipment) => shipment.estimated_delivery_date)
          .sort(
            (left, right) =>
              new Date(right || 0).getTime() - new Date(left || 0).getTime(),
          ),
      ) || null,
    actual_delivery_date:
      getFirstValue(
        sortedByLatest
          .map((shipment) => shipment.actual_delivery_date)
          .sort(
            (left, right) =>
              new Date(right || 0).getTime() - new Date(left || 0).getTime(),
          ),
      ) || null,
    origin: uniqueOrigin || getFirstValue(shipments.map(getShipmentOrigin)),
    destination:
      uniqueDestination || getFirstValue(shipments.map(getShipmentDestination)),
    weight: shipments.reduce(
      (sum, shipment) => sum + Number(shipment.weight || 0),
      0,
    ),
    cbm: shipments.reduce(
      (sum, shipment) =>
        sum +
        Number(
          getShipmentCbmValue({ cbm: shipment.cbm, notes: shipment.notes }) ||
          0,
        ),
      0,
    ),
    shipping_fee: shipments.reduce(
      (sum, shipment) => sum + Number(shipment.shipping_cost || 0),
      0,
    ),
    item_value: shipments.reduce(
      (sum, shipment) => sum + Number(shipment.total_cost || 0),
      0,
    ),
    item_count: shipments.length,
    status_message: events.at(-1)?.message || "Tracking details loaded.",
    events,
    items: [
      buildCombinedTrackingItem(sortedForItems, {
        id: `grouped-${query}`,
        code: query,
        tracking_number: uniqueTrackingReference || query,
        airway_bill_number: uniqueAirwayReference,
        description: `Mixed shipment (${sortedForItems.length} items)`,
        status: latestShipment.status,
        service_type: uniqueTransport || "mixed",
      }),
    ],
    carrier_query: uniqueAirwayReference || uniqueTrackingReference || query,
    shipsgo_transport: uniqueTransport,
  };
};

const buildConsolidationTrackingDetails = (
  consolidation: TrackingConsolidationFallbackRow,
  shipments: TrackingShipmentFallbackRow[],
  notifications: TrackingNotificationRow[],
): TrackingDetails => {
  const sortedForItems = shipments
    .slice()
    .sort(
      (left, right) =>
        new Date(left.created_at).getTime() -
        new Date(right.created_at).getTime() ||
        left.code.localeCompare(right.code),
    );
  const trackingReference = getConsolidationWarehouseTrackingReference(consolidation);
  const events = addConsolidationLifecycleEvents(
    buildTrackingEvents(notifications, true, trackingReference),
    consolidation,
    shipments,
    trackingReference,
  );
  const uniqueAirwayReference = getUniqueValue(
    shipments.map(getShipmentAirwayReference),
  );
  const uniqueOrigin = getUniqueValue(shipments.map(getShipmentOrigin));
  const uniqueDestination = getUniqueValue(
    shipments.map(getShipmentDestination),
  );
  const uniqueTransport = getUniqueValue(
    shipments.map((shipment) => normalizeTransport(shipment.service_type)),
  );

  return {
    kind: "consolidation",
    id: consolidation.id,
    code: consolidation.code,
    status: consolidation.status,
    tracking_number: trackingReference || "",
    airway_bill_number: uniqueAirwayReference,
    created_at: consolidation.created_at,
    pickup_date:
      getFirstValue(
        sortedForItems
          .map((shipment) => shipment.pickup_date)
          .sort(
            (left, right) =>
              new Date(left || 0).getTime() - new Date(right || 0).getTime(),
          ),
      ) || null,
    estimated_delivery_date:
      getFirstValue(
        sortedForItems
          .map((shipment) => shipment.estimated_delivery_date)
          .sort(
            (left, right) =>
              new Date(right || 0).getTime() - new Date(left || 0).getTime(),
          ),
      ) || null,
    actual_delivery_date:
      getFirstValue(
        sortedForItems
          .map((shipment) => shipment.actual_delivery_date)
          .sort(
            (left, right) =>
              new Date(right || 0).getTime() - new Date(left || 0).getTime(),
          ),
      ) || null,
    origin: uniqueOrigin || getFirstValue(shipments.map(getShipmentOrigin)),
    destination:
      uniqueDestination || getFirstValue(shipments.map(getShipmentDestination)),
    weight:
      Number(consolidation.total_weight || 0) > 0
        ? Number(consolidation.total_weight || 0)
        : shipments.reduce(
          (sum, shipment) => sum + Number(shipment.weight || 0),
          0,
        ),
    cbm:
      Number(consolidation.total_cbm || 0) > 0
        ? Number(consolidation.total_cbm || 0)
        : shipments.reduce(
          (sum, shipment) =>
            sum +
            Number(
              getShipmentCbmValue({
                cbm: shipment.cbm,
                notes: shipment.notes,
              }) || 0,
            ),
          0,
        ),
    shipping_fee: shipments.reduce(
      (sum, shipment) => sum + Number(shipment.shipping_cost || 0),
      0,
    ),
    item_value:
      Number(consolidation.total_cost || 0) > 0
        ? Number(consolidation.total_cost || 0)
        : shipments.reduce(
          (sum, shipment) => sum + Number(shipment.total_cost || 0),
          0,
        ),
    item_count:
      Number(consolidation.item_count || 0) > 0
        ? Number(consolidation.item_count || 0)
        : sortedForItems.length,
    status_message: events.at(-1)?.message || "Tracking details loaded.",
    events,
    items: [
      buildCombinedTrackingItem(sortedForItems, {
        id: `consolidation-${consolidation.id}`,
        code: consolidation.code || consolidation.id,
        tracking_number: trackingReference || "",
        airway_bill_number: uniqueAirwayReference,
        description:
          cleanValue(consolidation.notes) ||
          `Consolidated shipment (${sortedForItems.length} items)`,
        status: consolidation.status,
        service_type: uniqueTransport || "mixed",
      }),
    ],
    carrier_query:
      uniqueAirwayReference ||
      trackingReference ||
      cleanValue(consolidation.code),
    shipsgo_transport: uniqueTransport,
  };
};

const getAccessibleCustomerIds = async (
  userId: string,
  userRole: string | null | undefined,
) => {
  const normalizedRole = (userRole || "").toLowerCase();

  if (normalizedRole === "agent") {
    const customers = await fetchAgentCustomers(userId);
    return customers.map((customer) => customer.id);
  }

  if (normalizedRole === "customer") {
    const { data, error } = await supabase
      .from("customers")
      .select("id")
      .eq("user_id", userId)
      .limit(1);

    if (error || !data?.length) {
      return [] as string[];
    }

    return data.map((customer) => customer.id);
  }

  return [] as string[];
};

const resolveTrackingLookupRole = async (
  preferredRole: string | null | undefined,
) => {
  const normalizedPreferredRole = (preferredRole || "").toLowerCase().trim();
  if (normalizedPreferredRole) {
    return normalizedPreferredRole;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return null;

  const { data: roles, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  if (!error && roles?.length) {
    const normalizedRoles = roles.map((row) =>
      String(row.role || "").toLowerCase(),
    );
    if (normalizedRoles.includes("agent")) return "agent";
    if (normalizedRoles.includes("customer")) return "customer";
  }

  const { data: customers, error: customerError } = await supabase
    .from("customers")
    .select("id")
    .eq("user_id", user.id)
    .limit(1);

  if (!customerError && customers?.length) {
    return "customer";
  }

  return null;
};

const findAuthenticatedTrackingFallback = async (
  query: string,
  lookupCandidates: string[],
  userRole: string | null | undefined,
): Promise<TrackingDetails | null> => {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) return null;

    const customerIds = await getAccessibleCustomerIds(user.id, userRole);
    if (customerIds.length === 0) return null;

    const { data, error } = await supabase
      .from("shipments")
      .select(
        `
        id,
        code,
        status,
        payment_status,
        custom_tracking_number,
        awb_number,
        bl_number,
        created_at,
        updated_at,
        pickup_date,
        estimated_delivery_date,
        actual_delivery_date,
        service_type,
        description,
        quantity,
        weight,
        cbm,
        total_cost,
        shipping_cost,
        notes,
        branch:branches!shipments_branch_id_fkey(city, name),
        destination_branch:branches!shipments_destination_branch_id_fkey(city, name)
      `,
      )
      .in("customer_id", customerIds)
      .order("updated_at", { ascending: false })
      .range(0, 1999);

    if (error || !data?.length) {
      return null;
    }

    const normalizedQuery = query.toLowerCase();
    const shipments = (data as unknown as TrackingShipmentFallbackRow[]).filter(
      (shipment) => {
        const matchedByStructuredField = lookupCandidates.some((candidate) =>
          [
            shipment.code,
            shipment.custom_tracking_number,
            shipment.awb_number,
            shipment.bl_number,
            getWarehouseTrackingNumber(shipment.notes),
            getAirwayBillNumber(shipment.notes),
          ].some((value) => trackingLookupMatches(value, candidate)),
        );

        if (matchedByStructuredField) {
          return true;
        }

        return (shipment.notes || "").toLowerCase().includes(normalizedQuery);
      },
    );

    if (shipments.length === 0) {
      return null;
    }

    const shipmentIds = shipments.map((shipment) => shipment.id);
    const notificationsResponse =
      shipmentIds.length > 0
        ? await supabase
          .from("notifications")
          .select("reference_id, title, message, created_at")
          .in("reference_id", shipmentIds)
          .order("created_at", { ascending: true })
        : { data: [], error: null };

    const notifications =
      notificationsResponse.error || !notificationsResponse.data
        ? []
        : (notificationsResponse.data as TrackingNotificationRow[]);

    return shipments.length === 1
      ? buildSingleShipmentTrackingDetails(shipments[0], notifications)
      : buildGroupedShipmentTrackingDetails(query, shipments, notifications);
  } catch {
    return null;
  }
};

const findAuthenticatedConsolidationTrackingFallback = async (
  query: string,
  lookupCandidates: string[],
  userRole: string | null | undefined,
): Promise<TrackingDetails | null> => {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) return null;

    const customerIds = await getAccessibleCustomerIds(user.id, userRole);
    if (customerIds.length === 0) return null;

    const { data, error } = await supabase
      .from("consolidations")
      .select(
        `
        id,
        code,
        status,
        tracking_code,
        notes,
        item_count,
        total_weight,
        total_cbm,
        total_cost,
        created_at,
        updated_at,
        consolidation_shipments(
          shipment_id,
          shipment:shipments(
            id,
            code,
            status,
            payment_status,
            custom_tracking_number,
            awb_number,
            bl_number,
            created_at,
            updated_at,
            pickup_date,
            estimated_delivery_date,
            actual_delivery_date,
            service_type,
            description,
            quantity,
            weight,
            cbm,
            total_cost,
            shipping_cost,
            notes,
            branch:branches!shipments_branch_id_fkey(city, name),
            destination_branch:branches!shipments_destination_branch_id_fkey(city, name)
          )
        )
      `,
      )
      .in("customer_id", customerIds)
      .order("updated_at", { ascending: false })
      .range(0, 499);

    if (error || !data?.length) {
      return null;
    }

    const normalizedQuery = query.toLowerCase();
    const consolidations = (
      data as unknown as TrackingConsolidationFallbackRow[]
    ).filter((consolidation) => {
      const childShipments = (consolidation.consolidation_shipments || [])
        .map((entry) => entry.shipment)
        .filter(Boolean) as TrackingShipmentFallbackRow[];

      const topLevelMatch = lookupCandidates.some((candidate) =>
        [
          consolidation.code,
          consolidation.tracking_code,
          getWarehouseTrackingNumber(consolidation.notes),
        ].some((value) => trackingLookupMatches(value, candidate)),
      );

      if (topLevelMatch) {
        return true;
      }

      const childMatch = childShipments.some((shipment) =>
        lookupCandidates.some((candidate) =>
          [
            shipment.code,
            shipment.custom_tracking_number,
            shipment.awb_number,
            shipment.bl_number,
            getWarehouseTrackingNumber(shipment.notes),
            getAirwayBillNumber(shipment.notes),
          ].some((value) => trackingLookupMatches(value, candidate)),
        ),
      );

      if (childMatch) {
        return true;
      }

      return (consolidation.notes || "")
        .toLowerCase()
        .includes(normalizedQuery);
    });

    if (consolidations.length === 0) {
      return null;
    }

    const consolidation = consolidations[0];
    const shipments = (consolidation.consolidation_shipments || [])
      .map((entry) => entry.shipment)
      .filter(Boolean) as TrackingShipmentFallbackRow[];
    const referenceIds = [
      consolidation.id,
      ...shipments.map((shipment) => shipment.id),
    ];

    const notificationsResponse =
      referenceIds.length > 0
        ? await supabase
          .from("notifications")
          .select("reference_id, title, message, created_at")
          .in("reference_id", referenceIds)
          .order("created_at", { ascending: true })
        : { data: [], error: null };

    const notifications =
      notificationsResponse.error || !notificationsResponse.data
        ? []
        : (notificationsResponse.data as TrackingNotificationRow[]);

    return buildConsolidationTrackingDetails(
      consolidation,
      shipments,
      notifications,
    );
  } catch {
    return null;
  }
};

export const lookupTrackingDetails = async (
  query: string | null | undefined,
  options?: { userRole?: string | null },
): Promise<TrackingDetails | null> => {
  const trimmed = cleanValue(query);
  if (!trimmed) return null;

  const lookupCandidates = buildTrackingLookupCandidates(trimmed);
  const normalizedRole = await resolveTrackingLookupRole(options?.userRole);

  if (normalizedRole === "agent" || normalizedRole === "customer") {
    const consolidationFallback = await findAuthenticatedConsolidationTrackingFallback(
      trimmed,
      lookupCandidates,
      normalizedRole,
    );
    if (consolidationFallback) {
      return consolidationFallback;
    }
  }

  for (const candidate of lookupCandidates) {
    const { data, error } = await supabase.rpc(
      "track_shipment_details_by_code" as any,
      {
        p_code: candidate,
      },
    );

    if (error) {
      console.warn("[tracking] rpc error for candidate", candidate, error);
      continue;
    }

    const details = (
      Array.isArray(data) ? data[0] : data
    ) as TrackingDetails | null;
    if (details) {
      if (details.events) {
        details.events = deduplicateTrackingEvents(details.events);
        if (details.kind === "consolidation") {
          // Reuse the logic via a temporary notifications-like structure if needed,
          // but since buildTrackingEvents is tailored for TrackingNotificationRow,
          // we'll just implement a quick inline grouping for RPC results here.
          const events = details.events;
          const grouped: TrackingEvent[] = [];
          const processed = new Set<number>();
          for (let i = 0; i < events.length; i++) {
            if (processed.has(i)) continue;
            const current = events[i];
            const similar = [current];
            processed.add(i);
            for (let j = i + 1; j < events.length; j++) {
              if (processed.has(j)) continue;
              const other = events[j];
              const timeDiff = Math.abs(new Date(current.created_at).getTime() - new Date(other.created_at).getTime());
              if (current.title === other.title && timeDiff < 15 * 60 * 1000) {
                similar.push(other);
                processed.add(j);
              }
            }

            let msg = current.message;
            const parcelPattern = /(?:Parcel|Shipment)\s+[A-Z0-9-]+\s+for\s+/i;
            const replacement = details.tracking_number ? `Shipment ${details.tracking_number} for ` : "Consolidated items for ";

            if (parcelPattern.test(msg)) {
              msg = msg.replace(parcelPattern, replacement);
            }

            if (similar.length > 1) {
              if (!parcelPattern.test(msg)) {
                if (!msg.toLowerCase().includes("items") && !msg.toLowerCase().includes("parcels")) {
                  msg = details.tracking_number ? `Shipment ${details.tracking_number}: ${msg}` : `Multiple items: ${msg}`;
                }
              }
            }
            grouped.push({ ...current, message: msg });
          }
          details.events = grouped;
        }
      }

      if (details.kind === "consolidation" && details.items && details.items.length > 1) {
        const totalQuantity = details.items.reduce((sum, item) => sum + (item.quantity || 1), 0);
        const totalWeight = details.items.reduce((sum, item) => sum + (item.weight || 0), 0);
        const totalCbm = details.items.reduce((sum, item) => sum + (item.cbm || 0), 0);
        const totalShippingFee = details.items.reduce((sum, item) => sum + (item.shipping_fee || 0), 0);
        const totalItemValue = details.items.reduce((sum, item) => sum + (item.item_value || 0), 0);

        details.items = [{
          id: `consolidation-${details.id}`,
          code: details.code || details.id,
          tracking_number: details.tracking_number,
          airway_bill_number: details.airway_bill_number || null,
          description: `Consolidated shipment (${details.item_count} items)`,
          service_type: details.shipsgo_transport || "mixed",
          quantity: totalQuantity,
          weight: totalWeight,
          cbm: totalCbm,
          item_value: totalItemValue,
          shipping_fee: totalShippingFee,
          status: details.status,
        }];
      }

      return details;
    }
  }

  try {
    const { data, error } = await supabase.functions.invoke(
      "public-tracking-lookup",
      {
        body: { query: trimmed, candidates: lookupCandidates },
      },
    );

    if (!error && data?.success && data.data) {
      const details = data.data as TrackingDetails;
      if (details.events) {
        details.events = deduplicateTrackingEvents(details.events);
        if (details.kind === "consolidation") {
          const events = details.events;
          const grouped: TrackingEvent[] = [];
          const processed = new Set<number>();
          for (let i = 0; i < events.length; i++) {
            if (processed.has(i)) continue;
            const current = events[i];
            const similar = [current];
            processed.add(i);
            for (let j = i + 1; j < events.length; j++) {
              if (processed.has(j)) continue;
              const other = events[j];
              const timeDiff = Math.abs(new Date(current.created_at).getTime() - new Date(other.created_at).getTime());
              if (current.title === other.title && timeDiff < 15 * 60 * 1000) {
                similar.push(other);
                processed.add(j);
              }
            }

            let msg = current.message;
            const parcelPattern = /(?:Parcel|Shipment)\s+[A-Z0-9-]+\s+for\s+/i;
            const replacement = details.tracking_number ? `Shipment ${details.tracking_number} for ` : "Consolidated items for ";

            if (parcelPattern.test(msg)) {
              msg = msg.replace(parcelPattern, replacement);
            }

            if (similar.length > 1) {
              if (!parcelPattern.test(msg)) {
                if (!msg.toLowerCase().includes("items") && !msg.toLowerCase().includes("parcels")) {
                  msg = details.tracking_number ? `Shipment ${details.tracking_number}: ${msg}` : `Multiple items: ${msg}`;
                }
              }
            }
            grouped.push({ ...current, message: msg });
          }
          details.events = grouped;
        }
      }

      if (details.kind === "consolidation" && details.items && details.items.length > 1) {
        const totalQuantity = details.items.reduce((sum, item) => sum + (item.quantity || 1), 0);
        const totalWeight = details.items.reduce((sum, item) => sum + (item.weight || 0), 0);
        const totalCbm = details.items.reduce((sum, item) => sum + (item.cbm || 0), 0);
        const totalShippingFee = details.items.reduce((sum, item) => sum + (item.shipping_fee || 0), 0);
        const totalItemValue = details.items.reduce((sum, item) => sum + (item.item_value || 0), 0);

        details.items = [{
          id: `consolidation-${details.id}`,
          code: details.code || details.id,
          tracking_number: details.tracking_number,
          airway_bill_number: details.airway_bill_number || null,
          description: `Consolidated shipment (${details.item_count} items)`,
          service_type: details.shipsgo_transport || "mixed",
          quantity: totalQuantity,
          weight: totalWeight,
          cbm: totalCbm,
          item_value: totalItemValue,
          shipping_fee: totalShippingFee,
          status: details.status,
        }];
      }

      return details;
    }
  } catch (error) {
    console.warn("[tracking] public-tracking-lookup invoke failed", error);
  }

  if (normalizedRole === "agent" || normalizedRole === "customer") {
    const shipmentFallback = await findAuthenticatedTrackingFallback(
      trimmed,
      lookupCandidates,
      normalizedRole,
    );
    if (shipmentFallback) {
      return shipmentFallback;
    }

    return findAuthenticatedConsolidationTrackingFallback(
      trimmed,
      lookupCandidates,
      normalizedRole,
    );
  }

  return null;
};

export const buildShipsGoEmbedUrl = (
  token: string | null | undefined,
  params: { transport: ShipsGoTransport; query: string } | null | undefined,
) => {
  const normalizedToken = cleanValue(token) || DEFAULT_SHIPSGO_EMBED_TOKEN;
  if (!normalizedToken) return null;
  if (!cleanValue(params?.query)) return null;

  const url = new URL("https://embed.shipsgo.com/");
  url.searchParams.set("token", normalizedToken);

  url.searchParams.set("transport", params.transport);
  url.searchParams.set("query", params.query);

  return url.toString();
};

const normalizeLiveMapQuery = (value: string | null | undefined) => {
  const normalized = cleanValue(value);
  if (!normalized) return null;
  return CONTAINER_CODE_PATTERN.test(normalized)
    ? normalized.toUpperCase()
    : null;
};

export const getShipsGoLiveMapContainerCode = (
  details: TrackingDetails | null | undefined,
  fallbackQuery?: string | null,
) => {
  const candidates = Array.from(
    new Set(
      [
        details?.carrier_query,
        ...(details?.items || []).map((item) => item.tracking_number),
        fallbackQuery,
      ]
        .map(normalizeLiveMapQuery)
        .filter(Boolean),
    ),
  ) as string[];

  return candidates[0] || DEFAULT_SHIPSGO_LIVE_MAP_QUERY;
};

export const buildShipsGoLiveMapUrl = (query: string | null | undefined) => {
  const normalized =
    normalizeLiveMapQuery(query) || DEFAULT_SHIPSGO_LIVE_MAP_QUERY;
  return `https://shipsgo.com/iframe/where-is-my-container/${encodeURIComponent(normalized)}`;
};
