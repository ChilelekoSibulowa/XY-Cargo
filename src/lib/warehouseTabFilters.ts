export const normalizeConsolidationStatus = (status: string) => {
  const normalized = (status || "").toLowerCase().trim();
  if (["pending", "requested", "submitted"].includes(normalized)) return "submitted";
  if (["processed", "completed", "confirmed"].includes(normalized)) return "confirmed";
  if (["assigned", "outgoing"].includes(normalized)) return "outgoing";
  if (["in_transit", "intransit", "supplied"].includes(normalized)) return "in_transit";
  if (["arrived", "delivered"].includes(normalized)) return "arrived";
  if (["collected", "closed"].includes(normalized)) return "collected";
  return normalized || "submitted";
};

export const normalizeShipmentStatus = (status: string) => {
  const normalized = (status || "").toLowerCase().trim();
  const aliasMap: Record<string, string> = {
    created: "saved_pickup",
    incoming: "saved_dropoff",
    need_action: "received",
    submitted: "requested_pickup",
    confirm_shipment: "approved",
    outgoing: "assigned",
    in_transit: "supplied",
    arrived: "delivered",
    collected: "closed",
  };

  return aliasMap[normalized] || normalized;
};

export const mapConsolidationStatusToShipmentStatus: Record<string, string> = {
  submitted: "requested_pickup",
  confirmed: "approved",
  outgoing: "assigned",
  in_transit: "supplied",
  arrived: "delivered",
  collected: "closed",
};

export const isShipmentStageStatus = (status: string) => {
  const normalized = normalizeShipmentStatus(status);
  return ["saved_pickup", "saved_dropoff", "received", "requested_pickup", "approved", "assigned", "supplied", "delivered", "closed", "returned", "returned_stock", "returned_delivered"].includes(normalized);
};

export const isWarehouseAllShipmentsRow = (args: {
  rowType: "shipment" | "consolidation";
  status: string;
  isConsolidatedChild?: boolean;
}) => {
  if (!isShipmentStageStatus(args.status)) return false;
  if (args.rowType === "consolidation") return true;
  return !args.isConsolidatedChild;
};
