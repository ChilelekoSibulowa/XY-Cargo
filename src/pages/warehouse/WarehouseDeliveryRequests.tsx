import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, Column } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDefaultCurrency } from "@/hooks/useDefaultCurrency";
import {
  ACTIVE_DELIVERY_REQUEST_STATUSES,
  buildDeliveryAssignmentPayload,
  dedupeDeliveryRequestLinks,
  dedupeDeliveryRequestRowsById,
  DELIVERY_REQUEST_HISTORY_STATUSES,
  getDeliveryRequestStatusLabel,
  getLatestDeliveryRequestLinks,
  getLinkedShipmentIdsForConsolidations,
} from "@/lib/deliveryRequests";
import { toast } from "sonner";
import { notifyDriverAssigned } from "@/lib/notifications";
import {
  getAirwayBillNumber,
  getProductType,
  getWarehouseTrackingNumber,
  resolveTrackingByStatus,
} from "@/lib/shipmentNotes";
import { Checkbox } from "@/components/ui/checkbox";
import { useBulkSelection } from "@/hooks/useBulkSelection";
import { Eye, Loader2, Check } from "lucide-react";

type ShipmentDetail = {
  id: string;
  code: string;
  customer_id: string;
  workflow_status: string;
  delivery_request_status: string | null;
  service_type: string;
  notes: string | null;
  custom_tracking_number: string | null;
  description: string | null;
  total_cost: number;
  shipping_cost: number;
  weight: number | null;
  cbm: number | null;
  receiver: { full_name: string | null; phone: string | null; address: string | null } | null;
  delivery_request_assigned_driver_id: string | null;
  assigned_driver: { full_name: string | null; code: string | null } | null;
  delivery_request_requested_at: string | null;
  delivery_request_requested_by_role: string | null;
};

type ConsolidationLink = {
  consolidation_id: string;
  shipment_id: string;
};

type ConsolidationRecord = {
  id: string;
  code: string;
  customer_id: string;
  status: string;
  delivery_request_status: string | null;
  notes: string | null;
  total_cost: number | null;
  total_weight: number | null;
  total_cbm: number | null;
  tracking_code: string | null;
  delivery_request_assigned_driver_id: string | null;
  delivery_request_requested_at: string | null;
  delivery_request_requested_by_role: string | null;
};

type Row = ShipmentDetail & {
  row_type: "shipment" | "consolidation";
  consolidation_id: string | null;
  child_shipments: ShipmentDetail[];
};

type DriverRow = {
  id: string;
  code: string;
  full_name: string;
  is_active: boolean | null;
};

const formatServiceType = (type: string | null | undefined) => {
  const normalized = (type || "").toLowerCase().trim();
  if (normalized === "air") return "Air Freight";
  if (normalized === "sea") return "Sea Freight";
  if (normalized === "mixed" || normalized === "consolidated") return "Mixed Service";
  return "Air Freight"; // Default fallback to ensure it's never blank
};

const formatRequestedAt = (value: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString();
};

const normalizeTrackingNumber = (value: string | null | undefined) => {
  const trimmed = (value || "").trim();
  return trimmed || null;
};

const resolveDisplayTrackingNumber = (
  notes: string | null | undefined,
  primaryTrackingNumber: string | null | undefined,
  fallbackTrackingNumber?: string | null | undefined,
  status?: string | null | undefined,
) =>
  resolveTrackingByStatus(status, notes, primaryTrackingNumber) ||
  normalizeTrackingNumber(fallbackTrackingNumber);

const formatRequesterRole = (value: string | null) => {
  if (value === "customer") return "Customer";
  if (value === "agent") return "Agent";
  return "-";
};

const normalizeShipmentRows = (
  shipments: any[],
  driversMap: Map<string, { full_name: string | null; code: string | null }>,
) =>
  ((shipments || []).map((shipment: any) => ({
    ...shipment,
    workflow_status: shipment.status,
    custom_tracking_number: resolveDisplayTrackingNumber(
      shipment.notes,
      shipment.custom_tracking_number,
      undefined,
      shipment.status,
    ),
    assigned_driver: shipment.delivery_request_assigned_driver_id
      ? driversMap.get(shipment.delivery_request_assigned_driver_id) || null
      : null,
  })) as ShipmentDetail[]);

const getGroupedRequestStatus = (shipments: ShipmentDetail[]) => {
  if (shipments.some((shipment) => shipment.delivery_request_status === "assigned")) return "assigned";
  if (shipments.some((shipment) => shipment.delivery_request_status === "requested")) return "requested";
  if (shipments.some((shipment) => shipment.delivery_request_status === "failed")) return "failed";
  if (shipments.some((shipment) => shipment.delivery_request_status === "successful")) return "successful";
  return null;
};

const getSharedReceiver = (shipments: ShipmentDetail[]) => {
  const receivers = shipments
    .map((shipment) => shipment.receiver)
    .filter((receiver): receiver is NonNullable<ShipmentDetail["receiver"]> => !!receiver);

  if (receivers.length === 0) return null;

  const firstKey = JSON.stringify(receivers[0]);
  return receivers.every((receiver) => JSON.stringify(receiver) === firstKey) ? receivers[0] : null;
};

const getGroupedRequestedAt = (shipments: ShipmentDetail[]) =>
  shipments
    .map((shipment) => shipment.delivery_request_requested_at)
    .filter((value): value is string => !!value)
    .sort()[0] || null;

const getGroupedDescription = (shipments: ShipmentDetail[]) => {
  const names = Array.from(
    new Set(
      shipments
        .map((shipment) => shipment.description || shipment.code)
        .filter((value): value is string => !!value),
    ),
  );

  if (names.length <= 2) return names.join(", ") || null;
  return `${names.slice(0, 2).join(", ")} +${names.length - 2} more`;
};

const buildGroupedRows = (
  shipments: ShipmentDetail[],
  links: ConsolidationLink[],
  consolidations: ConsolidationRecord[],
  driversMap: Map<string, { full_name: string | null; code: string | null }>,
): Row[] => {
  const shipmentById = new Map(shipments.map((shipment) => [shipment.id, shipment]));
  const indexByShipmentId = new Map(shipments.map((shipment, index) => [shipment.id, index]));
  const consolidationById = new Map(consolidations.map((consolidation) => [consolidation.id, consolidation]));
  const shipmentIdsByConsolidation = new Map<string, string[]>();

  links.forEach((link) => {
    if (!shipmentById.has(link.shipment_id)) return;
    const current = shipmentIdsByConsolidation.get(link.consolidation_id) || [];
    current.push(link.shipment_id);
    shipmentIdsByConsolidation.set(link.consolidation_id, current);
  });

  const consumedShipmentIds = new Set<string>();
  const rows: Array<{ index: number; row: Row }> = [];

  shipmentIdsByConsolidation.forEach((shipmentIds, consolidationId) => {
    const childShipments = shipmentIds
      .map((shipmentId) => shipmentById.get(shipmentId))
      .filter(Boolean) as ShipmentDetail[];

    if (childShipments.length === 0) return;

    childShipments.forEach((shipment) => consumedShipmentIds.add(shipment.id));

    const consolidation = consolidationById.get(consolidationId);
    const firstShipment = childShipments[0];
    const assignedDriverId =
      consolidation?.delivery_request_assigned_driver_id ||
      childShipments.find((shipment) => !!shipment.delivery_request_assigned_driver_id)
        ?.delivery_request_assigned_driver_id ||
      null;

    rows.push({
      index: Math.min(...childShipments.map((shipment) => indexByShipmentId.get(shipment.id) ?? 0)),
      row: {
        ...firstShipment,
        id: `consolidation-${consolidationId}`,
        code: consolidation?.code || `CON-${consolidationId.slice(0, 8).toUpperCase()}`,
        workflow_status: consolidation?.status || firstShipment.workflow_status,
        delivery_request_status:
          consolidation?.delivery_request_status || getGroupedRequestStatus(childShipments),
        service_type: Array.from(new Set(childShipments.map(s => (s.service_type || "").toLowerCase().trim()).map(t => (t === "air" || t === "air freight" || t === "air_freight") ? "air" : (t === "sea" || t === "sea freight" || t === "sea_freight") ? "sea" : t).filter(Boolean))).length > 1 ? "mixed" : firstShipment.service_type,
        notes: consolidation?.notes || firstShipment.notes,
        custom_tracking_number: resolveDisplayTrackingNumber(
          consolidation?.notes,
          consolidation?.tracking_code,
          childShipments.find((shipment) => !!shipment.custom_tracking_number)?.custom_tracking_number,
          consolidation?.status || firstShipment.workflow_status,
        ),
        description: consolidation?.notes || getGroupedDescription(childShipments),
        total_cost:
          Number(consolidation?.total_cost ?? childShipments.reduce((sum, shipment) => sum + Number(shipment.total_cost || 0), 0)),
        shipping_cost: childShipments.reduce((sum, shipment) => sum + Number(shipment.shipping_cost || 0), 0),
        weight:
          Number(consolidation?.total_weight ?? childShipments.reduce((sum, shipment) => sum + Number(shipment.weight || 0), 0)),
        cbm:
          Number(consolidation?.total_cbm ?? childShipments.reduce((sum, shipment) => sum + Number(shipment.cbm || 0), 0)),
        receiver: getSharedReceiver(childShipments),
        delivery_request_assigned_driver_id: assignedDriverId,
        assigned_driver: assignedDriverId ? driversMap.get(assignedDriverId) || null : null,
        delivery_request_requested_at:
          consolidation?.delivery_request_requested_at || getGroupedRequestedAt(childShipments),
        delivery_request_requested_by_role:
          consolidation?.delivery_request_requested_by_role ||
          childShipments.find((shipment) => !!shipment.delivery_request_requested_by_role)
            ?.delivery_request_requested_by_role ||
          null,
        row_type: "consolidation",
        consolidation_id: consolidationId,
        child_shipments: childShipments,
      },
    });
  });

  shipments.forEach((shipment, index) => {
    if (consumedShipmentIds.has(shipment.id)) return;

    rows.push({
      index,
      row: {
        ...shipment,
        row_type: "shipment",
        consolidation_id: null,
        child_shipments: [shipment],
      },
    });
  });

  return rows.sort((left, right) => left.index - right.index).map((entry) => entry.row);
};

const WarehouseDeliveryRequests = () => {
  const { formatAmount } = useDefaultCurrency();
  const [activeRows, setActiveRows] = useState<Row[]>([]);
  const [historyRows, setHistoryRows] = useState<Row[]>([]);
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRow, setSelectedRow] = useState<Row | null>(null);
  const [viewDetailsRow, setViewDetailsRow] = useState<Row | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isBulkAssign, setIsBulkAssign] = useState(false);
  const bulkSelection = useBulkSelection<Row>();

  useEffect(() => {
    const fetchRows = async () => {
      setIsLoading(true);

      const baseShipmentSelect =
        "id, code, customer_id, status, delivery_request_status, service_type, notes, description, custom_tracking_number, total_cost, shipping_cost, weight, cbm, delivery_request_assigned_driver_id, delivery_request_requested_at, delivery_request_requested_by_role, receiver:receivers(full_name, phone, address)";
      const baseConsolidationSelect =
        "id, code, customer_id, status, delivery_request_status, notes, total_cost, total_weight, total_cbm, tracking_code, delivery_request_assigned_driver_id, delivery_request_requested_at, delivery_request_requested_by_role";

      const [
        activeShipmentsRes,
        historyShipmentsRes,
        driversRes,
        activeConsolidationsRes,
        historyConsolidationsRes,
      ] = await Promise.all([
        supabase
          .from("shipments")
          .select(baseShipmentSelect)
          .in("delivery_request_status", [...ACTIVE_DELIVERY_REQUEST_STATUSES])
          .order("delivery_request_requested_at", { ascending: false }),
        supabase
          .from("shipments")
          .select(baseShipmentSelect)
          .in("delivery_request_status", [...DELIVERY_REQUEST_HISTORY_STATUSES])
          .order("delivery_request_requested_at", { ascending: false }),
        supabase
          .from("drivers")
          .select("id, code, full_name, is_active")
          .eq("is_active", true)
          .order("full_name", { ascending: true }),
        supabase
          .from("consolidations")
          .select(baseConsolidationSelect)
          .in("delivery_request_status", [...ACTIVE_DELIVERY_REQUEST_STATUSES])
          .order("delivery_request_requested_at", { ascending: false }),
        supabase
          .from("consolidations")
          .select(baseConsolidationSelect)
          .in("delivery_request_status", [...DELIVERY_REQUEST_HISTORY_STATUSES])
          .order("delivery_request_requested_at", { ascending: false }),
      ]);

      const driversMap = new Map<string, { full_name: string | null; code: string | null }>();
      (driversRes.data || []).forEach((driver: DriverRow) => {
        driversMap.set(driver.id, { full_name: driver.full_name, code: driver.code });
      });

      const activeShipments = normalizeShipmentRows(activeShipmentsRes.data, driversMap);
      const historyShipments = normalizeShipmentRows(historyShipmentsRes.data, driversMap);
      const directShipmentIds = Array.from(
        new Set([...activeShipments, ...historyShipments].map((shipment) => shipment.id)),
      );
      const activeConsolidationIds = (activeConsolidationsRes.data || []).map((row: any) => row.id);
      const historyConsolidationIds = (historyConsolidationsRes.data || []).map((row: any) => row.id);
      const requestConsolidationIds = Array.from(
        new Set([...activeConsolidationIds, ...historyConsolidationIds]),
      );

      let links: ConsolidationLink[] = [];
      let consolidations: ConsolidationRecord[] = [];
      let extraShipments: ShipmentDetail[] = [];
      let linksError: string | null = null;
      let consolidationsError: string | null = null;
      let extraShipmentsError: string | null = null;

      let seedLinks: ConsolidationLink[] = [];
      if (directShipmentIds.length > 0) {
        const seedLinksRes = await supabase
          .from("consolidation_shipments")
          .select("consolidation_id, shipment_id, created_at")
          .in("shipment_id", directShipmentIds);

        if (seedLinksRes.error) {
          linksError = seedLinksRes.error.message;
        } else {
          seedLinks = (seedLinksRes.data || []) as ConsolidationLink[];
        }
      }

      if (!linksError) {
        const candidateConsolidationIds = Array.from(
          new Set([
            ...requestConsolidationIds,
            ...seedLinks.map((link) => link.consolidation_id).filter(Boolean),
          ]),
        );

        let allLinks = seedLinks;
        if (candidateConsolidationIds.length > 0) {
          const expandedLinksRes = await supabase
            .from("consolidation_shipments")
            .select("consolidation_id, shipment_id, created_at")
            .in("consolidation_id", candidateConsolidationIds);

          if (expandedLinksRes.error) {
            linksError = expandedLinksRes.error.message;
          } else {
            allLinks = dedupeDeliveryRequestLinks([
              ...seedLinks,
              ...((expandedLinksRes.data || []) as ConsolidationLink[]),
            ]);
          }
        }

        if (!linksError) {
          links = getLatestDeliveryRequestLinks(allLinks);
          const directShipmentIdSet = new Set(directShipmentIds);
          const parentOnlyConsolidationIds = requestConsolidationIds.filter((consolidationId) => {
            const linkedShipmentIds = getLinkedShipmentIdsForConsolidations(links, [consolidationId]);
            return linkedShipmentIds.length > 0 && linkedShipmentIds.every((shipmentId) => !directShipmentIdSet.has(shipmentId));
          });

          const consolidationIds = Array.from(
            new Set([
              ...candidateConsolidationIds,
              ...links.map((link) => link.consolidation_id).filter(Boolean),
            ]),
          );

          if (consolidationIds.length > 0) {
            const consolidationsRes = await supabase
              .from("consolidations")
              .select(baseConsolidationSelect)
              .in("id", consolidationIds);

            if (consolidationsRes.error) {
              consolidationsError = consolidationsRes.error.message;
            } else {
              consolidations = (consolidationsRes.data || []) as ConsolidationRecord[];
            }
          }

          const extraShipmentIds = getLinkedShipmentIdsForConsolidations(links, parentOnlyConsolidationIds).filter(
            (shipmentId) => !directShipmentIds.includes(shipmentId),
          );

          if (extraShipmentIds.length > 0) {
            const extraShipmentsRes = await supabase
              .from("shipments")
              .select(baseShipmentSelect)
              .in("id", extraShipmentIds);

            if (extraShipmentsRes.error) {
              extraShipmentsError = extraShipmentsRes.error.message;
            } else {
              extraShipments = normalizeShipmentRows(extraShipmentsRes.data, driversMap);
            }
          }
        }
      }

      const shipmentIdsByActiveConsolidation = new Set(
        getLinkedShipmentIdsForConsolidations(links, activeConsolidationIds),
      );
      const shipmentIdsByHistoryConsolidation = new Set(
        getLinkedShipmentIdsForConsolidations(links, historyConsolidationIds),
      );

      const mergedActiveShipments = dedupeDeliveryRequestRowsById([
        ...activeShipments,
        ...extraShipments.filter((shipment) => shipmentIdsByActiveConsolidation.has(shipment.id)),
      ]);
      const mergedHistoryShipments = dedupeDeliveryRequestRowsById([
        ...historyShipments,
        ...extraShipments.filter((shipment) => shipmentIdsByHistoryConsolidation.has(shipment.id)),
      ]);

      const queryErrors = [
        activeShipmentsRes.error && `active-shipments: ${activeShipmentsRes.error.message}`,
        historyShipmentsRes.error && `history-shipments: ${historyShipmentsRes.error.message}`,
        driversRes.error && `drivers: ${driversRes.error.message}`,
        activeConsolidationsRes.error && `active-consolidations: ${activeConsolidationsRes.error.message}`,
        historyConsolidationsRes.error && `history-consolidations: ${historyConsolidationsRes.error.message}`,
        linksError && `request-links: ${linksError}`,
        consolidationsError && `request-consolidations: ${consolidationsError}`,
        extraShipmentsError && `request-child-shipments: ${extraShipmentsError}`,
      ].filter(Boolean);

      setActiveRows(buildGroupedRows(mergedActiveShipments, links, consolidations, driversMap));
      setHistoryRows(buildGroupedRows(mergedHistoryShipments, links, consolidations, driversMap));
      setDrivers((driversRes.data || []) as DriverRow[]);

      if (queryErrors.length > 0) {
        console.error("[WarehouseDeliveryRequests] Query errors:", queryErrors);
        toast.error(`Some delivery request data could not be loaded: ${queryErrors[0]}`);
      }

      setIsLoading(false);
    };

    void fetchRows();
  }, [refreshKey]);

  const handleOpenAssign = (row: Row) => {
    setSelectedRow(row);
    setSelectedDriverId(row.delivery_request_assigned_driver_id || "");
    setIsBulkAssign(false);
  };

  const handleOpenBulkAssign = () => {
    const selected = bulkSelection.getSelectedItems(activeRows);
    if (selected.length === 0) {
      toast.error("Select at least one delivery request.");
      return;
    }
    setSelectedRow(selected[0]);
    setSelectedDriverId("");
    setIsBulkAssign(true);
  };

  const assignDriver = async () => {
    if (!selectedDriverId) {
      toast.error("Select a driver first.");
      return;
    }

    setIsAssigning(true);
    const assignmentPayload = buildDeliveryAssignmentPayload(selectedDriverId);

    const rowsToAssign = isBulkAssign
      ? bulkSelection.getSelectedItems(activeRows)
      : selectedRow
        ? [selectedRow]
        : [];

    const allShipmentIds = rowsToAssign.flatMap((row) =>
      row.child_shipments.map((shipment) => shipment.id)
    );
    const allConsolidationIds = rowsToAssign
      .filter((row) => row.row_type === "consolidation" && row.consolidation_id)
      .map((row) => row.consolidation_id as string);

    if (allShipmentIds.length === 0 && allConsolidationIds.length === 0) {
      toast.error("No items found to assign.");
      setIsAssigning(false);
      return;
    }

    const updates: Promise<any>[] = [];

    if (allShipmentIds.length > 0) {
      updates.push(
        Promise.resolve(
          supabase
            .from("shipments")
            .update(assignmentPayload)
            .in("id", allShipmentIds)
        )
      );
    }

    if (allConsolidationIds.length > 0) {
      updates.push(
        Promise.resolve(
          supabase
            .from("consolidations")
            .update(assignmentPayload)
            .in("id", allConsolidationIds)
        )
      );
    }

    const results = await Promise.all(updates);
    const error = results.find((r) => r.error)?.error;

    if (error) {
      toast.error(error.message || "Failed to assign driver.");
      setIsAssigning(false);
      return;
    }

    toast.success(
      isBulkAssign
        ? `Driver assigned to ${rowsToAssign.length} delivery request(s) successfully.`
        : "Driver assigned successfully."
    );

    // Lookup driver name for the notification
    let driverName: string | null = null;
    try {
      const { data: driverRow } = await supabase
        .from("drivers")
        .select("full_name")
        .eq("id", selectedDriverId)
        .maybeSingle();
      driverName = driverRow?.full_name || null;
    } catch (_) {
      driverName = null;
    }

    rowsToAssign.forEach((row) => {
      if (row.customer_id) {
        notifyDriverAssigned(row.customer_id, row.custom_tracking_number, row.id, driverName);
      }
    });

    setIsAssigning(false);
    setSelectedRow(null);
    setSelectedDriverId("");
    setIsBulkAssign(false);
    bulkSelection.clearSelection();
    setRefreshKey((value) => value + 1);
  };

  const detailShipments = viewDetailsRow?.child_shipments || [];

  const sharedColumns = useMemo<Column<Row>[]>(
    () => [
      { key: "service_type", label: "Service Type", render: (row) => <Badge variant="outline">{formatServiceType(row.service_type)}</Badge> },
      { key: "product_type", label: "Product Type", render: (row) => (row.row_type === "consolidation" ? (getProductType(row.notes) !== "-" ? getProductType(row.notes) : "Mixed Products") : getProductType(row.notes, row.description)) },
      { key: "cost", label: "Cost", render: (row) => formatAmount(Number(row.total_cost || 0)) },
      { key: "tracking", label: "Tracking Number", render: (row) => <span className="font-mono text-xs">{row.custom_tracking_number || "-"}</span> },
      {
        key: "receiver",
        label: "Receiver Details",
        render: (row) => (
          <div className="space-y-1">
            <p>{row.receiver?.full_name || "-"}</p>
            <p className="text-xs text-muted-foreground">{row.receiver?.phone || "-"}</p>
            <p className="text-xs text-muted-foreground">{row.receiver?.address || "-"}</p>
          </div>
        ),
      },
      { key: "awb_bl", label: "AWB/BL Number", render: (row) => <span className="font-mono text-xs">{getAirwayBillNumber(row.notes) || "-"}</span> },
      { key: "weight", label: "Weight", render: (row) => `${Number(row.weight || 0).toFixed(2)} kg` },
      { key: "cbm", label: "Cubic Meter (CBM)", render: (row) => `${Number(row.cbm || 0).toFixed(4)} CBM` },
      { key: "shipping_fee", label: "Shipping Fee", render: (row) => formatAmount(Number(row.shipping_cost || 0)) },
      { key: "status", label: "Status", render: (row) => <Badge variant={row.delivery_request_status === "assigned" ? "default" : "secondary"}>{getDeliveryRequestStatusLabel(row.delivery_request_status)}</Badge> },
    ],
    [formatAmount],
  );

  const activeColumns = useMemo<Column<Row>[]>(
    () => [
      {
        key: "select",
        label: "",
        render: (row: Row) => (
          <Checkbox
            checked={bulkSelection.isSelected(row.id)}
            onCheckedChange={() => bulkSelection.toggleSelection(row.id)}
            aria-label={`Select ${row.code}`}
          />
        ),
      },
      ...sharedColumns,
      { key: "requested_at", label: "Requested At", render: (row) => formatRequestedAt(row.delivery_request_requested_at) },
      {
        key: "action",
        label: "Action",
        render: (row) => (
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" className="h-8 w-8 p-0" onClick={() => setViewDetailsRow(row)} title="View details">
              <Eye className="h-4 w-4 text-blue-600" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleOpenAssign(row)} title="Assign driver">
              <Check className="h-4 w-4 text-blue-600" />
            </Button>
          </div>
        ),
      },
    ],
    [sharedColumns, bulkSelection],
  );

  const historyColumns = useMemo<Column<Row>[]>(
    () => [
      ...sharedColumns,
      { key: "requested_at", label: "Requested At", render: (row) => formatRequestedAt(row.delivery_request_requested_at) },
      {
        key: "action",
        label: "Action",
        render: (row) => (
          <Button size="icon" variant="ghost" className="h-8 w-8 p-0" onClick={() => setViewDetailsRow(row)} title="View details">
            <Eye className="h-4 w-4 text-blue-600" />
          </Button>
        ),
      },
    ],
    [sharedColumns],
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Delivery Requests"  />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Submitted</h2>
          {bulkSelection.selectedIds.size > 0 && (
            <Button onClick={handleOpenBulkAssign} size="sm">
              <Check className="mr-2 h-4 w-4" />
              Assign Driver ({bulkSelection.selectedIds.size})
            </Button>
          )}
        </div>
        <DataTable columns={activeColumns} data={activeRows} isLoading={isLoading} searchPlaceholder="Search submitted delivery requests..." />
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Delivery Request History</h2>
        <DataTable columns={historyColumns} data={historyRows} isLoading={isLoading} searchPlaceholder="Search delivery request history..." />
      </div>

      <Dialog open={!!selectedRow} onOpenChange={(open) => { if (!open) { setSelectedRow(null); setIsBulkAssign(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isBulkAssign ? `Assign Driver to ${bulkSelection.selectedIds.size} Request(s)` : "Assign Driver"}</DialogTitle>
            
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="warehouse-driver-select">Driver</Label>
            <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
              <SelectTrigger id="warehouse-driver-select">
                <SelectValue placeholder="Select driver" />
              </SelectTrigger>
              <SelectContent>
                {drivers.map((driver) => (
                  <SelectItem key={driver.id} value={driver.id}>
                    {driver.full_name} ({driver.code || "No Code"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedRow(null)} disabled={isAssigning}>Cancel</Button>
            <Button onClick={assignDriver} disabled={isAssigning || !selectedDriverId}>
              {isAssigning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewDetailsRow} onOpenChange={(open) => !open && setViewDetailsRow(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Delivery Request Details</DialogTitle>
          </DialogHeader>

          {viewDetailsRow && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Service Type</Label>
                  <p className="font-medium">{formatServiceType(viewDetailsRow.service_type)}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Product Type</Label>
                  <p className="font-medium">{viewDetailsRow.row_type === "consolidation" ? (getProductType(viewDetailsRow.notes) !== "-" ? getProductType(viewDetailsRow.notes) : "Mixed Products") : getProductType(viewDetailsRow.notes, viewDetailsRow.description)}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Tracking Number</Label>
                  <p className="font-mono text-sm">{viewDetailsRow.custom_tracking_number || "-"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">AWB/BL Number</Label>
                  <p className="font-mono text-sm">{getAirwayBillNumber(viewDetailsRow.notes) || "-"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Total Cost</Label>
                  <p className="font-medium">{formatAmount(Number(viewDetailsRow.total_cost || 0))}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Shipping Fee</Label>
                  <p className="font-medium">{formatAmount(Number(viewDetailsRow.shipping_cost || 0))}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Weight</Label>
                  <p className="font-medium">{Number(viewDetailsRow.weight || 0).toFixed(2)} kg</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">CBM</Label>
                  <p className="font-medium">{Number(viewDetailsRow.cbm || 0).toFixed(4)} CBM</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <p className="font-medium">{getDeliveryRequestStatusLabel(viewDetailsRow.delivery_request_status)}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Requested At</Label>
                  <p className="font-medium">{formatRequestedAt(viewDetailsRow.delivery_request_requested_at)}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Requested By</Label>
                  <p className="font-medium">{formatRequesterRole(viewDetailsRow.delivery_request_requested_by_role)}</p>
                </div>
                {viewDetailsRow.assigned_driver ? (
                  <div>
                    <Label className="text-xs text-muted-foreground">Assigned Driver</Label>
                    <p className="font-medium">{viewDetailsRow.assigned_driver.full_name || "-"} ({viewDetailsRow.assigned_driver.code || "No Code"})</p>
                  </div>
                ) : null}
              </div>

              <div className="space-y-3 border-t pt-4">
                <Label className="text-xs text-muted-foreground">
                  {viewDetailsRow.row_type === "consolidation" ? "Items in This Consolidated Request" : "Shipment Details"}
                </Label>
                {detailShipments.map((shipment) => (
                  <div key={shipment.id} className="rounded-md border p-3 space-y-1 text-sm">
                    <p className="font-semibold">{shipment.description || shipment.code}</p>
                    <p className="text-xs font-mono text-muted-foreground">
                      Tracking: {shipment.custom_tracking_number || "-"}
                      {" | "}
                      AWB/BL No.: {getAirwayBillNumber(shipment.notes) || "-"}
                    </p>
                    <p>
                      Service: {formatServiceType(shipment.service_type)}
                      {" | "}
                      Weight: {(shipment.weight || 0).toFixed(2)} kg
                      {" | "}
                      CBM: {(shipment.cbm || 0).toFixed(4)}
                    </p>
                    {shipment.receiver ? (
                      <p className="text-xs text-muted-foreground">
                        Receiver: {shipment.receiver.full_name || "-"} | {shipment.receiver.phone || "-"} | {shipment.receiver.address || "-"}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDetailsRow(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WarehouseDeliveryRequests;

