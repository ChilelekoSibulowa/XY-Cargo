import { useEffect, useMemo, useState } from "react";
import { Eye, Loader2, Trash2, Check } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, Column } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CustomerProfileGate } from "@/components/customer/CustomerProfileGate";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerRecord } from "@/hooks/useCustomerRecord";
import { useDefaultCurrency } from "@/hooks/useDefaultCurrency";
import {
  ACTIVE_DELIVERY_REQUEST_STATUSES,
  buildClearDeliveryRequestPayload,
  buildDeliveryRequestPayload,
  canRemoveDeliveryRequest,
  dedupeDeliveryRequestLinks,
  dedupeDeliveryRequestRowsById,
  DELIVERY_REQUEST_HISTORY_STATUSES,
  getDeliveryRequestStatusLabel,
  getLatestDeliveryRequestLinks,
  getLinkedShipmentIdsForConsolidations,
  REQUESTABLE_DELIVERY_SHIPMENT_STATUSES,
} from "@/lib/deliveryRequests";
import { getAirwayBillNumber, getProductType, getWarehouseTrackingNumber, resolveTrackingByStatus } from "@/lib/shipmentNotes";
import { toast } from "sonner";
import { notifyDeliveryRequested } from "@/lib/notifications";

type ShipmentDetail = {
  id: string;
  code: string;
  customer_id: string;
  workflow_status: string;
  delivery_request_status: string | null;
  service_type: string;
  description: string | null;
  notes: string | null;
  total_cost: number;
  shipping_cost: number;
  custom_tracking_number: string | null;
  weight: number | null;
  cbm: number | null;
  receiver: { full_name: string | null; phone: string | null; address: string | null } | null;
  delivery_request_requested_at: string | null;
  delivery_request_completed_at: string | null;
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
  delivery_request_requested_at: string | null;
  delivery_request_completed_at: string | null;
};

type RequestRow = ShipmentDetail & {
  row_type: "shipment" | "consolidation";
  consolidation_id: string | null;
  child_shipments: ShipmentDetail[];
};

const formatServiceType = (type: string) => {
  const normalized = (type || "").toLowerCase().trim();
  if (["air", "air_freight", "air freight"].includes(normalized)) return "Air Freight";
  if (["sea", "sea_freight", "sea freight"].includes(normalized)) return "Sea Freight";
  if (["mixed", "consolidated"].includes(normalized)) return "Mixed Freight";
  return "-";
};

const formatRequestedAt = (value: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString();
};

const normalizeShipmentRows = (shipments: any[]) =>
  ((shipments || []).map((row: any) => ({
    ...row,
    workflow_status: row.status,
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

const getGroupedCompletedAt = (shipments: ShipmentDetail[]) =>
  shipments
    .map((shipment) => shipment.delivery_request_completed_at)
    .filter((value): value is string => !!value)
    .sort()
    .at(-1) || null;

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

const buildGroupedRequestRows = (
  shipments: ShipmentDetail[],
  links: ConsolidationLink[],
  consolidations: ConsolidationRecord[],
): RequestRow[] => {
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
  const rows: Array<{ index: number; row: RequestRow }> = [];

  shipmentIdsByConsolidation.forEach((shipmentIds, consolidationId) => {
    const childShipments = shipmentIds
      .map((shipmentId) => shipmentById.get(shipmentId))
      .filter(Boolean) as ShipmentDetail[];

    if (childShipments.length === 0) return;

    childShipments.forEach((shipment) => consumedShipmentIds.add(shipment.id));

    const consolidation = consolidationById.get(consolidationId);
    const firstShipment = childShipments[0];

    rows.push({
      index: Math.min(...childShipments.map((shipment) => indexByShipmentId.get(shipment.id) ?? 0)),
      row: {
        ...firstShipment,
        id: `consolidation-${consolidationId}`,
        code: consolidation?.code || `CON-${consolidationId.slice(0, 8).toUpperCase()}`,
        workflow_status: consolidation?.status || firstShipment.workflow_status,
        delivery_request_status:
          consolidation?.delivery_request_status || getGroupedRequestStatus(childShipments),
        service_type: "consolidated",
        description: consolidation?.notes || getGroupedDescription(childShipments),
        notes: consolidation?.notes || firstShipment.notes,
        total_cost:
          Number(consolidation?.total_cost ?? childShipments.reduce((sum, shipment) => sum + Number(shipment.total_cost || 0), 0)),
        shipping_cost: childShipments.reduce((sum, shipment) => sum + Number(shipment.shipping_cost || 0), 0),
        custom_tracking_number:
          consolidation?.tracking_code ||
          childShipments.find((shipment) => !!shipment.custom_tracking_number)?.custom_tracking_number ||
          null,
        weight:
          Number(consolidation?.total_weight ?? childShipments.reduce((sum, shipment) => sum + Number(shipment.weight || 0), 0)),
        cbm:
          Number(consolidation?.total_cbm ?? childShipments.reduce((sum, shipment) => sum + Number(shipment.cbm || 0), 0)),
        receiver: getSharedReceiver(childShipments),
        delivery_request_requested_at:
          consolidation?.delivery_request_requested_at || getGroupedRequestedAt(childShipments),
        delivery_request_completed_at:
          consolidation?.delivery_request_completed_at || getGroupedCompletedAt(childShipments),
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

const CustomerRequestDelivery = () => {
  const { customer } = useCustomerRecord();
  const { formatAmount } = useDefaultCurrency();
  const [availableRows, setAvailableRows] = useState<RequestRow[]>([]);
  const [activeRows, setActiveRows] = useState<RequestRow[]>([]);
  const [historyRows, setHistoryRows] = useState<RequestRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [isSavingItemRemoval, setIsSavingItemRemoval] = useState(false);
  const [selectedRemovalIds, setSelectedRemovalIds] = useState<Set<string>>(new Set());
  const [viewDetailsRow, setViewDetailsRow] = useState<RequestRow | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setSelectedRemovalIds(new Set());
  }, [viewDetailsRow?.id]);

  useEffect(() => {
    const fetchRows = async () => {
      if (!customer?.id) {
        setAvailableRows([]);
        setActiveRows([]);
        setHistoryRows([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      const baseShipmentSelect =
        "id, code, customer_id, status, delivery_request_status, service_type, description, notes, total_cost, shipping_cost, custom_tracking_number, weight, cbm, delivery_request_requested_at, delivery_request_completed_at, receiver:receivers(full_name, phone, address)";
      const baseConsolidationSelect =
        "id, code, customer_id, status, delivery_request_status, notes, total_cost, total_weight, total_cbm, tracking_code, delivery_request_requested_at, delivery_request_completed_at";

      const [
        availableShipmentsRes,
        activeShipmentsRes,
        historyShipmentsRes,
        activeConsolidationsRes,
        historyConsolidationsRes,
      ] = await Promise.all([
        supabase
          .from("shipments")
          .select(baseShipmentSelect)
          .eq("customer_id", customer.id)
          .in("status", [...REQUESTABLE_DELIVERY_SHIPMENT_STATUSES])
          .is("delivery_request_status", null)
          .order("created_at", { ascending: false }),
        supabase
          .from("shipments")
          .select(baseShipmentSelect)
          .eq("customer_id", customer.id)
          .in("delivery_request_status", [...ACTIVE_DELIVERY_REQUEST_STATUSES])
          .order("delivery_request_requested_at", { ascending: false }),
        supabase
          .from("shipments")
          .select(baseShipmentSelect)
          .eq("customer_id", customer.id)
          .in("delivery_request_status", [...DELIVERY_REQUEST_HISTORY_STATUSES])
          .order("delivery_request_completed_at", { ascending: false }),
        supabase
          .from("consolidations")
          .select(baseConsolidationSelect)
          .eq("customer_id", customer.id)
          .in("delivery_request_status", [...ACTIVE_DELIVERY_REQUEST_STATUSES])
          .order("delivery_request_requested_at", { ascending: false }),
        supabase
          .from("consolidations")
          .select(baseConsolidationSelect)
          .eq("customer_id", customer.id)
          .in("delivery_request_status", [...DELIVERY_REQUEST_HISTORY_STATUSES])
          .order("delivery_request_completed_at", { ascending: false }),
      ]);

      const availableShipments = normalizeShipmentRows(availableShipmentsRes.data);
      const activeShipments = normalizeShipmentRows(activeShipmentsRes.data);
      const historyShipments = normalizeShipmentRows(historyShipmentsRes.data);
      const directRequestShipmentIds = Array.from(
        new Set([...activeShipments, ...historyShipments].map((shipment) => shipment.id)),
      );
      const directShipmentIds = Array.from(
        new Set([...availableShipments, ...activeShipments, ...historyShipments].map((shipment) => shipment.id)),
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

          const directRequestShipmentIdSet = new Set(directRequestShipmentIds);
          const parentOnlyConsolidationIds = requestConsolidationIds.filter((consolidationId) => {
            const linkedShipmentIds = getLinkedShipmentIdsForConsolidations(links, [consolidationId]);
            return linkedShipmentIds.length > 0 && linkedShipmentIds.every((shipmentId) => !directRequestShipmentIdSet.has(shipmentId));
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
              .eq("customer_id", customer.id)
              .in("id", consolidationIds);

            if (consolidationsRes.error) {
              consolidationsError = consolidationsRes.error.message;
            } else {
              consolidations = (consolidationsRes.data || []) as ConsolidationRecord[];
            }
          }

          const extraShipmentIds = getLinkedShipmentIdsForConsolidations(links, parentOnlyConsolidationIds).filter(
            (shipmentId) => !directRequestShipmentIds.includes(shipmentId),
          );

          if (extraShipmentIds.length > 0) {
            const extraShipmentsRes = await supabase
              .from("shipments")
              .select(baseShipmentSelect)
              .eq("customer_id", customer.id)
              .in("id", extraShipmentIds);

            if (extraShipmentsRes.error) {
              extraShipmentsError = extraShipmentsRes.error.message;
            } else {
              extraShipments = normalizeShipmentRows(extraShipmentsRes.data);
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
      const activeOrHistoryHiddenShipmentIds = new Set([
        ...activeShipments.map((shipment) => shipment.id),
        ...historyShipments.map((shipment) => shipment.id),
        ...extraShipments.map((shipment) => shipment.id),
      ]);
      const visibleAvailableShipments = availableShipments.filter(
        (shipment) => !activeOrHistoryHiddenShipmentIds.has(shipment.id),
      );
      const visibleAvailableShipmentIdSet = new Set(visibleAvailableShipments.map((shipment) => shipment.id));
      const availableConsolidationIds = Array.from(
        new Set(
          links
            .filter((link) => visibleAvailableShipmentIdSet.has(link.shipment_id))
            .map((link) => link.consolidation_id),
        ),
      );
      const fullyAvailableConsolidationIds = new Set(
        availableConsolidationIds.filter((consolidationId) => {
          const linkedShipmentIds = getLinkedShipmentIdsForConsolidations(links, [consolidationId]);
          return (
            linkedShipmentIds.length > 0 &&
            linkedShipmentIds.every((shipmentId) => visibleAvailableShipmentIdSet.has(shipmentId))
          );
        }),
      );
      const availableGroupingLinks = links.filter((link) =>
        fullyAvailableConsolidationIds.has(link.consolidation_id),
      );

      const queryErrors = [
        availableShipmentsRes.error && `available-shipments: ${availableShipmentsRes.error.message}`,
        activeShipmentsRes.error && `active-shipments: ${activeShipmentsRes.error.message}`,
        historyShipmentsRes.error && `history-shipments: ${historyShipmentsRes.error.message}`,
        activeConsolidationsRes.error && `active-consolidations: ${activeConsolidationsRes.error.message}`,
        historyConsolidationsRes.error && `history-consolidations: ${historyConsolidationsRes.error.message}`,
        linksError && `request-links: ${linksError}`,
        consolidationsError && `request-consolidations: ${consolidationsError}`,
        extraShipmentsError && `request-child-shipments: ${extraShipmentsError}`,
      ].filter(Boolean);

      setAvailableRows(
        buildGroupedRequestRows(visibleAvailableShipments, availableGroupingLinks, consolidations),
      );
      setActiveRows(buildGroupedRequestRows(mergedActiveShipments, links, consolidations));
      setHistoryRows(buildGroupedRequestRows(mergedHistoryShipments, links, consolidations));

      if (queryErrors.length > 0) {
        console.error("[CustomerRequestDelivery] Query errors:", queryErrors);
        toast.error(`Some delivery request data could not be loaded: ${queryErrors[0]}`);
      }

      setIsLoading(false);
    };

    void fetchRows();
  }, [customer?.id, refreshKey]);

  const requestDelivery = async (row: RequestRow) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      toast.error("You must be signed in to request delivery.");
      return;
    }

    setUpdatingId(row.id);
    const requestPayload = buildDeliveryRequestPayload("customer", user.id);
    const shipmentIds = row.child_shipments.map((shipment) => shipment.id);

    const shipmentUpdate = await supabase
      .from("shipments")
      .update(requestPayload)
      .in("id", shipmentIds);

    if (shipmentUpdate.error) {
      toast.error(shipmentUpdate.error.message || "Failed to request delivery.");
      setUpdatingId(null);
      return;
    }

    toast.success("Delivery request sent to warehouse.");

    if (customer?.id) {
      notifyDeliveryRequested(customer.id, row.custom_tracking_number, row.id);
    }

    setUpdatingId(null);
    setRefreshKey((value) => value + 1);
  };

  const removeDeliveryRequest = async (row: RequestRow) => {
    if (!canRemoveDeliveryRequest(row.delivery_request_status)) {
      toast.error("Only submitted delivery requests can be removed.");
      return;
    }

    const confirmed = window.confirm("Remove this submitted delivery request?");
    if (!confirmed) return;

    setRemovingId(row.id);
    const shipmentIds = row.child_shipments.map((shipment) => shipment.id);
    const shipmentUpdate = await supabase
      .from("shipments")
      .update(buildClearDeliveryRequestPayload())
      .in("id", shipmentIds);

    if (shipmentUpdate.error) {
      toast.error(shipmentUpdate.error.message || "Failed to remove delivery request.");
      setRemovingId(null);
      return;
    }

    toast.success("Delivery request returned to Need Action.");
    setRemovingId(null);
    setRefreshKey((value) => value + 1);
  };

  const toggleRemovalSelection = (shipmentId: string, checked: boolean) => {
    setSelectedRemovalIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(shipmentId);
      } else {
        next.delete(shipmentId);
      }
      return next;
    });
  };

  const handleSaveSelectedRemoval = async () => {
    if (!viewDetailsRow || viewDetailsRow.row_type !== "consolidation") return;

    const shipmentIds = viewDetailsRow.child_shipments
      .filter((shipment) => selectedRemovalIds.has(shipment.id))
      .map((shipment) => shipment.id);

    if (shipmentIds.length === 0) {
      toast.error("Select at least one item to remove.");
      return;
    }

    setIsSavingItemRemoval(true);
    const shipmentUpdate = await supabase
      .from("shipments")
      .update(buildClearDeliveryRequestPayload())
      .in("id", shipmentIds);

    if (shipmentUpdate.error) {
      toast.error(shipmentUpdate.error.message || "Failed to remove selected items.");
      setIsSavingItemRemoval(false);
      return;
    }

    setIsSavingItemRemoval(false);
    setSelectedRemovalIds(new Set());
    setViewDetailsRow(null);
    toast.success("Selected items returned to Need Action.");
    setRefreshKey((value) => value + 1);
  };

  const detailShipments = viewDetailsRow?.child_shipments || [];

  const sharedColumns = useMemo<Column<RequestRow>[]>(
    () => [
      { key: "service_type", label: "Service Type", render: (row) => <Badge variant="outline">{formatServiceType(row.service_type)}</Badge> },
      { key: "product_type", label: "Product Type", render: (row) => (row.row_type === "consolidation" ? "Mixed Products" : getProductType(row.notes, row.description)) },
      { key: "cost", label: "Cost", render: (row) => formatAmount(Number(row.total_cost || 0)) },
      { key: "tracking", label: "Tracking Number", render: (row) => <span className="font-mono text-xs">{resolveTrackingByStatus(row.workflow_status, row.notes, row.custom_tracking_number) || "-"}</span> },
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
      { key: "status", label: "Status", render: (row) => <Badge variant="secondary">{getDeliveryRequestStatusLabel(row.delivery_request_status)}</Badge> },
    ],
    [formatAmount],
  );

  const availableColumns = useMemo<Column<RequestRow>[]>(
    () => [
      ...sharedColumns,
      {
        key: "action",
        label: "Action",
        render: (row) => (
          <div className="flex gap-2">
            <Button size="icon" variant="outline" onClick={() => setViewDetailsRow(row)} title="View details">
              <Eye className="h-4 w-4" />
            </Button>
            <Button size="icon" onClick={() => requestDelivery(row)} disabled={updatingId === row.id} title="Request delivery">
              {updatingId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            </Button>
          </div>
        ),
      },
    ],
    [sharedColumns, updatingId],
  );

  const trackedColumns = useMemo<Column<RequestRow>[]>(
    () => [
      ...sharedColumns,
      { key: "requested_at", label: "Requested At", render: (row) => formatRequestedAt(row.delivery_request_requested_at) },
      {
        key: "action",
        label: "Action",
        render: (row) => (
          <div className="flex gap-2">
            <Button size="icon" variant="outline" onClick={() => setViewDetailsRow(row)} title="View details">
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="destructive"
              onClick={() => removeDeliveryRequest(row)}
              disabled={!canRemoveDeliveryRequest(row.delivery_request_status) || removingId === row.id}
              title={
                canRemoveDeliveryRequest(row.delivery_request_status)
                  ? "Remove request"
                  : "Assigned requests cannot be removed"
              }
            >
              {removingId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          </div>
        ),
      },
    ],
    [removingId, sharedColumns],
  );

  return (
    <CustomerProfileGate>
      <div className="space-y-6 animate-fade-in">
        <PageHeader title="Request Delivery"  />

        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Need Action</h2>
          <DataTable columns={availableColumns} data={availableRows} isLoading={isLoading} searchPlaceholder="Search need action shipments..." />
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Submitted</h2>
          <DataTable columns={trackedColumns} data={activeRows} isLoading={isLoading} searchPlaceholder="Search submitted delivery requests..." />
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Delivery Request History</h2>
          <DataTable columns={trackedColumns} data={historyRows} isLoading={isLoading} searchPlaceholder="Search delivery request history..." />
        </div>

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
                    <p className="font-medium">{viewDetailsRow.row_type === "consolidation" ? "Mixed Products" : getProductType(viewDetailsRow.notes, viewDetailsRow.description)}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Tracking Number</Label>
                    <p className="font-mono text-sm">{resolveTrackingByStatus(viewDetailsRow.workflow_status, viewDetailsRow.notes, viewDetailsRow.custom_tracking_number) || "-"}</p>
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
                </div>

                <div className="space-y-3 border-t pt-4">
                  <Label className="text-xs text-muted-foreground">
                    {viewDetailsRow.row_type === "consolidation" ? "Items in This Consolidated Request" : "Shipment Details"}
                  </Label>
                  {detailShipments.map((shipment) => (
                    <div key={shipment.id} className="rounded-md border p-3 space-y-1 text-sm">
                      {viewDetailsRow.row_type === "consolidation" && canRemoveDeliveryRequest(viewDetailsRow.delivery_request_status) ? (
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Checkbox
                            checked={selectedRemovalIds.has(shipment.id)}
                            onCheckedChange={(checked) => toggleRemovalSelection(shipment.id, checked === true)}
                          />
                          Remove this item from submitted delivery request
                        </label>
                      ) : null}
                      <p className="font-semibold">{shipment.description || shipment.code}</p>
                      <p className="text-xs font-mono text-muted-foreground">
                        Tracking: {resolveTrackingByStatus(shipment.workflow_status, shipment.notes, shipment.custom_tracking_number) || "-"}
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
              {viewDetailsRow?.row_type === "consolidation" && canRemoveDeliveryRequest(viewDetailsRow.delivery_request_status) ? (
                <Button
                  variant="destructive"
                  onClick={handleSaveSelectedRemoval}
                  disabled={selectedRemovalIds.size === 0 || isSavingItemRemoval}
                >
                  {isSavingItemRemoval ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Remove Selected ({selectedRemovalIds.size})
                </Button>
              ) : null}
              <Button variant="outline" onClick={() => setViewDetailsRow(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </CustomerProfileGate>
  );
};

export default CustomerRequestDelivery;

