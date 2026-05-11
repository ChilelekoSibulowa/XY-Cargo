import { supabase } from "@/integrations/supabase/client";

export const replaceConsolidationShipmentLinks = async (
  consolidationId: string,
  shipmentIds: string[],
) => {
  const uniqueShipmentIds = Array.from(
    new Set(shipmentIds.filter((shipmentId): shipmentId is string => !!shipmentId)),
  );

  if (uniqueShipmentIds.length === 0) {
    return { error: null };
  }

  return supabase.rpc(
    "replace_consolidation_shipments" as any,
    {
      p_consolidation_id: consolidationId,
      p_shipment_ids: uniqueShipmentIds,
    } as any,
  );
};
