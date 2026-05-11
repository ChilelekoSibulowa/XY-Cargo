type ParcelWorkflowRow = {
  id: string;
  status: string | null;
  customer_id?: string | null;
  service_type?: string | null;
  notes?: string | null;
};

const preConsolidationStatuses = new Set(["saved_pickup", "saved_dropoff", "received"]);

const normalizeServiceTypeKey = (serviceType: string | null | undefined) => {
  const normalized = (serviceType || "").trim().toLowerCase();
  if (normalized === "air freight" || normalized === "air_freight") return "air";
  if (normalized === "sea freight" || normalized === "sea_freight") return "sea";
  return normalized || "unspecified";
};

const matchesCustomerScope = <T extends ParcelWorkflowRow>(target: T, candidate: T) => {
  if (target.customer_id && candidate.customer_id) {
    return target.customer_id === candidate.customer_id;
  }

  return !target.customer_id && !candidate.customer_id;
};

export const hasConsolidationPeers = <T extends ParcelWorkflowRow>(shipment: T, shipments: T[]) => {
  const serviceTypeKey = normalizeServiceTypeKey(shipment.service_type);

  return shipments.some((candidate) => {
    if (candidate.id === shipment.id) return false;
    if (!matchesCustomerScope(shipment, candidate)) return false;
    if (!preConsolidationStatuses.has((candidate.status || "").trim().toLowerCase())) return false;

    return normalizeServiceTypeKey(candidate.service_type) === serviceTypeKey;
  });
};

const getHandlingMethod = (notes: string | null | undefined) => {
  const match = (notes || "").match(/Handling method:\s*([^|]+)/i);
  return match ? match[1].trim().toLowerCase() : null;
};

export const isSingleHandlingMethod = <T extends ParcelWorkflowRow>(shipment: T) => {
  // Notes ALWAYS reflect the user's chosen handling method at parcel-creation time.
  // The DB column defaults to 'single', so trusting the column alone causes
  // consolidation parcels to be misclassified. The notes value wins when present.
  const noteMethod = getHandlingMethod(shipment.notes);
  const columnMethod = ((shipment as any).handling_method as string | undefined) || null;
  const effective = (noteMethod || columnMethod || "single").toLowerCase();
  // Any explicit non-"single" handling method (consolidated/consolidation) is NOT single.
  return effective === "single";
};

const prefersConsolidation = <T extends ParcelWorkflowRow>(shipment: T) => {
  const method = ((shipment as any).handling_method || getHandlingMethod(shipment.notes) || "").toLowerCase();
  return method === "consolidated" || method === "consolidation";
};

export const shouldAutoSubmitSingleParcel = <T extends ParcelWorkflowRow>(shipment: T, shipments: T[]) =>
  (shipment.status || "").trim().toLowerCase() === "received" &&
  isSingleHandlingMethod(shipment);

export const getPortalShipmentWorkflowStatus = <T extends ParcelWorkflowRow>(shipment: T, shipments: T[]) =>
  shouldAutoSubmitSingleParcel(shipment, shipments) ? "requested_pickup" : shipment.status || "";

export const getWarehouseArrivalTransition = <T extends ParcelWorkflowRow>(shipment: T, shipments: T[]) =>
  isSingleHandlingMethod(shipment) ? ["received", "requested_pickup"] : ["received"];

const PRE_SUBMITTED_STATUSES = new Set([
  "saved_pickup",
  "saved_dropoff",
  "received",
  "need_action",
]);

/**
 * Returns the noun ("parcel" / "shipment") that should be used for UI copy
 * based on the current workflow stage. Created / Incoming / Need Action use
 * "parcel"; Submitted onward uses "shipment".
 */
export const getStageNoun = (status: string | null | undefined): "parcel" | "shipment" => {
  const normalized = (status || "").trim().toLowerCase();
  return PRE_SUBMITTED_STATUSES.has(normalized) ? "parcel" : "shipment";
};

/**
 * Guard for the Submitted stage in the consolidation flow: a consolidated
 * parcel must be part of an active consolidation before it can move into
 * Submitted. Single parcels are always allowed.
 */
export const canEnterSubmitted = <T extends ParcelWorkflowRow>(
  shipment: T,
  options?: { hasActiveConsolidation?: boolean },
) => {
  if (isSingleHandlingMethod(shipment)) return true;
  return Boolean(options?.hasActiveConsolidation);
};

