import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/components/auth/AuthContext";
import { useCustomerRecord } from "@/hooks/useCustomerRecord";
import { useDefaultCurrency } from "@/hooks/useDefaultCurrency";
import {
  extractNoteValue,
  getAirwayBillNumber,
  getShipmentCbmValue,
  resolveTrackingByParcelTab,
  resolveTrackingByStatus,
} from "@/lib/shipmentNotes";
import {
  getPortalShipmentWorkflowStatus,
  isSingleHandlingMethod,
} from "@/lib/parcelWorkflow";
import {
  isShipmentStageStatus,
  normalizeConsolidationStatus,
  normalizeShipmentStatus,
} from "@/lib/warehouseTabFilters";

type PortalScope = "customer" | "agent";

type ShipmentRow = {
  id: string;
  code: string;
  status: string;
  created_at: string;
  updated_at: string;
  estimated_delivery_date: string | null;
  collected_at?: string | null;
  collected_by?: string | null;
  total_cost: number | null;
  shipping_cost: number | null;
  payment_status: string | null;
  service_type: string;
  description: string | null;
  notes: string | null;
  custom_tracking_number: string | null;
  weight: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
  cbm: number | null;
  quantity: number | null;
  handling_method: string | null;
  consolidation_id?: string | null;
  customer?: { id?: string | null; full_name: string | null; code: string | null } | null;
  receiver: { full_name: string | null; phone: string | null; address: string | null } | null;
};

type ConsolidationShipment = {
  shipment_id: string;
  shipment?: {
    id: string;
    code: string;
    description: string | null;
    notes: string | null;
    service_type: string;
    custom_tracking_number: string | null;
    estimated_delivery_date: string | null;
    collected_at?: string | null;
    collected_by?: string | null;
    quantity: number | null;
    weight: number | null;
    cbm: number | null;
    length: number | null;
    width: number | null;
    height: number | null;
    total_cost: number | null;
    shipping_cost: number | null;
    payment_status: string | null;
    receiver: { full_name: string | null; phone: string | null; address: string | null } | null;
  } | null;
};

type ConsolidationShipmentDetails = NonNullable<ConsolidationShipment["shipment"]>;

type ConsolidationRow = {
  id: string;
  code: string;
  status: string;
  tracking_code: string | null;
  notes: string | null;
  item_count: number | null;
  total_weight: number | null;
  total_cbm: number | null;
  total_cost: number | null;
  created_at: string;
  collected_at: string | null;
  collected_by: string | null;
  consolidation_shipments: ConsolidationShipment[];
  customer?: { id?: string | null; full_name: string | null; code: string | null } | null;
};

type UnifiedDashboardRow = {
  id: string;
  rowType: "shipment" | "consolidation";
  code: string;
  status: string;
  created_at: string;
  service_type: string;
  description: string | null;
  notes: string | null;
  custom_tracking_number: string | null;
  airway_bill_number: string | null;
  estimated_delivery_date: string | null;
  total_cost: number;
  shipping_cost: number | null;
  payment_status: string | null;
  weight: number;
  length: number | null;
  width: number | null;
  height: number | null;
  cbm: number | null;
  quantity: number | null;
  handling_method: string | null;
  consolidation_id?: string | null;
  customer_name?: string;
  customer_code?: string;
  sourceShipment?: ShipmentRow;
  sourceConsolidation?: ConsolidationRow;
};

type DetailShipmentRow = {
  id: string;
  code: string;
  description: string | null;
  notes: string | null;
  custom_tracking_number: string | null;
  service_type: string;
  quantity: number | null;
  weight: number | null;
  cbm: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
  total_cost: number | null;
  shipping_cost: number | null;
  receiver?: { full_name: string | null; phone: string | null; address: string | null } | null;
};

type ColumnDef = {
  key: string;
  label: string;
  render: (row: UnifiedDashboardRow) => ReactNode;
};

const statusLabel: Record<string, string> = {
  saved_pickup: "Created",
  saved_dropoff: "Incoming",
  received: "Need Action",
  requested_pickup: "Submitted",
  approved: "Confirm Shipment",
  assigned: "Outgoing Parcel",
  supplied: "In Transit",
  delivered: "Ready for Collection",
  closed: "Collected",
};

const consolidationStatusToShipmentStatus: Record<string, string> = {
  submitted: "requested_pickup",
  confirmed: "approved",
  outgoing: "assigned",
  in_transit: "supplied",
  arrived: "delivered",
  collected: "closed",
};

const getConsolidationShipments = (row: ConsolidationRow) =>
  (row.consolidation_shipments || [])
    .map((item) => item.shipment)
    .filter(Boolean) as ConsolidationShipmentDetails[];

const getConsolidationTrackingNumberFromNotes = (notes: string | null) =>
  extractNoteValue(notes, "Tracking Number");

const getConsolidationCbmFromNotes = (notes: string | null) => {
  const value = extractNoteValue(notes, "CBM");
  if (!value) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const getLatestEstimatedDeliveryDate = (values: Array<string | null | undefined>) => {
  const validValues = values.filter((value): value is string => !!value);
  if (validValues.length === 0) return null;

  return validValues.reduce((latest, value) => {
    const latestTime = new Date(latest).getTime();
    const currentTime = new Date(value).getTime();
    if (Number.isNaN(latestTime)) return value;
    if (Number.isNaN(currentTime)) return latest;
    return currentTime > latestTime ? value : latest;
  });
};

const isMissingConsolidationTotalsError = (error: { code?: string; message?: string } | null) =>
  !!error &&
  (error.code === "42703" ||
    /item_count|total_weight|total_cbm|total_cost|tracking_code/i.test(error.message || ""));

const formatServiceType = (type: string) => {
  const normalized = (type || "").toLowerCase().trim();
  if (normalized === "air" || normalized === "air_freight" || normalized === "air freight") {
    return "Air Freight";
  }
  if (normalized === "sea" || normalized === "sea_freight" || normalized === "sea freight") {
    return "Sea Freight";
  }
  if (normalized === "mixed") return "Mixed Freight";
  return "-";
};

const formatDims = (l: number | null, w: number | null, h: number | null) => {
  if (!l && !w && !h) return "-";
  return `${l || 0}x${w || 0}x${h || 0}`;
};

const formatDateCell = (value: string | null | undefined) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getProductType = (shipment: { notes: string | null }) =>
  extractNoteValue(shipment.notes, "Product type") || "-";

const getUnitPrice = (shipment: { notes: string | null }) =>
  extractNoteValue(shipment.notes, "Price");

const getItemCostAmount = (shipment: { notes: string | null; total_cost: number | null }) => {
  const notePrice = getUnitPrice(shipment);
  if (notePrice) {
    const parsed = Number(notePrice);
    if (!Number.isNaN(parsed) && parsed >= 0) return parsed;
  }
  return shipment.total_cost || 0;
};

const toConsolidationShipmentDetails = (shipment: ShipmentRow): ConsolidationShipmentDetails => ({
  id: shipment.id,
  code: shipment.code,
  description: shipment.description,
  notes: shipment.notes,
  service_type: shipment.service_type,
  custom_tracking_number: shipment.custom_tracking_number,
  estimated_delivery_date: shipment.estimated_delivery_date,
  collected_at: shipment.collected_at,
  collected_by: shipment.collected_by,
  quantity: shipment.quantity,
  weight: shipment.weight,
  cbm: getShipmentCbmValue(shipment),
  length: shipment.length,
  width: shipment.width,
  height: shipment.height,
  total_cost: shipment.total_cost,
  shipping_cost: shipment.shipping_cost,
  payment_status: shipment.payment_status,
  receiver: shipment.receiver,
});

const filterAllShipmentRows = (rows: UnifiedDashboardRow[]) =>
  rows.filter(
    (row) =>
      !["saved_pickup", "saved_dropoff", "received"].includes(normalizeShipmentStatus(row.status)) &&
      isShipmentStageStatus(row.status) &&
      (row.rowType === "consolidation" || (row.rowType === "shipment" && isSingleHandlingMethod(row))),
  );

const getCustomerSelect = (withTotals: boolean) => `
  id,
  code,
  status,
  tracking_code,
  notes,
  ${withTotals ? "item_count, total_weight, total_cbm, total_cost," : ""}
  created_at,
  collected_at,
  collected_by,
  consolidation_shipments(
    shipment_id,
    shipment:shipments(
      id,
      code,
      description,
      notes,
      service_type,
      custom_tracking_number,
      estimated_delivery_date,
      collected_at,
      collected_by,
      quantity,
      weight,
      cbm,
      length,
      width,
      height,
      total_cost,
      shipping_cost,
      payment_status,
      receiver:receivers(full_name, phone, address)
    )
  )
`;

const getAgentSelect = (withTotals: boolean) => `
  id, code, status, tracking_code, notes, ${withTotals ? "item_count, total_weight, total_cbm, total_cost," : ""}
  created_at, collected_at, collected_by,
  consolidation_shipments(
    shipment_id,
    shipment:shipments(
      id, code, description, notes, service_type, custom_tracking_number,
      estimated_delivery_date, collected_at, collected_by,
      quantity, weight, cbm, length, width, height, total_cost, shipping_cost, payment_status,
      receiver:receivers(full_name, phone, address)
    )
  ),
  customer:customers(id, full_name, code)
`;

export const PortalShipmentHistoryTable = ({ scope }: { scope: PortalScope }) => {
  const { user } = useAuthContext();
  const { customer } = useCustomerRecord();
  const { formatAmount } = useDefaultCurrency();
  const [shipments, setShipments] = useState<ShipmentRow[]>([]);
  const [consolidations, setConsolidations] = useState<ConsolidationRow[]>([]);
  const [agentCustomerIds, setAgentCustomerIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingConsolidations, setIsLoadingConsolidations] = useState(true);
  const [viewRow, setViewRow] = useState<UnifiedDashboardRow | null>(null);

  useEffect(() => {
    if (scope !== "agent") return;
    const fetchAgentCustomers = async () => {
      if (!user?.id) {
        setAgentCustomerIds([]);
        return;
      }
      const { data } = await supabase.from("customers").select("id").eq("agent_id", user.id);
      setAgentCustomerIds((data || []).map((row) => row.id));
    };
    fetchAgentCustomers();
  }, [scope, user?.id]);

  useEffect(() => {
    const fetchShipments = async () => {
      setIsLoading(true);
      if (scope === "customer") {
        if (!customer?.id) {
          setShipments([]);
          setIsLoading(false);
          return;
        }
        const { data } = await supabase
          .from("shipments")
          .select("id, code, status, created_at, updated_at, estimated_delivery_date, collected_at, collected_by, total_cost, shipping_cost, payment_status, service_type, description, notes, custom_tracking_number, weight, length, width, height, cbm, quantity, consolidation_id, handling_method, receiver:receivers(full_name, phone, address)")
          .eq("customer_id", customer.id)
          .order("created_at", { ascending: false });
        setShipments((data || []) as ShipmentRow[]);
        setIsLoading(false);
        return;
      }

      if (agentCustomerIds.length === 0) {
        setShipments([]);
        setIsLoading(false);
        return;
      }
      const { data } = await supabase
        .from("shipments")
        .select("id, code, status, created_at, updated_at, estimated_delivery_date, collected_at, collected_by, total_cost, shipping_cost, payment_status, service_type, description, notes, custom_tracking_number, weight, length, width, height, cbm, quantity, consolidation_id, handling_method, customer:customers(id, code, full_name), receiver:receivers(full_name, phone, address)")
        .in("customer_id", agentCustomerIds)
        .order("created_at", { ascending: false });
      setShipments((data || []) as ShipmentRow[]);
      setIsLoading(false);
    };

    fetchShipments();
  }, [agentCustomerIds, customer?.id, scope]);

  useEffect(() => {
    const fetchConsolidations = async () => {
      setIsLoadingConsolidations(true);
      const isCustomerScope = scope === "customer";
      const customerIds = isCustomerScope ? (customer?.id ? [customer.id] : []) : agentCustomerIds;
      if (customerIds.length === 0) {
        setConsolidations([]);
        setIsLoadingConsolidations(false);
        return;
      }

      const runQuery = (withTotals: boolean) => {
        let query = supabase
          .from("consolidations")
          .select(isCustomerScope ? getCustomerSelect(withTotals) : getAgentSelect(withTotals));

        query =
          customerIds.length === 1
            ? query.eq("customer_id", customerIds[0])
            : query.in("customer_id", customerIds);

        return query.order("created_at", { ascending: false });
      };

      const { data, error } = await runQuery(true);
      if (error && isMissingConsolidationTotalsError(error)) {
        const { data: fallbackData, error: fallbackError } = await runQuery(false);
        if (fallbackError) {
          toast.error("Failed to load consolidation requests.");
          setConsolidations([]);
        } else {
          const normalized = (fallbackData || []).map((row: any) => ({
            ...row,
            item_count: null,
            total_weight: null,
            total_cbm: null,
            total_cost: null,
            tracking_code: null,
          }));
          setConsolidations(normalized as ConsolidationRow[]);
        }
        setIsLoadingConsolidations(false);
        return;
      }

      if (error) {
        toast.error("Failed to load consolidation requests.");
        setConsolidations([]);
      } else {
        setConsolidations((data || []) as unknown as ConsolidationRow[]);
      }
      setIsLoadingConsolidations(false);
    };

    fetchConsolidations();
  }, [agentCustomerIds, customer?.id, scope]);

  const normalizedShipments = useMemo(
    () => shipments.map((shipment) => ({ ...shipment, status: normalizeShipmentStatus(shipment.status) })),
    [shipments],
  );

  const shipmentsByConsolidationCode = useMemo(() => {
    const map = new Map<string, ShipmentRow[]>();
    if (scope !== "customer") return map;
    normalizedShipments.forEach((shipment) => {
      const consolidationCode = extractNoteValue(shipment.notes, "Consolidation")?.trim().toLowerCase();
      if (!consolidationCode) return;
      const existing = map.get(consolidationCode) || [];
      existing.push(shipment);
      map.set(consolidationCode, existing);
    });
    return map;
  }, [normalizedShipments, scope]);

  const activeConsolidationShipmentIds = useMemo(() => {
    const ids = new Set<string>();
    const activeConsolidationCodes = new Set<string>();
    if (scope !== "customer") return ids;
    consolidations.forEach((consolidation) => {
      const normalizedStatus = normalizeConsolidationStatus(consolidation.status);
      if (normalizedStatus === "cancelled" || normalizedStatus === "canceled") return;
      activeConsolidationCodes.add(consolidation.code.trim().toLowerCase());
      consolidation.consolidation_shipments?.forEach((row) => ids.add(row.shipment_id));
    });
    normalizedShipments.forEach((shipment) => {
      const consolidationCode = extractNoteValue(shipment.notes, "Consolidation")?.trim().toLowerCase();
      if (consolidationCode && activeConsolidationCodes.has(consolidationCode)) {
        ids.add(shipment.id);
      }
    });
    return ids;
  }, [consolidations, normalizedShipments, scope]);

  const visibleShipments = useMemo(
    () =>
      scope === "customer"
        ? normalizedShipments.filter((row) => !row.consolidation_id && !activeConsolidationShipmentIds.has(row.id))
        : normalizedShipments.filter((row) => !row.consolidation_id),
    [activeConsolidationShipmentIds, normalizedShipments, scope],
  );

  const shipmentsById = useMemo(() => {
    const map = new Map<string, ShipmentRow>();
    normalizedShipments.forEach((shipment) => map.set(shipment.id, shipment));
    return map;
  }, [normalizedShipments]);

  const workflowShipments = useMemo(
    () =>
      visibleShipments.map((shipment) => ({
        id: shipment.id,
        status: normalizeShipmentStatus(shipment.status),
        service_type: shipment.service_type,
        customer_id: shipment.customer?.id || null,
        notes: shipment.notes,
      })),
    [visibleShipments],
  );

  const getResolvedConsolidationShipments = useCallback(
    (row: ConsolidationRow): ConsolidationShipmentDetails[] => {
      const merged = new Map<string, ConsolidationShipmentDetails>();
      getConsolidationShipments(row).forEach((shipment) => merged.set(shipment.id, shipment));

      if (scope === "customer") {
        const noteMatchedShipments = shipmentsByConsolidationCode.get(row.code.trim().toLowerCase()) || [];
        noteMatchedShipments.forEach((shipment) => {
          if (!merged.has(shipment.id)) merged.set(shipment.id, toConsolidationShipmentDetails(shipment));
        });
      }

      (row.consolidation_shipments || []).forEach((entry) => {
        if (merged.has(entry.shipment_id)) return;
        const fallback = shipmentsById.get(entry.shipment_id);
        if (fallback) merged.set(entry.shipment_id, toConsolidationShipmentDetails(fallback));
      });

      return Array.from(merged.values());
    },
    [shipmentsByConsolidationCode, shipmentsById, scope],
  );

  const mapShipmentToUnifiedRow = useCallback(
    (shipment: ShipmentRow): UnifiedDashboardRow => ({
      id: shipment.id,
      rowType: "shipment",
      code: shipment.code,
      status:
        scope === "customer"
          ? getPortalShipmentWorkflowStatus(shipment as any, visibleShipments as any)
          : getPortalShipmentWorkflowStatus(
              {
                id: shipment.id,
                status: shipment.status,
                service_type: shipment.service_type,
                customer_id: shipment.customer?.id || null,
                notes: shipment.notes,
                handling_method: shipment.handling_method,
              } as any,
              workflowShipments as any,
            ),
      created_at: shipment.created_at,
      service_type: shipment.service_type,
      description: shipment.description,
      notes: shipment.notes,
      custom_tracking_number: shipment.custom_tracking_number,
      airway_bill_number: getAirwayBillNumber(shipment.notes),
      estimated_delivery_date: shipment.estimated_delivery_date,
      total_cost: shipment.total_cost || 0,
      shipping_cost: shipment.shipping_cost,
      payment_status: shipment.payment_status,
      weight: shipment.weight || 0,
      length: shipment.length,
      width: shipment.width,
      height: shipment.height,
      cbm: getShipmentCbmValue(shipment),
      quantity: shipment.quantity,
      handling_method: shipment.handling_method,
      consolidation_id: shipment.consolidation_id,
      customer_name: shipment.customer?.full_name || "Client",
      customer_code: shipment.customer?.code || "-",
      sourceShipment: shipment,
    }),
    [scope, visibleShipments, workflowShipments],
  );

  const shipmentDisplayRows = useMemo<UnifiedDashboardRow[]>(
    () => visibleShipments.map((shipment) => mapShipmentToUnifiedRow(shipment)),
    [mapShipmentToUnifiedRow, visibleShipments],
  );

  const consolidationDisplayRows = useMemo<UnifiedDashboardRow[]>(
    () =>
      consolidations.map((consolidation) => {
        const normalizedStatus = normalizeConsolidationStatus(consolidation.status);
        const mappedShipmentStatus = consolidationStatusToShipmentStatus[normalizedStatus] || "requested_pickup";
        const shipmentsInConsolidation = getResolvedConsolidationShipments(consolidation);
        const distinctServiceTypes = Array.from(
          new Set(
            shipmentsInConsolidation
              .map((shipment) => (shipment.service_type || "").toLowerCase().trim())
              .filter(Boolean),
          ),
        );
        const consolidationServiceType =
          distinctServiceTypes.length === 1
            ? distinctServiceTypes[0]
            : distinctServiceTypes.length > 1
              ? "mixed"
              : "";
        const isMixedConsolidation = shipmentsInConsolidation.length > 1;
        const consolidatedItemCost = shipmentsInConsolidation.reduce(
          (sum, shipment) => sum + getItemCostAmount(shipment),
          0,
        );
        const consolidatedShippingFee =
          consolidation.total_cost ??
          shipmentsInConsolidation.reduce((sum, shipment) => sum + (shipment.shipping_cost || 0), 0);
        const consolidatedWeight =
          consolidation.total_weight ??
          shipmentsInConsolidation.reduce((sum, shipment) => sum + (shipment.weight || 0), 0);
        const consolidatedCbm =
          consolidation.total_cbm ??
          getConsolidationCbmFromNotes(consolidation.notes) ??
          shipmentsInConsolidation.reduce((sum, shipment) => sum + (getShipmentCbmValue(shipment) || 0), 0);
        const consolidatedPaymentStatus =
          shipmentsInConsolidation.length === 0
            ? null
            : shipmentsInConsolidation.every((shipment) => shipment.payment_status === "completed")
              ? "completed"
              : "pending";
        const consolidationTrackingNumber =
          consolidation.tracking_code ||
          getConsolidationTrackingNumberFromNotes(consolidation.notes) ||
          (scope === "customer"
            ? shipmentsInConsolidation.find((shipment) => !!shipment.custom_tracking_number?.trim())?.custom_tracking_number
            : "") ||
          "";
        const consolidationAirwayBill =
          getAirwayBillNumber(consolidation.notes) ||
          (scope === "customer"
            ? shipmentsInConsolidation.map((shipment) => getAirwayBillNumber(shipment.notes)).find((value) => !!value)
            : null) ||
          null;

        return {
          id: consolidation.id,
          rowType: "consolidation" as const,
          code: consolidation.code,
          status: mappedShipmentStatus,
          created_at: consolidation.created_at,
          service_type: consolidationServiceType,
          description: isMixedConsolidation
            ? "Mixed Products"
            : shipmentsInConsolidation[0]?.description ||
              shipmentsInConsolidation[0]?.code ||
              "Consolidated shipment",
          notes: consolidation.notes,
          custom_tracking_number: consolidationTrackingNumber,
          airway_bill_number: consolidationAirwayBill,
          estimated_delivery_date: getLatestEstimatedDeliveryDate(
            shipmentsInConsolidation.map((shipment) => shipment.estimated_delivery_date),
          ),
          total_cost: consolidatedItemCost,
          shipping_cost: consolidatedShippingFee,
          payment_status: consolidatedPaymentStatus,
          weight: consolidatedWeight,
          length: null,
          width: null,
          height: null,
          cbm: consolidatedCbm,
          quantity:
            consolidation.item_count ??
            shipmentsInConsolidation.reduce((sum, shipment) => sum + (shipment.quantity || 1), 0),
          handling_method: "consolidated",
          customer_name: consolidation.customer?.full_name || "Client",
          customer_code: consolidation.customer?.code || "-",
          sourceConsolidation: consolidation,
        };
      }),
    [consolidations, getResolvedConsolidationShipments, scope],
  );

  const allShipmentDisplayRows = useMemo(
    () => filterAllShipmentRows([...shipmentDisplayRows, ...consolidationDisplayRows]),
    [consolidationDisplayRows, shipmentDisplayRows],
  );

  const renderCost = (row: UnifiedDashboardRow) => {
    if (row.rowType === "consolidation") return formatAmount(row.total_cost || 0);
    const shipment = row.sourceShipment;
    if (!shipment) return formatAmount(row.total_cost || 0);
    const price = getUnitPrice(shipment);
    if (price) {
      const numeric = Number(price);
      if (!Number.isNaN(numeric)) return formatAmount(numeric);
      return price;
    }
    return formatAmount(shipment.total_cost || 0);
  };

  const renderStatusBadge = (row: UnifiedDashboardRow) => (
    <Badge variant="secondary" className="text-xs">
      {statusLabel[row.status] || row.status}
    </Badge>
  );

  const getConsolidationProductTypeLabel = (row: UnifiedDashboardRow) => {
    if (row.rowType !== "consolidation") return "-";
    if (row.sourceConsolidation) {
      const noteProductType = extractNoteValue(row.notes, "Product type");
      if (noteProductType) return noteProductType;
      const childProductTypes = Array.from(
        new Set(
          getResolvedConsolidationShipments(row.sourceConsolidation)
            .map((shipment) => extractNoteValue(shipment.notes, "Product type"))
            .filter((value): value is string => !!value && value.trim().length > 0),
        ),
      );
      if (childProductTypes.length === 1) return childProductTypes[0];
      if (childProductTypes.length > 1) return "Mixed Products";
    }
    return "Mixed Products";
  };

  const viewRows = useMemo<DetailShipmentRow[]>(() => {
    if (!viewRow) return [];
    if (viewRow.rowType === "shipment" && viewRow.sourceShipment) {
      const shipment = viewRow.sourceShipment;
      return [{
        id: shipment.id,
        code: shipment.code,
        description: shipment.description,
        notes: shipment.notes,
        custom_tracking_number: shipment.custom_tracking_number,
        service_type: shipment.service_type,
        quantity: shipment.quantity,
        weight: shipment.weight,
        cbm: getShipmentCbmValue(shipment),
        length: shipment.length,
        width: shipment.width,
        height: shipment.height,
        total_cost: shipment.total_cost,
        shipping_cost: shipment.shipping_cost,
        receiver: shipment.receiver,
      }];
    }
    if (viewRow.rowType === "consolidation" && viewRow.sourceConsolidation) {
      return getResolvedConsolidationShipments(viewRow.sourceConsolidation).map((shipment) => ({
        id: shipment.id,
        code: shipment.code,
        description: shipment.description,
        notes: shipment.notes,
        custom_tracking_number: shipment.custom_tracking_number,
        service_type: shipment.service_type,
        quantity: shipment.quantity,
        weight: shipment.weight,
        cbm: getShipmentCbmValue(shipment),
        length: shipment.length,
        width: shipment.width,
        height: shipment.height,
        total_cost: shipment.total_cost,
        shipping_cost: shipment.shipping_cost,
        receiver: shipment.receiver,
      }));
    }
    return [];
  }, [getResolvedConsolidationShipments, viewRow]);

  const columns = useMemo<ColumnDef[]>(() => {
    const baseColumns: Record<string, ColumnDef> = {
      client: {
        key: "client",
        label: "Client",
        render: (row) => (
          <div>
            <p>{row.customer_name}</p>
            <p className="text-xs text-muted-foreground font-mono">{row.customer_code}</p>
          </div>
        ),
      },
      serviceType: {
        key: "service_type",
        label: "Service Type",
        render: (row) => <Badge variant="outline">{formatServiceType(row.service_type)}</Badge>,
      },
      productType: {
        key: "product_type",
        label: "Product Type",
        render: (row) =>
          row.rowType === "consolidation"
            ? getConsolidationProductTypeLabel(row)
            : row.sourceShipment
              ? getProductType(row.sourceShipment)
              : "-",
      },
      cost: {
        key: "cost",
        label: "Cost",
        render: (row) => <span className="whitespace-nowrap">{renderCost(row)}</span>,
      },
      tracking: {
        key: "tracking",
        label: "Tracking Number",
        render: (row) => {
          const tracking =
            row.rowType === "shipment"
              ? resolveTrackingByParcelTab("all_shipments", row.status, row.sourceShipment?.notes || null, row.sourceShipment?.custom_tracking_number)
              : resolveTrackingByParcelTab("all_shipments", row.status, row.sourceConsolidation?.notes || null, row.custom_tracking_number);
          return <span className="font-mono text-xs">{tracking || "Not provided"}</span>;
        },
      },
      receiver: {
        key: "receiver",
        label: "Receiver",
        render: (row) => {
          if (row.rowType === "shipment") {
            const name = row.sourceShipment?.receiver?.full_name || "-";
            const phone = row.sourceShipment?.receiver?.phone || "-";
            const address = row.sourceShipment?.receiver?.address || "-";
            return (
              <div>
                <p>{name}</p>
                <p className="text-xs text-muted-foreground">{phone}</p>
                <p className="text-xs text-muted-foreground">{address}</p>
              </div>
            );
          }
          if (!row.sourceConsolidation) return "-";
          const consolidationShipments = getResolvedConsolidationShipments(row.sourceConsolidation);
          const names = Array.from(new Set(consolidationShipments.map((shipment) => shipment.receiver?.full_name || "").filter(Boolean)));
          const phones = Array.from(new Set(consolidationShipments.map((shipment) => shipment.receiver?.phone || "").filter(Boolean)));
          const addresses = Array.from(new Set(consolidationShipments.map((shipment) => shipment.receiver?.address || "").filter(Boolean)));
          return (
            <div>
              <p>{names.length === 1 ? names[0] : names.length > 1 ? "Multiple Receivers" : "-"}</p>
              <p className="text-xs text-muted-foreground">{phones.length === 1 ? phones[0] : "-"}</p>
              <p className="text-xs text-muted-foreground">{addresses.length === 1 ? addresses[0] : "-"}</p>
            </div>
          );
        },
      },
      departureDateOrigin: {
        key: "departure_date_origin",
        label: "Departure Date (Origin)",
        render: (row) => formatDateCell(row.created_at),
      },
      arrivalDateDestination: {
        key: "arrival_date_destination",
        label: "Arrival Date (Destination)",
        render: (row) => {
          const hasArrived = ["delivered", "closed"].includes(normalizeShipmentStatus(row.status));
          if (!hasArrived) return "-";
          if (row.rowType === "shipment" && row.sourceShipment) {
            return formatDateCell(row.sourceShipment.updated_at || row.sourceShipment.created_at);
          }
          if (row.rowType === "consolidation" && row.sourceConsolidation) {
            return formatDateCell(row.sourceConsolidation.created_at);
          }
          return "-";
        },
      },
      airwayBill: {
        key: "airway_bill",
        label: "AWB/BL No.",
        render: (row) => <span className="font-mono text-xs">{row.airway_bill_number || "-"}</span>,
      },
      wt: {
        key: "wt",
        label: "Weight",
        render: (row) => `${row.weight}kg`,
      },
      cbm: {
        key: "cbm",
        label: "Cubic Meters (CBM)",
        render: (row) => (row.cbm == null ? "-" : row.cbm.toFixed(2)),
      },
      shippingFee: {
        key: "shipping_fee",
        label: "Shipping Fee",
        render: (row) => {
          const earlyStages = new Set(["saved_pickup", "saved_dropoff", "received", "requested_pickup"]);
          if (earlyStages.has((row.status || "").toLowerCase()) || row.shipping_cost == null) {
            return <span className="whitespace-nowrap text-muted-foreground">-</span>;
          }
          return <span className="whitespace-nowrap">{formatAmount(row.shipping_cost)}</span>;
        },
      },
      status: {
        key: "status",
        label: "Status",
        render: (row) => renderStatusBadge(row),
      },
      action: {
        key: "action",
        label: "Action",
        render: (row) => (
          <Button size="icon" variant="ghost" className="h-8 w-8 p-0" onClick={() => setViewRow(row)} title="View details">
            <Eye className="h-4 w-4 text-blue-600" />
          </Button>
        ),
      },
    };

    const allShipmentColumns = [
      baseColumns.serviceType,
      baseColumns.productType,
      baseColumns.cost,
      baseColumns.tracking,
      baseColumns.receiver,
      baseColumns.departureDateOrigin,
      baseColumns.arrivalDateDestination,
      baseColumns.airwayBill,
      baseColumns.wt,
      baseColumns.cbm,
      baseColumns.shippingFee,
      baseColumns.status,
      baseColumns.action,
    ];

    return scope === "agent" ? [baseColumns.client, ...allShipmentColumns] : allShipmentColumns;
  }, [formatAmount, getResolvedConsolidationShipments, scope]);

  const loading = isLoading || isLoadingConsolidations;

  return (
    <>
      {loading ? (
        <p className="text-sm text-muted-foreground p-4">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
          Loading shipments...
        </p>
      ) : (
        <div className="overflow-x-auto" data-table-export-ignore="true">
          <table className="w-full text-sm" data-portal-export={`${scope}-all_shipments`}>
            <thead>
              <tr className="border-b bg-muted/50">
                {columns.map((column) => (
                  <th key={column.key} className="text-left p-3 font-medium text-muted-foreground">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allShipmentDisplayRows.map((row) => (
                <tr key={`${row.rowType}-${row.id}`} className="border-b hover:bg-muted/30 transition-colors">
                  {columns.map((column) => (
                    <td key={`${row.id}-${column.key}`} className="p-3">
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
              {allShipmentDisplayRows.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="p-8 text-center text-muted-foreground">
                    No shipments found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!viewRow} onOpenChange={(open) => !open && setViewRow(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Shipment Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {viewRow && (
              <div className="rounded-lg border bg-slate-50 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-slate-900">
                    {viewRow.rowType === "consolidation" ? "Consolidated Shipment" : "Single Shipment"}: {viewRow.code}
                  </h3>
                  <Badge variant="outline" className="bg-white">
                    {statusLabel[viewRow.status] || viewRow.status}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <p className="text-muted-foreground font-medium">
                    Shipment Tracking:{" "}
                    <span className="font-mono text-slate-900">
                      {viewRow.rowType === "consolidation"
                        ? resolveTrackingByStatus(viewRow.status, viewRow.sourceConsolidation?.notes || null, viewRow.sourceConsolidation?.tracking_code) || "Pending"
                        : resolveTrackingByStatus(viewRow.status, viewRow.sourceShipment?.notes || null, viewRow.sourceShipment?.custom_tracking_number) || "Pending"}
                    </span>
                  </p>
                  <p className="text-muted-foreground font-medium">
                    AWB/BL No.:{" "}
                    <span className="font-mono text-slate-900">
                      {viewRow.rowType === "consolidation"
                        ? getAirwayBillNumber(viewRow.sourceConsolidation?.notes || null) || "-"
                        : getAirwayBillNumber(viewRow.sourceShipment?.notes || null) || "-"}
                    </span>
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-slate-700 px-1">Individual Parcel Items</h4>
              {viewRows.map((shipment) => {
                const parsedPrice = Number(getUnitPrice(shipment));
                const itemCost = !Number.isNaN(parsedPrice)
                  ? parsedPrice
                  : shipment.total_cost || shipment.shipping_cost || 0;
                return (
                  <div key={shipment.id} className="rounded-md border p-3 space-y-1 text-sm">
                    <p className="font-semibold">{shipment.description || shipment.code}</p>
                    <p className="text-xs font-mono text-muted-foreground">
                      Tracking: {shipment.custom_tracking_number || "-"} | AWB/BL No.: {getAirwayBillNumber(shipment.notes) || "-"}
                    </p>
                    {scope === "agent" ? (
                      <p className="text-xs text-muted-foreground">
                        Receiver: {shipment.receiver?.full_name || "-"} | {shipment.receiver?.phone || "-"} | {shipment.receiver?.address || "-"}
                      </p>
                    ) : null}
                    <p>
                      Service: {formatServiceType(shipment.service_type)}
                      {" | "}
                      Qty: {shipment.quantity || 1}
                      {" | "}
                      Weight: {(shipment.weight || 0).toFixed(2)} kg
                      {" | "}
                      CBM: {(getShipmentCbmValue(shipment) || 0).toFixed(4)}
                      {" | "}
                      Dimensions: {formatDims(shipment.length ?? null, shipment.width ?? null, shipment.height ?? null)}
                    </p>
                    <p>
                      Item Cost: {formatAmount(itemCost)} | Shipping Fee: {formatAmount(shipment.shipping_cost || 0)}
                    </p>
                  </div>
                );
              })}
              {viewRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No shipment details found.</p>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewRow(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
