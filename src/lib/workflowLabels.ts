// Single source of truth for workflow stage vocabulary.
// DB column values stay; only UI labels are mapped here.

export const WORKFLOW_LABELS: Record<string, string> = {
  // Shipments table statuses
  saved_pickup: "Created",
  saved_dropoff: "Incoming",
  received: "Need Action",
  need_action: "Need Action",
  requested_pickup: "Submitted",
  approved: "Confirm Shipment",
  assigned: "Outgoing Parcel",
  supplied: "In Transit",
  delivered: "Ready for Collection",
  arrived: "Ready for Collection",
  closed: "Collected",
  collected: "Collected",
  // Consolidations table statuses (mirror)
  pending: "Need Action",
  submitted: "Submitted",
  confirmed: "Confirm Shipment",
  outgoing: "Outgoing Parcel",
  in_transit: "In Transit",
};

export const PARCEL_STATUSES = new Set([
  "saved_pickup",
  "saved_dropoff",
  "received",
  "need_action",
  "pending",
]);

export const SHIPMENT_STATUSES = new Set([
  "requested_pickup",
  "submitted",
  "approved",
  "confirmed",
  "assigned",
  "outgoing",
  "supplied",
  "in_transit",
  "delivered",
  "arrived",
  "closed",
  "collected",
]);

export const WORKFLOW_ORDER = [
  "saved_pickup",
  "saved_dropoff",
  "received",
  "requested_pickup",
  "approved",
  "assigned",
  "supplied",
  "delivered",
  "closed",
];

const norm = (s: string | null | undefined) => (s || "").trim().toLowerCase();

export const getStageLabel = (status: string | null | undefined): string => {
  const key = norm(status);
  return WORKFLOW_LABELS[key] || (status || "");
};

export const getStageNoun = (status: string | null | undefined): "parcel" | "shipment" =>
  PARCEL_STATUSES.has(norm(status)) ? "parcel" : "shipment";

export const isParcelStage = (status: string | null | undefined) =>
  PARCEL_STATUSES.has(norm(status));

export const isShipmentStage = (status: string | null | undefined) =>
  SHIPMENT_STATUSES.has(norm(status));

export const PAYMENT_LABELS: Record<string, string> = {
  pending: "Unpaid",
  unpaid: "Unpaid",
  partial: "Unpaid",
  completed: "Paid",
  paid: "Paid",
};

export const getPaymentLabel = (status: string | null | undefined) =>
  PAYMENT_LABELS[norm(status)] || "Unpaid";
