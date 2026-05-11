export const REQUESTABLE_DELIVERY_SHIPMENT_STATUSES = ["delivered"] as const;

export const REQUESTABLE_DELIVERY_CONSOLIDATION_STATUSES = ["arrived", "delivered"] as const;

export const ACTIVE_DELIVERY_REQUEST_STATUSES = ["requested", "assigned"] as const;

export const DELIVERY_REQUEST_HISTORY_STATUSES = ["successful", "failed"] as const;

export type DeliveryRequestStatus = (typeof ACTIVE_DELIVERY_REQUEST_STATUSES)[number] | (typeof DELIVERY_REQUEST_HISTORY_STATUSES)[number];

export type DeliveryRequestActorRole = "customer" | "agent";

export const DELIVERY_REQUEST_STATUS_LABELS: Record<DeliveryRequestStatus, string> = {
  requested: "Requested",
  assigned: "Assigned",
  successful: "Successful Delivery",
  failed: "Failed Delivery",
};

export const getDeliveryRequestStatusLabel = (status: string | null | undefined) => {
  const normalized = (status || "").toLowerCase().trim() as DeliveryRequestStatus | "";
  if (!normalized) {
    return "Ready for Request";
  }

  return DELIVERY_REQUEST_STATUS_LABELS[normalized] || status || "Ready for Request";
};

export const normalizeDeliveryRequestStatus = (status: string | null | undefined) =>
  (status || "").toLowerCase().trim();

export type DeliveryRequestConsolidationLink = {
  consolidation_id: string;
  shipment_id: string;
  created_at?: string | null;
};

export const dedupeDeliveryRequestRowsById = <T extends { id: string }>(rows: T[]) =>
  Array.from(new Map(rows.map((row) => [row.id, row])).values());

export const dedupeDeliveryRequestLinks = (links: DeliveryRequestConsolidationLink[]) =>
  Array.from(
    new Map(
      links.map((link) => [`${link.consolidation_id}:${link.shipment_id}`, link]),
    ).values(),
  );

export const getLatestDeliveryRequestLinks = (
  links: DeliveryRequestConsolidationLink[],
) => {
  const latestByShipmentId = new Map<string, DeliveryRequestConsolidationLink>();

  links.forEach((link) => {
    const current = latestByShipmentId.get(link.shipment_id);
    if (!current) {
      latestByShipmentId.set(link.shipment_id, link);
      return;
    }

    const currentTime = new Date(current.created_at || 0).getTime();
    const nextTime = new Date(link.created_at || 0).getTime();

    if (nextTime >= currentTime) {
      latestByShipmentId.set(link.shipment_id, link);
    }
  });

  return Array.from(latestByShipmentId.values());
};

export const getLinkedShipmentIdsForConsolidations = (
  links: DeliveryRequestConsolidationLink[],
  consolidationIds: Iterable<string>,
) => {
  const consolidationIdSet = new Set(consolidationIds);
  return Array.from(
    new Set(
      links
        .filter((link) => consolidationIdSet.has(link.consolidation_id))
        .map((link) => link.shipment_id),
    ),
  );
};

export const canRemoveDeliveryRequest = (status: string | null | undefined) =>
  normalizeDeliveryRequestStatus(status) === "requested";

export const buildDeliveryRequestPayload = (role: DeliveryRequestActorRole, userId: string) => ({
  delivery_request_status: "requested" as const,
  delivery_request_requested_at: new Date().toISOString(),
  delivery_request_requested_by_role: role,
  delivery_request_requested_by_user_id: userId,
  delivery_request_assigned_driver_id: null,
  delivery_request_assigned_at: null,
  delivery_request_completed_at: null,
});

export const buildDeliveryAssignmentPayload = (driverId: string) => ({
  delivery_request_status: "assigned" as const,
  delivery_request_assigned_driver_id: driverId,
  delivery_request_assigned_at: new Date().toISOString(),
  delivery_request_completed_at: null,
});

export const buildDeliveryCompletionPayload = (status: "successful" | "failed") => ({
  delivery_request_status: status,
  delivery_request_completed_at: new Date().toISOString(),
});

export const buildClearDeliveryRequestPayload = () => ({
  delivery_request_status: null,
  delivery_request_requested_at: null,
  delivery_request_requested_by_role: null,
  delivery_request_requested_by_user_id: null,
  delivery_request_assigned_driver_id: null,
  delivery_request_assigned_at: null,
  delivery_request_completed_at: null,
});
