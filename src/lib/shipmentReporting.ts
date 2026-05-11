type ShipmentLike = {
  id: string;
  consolidation_id: string | null;
};

export const toShipmentLevelRows = <T extends ShipmentLike>(rows: T[]): T[] => {
  const seenConsolidations = new Set<string>();
  const shipmentLevelRows: T[] = [];

  for (const row of rows) {
    const consolidationId = row.consolidation_id?.trim();

    if (!consolidationId) {
      shipmentLevelRows.push(row);
      continue;
    }

    if (seenConsolidations.has(consolidationId)) {
      continue;
    }

    seenConsolidations.add(consolidationId);
    shipmentLevelRows.push(row);
  }

  return shipmentLevelRows;
};
