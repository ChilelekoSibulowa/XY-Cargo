import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

type TrackingItem = {
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

type TrackingEvent = {
  title: string;
  message: string;
  created_at: string;
};

type TrackingDetails = {
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

type TrackingBranchRow = {
  city: string | null;
  name: string | null;
} | null;

type TrackingShipmentFallbackRow = {
  id: string;
  code: string;
  status: string;
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

const cleanValue = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const extractNoteValue = (notes: string | null | undefined, label: string) => {
  if (!notes) return null;
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = notes.match(new RegExp(`${escapedLabel}:\\s*([^|]+)`, "i"));
  return match ? match[1].trim() : null;
};

const getWarehouseTrackingNumber = (notes: string | null | undefined) =>
  extractNoteValue(notes, "Warehouse Tracking Number") ||
  extractNoteValue(notes, "Warehouse Tracking") ||
  extractNoteValue(notes, "Consolidation Tracking Number") ||
  extractNoteValue(notes, "Consolidation Tracking") ||
  extractNoteValue(notes, "Tracking Number") ||
  extractNoteValue(notes, "Tracking No.") ||
  null;

const getAirwayBillNumber = (notes: string | null | undefined) =>
  extractNoteValue(notes, "AWB/BL No.") ||
  extractNoteValue(notes, "Airway Bill") ||
  extractNoteValue(notes, "Bill of Lading") ||
  null;

const getShipmentCbmValue = (shipment: { cbm: number | string | null; notes: string | null }) => {
  if (shipment.cbm !== null && shipment.cbm !== undefined && String(shipment.cbm).trim() !== "") {
    const parsedFromColumn =
      typeof shipment.cbm === "number" ? shipment.cbm : Number(String(shipment.cbm).trim());
    if (Number.isFinite(parsedFromColumn)) {
      return parsedFromColumn;
    }
  }

  const cbmMatch = shipment.notes?.match(
    /(?:^|\|)\s*(?:CBM|Cubic\s+Meters(?:\s*\(CBM\))?)\s*:\s*([^|]+)/i,
  );
  if (!cbmMatch) return null;

  const parsed = Number(cbmMatch[1].trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeTransport = (value: string | null | undefined) => {
  const normalized = cleanValue(value)?.toLowerCase();
  if (!normalized) return null;
  if (normalized === "air" || normalized === "air freight" || normalized === "air_freight") return "air";
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

const buildTrackingLookupCandidates = (query: string | null | undefined) => {
  const trimmed = cleanValue(query);
  if (!trimmed) return [] as string[];

  const candidates = [
    trimmed,
    trimmed.replace(/\s*-\s*/g, "-"),
    trimmed.replace(/-{2,}/g, "-"),
    trimmed.replace(/[\s_-]+/g, " ").replace(/\s+/g, " ").trim(),
    trimmed.replace(/[\s_-]+/g, ""),
    trimmed.replace(/[^a-z0-9]+/gi, ""),
  ]
    .map((value) => value.trim())
    .filter(Boolean);

  return Array.from(new Set(candidates));
};

const normalizeTrackingLookupText = (value: string | null | undefined) =>
  cleanValue(value)?.toLowerCase().replace(/[^a-z0-9]+/g, "") || null;

const trackingLookupMatches = (candidate: string | null | undefined, lookup: string | null | undefined) => {
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

    if (normalizedLookup.length >= 6 && normalizedCandidate.includes(normalizedLookup)) {
      return true;
    }

    if (normalizedCandidate.length >= 6 && normalizedLookup.includes(normalizedCandidate)) {
      return true;
    }
  }

  return false;
};

const getUniqueValue = (values: Array<string | null | undefined>) => {
  const unique = Array.from(new Set(values.map(cleanValue).filter(Boolean))) as string[];
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
  cleanValue(shipment.custom_tracking_number) ||
  cleanValue(shipment.code);

const getShipmentAirwayReference = (shipment: TrackingShipmentFallbackRow) =>
  cleanValue(shipment.awb_number) ||
  cleanValue(shipment.bl_number) ||
  cleanValue(getAirwayBillNumber(shipment.notes));

const getShipmentOrigin = (shipment: TrackingShipmentFallbackRow) =>
  cleanValue(shipment.branch?.city) || cleanValue(shipment.branch?.name);

const getShipmentDestination = (shipment: TrackingShipmentFallbackRow) =>
  cleanValue(shipment.destination_branch?.city) || cleanValue(shipment.destination_branch?.name);

const getConsolidationTrackingReference = (consolidation: TrackingConsolidationFallbackRow) =>
  cleanValue(getWarehouseTrackingNumber(consolidation.notes)) ||
  cleanValue(consolidation.tracking_code) ||
  cleanValue(consolidation.code);

const buildTrackingEvents = (notifications: TrackingNotificationRow[]): TrackingEvent[] => {
  const seen = new Set<string>();

  return notifications
    .slice()
    .sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime())
    .map((row) => ({
      title: cleanValue(row.title) || "Status Update",
      message: cleanValue(row.message) || "Tracking details updated.",
      created_at: row.created_at,
    }))
    .filter((event) => {
      const key = `${event.created_at}|${event.title}|${event.message}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
};

const buildTrackingItem = (shipment: TrackingShipmentFallbackRow): TrackingItem => ({
  id: shipment.id,
  code: shipment.code,
  tracking_number: getShipmentTrackingReference(shipment) || shipment.code,
  airway_bill_number: getShipmentAirwayReference(shipment),
  description: cleanValue(shipment.description) || shipment.code,
  service_type: shipment.service_type,
  quantity: Number(shipment.quantity || 1),
  weight: Number(shipment.weight || 0),
  cbm: Number(getShipmentCbmValue({ cbm: shipment.cbm, notes: shipment.notes }) || 0),
  item_value: Number(shipment.total_cost || 0),
  shipping_fee: Number(shipment.shipping_cost || 0),
  status: shipment.status,
});

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
    cbm: Number(getShipmentCbmValue({ cbm: shipment.cbm, notes: shipment.notes }) || 0),
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
        new Date(right.created_at).getTime() - new Date(left.created_at).getTime() ||
        right.code.localeCompare(left.code),
    );
  const sortedForItems = shipments
    .slice()
    .sort(
      (left, right) =>
        new Date(left.created_at).getTime() - new Date(right.created_at).getTime() ||
        left.code.localeCompare(right.code),
    );
  const events = buildTrackingEvents(notifications);
  const latestShipment = sortedByLatest[0];
  const uniqueTrackingReference = getUniqueValue(shipments.map(getShipmentTrackingReference));
  const uniqueAirwayReference = getUniqueValue(shipments.map(getShipmentAirwayReference));
  const uniqueOrigin = getUniqueValue(shipments.map(getShipmentOrigin));
  const uniqueDestination = getUniqueValue(shipments.map(getShipmentDestination));
  const uniqueTransport = getUniqueValue(
    shipments.map((shipment) => normalizeTransport(shipment.service_type)),
  );

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
          .sort((left, right) => new Date(left || 0).getTime() - new Date(right || 0).getTime()),
      ) || null,
    estimated_delivery_date:
      getFirstValue(
        sortedByLatest
          .map((shipment) => shipment.estimated_delivery_date)
          .sort((left, right) => new Date(right || 0).getTime() - new Date(left || 0).getTime()),
      ) || null,
    actual_delivery_date:
      getFirstValue(
        sortedByLatest
          .map((shipment) => shipment.actual_delivery_date)
          .sort((left, right) => new Date(right || 0).getTime() - new Date(left || 0).getTime()),
      ) || null,
    origin: uniqueOrigin || getFirstValue(shipments.map(getShipmentOrigin)),
    destination: uniqueDestination || getFirstValue(shipments.map(getShipmentDestination)),
    weight: shipments.reduce((sum, shipment) => sum + Number(shipment.weight || 0), 0),
    cbm: shipments.reduce(
      (sum, shipment) => sum + Number(getShipmentCbmValue({ cbm: shipment.cbm, notes: shipment.notes }) || 0),
      0,
    ),
    shipping_fee: shipments.reduce((sum, shipment) => sum + Number(shipment.shipping_cost || 0), 0),
    item_value: shipments.reduce((sum, shipment) => sum + Number(shipment.total_cost || 0), 0),
    item_count: shipments.length,
    status_message: events.at(-1)?.message || "Tracking details loaded.",
    events,
    items: sortedForItems.map(buildTrackingItem),
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
        new Date(left.created_at).getTime() - new Date(right.created_at).getTime() ||
        left.code.localeCompare(right.code),
    );
  const events = buildTrackingEvents(notifications);
  const uniqueAirwayReference = getUniqueValue(shipments.map(getShipmentAirwayReference));
  const uniqueOrigin = getUniqueValue(shipments.map(getShipmentOrigin));
  const uniqueDestination = getUniqueValue(shipments.map(getShipmentDestination));
  const uniqueTransport = getUniqueValue(
    shipments.map((shipment) => normalizeTransport(shipment.service_type)),
  );

  return {
    kind: "consolidation",
    id: consolidation.id,
    code: consolidation.code,
    status: consolidation.status,
    tracking_number: getConsolidationTrackingReference(consolidation) || consolidation.code,
    airway_bill_number: uniqueAirwayReference,
    created_at: consolidation.created_at,
    pickup_date:
      getFirstValue(
        sortedForItems
          .map((shipment) => shipment.pickup_date)
          .sort((left, right) => new Date(left || 0).getTime() - new Date(right || 0).getTime()),
      ) || null,
    estimated_delivery_date:
      getFirstValue(
        sortedForItems
          .map((shipment) => shipment.estimated_delivery_date)
          .sort((left, right) => new Date(right || 0).getTime() - new Date(left || 0).getTime()),
      ) || null,
    actual_delivery_date:
      getFirstValue(
        sortedForItems
          .map((shipment) => shipment.actual_delivery_date)
          .sort((left, right) => new Date(right || 0).getTime() - new Date(left || 0).getTime()),
      ) || null,
    origin: uniqueOrigin || getFirstValue(shipments.map(getShipmentOrigin)),
    destination: uniqueDestination || getFirstValue(shipments.map(getShipmentDestination)),
    weight:
      Number(consolidation.total_weight || 0) > 0
        ? Number(consolidation.total_weight || 0)
        : shipments.reduce((sum, shipment) => sum + Number(shipment.weight || 0), 0),
    cbm:
      Number(consolidation.total_cbm || 0) > 0
        ? Number(consolidation.total_cbm || 0)
        : shipments.reduce(
            (sum, shipment) =>
              sum + Number(getShipmentCbmValue({ cbm: shipment.cbm, notes: shipment.notes }) || 0),
            0,
          ),
    shipping_fee: shipments.reduce((sum, shipment) => sum + Number(shipment.shipping_cost || 0), 0),
    item_value:
      Number(consolidation.total_cost || 0) > 0
        ? Number(consolidation.total_cost || 0)
        : shipments.reduce((sum, shipment) => sum + Number(shipment.total_cost || 0), 0),
    item_count:
      Number(consolidation.item_count || 0) > 0
        ? Number(consolidation.item_count || 0)
        : sortedForItems.length,
    status_message: events.at(-1)?.message || "Tracking details loaded.",
    events,
    items: sortedForItems.map(buildTrackingItem),
    carrier_query:
      uniqueAirwayReference ||
      getConsolidationTrackingReference(consolidation) ||
      cleanValue(consolidation.code),
    shipsgo_transport: uniqueTransport,
  };
};

const shipmentMatchesLookup = (shipment: TrackingShipmentFallbackRow, lookupCandidates: string[], normalizedQuery: string) => {
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
};

const consolidationMatchesLookup = (
  consolidation: TrackingConsolidationFallbackRow,
  lookupCandidates: string[],
  normalizedQuery: string,
) => {
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

  return (consolidation.notes || "").toLowerCase().includes(normalizedQuery);
};

const fetchAllMatchingShipments = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  query: string,
  lookupCandidates: string[],
) => {
  const matches: TrackingShipmentFallbackRow[] = [];
  const seenIds = new Set<string>();
  const pageSize = 500;
  const maxPages = 40;
  const normalizedQuery = query.toLowerCase();

  for (let page = 0; page < maxPages; page += 1) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await supabaseAdmin
      .from("shipments")
      .select(`
        id,
        code,
        status,
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
      `)
      .order("updated_at", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      throw error;
    }

    const rows = (data || []) as TrackingShipmentFallbackRow[];
    for (const shipment of rows) {
      if (seenIds.has(shipment.id)) continue;
      if (!shipmentMatchesLookup(shipment, lookupCandidates, normalizedQuery)) continue;
      seenIds.add(shipment.id);
      matches.push(shipment);
    }

    if (rows.length < pageSize) {
      break;
    }
  }

  return matches;
};

const fetchAllMatchingConsolidations = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  query: string,
  lookupCandidates: string[],
) => {
  const pageSize = 200;
  const maxPages = 20;
  const normalizedQuery = query.toLowerCase();

  for (let page = 0; page < maxPages; page += 1) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await supabaseAdmin
      .from("consolidations")
      .select(`
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
      `)
      .order("updated_at", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      throw error;
    }

    const rows = (data || []) as TrackingConsolidationFallbackRow[];
    const match = rows.find((row) => consolidationMatchesLookup(row, lookupCandidates, normalizedQuery));
    if (match) {
      return match;
    }

    if (rows.length < pageSize) {
      break;
    }
  }

  return null;
};

const fetchNotifications = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  referenceIds: string[],
) => {
  if (referenceIds.length === 0) {
    return [] as TrackingNotificationRow[];
  }

  const { data, error } = await supabaseAdmin
    .from("notifications")
    .select("reference_id, title, message, created_at")
    .in("reference_id", referenceIds)
    .order("created_at", { ascending: true });

  if (error || !data) {
    return [] as TrackingNotificationRow[];
  }

  return data as TrackingNotificationRow[];
};

const lookupViaServiceRole = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  query: string,
  lookupCandidates: string[],
) => {
  for (const candidate of lookupCandidates) {
    const { data, error } = await supabaseAdmin.rpc("track_shipment_details_by_code", {
      p_code: candidate,
    });

    if (error) {
      continue;
    }

    const details = (Array.isArray(data) ? data[0] : data) as TrackingDetails | null;
    if (details) {
      return details;
    }
  }

  const shipments = await fetchAllMatchingShipments(supabaseAdmin, query, lookupCandidates);
  if (shipments.length > 0) {
    const notifications = await fetchNotifications(
      supabaseAdmin,
      shipments.map((shipment) => shipment.id),
    );
    return shipments.length === 1
      ? buildSingleShipmentTrackingDetails(shipments[0], notifications)
      : buildGroupedShipmentTrackingDetails(query, shipments, notifications);
  }

  const consolidation = await fetchAllMatchingConsolidations(supabaseAdmin, query, lookupCandidates);
  if (consolidation) {
    const shipmentsForConsolidation = (consolidation.consolidation_shipments || [])
      .map((entry) => entry.shipment)
      .filter(Boolean) as TrackingShipmentFallbackRow[];
    const notifications = await fetchNotifications(supabaseAdmin, [
      consolidation.id,
      ...shipmentsForConsolidation.map((shipment) => shipment.id),
    ]);
    return buildConsolidationTrackingDetails(consolidation, shipmentsForConsolidation, notifications);
  }

  return null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ success: false, error: "Supabase service role not configured." }), {
        status: 500,
        headers: jsonHeaders,
      });
    }

    const body = await req.json().catch(() => ({}));
    const query = cleanValue(body?.query);
    const candidatesFromBody = Array.isArray(body?.candidates)
      ? body.candidates.filter((candidate: unknown): candidate is string => typeof candidate === "string")
      : [];

    if (!query) {
      return new Response(JSON.stringify({ success: false, error: "query is required" }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const lookupCandidates = Array.from(new Set([...buildTrackingLookupCandidates(query), ...candidatesFromBody]));
    const details = await lookupViaServiceRole(supabaseAdmin, query, lookupCandidates);

    return new Response(JSON.stringify({ success: true, data: details }), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (error) {
    console.error("public-tracking-lookup error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: jsonHeaders },
    );
  }
});
