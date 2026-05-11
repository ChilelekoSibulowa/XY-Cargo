export const extractNoteValue = (notes: string | null, label: string) => {
  if (!notes) return null;
  const match = notes.match(new RegExp(`${label}:\\s*([^|]+)`));
  return match ? match[1].trim() : null;
};

const COLLECTED_BY_OVERRIDE_LABEL = "Collected by custom";
const COLLECTED_BY_CLEARED_SENTINEL = "__CLEARED__";

const splitNoteParts = (notes: string | null) =>
  (notes || "")
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);

export const upsertNoteValue = (notes: string | null, label: string, value: string | null) => {
  const parts = splitNoteParts(notes);
  const labelPattern = new RegExp(`^${label}:\\s*`, "i");
  const index = parts.findIndex((part) => labelPattern.test(part));
  const trimmedValue = value?.trim() || "";

  if (trimmedValue) {
    const entry = `${label}: ${trimmedValue}`;
    if (index >= 0) {
      parts[index] = entry;
    } else {
      parts.push(entry);
    }
  } else if (index >= 0) {
    parts.splice(index, 1);
  }

  return parts.length ? parts.join(" | ") : null;
};

export const getCollectedByOverride = (notes: string | null) => {
  const value = extractNoteValue(notes, COLLECTED_BY_OVERRIDE_LABEL);
  if (value === null) return null;
  return value === COLLECTED_BY_CLEARED_SENTINEL ? "" : value;
};

export const setCollectedByOverride = (notes: string | null, value: string | null | undefined) => {
  if (value === null || value === undefined) {
    return upsertNoteValue(notes, COLLECTED_BY_OVERRIDE_LABEL, null);
  }

  const trimmedValue = value.trim();
  return upsertNoteValue(
    notes,
    COLLECTED_BY_OVERRIDE_LABEL,
    trimmedValue || COLLECTED_BY_CLEARED_SENTINEL,
  );
};

export const resolveCollectedByValue = (notes: string | null, fallback?: string | null) => {
  const override = getCollectedByOverride(notes);
  if (override !== null) {
    return override;
  }

  const collectedBy = extractNoteValue(notes, "Collected by");
  if (collectedBy) {
    return collectedBy;
  }

  return fallback || null;
};

export const resolveStoredCollectedByValue = (
  storedValue: string | null | undefined,
  notes: string | null,
  fallback?: string | null,
) => {
  if (storedValue !== null && storedValue !== undefined) {
    return storedValue;
  }

  return resolveCollectedByValue(notes, fallback);
};

export const getProductType = (notes: string | null, fallback?: string | null) =>
  extractNoteValue(notes, "Product type") || fallback || "-";

export const getItemLabel = (notes: string | null, fallback?: string | null) =>
  extractNoteValue(notes, "Item") || fallback || "-";

export const getItemPrice = (notes: string | null) => extractNoteValue(notes, "Price");

export const getShipmentCbmValue = (shipment: {
  cbm: number | string | null;
  notes: string | null;
}) => {
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

export const getAirwayBillNumber = (notes: string | null) =>
  extractNoteValue(notes, "AWB/BL No.") ||
  extractNoteValue(notes, "Airway Bill") ||
  extractNoteValue(notes, "Bill of Lading") ||
  null;

export const getWarehouseTrackingNumber = (notes: string | null) =>
  extractNoteValue(notes, "Warehouse Tracking Number") ||
  extractNoteValue(notes, "Warehouse Tracking") ||
  extractNoteValue(notes, "Consolidation Tracking Number") ||
  extractNoteValue(notes, "Consolidation Tracking") ||
  extractNoteValue(notes, "Tracking Number") ||
  extractNoteValue(notes, "Tracking No.") ||
  null;

const WAREHOUSE_ONLY_STATUSES = new Set([
  "assigned",
  "supplied",
  "delivered",
  "closed",
  "paid",
  "unpaid",
  "corrected",
  "arrived",
  "collected"
]);

const CUSTOMER_TRACKING_TABS = new Set(["all", "created", "incoming"]);
const WAREHOUSE_TRACKING_TABS = new Set([
  "all_shipments",
  "outgoing",
  "intransit",
  "in_transit",
  "arrived",
  "collected",
  "corrected",
  "unpaid",
  "paid",
]);

export const resolveTrackingByStatus = (
  status: string | null | undefined,
  notes: string | null | undefined,
  customTrackingNumber: string | null | undefined,
): string | null => {
  const normalizedStatus = (status || "").toLowerCase().trim();
  const warehouseTracking = getWarehouseTrackingNumber(notes || null)?.trim() || null;

  // 1. Outgoing Parcel onwards: Show Warehouse Assigned Tracking
  if (["assigned", "outgoing", "in_transit", "intransit", "supplied", "arrived", "delivered", "closed", "collected", "corrected"].includes(normalizedStatus)) {
    return warehouseTracking || null;
  }

  // 2. Unified Shipment stages: Show NOTHING (as requested)
  if (["need_action", "submitted", "confirm_shipment", "approved"].includes(normalizedStatus)) {
    return null;
  }

  // 3. Pre-consolidation stages: Show Customer Parcel Tracking
  return customTrackingNumber?.trim() || null;
};

export const resolveTrackingByParcelTab = (
  tab: string | null | undefined,
  status: string | null | undefined,
  notes: string | null | undefined,
  customTrackingNumber: string | null | undefined,
): string | null => {
  const normalizedTab = (tab || "").toLowerCase().trim();
  const normalizedStatus = (status || "").toLowerCase().trim();
  const warehouseTracking = getWarehouseTrackingNumber(notes || null)?.trim() || null;

  // Prioritize visibility rules for specific tabs
  if (["created", "incoming"].includes(normalizedTab)) {
    return customTrackingNumber?.trim() || null;
  }

  if (WAREHOUSE_TRACKING_TABS.has(normalizedTab)) {
    return warehouseTracking || null;
  }

  // Default to the status-based resolution
  return resolveTrackingByStatus(status, notes, customTrackingNumber);
};

export const setAirwayBillNumber = (notes: string | null, value: string | null) => {
  const withoutModernLabel = upsertNoteValue(notes, "AWB/BL No.", null);
  const withoutLegacyAirway = upsertNoteValue(withoutModernLabel, "Airway Bill", null);
  const withoutLegacyBol = upsertNoteValue(withoutLegacyAirway, "Bill of Lading", null);
  return upsertNoteValue(withoutLegacyBol, "AWB/BL No.", value);
};

export const getTransitStatusMessage = (notes: string | null) =>
  extractNoteValue(notes, "Transit Status") ||
  extractNoteValue(notes, "Transit Update") ||
  null;

export const setTransitStatusMessage = (notes: string | null, value: string | null) => {
  const withoutStatus = upsertNoteValue(notes, "Transit Status", null);
  const withoutUpdate = upsertNoteValue(withoutStatus, "Transit Update", null);
  return upsertNoteValue(withoutUpdate, "Transit Status", value);
};

export const getInsuranceLabel = (notes: string | null) =>
  notes && /add insurance/i.test(notes) ? "Yes" : "No";

export const getSpecialPackagingLabel = (notes: string | null) => {
  const detail = extractNoteValue(notes, "Special packaging");
  if (detail) return detail;
  if (notes && /special packaging/i.test(notes)) return "Requested";
  return "No";
};

export const getValueAddedServicesSummary = (notes: string | null) => {
  const services: string[] = [];

  if (getInsuranceLabel(notes) === "Yes") {
    services.push("Insurance");
  }

  if (getSpecialPackagingLabel(notes) !== "No") {
    services.push("Special Packaging");
  }

  return services.length ? services.join(", ") : "None";
};
