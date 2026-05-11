export const REFUND_REQUEST_STATUSES = ["submitted", "approved", "rejected", "refunded"] as const;
export const WITHDRAWAL_REQUEST_STATUSES = ["requested", "approved", "rejected", "paid"] as const;

export const PAYOUT_METHOD_OPTIONS = [
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "mobile_money", label: "Mobile Money" },
  { value: "lipila", label: "Lipila" },
  { value: "cash", label: "Cash" },
] as const;

export const formatRequestStatus = (status: string | null | undefined) => {
  const normalized = (status || "").trim().toLowerCase();
  if (!normalized) return "Submitted";
  return normalized
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

export const getRefundableShipmentAmount = (shipment: {
  shipping_cost: number | null;
  total_cost: number | null;
}) => {
  const shippingFee = Number(shipment.shipping_cost || 0);
  if (shippingFee > 0) return shippingFee;
  return Number(shipment.total_cost || 0);
};
