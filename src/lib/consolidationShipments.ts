import { supabase } from "@/integrations/supabase/client";

const isActiveConsolidationStatus = (status: string | null) => {
  const normalized = (status || "").toLowerCase().trim();
  return normalized !== "cancelled" && normalized !== "canceled";
};

export const getActiveConsolidatedShipmentIds = async () => {
  const { data: consolidations, error: consolidationsError } = await supabase
    .from("consolidations")
    .select("id, status");

  if (consolidationsError || !consolidations?.length) {
    return new Set<string>();
  }

  const activeConsolidationIds = consolidations
    .filter((row) => isActiveConsolidationStatus(row.status))
    .map((row) => row.id);

  if (activeConsolidationIds.length === 0) {
    return new Set<string>();
  }

  const { data: consolidationShipments, error: consolidationShipmentsError } = await supabase
    .from("consolidation_shipments")
    .select("shipment_id")
    .in("consolidation_id", activeConsolidationIds);

  if (consolidationShipmentsError || !consolidationShipments?.length) {
    return new Set<string>();
  }

  return new Set(
    consolidationShipments
      .map((row) => row.shipment_id)
      .filter((shipmentId): shipmentId is string => Boolean(shipmentId))
  );
};
