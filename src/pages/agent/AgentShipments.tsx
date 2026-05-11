import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useDefaultCurrency } from "@/hooks/useDefaultCurrency";
import { useAuthContext } from "@/components/auth/AuthContext";
import {
  getShipmentCbmValue,
  getTransitStatusMessage,
  resolveStoredCollectedByValue,
  upsertNoteValue,
  getWarehouseTrackingNumber,
  resolveTrackingByParcelTab,
  resolveTrackingByStatus,
} from "@/lib/shipmentNotes";
import { replaceConsolidationShipmentLinks } from "@/lib/consolidationLinks";
import { getPortalShipmentWorkflowStatus, isSingleHandlingMethod } from "@/lib/parcelWorkflow";
import { exportHtmlTableToExcel, exportHtmlTableToPdf } from "@/lib/tableExport";
import { toast } from "sonner";
import { Eye, Loader2, Package, Pencil, QrCode, Trash2, FileText, FileSpreadsheet, Check, Users } from "lucide-react";
import { notifyConsolidation, notifyStatusChange } from "@/lib/notifications";

type ShipmentRow = {
  id: string;
  code: string;
  status: string;
  created_at: string;
  updated_at: string;
  estimated_delivery_date: string | null;
  collected_at: string | null;
  collected_by: string | null;
  total_cost: number;
  shipping_cost: number;
  payment_status: string | null;
  service_type: string;
  description: string | null;
  notes: string | null;
  custom_tracking_number: string | null;
  weight: number;
  length: number | null;
  width: number | null;
  height: number | null;
  cbm: number | null;
  quantity: number | null;
  handling_method: string | null;
  consolidation_id?: string | null;
  customer?: { id: string; full_name: string; code: string } | null;
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
  customer?: { id: string; full_name: string; code: string } | null;
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
  shipping_cost: number;
  payment_status: string | null;
  weight: number;
  length: number | null;
  width: number | null;
  height: number | null;
  cbm: number | null;
  quantity: number | null;
  handling_method: string | null;
  consolidation_id?: string | null;
  customer_name: string;
  customer_code: string;
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
  payment_status?: string | null;
  receiver?: { full_name: string | null; phone: string | null; address: string | null } | null;
};

const tabDefs = [
  { key: "all", label: "All Parcels" },
  { key: "all_shipments", label: "All Shipments" },
  { key: "created", label: "Created" },
  { key: "incoming", label: "Incoming" },
  { key: "need_action", label: "Need Action" },
  { key: "submitted", label: "Submitted" },
  { key: "confirm", label: "Confirm Shipment" },
  { key: "outgoing", label: "Outgoing Parcel" },
  { key: "intransit", label: "In Transit" },
  { key: "arrived", label: "Ready for Collection" },
  { key: "collected", label: "Collected" },
  { key: "unpaid", label: "Unpaid" },
  { key: "paid", label: "Paid" },
] as const;

type TabKey = (typeof tabDefs)[number]["key"];

const isValidTab = (value: string | null): value is TabKey =>
  !!value && tabDefs.some((tab) => tab.key === value);
const legacyTabAliases: Record<string, TabKey> = {
  offer: "confirm",
  offers: "confirm",
};
const resolveTabKey = (value: string | null): TabKey | null => {
  if (isValidTab(value)) return value;
  if (!value) return null;
  return legacyTabAliases[value.toLowerCase().trim()] || null;
};
const normalizeShipmentStatus = (status: string) => {
  const normalized = (status || "").toLowerCase().trim();
  const aliasMap: Record<string, string> = {
    created: "saved_pickup",
    incoming: "saved_dropoff",
    need_action: "received",
    submitted: "requested_pickup",
    confirmed: "approved",
    confirm_shipment: "approved",
    outgoing: "assigned",
    in_transit: "supplied",
    arrived: "delivered",
    collected: "closed",
  };

  return aliasMap[normalized] || normalized;
};
const shipmentStageStatuses = new Set([
  "assigned",
  "supplied",
  "delivered",
  "closed",
  "returned",
  "returned_stock",
  "returned_delivered",
]);
const isShipmentStageStatus = (status: string) =>
  shipmentStageStatuses.has(normalizeShipmentStatus(status));

const formatServiceType = (type: string) => {
  const normalized = (type || "").toLowerCase().trim();
  if (normalized === "air" || normalized === "air_freight" || normalized === "air freight") return "Air Freight";
  if (normalized === "sea" || normalized === "sea_freight" || normalized === "sea freight") return "Sea Freight";
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

const formatDateTimeCell = (value: string | null | undefined) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString();
};

const getLatestEstimatedDeliveryDate = (
  values: Array<string | null | undefined>
) => {
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

const hasReachedWarehouse = (status: string) => {
  const normalized = normalizeShipmentStatus(status);
  return ["received", "requested_pickup", "approved", "assigned", "supplied", "delivered", "closed"].includes(normalized);
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

const extractNoteValue = (notes: string | null, label: string) => {
  if (!notes) return null;
  const match = notes.match(new RegExp(`${label}:\\s*([^|]+)`));
  return match ? match[1].trim() : null;
};

const formatCollectedByValue = (name: string | null | undefined, phone: string | null | undefined) => {
  const normalizedName = (name || "").trim();
  const normalizedPhone = (phone || "").trim();
  const safeName = normalizedName && normalizedName !== "-" ? normalizedName : "";
  const safePhone = normalizedPhone && normalizedPhone !== "-" ? normalizedPhone : "";

  if (safeName && safePhone) return `${safeName} (${safePhone})`;
  return safeName || safePhone || null;
};

const getProductType = (shipment: ShipmentRow) => extractNoteValue(shipment.notes, "Product type") || "-";
const getItemLabel = (shipment: ShipmentRow) => extractNoteValue(shipment.notes, "Item") || shipment.description || "-";
const getUnitPrice = (shipment: { notes: string | null }) => extractNoteValue(shipment.notes, "Price");

const getItemCostAmount = (shipment: { notes: string | null; total_cost: number | null }) => {
  const notePrice = getUnitPrice(shipment);
  if (notePrice) {
    const parsed = Number(notePrice);
    if (!Number.isNaN(parsed) && parsed >= 0) return parsed;
  }
  return shipment.total_cost || 0;
};

const appendUniqueNote = (notes: string | null, entry: string) => {
  const parts = (notes || "")
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
  const exists = parts.some((part) => part.toLowerCase() === entry.toLowerCase());
  if (!exists) {
    parts.push(entry);
  }
  return parts.join(" | ");
};

const toInputNumber = (value: number | null | undefined, fallback = "") =>
  value === null || value === undefined || value === 0 ? fallback : String(value);

const parseOptionalNumberInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const getAirwayBillNumber = (notes: string | null) =>
  extractNoteValue(notes, "AWB/BL No.") ||
  extractNoteValue(notes, "Airway Bill") ||
  extractNoteValue(notes, "Bill of Lading") ||
  null;

const normalizeConsolidationStatus = (status: string) => {
  const normalized = (status || "").toLowerCase().trim();
  if (normalized === "pending" || normalized === "requested" || normalized === "submitted") return "submitted";
  if (normalized === "processed" || normalized === "completed" || normalized === "confirmed") return "confirmed";
  if (normalized === "outgoing" || normalized === "assigned") return "outgoing";
  if (normalized === "in_transit" || normalized === "intransit" || normalized === "supplied") return "in_transit";
  if (normalized === "arrived" || normalized === "delivered") return "arrived";
  if (normalized === "collected" || normalized === "closed") return "collected";
  return normalized || "submitted";
};

const isMissingConsolidationTotalsError = (error: { code?: string; message?: string } | null) =>
  !!error &&
  (error.code === "42703" ||
    /item_count|total_weight|total_cbm|total_cost|tracking_code/i.test(error.message || ""));

const consolidationStatusToShipmentStatus: Record<string, string> = {
  submitted: "requested_pickup",
  confirmed: "approved",
  outgoing: "assigned",
  in_transit: "supplied",
  arrived: "delivered",
  collected: "closed",
};

const getConsolidationShipments = (row: ConsolidationRow) =>
  (row.consolidation_shipments || []).map((item) => item.shipment).filter(Boolean) as ConsolidationShipmentDetails[];

const filterUnifiedRows = (rows: UnifiedDashboardRow[], tab: TabKey) => {
  switch (tab) {
    case "all":
      // Show only "Parcels" (Created, Incoming, Need Action)
      return rows.filter((row) =>
        row.rowType === "shipment" &&
        ["saved_pickup", "saved_dropoff", "received"].includes(normalizeShipmentStatus(row.status))
      );
    case "all_shipments":
      // Show only "Shipments" (Submitted and onwards)
      return rows.filter(
        (row) =>
          !["saved_pickup", "saved_dropoff", "received"].includes(normalizeShipmentStatus(row.status)) &&
          isShipmentStageStatus(row.status) &&
          (row.rowType === "consolidation" || (row.rowType === "shipment" && isSingleHandlingMethod(row)))
      );
    case "created":
      return rows.filter((row) => row.rowType === "shipment" && row.status === "saved_pickup");
    case "incoming":
      return rows.filter((row) => row.rowType === "shipment" && row.status === "saved_dropoff");
    case "need_action":
      return rows.filter((row) => row.rowType === "shipment" && row.status === "received");
    case "submitted":
      return rows.filter(
        (row) =>
          row.status === "requested_pickup" &&
          (row.rowType === "consolidation" || (row.rowType === "shipment" && isSingleHandlingMethod(row)))
      );
    case "confirm":
      return rows.filter(
        (row) =>
          row.status === "approved" &&
          (row.rowType === "consolidation" || (row.rowType === "shipment" && isSingleHandlingMethod(row)))
      );
    case "outgoing":
      return rows.filter(
        (row) =>
          row.status === "assigned" &&
          (row.rowType === "consolidation" || (row.rowType === "shipment" && isSingleHandlingMethod(row)))
      );
    case "intransit":
      return rows.filter(
        (row) =>
          row.status === "supplied" &&
          (row.rowType === "consolidation" || (row.rowType === "shipment" && isSingleHandlingMethod(row)))
      );
    case "arrived":
      return rows.filter(
        (row) =>
          row.status === "delivered" &&
          (row.rowType === "consolidation" || (row.rowType === "shipment" && isSingleHandlingMethod(row)))
      );
    case "collected":
      return rows.filter(
        (row) =>
          row.status === "closed" &&
          (row.rowType === "consolidation" || (row.rowType === "shipment" && isSingleHandlingMethod(row)))
      );
    case "unpaid":
      return rows.filter((row) => row.payment_status !== "completed");
    case "paid":
      return rows.filter((row) => row.payment_status === "completed");
    default:
      return rows;
  }
};

const getUnifiedDashboardRowSelectionKey = (row: UnifiedDashboardRow) => `${row.rowType}:${row.id}`;

const AgentShipments = () => {
  const { user } = useAuthContext();
  const { formatAmount } = useDefaultCurrency();
  const [searchParams, setSearchParams] = useSearchParams();
  const [shipments, setShipments] = useState<ShipmentRow[]>([]);
  const [consolidations, setConsolidations] = useState<ConsolidationRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingConsolidations, setIsLoadingConsolidations] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    const tab = searchParams.get("tab");
    return resolveTabKey(tab) ?? "all";
  });
  const [isUpdatingId, setIsUpdatingId] = useState<string | null>(null);
  const [isUpdatingConsolidationId, setIsUpdatingConsolidationId] = useState<string | null>(null);
  const [selectedNeedActionIds, setSelectedNeedActionIds] = useState<Set<string>>(new Set());
  const [selectedSubmittedIds, setSelectedSubmittedIds] = useState<Set<string>>(new Set());
  const [selectedConfirmRowKeys, setSelectedConfirmRowKeys] = useState<Set<string>>(new Set());
  const [activeBulkAction, setActiveBulkAction] = useState<string | null>(null);
  const [viewRow, setViewRow] = useState<UnifiedDashboardRow | null>(null);
  const [agentCustomerIds, setAgentCustomerIds] = useState<string[]>([]);
  const [editingShipment, setEditingShipment] = useState<ShipmentRow | null>(null);
  const [isSavingSubmittedEdit, setIsSavingSubmittedEdit] = useState(false);
  const [removingSubmittedShipmentId, setRemovingSubmittedShipmentId] = useState<string | null>(null);
  const [selectedConsolidationRemovalIds, setSelectedConsolidationRemovalIds] = useState<Set<string>>(new Set());
  const [isSavingConsolidationRemoval, setIsSavingConsolidationRemoval] = useState(false);
  const [submittedEditForm, setSubmittedEditForm] = useState({
    productType: "",
    item: "",
    quantity: "1",
    unitPrice: "",
    weight: "",
    length: "",
    width: "",
    height: "",
    trackingNumber: "",
    serviceType: "air",
    receiverName: "",
    receiverPhone: "",
    receiverAddress: "",
  });
  const [refreshCount, setRefreshCount] = useState(0);

  // Fetch agent's customers
  useEffect(() => {
    const fetchAgentCustomers = async () => {
      if (!user?.id) return;
      const { data: agentData } = await supabase
        .from("customers")
        .select("id")
        .eq("agent_id", user.id);

      if (agentData) {
        setAgentCustomerIds(agentData.map((c) => c.id));
      }
    };
    fetchAgentCustomers();
  }, [user?.id]);

  // Fetch shipments for agent's customers
  useEffect(() => {
    const fetchShipments = async () => {
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

    if (agentCustomerIds.length > 0) {
      fetchShipments();
    } else {
      setIsLoading(false);
    }
  }, [agentCustomerIds, refreshCount]);

  // Fetch consolidations for agent's customers
  useEffect(() => {
    const fetchConsolidations = async () => {
      if (agentCustomerIds.length === 0) {
        setConsolidations([]);
        setIsLoadingConsolidations(false);
        return;
      }

      const { data, error } = await supabase
        .from("consolidations")
        .select(`
          id, code, status, tracking_code, notes, item_count, total_weight, total_cbm, total_cost, created_at, collected_at, collected_by,
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
        `)
        .in("customer_id", agentCustomerIds)
        .order("created_at", { ascending: false });

      if (error && isMissingConsolidationTotalsError(error as { code?: string; message?: string })) {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("consolidations")
          .select(`
            id, code, status, notes, created_at, collected_at, collected_by,
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
          `)
          .in("customer_id", agentCustomerIds)
          .order("created_at", { ascending: false });

        if (!fallbackError && fallbackData) {
          const normalized = fallbackData.map((row: any) => ({
            ...row,
            tracking_code: null,
            item_count: null,
            total_weight: null,
            total_cbm: null,
            total_cost: null,
          }));
          setConsolidations(normalized as ConsolidationRow[]);
        } else {
          toast.error("Failed to load consolidation requests.");
          setConsolidations([]);
        }
      } else if (!error && data) {
        setConsolidations(data as unknown as ConsolidationRow[]);
      } else {
        toast.error("Failed to load consolidation requests.");
        setConsolidations([]);
      }
      setIsLoadingConsolidations(false);
    };

    if (agentCustomerIds.length > 0) {
      fetchConsolidations();
    } else {
      setIsLoadingConsolidations(false);
    }
  }, [agentCustomerIds, refreshCount]);

  useEffect(() => {
    const channel = supabase
      .channel("agent-shipments-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "shipments" }, () => setRefreshCount(c => c + 1))
      .on("postgres_changes", { event: "*", schema: "public", table: "consolidations" }, () => setRefreshCount(c => c + 1))
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const tab = searchParams.get("tab");
    const resolvedTab = resolveTabKey(tab);
    if (resolvedTab) setActiveTab(resolvedTab);
  }, [searchParams]);

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    if (tab === "all") {
      setSearchParams({});
      return;
    }
    setSearchParams({ tab });
  };

  const normalizedShipments = useMemo(
    () => shipments.map((shipment) => ({ ...shipment, status: normalizeShipmentStatus(shipment.status) })),
    [shipments]
  );

  const visibleShipments = useMemo(
    () => normalizedShipments.filter((row) => !row.consolidation_id),
    [normalizedShipments]
  );

  const workflowShipments = useMemo(
    () =>
      visibleShipments.map((shipment) => ({
        id: shipment.id,
        status: normalizeShipmentStatus(shipment.status),
        service_type: shipment.service_type,
        customer_id: shipment.customer?.id || null,
        notes: shipment.notes,
      })),
    [visibleShipments]
  );

  const allWorkflowShipments = useMemo(
    () =>
      normalizedShipments.map((shipment) => ({
        id: shipment.id,
        status: normalizeShipmentStatus(shipment.status),
        service_type: shipment.service_type,
        customer_id: shipment.customer?.id || null,
        notes: shipment.notes,
      })),
    [normalizedShipments]
  );

  const getWorkflowStatus = useCallback(
    (
      shipment: ShipmentRow,
      workflowRows: Array<{
        id: string;
        status: string;
        service_type: string;
        customer_id: string | null;
      }>,
    ) =>
      getPortalShipmentWorkflowStatus(
        {
          id: shipment.id,
          status: shipment.status,
          service_type: shipment.service_type,
          customer_id: shipment.customer?.id || null,
          notes: shipment.notes,
          ...(shipment as any).handling_method !== undefined
            ? { handling_method: (shipment as any).handling_method }
            : {},
        } as any,
        workflowRows,
      ),
    []
  );

  const getDisplayWorkflowStatus = useCallback(
    (shipment: ShipmentRow) => getWorkflowStatus(shipment, workflowShipments),
    [getWorkflowStatus, workflowShipments]
  );

  const shipmentsById = useMemo(() => {
    const map = new Map<string, ShipmentRow>();
    normalizedShipments.forEach((s) => map.set(s.id, s));
    return map;
  }, [normalizedShipments]);

  const getResolvedConsolidationShipments = useCallback(
    (row: ConsolidationRow): ConsolidationShipmentDetails[] => {
      const merged = new Map<string, ConsolidationShipmentDetails>();
      getConsolidationShipments(row).forEach((s) => merged.set(s.id, s));

      (row.consolidation_shipments || []).forEach((entry) => {
        if (merged.has(entry.shipment_id)) return;
        const fallback = shipmentsById.get(entry.shipment_id);
        if (fallback) {
          merged.set(entry.shipment_id, {
            id: fallback.id, code: fallback.code, description: fallback.description, notes: fallback.notes,
            service_type: fallback.service_type, custom_tracking_number: fallback.custom_tracking_number,
            estimated_delivery_date: fallback.estimated_delivery_date,
            quantity: fallback.quantity, weight: fallback.weight, cbm: fallback.cbm, length: fallback.length,
            width: fallback.width, height: fallback.height, total_cost: fallback.total_cost, shipping_cost: fallback.shipping_cost,
            payment_status: fallback.payment_status, receiver: fallback.receiver,
          });
        }
      });
      return Array.from(merged.values());
    },
    [shipmentsById]
  );

  const mapShipmentToUnifiedRow = useCallback(
    (shipment: ShipmentRow, status: string): UnifiedDashboardRow => ({
      id: shipment.id,
      rowType: "shipment",
      code: shipment.code,
      status,
      created_at: shipment.created_at,
      service_type: shipment.service_type,
      description: shipment.description,
      notes: shipment.notes,
      custom_tracking_number: shipment.custom_tracking_number,
      airway_bill_number: getAirwayBillNumber(shipment.notes),
      estimated_delivery_date: shipment.estimated_delivery_date,
      total_cost: shipment.total_cost || 0,
      shipping_cost: shipment.shipping_cost || 0,
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
    []
  );

  const shipmentDisplayRows = useMemo<UnifiedDashboardRow[]>(
    () =>
      visibleShipments.map((shipment) =>
        mapShipmentToUnifiedRow(shipment, getDisplayWorkflowStatus(shipment))
      ),
    [getDisplayWorkflowStatus, visibleShipments, mapShipmentToUnifiedRow]
  );

  const allParcelDisplayRows = useMemo<UnifiedDashboardRow[]>(
    () =>
      normalizedShipments.map((shipment) =>
        mapShipmentToUnifiedRow(shipment, getWorkflowStatus(shipment, allWorkflowShipments))
      ),
    [allWorkflowShipments, getWorkflowStatus, mapShipmentToUnifiedRow, normalizedShipments]
  );

  const consolidationDisplayRows = useMemo<UnifiedDashboardRow[]>(
    () =>
      consolidations.map((consolidation) => {
        const normalizedStatus = normalizeConsolidationStatus(consolidation.status);
        const mappedShipmentStatus = consolidationStatusToShipmentStatus[normalizedStatus] || "requested_pickup";
        const shipmentsInConsolidation = getResolvedConsolidationShipments(consolidation);
        const distinctServiceTypes = Array.from(
          new Set(shipmentsInConsolidation.map((s) => (s.service_type || "").toLowerCase().trim()).filter(Boolean))
        );
        const consolidationServiceType = distinctServiceTypes.length === 1 ? distinctServiceTypes[0] : distinctServiceTypes.length > 1 ? "mixed" : "";
        const isMixedConsolidation = shipmentsInConsolidation.length > 1;
        const consolidatedItemCost = shipmentsInConsolidation.reduce((sum, s) => sum + getItemCostAmount(s), 0);
        const consolidatedShippingFee = consolidation.total_cost ?? shipmentsInConsolidation.reduce((sum, s) => sum + (s.shipping_cost || 0), 0);
        const consolidatedWeight = consolidation.total_weight ?? shipmentsInConsolidation.reduce((sum, s) => sum + (s.weight || 0), 0);
        const consolidatedCbm =
          consolidation.total_cbm ??
          shipmentsInConsolidation.reduce((sum, s) => sum + (getShipmentCbmValue(s) || 0), 0);
        const consolidatedPaymentStatus =
          shipmentsInConsolidation.length === 0
            ? null
            : shipmentsInConsolidation.every((s) => s.payment_status === "completed")
              ? "completed"
              : "pending";
        const estimatedDeliveryDate = getLatestEstimatedDeliveryDate(
          shipmentsInConsolidation.map((shipment) => shipment.estimated_delivery_date)
        );

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
          custom_tracking_number: consolidation.tracking_code || "",
          airway_bill_number: getAirwayBillNumber(consolidation.notes),
          estimated_delivery_date: estimatedDeliveryDate,
          total_cost: consolidatedItemCost,
          shipping_cost: consolidatedShippingFee,
          payment_status: consolidatedPaymentStatus,
          weight: consolidatedWeight,
          length: null,
          width: null,
          height: null,
          cbm: consolidatedCbm,
          quantity: consolidation.item_count ?? shipmentsInConsolidation.reduce((sum, s) => sum + (s.quantity || 1), 0),
          customer_name: consolidation.customer?.full_name || "Client",
          customer_code: consolidation.customer?.code || "-",
          handling_method: "consolidated",
          sourceConsolidation: consolidation,
        };
      }),
    [consolidations, getResolvedConsolidationShipments]
  );

  const unifiedRows = useMemo(
    () => [...shipmentDisplayRows, ...consolidationDisplayRows],
    [shipmentDisplayRows, consolidationDisplayRows]
  );

  const allShipmentDisplayRows = useMemo(
    () => filterUnifiedRows(unifiedRows, "all_shipments"),
    [unifiedRows]
  );

  const needActionUnifiedRows = useMemo(
    () =>
      allParcelDisplayRows.filter(
        (row) => row.rowType === "shipment" && normalizeShipmentStatus(row.status) === "received" && !!row.sourceShipment,
      ),
    [allParcelDisplayRows],
  );

  const needActionRows = useMemo(
    () => needActionUnifiedRows.map((row) => row.sourceShipment).filter(Boolean) as ShipmentRow[],
    [needActionUnifiedRows]
  );
  const submittedShipmentRows = useMemo(
    () =>
      filterUnifiedRows(unifiedRows, "submitted").filter(
        (row) => (row.rowType === "shipment" && !!row.sourceShipment) || row.rowType === "consolidation",
      ),
    [unifiedRows],
  );
  const confirmRows = useMemo(
    () => filterUnifiedRows(unifiedRows, "confirm"),
    [unifiedRows],
  );

  useEffect(() => {
    setSelectedNeedActionIds((prev) => {
      const validIds = new Set(needActionRows.map((row) => row.id));
      const next = new Set<string>();
      prev.forEach((id) => {
        if (validIds.has(id)) next.add(id);
      });
      return next;
    });
  }, [needActionRows]);

  useEffect(() => {
    setSelectedSubmittedIds((prev) => {
      const validIds = new Set(submittedShipmentRows.map((row) => row.id));
      const next = new Set<string>();
      prev.forEach((id) => {
        if (validIds.has(id)) next.add(id);
      });
      return next;
    });
  }, [submittedShipmentRows]);

  useEffect(() => {
    setSelectedConfirmRowKeys((prev) => {
      const validKeys = new Set(confirmRows.map((row) => getUnifiedDashboardRowSelectionKey(row)));
      const next = new Set<string>();
      prev.forEach((key) => {
        if (validKeys.has(key)) next.add(key);
      });
      return next;
    });
  }, [confirmRows]);

  const toggleNeedActionSelection = (shipmentId: string, checked: boolean) => {
    setSelectedNeedActionIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(shipmentId);
      } else {
        next.delete(shipmentId);
      }
      return next;
    });
  };

  const handleSelectAllNeedAction = (checked: boolean) => {
    if (checked) {
      setSelectedNeedActionIds(new Set(needActionRows.map((row) => row.id)));
      return;
    }
    setSelectedNeedActionIds(new Set());
  };

  const toggleSubmittedSelection = (shipmentId: string, checked: boolean) => {
    setSelectedSubmittedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(shipmentId);
      } else {
        next.delete(shipmentId);
      }
      return next;
    });
  };

  const handleSelectAllSubmitted = (checked: boolean) => {
    if (checked) {
      setSelectedSubmittedIds(new Set(submittedShipmentRows.map((row) => row.id)));
      return;
    }
    setSelectedSubmittedIds(new Set());
  };

  const toggleConfirmSelection = (row: UnifiedDashboardRow, checked: boolean) => {
    const rowKey = getUnifiedDashboardRowSelectionKey(row);
    setSelectedConfirmRowKeys((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(rowKey);
      } else {
        next.delete(rowKey);
      }
      return next;
    });
  };

  const handleSelectAllConfirm = (checked: boolean) => {
    if (checked) {
      setSelectedConfirmRowKeys(
        new Set(confirmRows.map((row) => getUnifiedDashboardRowSelectionKey(row))),
      );
      return;
    }
    setSelectedConfirmRowKeys(new Set());
  };

  const handleSubmitConsolidation = async () => {
    const selectedShipments = needActionRows.filter((row) => selectedNeedActionIds.has(row.id));
    if (selectedShipments.length === 0) {
      toast.error("Select at least one parcel to consolidate.");
      return;
    }

    const customerIds = Array.from(
      new Set(selectedShipments.map((shipment) => shipment.customer?.id).filter(Boolean)),
    ) as string[];

    if (customerIds.length !== 1) {
      toast.error("Select parcels for one client at a time.");
      return;
    }

    const customerId = customerIds[0];
    const customerName = selectedShipments[0]?.customer?.full_name || "Client";
    setIsUpdatingConsolidationId("create");

    const code = `CON-${Date.now().toString(36).toUpperCase()}`;
    const note = `Agent requested consolidation for ${customerName} (${selectedShipments.length} parcel(s)).`;
    const totalWeight = selectedShipments.reduce((sum, row) => sum + (row.weight || 0), 0);
    const totalCost = selectedShipments.reduce(
      (sum, row) => sum + (row.total_cost || row.shipping_cost || 0),
      0,
    );

    let consolidation: { id: string } | null = null;
    let consolidationError: { code?: string; message?: string } | null = null;

    const withTotalsInsert = await supabase
      .from("consolidations")
      .insert({
        code,
        customer_id: customerId,
        status: "submitted",
        notes: note,
        item_count: selectedShipments.length,
        total_weight: totalWeight,
        total_cost: totalCost,
        created_by: user?.id ?? null,
      })
      .select("id")
      .single();

    consolidation = withTotalsInsert.data as { id: string } | null;
    consolidationError = withTotalsInsert.error as { code?: string; message?: string } | null;

    if (consolidationError && isMissingConsolidationTotalsError(consolidationError)) {
      const fallbackInsert = await supabase
        .from("consolidations")
        .insert({
          code,
          customer_id: customerId,
          status: "submitted",
          notes: note,
          created_by: user?.id ?? null,
        })
        .select("id")
        .single();

      consolidation = fallbackInsert.data as { id: string } | null;
      consolidationError = fallbackInsert.error as { code?: string; message?: string } | null;
    }

    if (consolidationError || !consolidation) {
      toast.error(consolidationError?.message || "Failed to create consolidation request.");
      setIsUpdatingConsolidationId(null);
      return;
    }

    const { error: linksError } = await replaceConsolidationShipmentLinks(
      consolidation.id,
      selectedShipments.map((row) => row.id),
    );

    if (linksError) {
      toast.error(linksError.message || "Failed to submit selected parcels.");
      setIsUpdatingConsolidationId(null);
      return;
    }

    const selectedIds = new Set(selectedShipments.map((row) => row.id));
    setShipments((prev) =>
      prev.map((row) =>
        selectedIds.has(row.id)
          ? {
            ...row,
            consolidation_id: consolidation.id,
            status: "requested_pickup",
            notes: appendUniqueNote(
              appendUniqueNote(row.notes, "Agent action: consolidation requested"),
              `Consolidation: ${code}`,
            ),
          }
          : row,
      ),
    );

    setConsolidations((prev) => [
      {
        id: consolidation.id,
        code,
        status: "submitted",
        tracking_code: null,
        notes: note,
        item_count: selectedShipments.length,
        total_weight: totalWeight,
        total_cbm: selectedShipments.reduce((sum, row) => sum + (row.cbm || 0), 0),
        total_cost: selectedShipments.reduce((sum, row) => sum + (row.shipping_cost || 0), 0),
        created_at: new Date().toISOString(),
        collected_at: null,
        collected_by: null,
        consolidation_shipments: selectedShipments.map((shipment) => ({
          shipment_id: shipment.id,
          shipment: {
            id: shipment.id,
            code: shipment.code,
            description: shipment.description,
            notes: shipment.notes,
            service_type: shipment.service_type,
            custom_tracking_number: shipment.custom_tracking_number,
            estimated_delivery_date: shipment.estimated_delivery_date,
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
          },
        })),
        customer: selectedShipments[0]?.customer || null,
      },
      ...prev,
    ]);

    setSelectedNeedActionIds(new Set());
    setIsUpdatingConsolidationId(null);
    toast.success("Consolidation submitted to warehouse.");

    // Notify customer about successful consolidation (Need Action → Submitted)
    notifyStatusChange(customerId, code, consolidation.id, "requested_pickup", { handlingMethod: "consolidated" })
      .catch((err) => console.error("notifyStatusChange (consolidate) failed:", err));

    handleTabChange("submitted");
  };

  const openSubmittedEditDialog = (shipment: ShipmentRow) => {
    setEditingShipment(shipment);
    setSubmittedEditForm({
      productType: extractNoteValue(shipment.notes, "Product type") || "",
      item: extractNoteValue(shipment.notes, "Item") || shipment.description || "",
      quantity: String(shipment.quantity || 1),
      unitPrice: getUnitPrice(shipment) || "",
      weight: toInputNumber(shipment.weight),
      length: toInputNumber(shipment.length),
      width: toInputNumber(shipment.width),
      height: toInputNumber(shipment.height),
      trackingNumber: shipment.custom_tracking_number || "",
      serviceType: shipment.service_type || "air",
      receiverName: shipment.receiver?.full_name || "",
      receiverPhone: shipment.receiver?.phone || "",
      receiverAddress: shipment.receiver?.address || "",
    });
  };

  const handleSaveSubmittedEdit = async () => {
    if (!editingShipment) return;

    const parsedQuantity = Number(submittedEditForm.quantity);
    const parsedUnitPrice = parseOptionalNumberInput(submittedEditForm.unitPrice);
    const parsedWeight = parseOptionalNumberInput(submittedEditForm.weight);
    const parsedLength = parseOptionalNumberInput(submittedEditForm.length);
    const parsedWidth = parseOptionalNumberInput(submittedEditForm.width);
    const parsedHeight = parseOptionalNumberInput(submittedEditForm.height);

    if (!Number.isFinite(parsedQuantity) || parsedQuantity < 1) {
      toast.error("Quantity must be at least 1.");
      return;
    }

    if (
      Number.isNaN(parsedUnitPrice) ||
      Number.isNaN(parsedWeight) ||
      Number.isNaN(parsedLength) ||
      Number.isNaN(parsedWidth) ||
      Number.isNaN(parsedHeight)
    ) {
      toast.error("Please enter valid numeric values.");
      return;
    }

    if (
      (parsedUnitPrice !== null && parsedUnitPrice < 0) ||
      (parsedWeight !== null && parsedWeight < 0) ||
      (parsedLength !== null && parsedLength < 0) ||
      (parsedWidth !== null && parsedWidth < 0) ||
      (parsedHeight !== null && parsedHeight < 0)
    ) {
      toast.error("Numeric values cannot be negative.");
      return;
    }

    const nextWeight = parsedWeight ?? editingShipment.weight ?? 0;
    const nextLength = parsedLength;
    const nextWidth = parsedWidth;
    const nextHeight = parsedHeight;

    let nextNotes = editingShipment.notes;
    nextNotes = upsertNoteValue(nextNotes, "Product type", submittedEditForm.productType || null);
    nextNotes = upsertNoteValue(nextNotes, "Item", submittedEditForm.item || null);
    nextNotes = upsertNoteValue(nextNotes, "Quantity", String(parsedQuantity));
    nextNotes = upsertNoteValue(
      nextNotes,
      "Price",
      parsedUnitPrice === null ? null : parsedUnitPrice.toString()
    );
    nextNotes = upsertNoteValue(nextNotes, "Service type", submittedEditForm.serviceType || null);

    const nextDescription = submittedEditForm.item.trim() || editingShipment.description || "";

    setIsSavingSubmittedEdit(true);
    const { error } = await supabase
      .from("shipments")
      .update({
        description: nextDescription,
        quantity: parsedQuantity,
        weight: nextWeight,
        length: nextLength,
        width: nextWidth,
        height: nextHeight,
        notes: nextNotes,
        custom_tracking_number: submittedEditForm.trackingNumber.trim() || null,
        service_type: (submittedEditForm.serviceType || null) as any,
      })
      .eq("id", editingShipment.id);

    if ((editingShipment as any).receiver_id) {
      await supabase
        .from("receivers")
        .update({
          full_name: submittedEditForm.receiverName.trim() || null,
          phone: submittedEditForm.receiverPhone.trim() || null,
          address: submittedEditForm.receiverAddress.trim() || null,
        })
        .eq("id", (editingShipment as any).receiver_id);
    }

    if (error) {
      toast.error(error.message || "Failed to update submitted parcel.");
      setIsSavingSubmittedEdit(false);
      return;
    }

    await supabase.rpc("insert_portal_route_notifications" as any, {
      _portal_id: "warehouse",
      _title: "Parcel updated by agent",
      _message: `Parcel ${editingShipment.code} was updated by agent and requires review.`,
      _route: "route:/warehouse/parcels",
      _reference_id: editingShipment.id,
      _exclude_user_id: user?.id ?? undefined,
      _include_admins: true,
    } as any);

    setShipments((prev) =>
      prev.map((row) =>
        row.id === editingShipment.id
          ? {
            ...row,
            description: nextDescription,
            quantity: parsedQuantity,
            weight: nextWeight,
            length: nextLength,
            width: nextWidth,
            height: nextHeight,
            notes: nextNotes,
            custom_tracking_number: submittedEditForm.trackingNumber.trim() || null,
            service_type: submittedEditForm.serviceType || null,
            receiver: {
              full_name: submittedEditForm.receiverName.trim() || null,
              phone: submittedEditForm.receiverPhone.trim() || null,
              address: submittedEditForm.receiverAddress.trim() || null,
            },
          }
          : row
      )
    );

    setConsolidations((prev) =>
      prev.map((row) => ({
        ...row,
        consolidation_shipments: (row.consolidation_shipments || []).map((entry) =>
          entry.shipment_id === editingShipment.id && entry.shipment
            ? {
              ...entry,
              shipment: {
                ...entry.shipment,
                description: nextDescription,
                quantity: parsedQuantity,
                weight: nextWeight,
                length: nextLength,
                width: nextWidth,
                height: nextHeight,
                notes: nextNotes,
              },
            }
            : entry
        ),
      }))
    );

    toast.success("Submitted parcel updated.");
    setIsSavingSubmittedEdit(false);
    setEditingShipment(null);
  };

  const removeSubmittedShipment = async (
    shipment: ShipmentRow,
    options?: { requireConfirmation?: boolean; silent?: boolean },
  ) => {
    if (options?.requireConfirmation !== false) {
      const confirmed = window.confirm("Remove this submitted item?");
      if (!confirmed) return false;
    }

    setRemovingSubmittedShipmentId(shipment.id);
    const { error } = await supabase.rpc(
      "remove_submitted_shipment" as any,
      { p_shipment_id: shipment.id } as any
    );

    if (error) {
      if (!options?.silent) {
        toast.error(error.message || "Failed to remove submitted item.");
      }
      setRemovingSubmittedShipmentId(null);
      return false;
    }

    setShipments((prev) =>
      prev.map((row) =>
        row.id === shipment.id
          ? {
            ...row,
            status: "received",
            consolidation_id: null,
          }
          : row
      )
    );
    setSelectedNeedActionIds((prev) => {
      const next = new Set(prev);
      next.delete(shipment.id);
      return next;
    });
    setSelectedSubmittedIds((prev) => {
      const next = new Set(prev);
      next.delete(shipment.id);
      return next;
    });
    setConsolidations((prev) =>
      prev
        .map((row) => ({
          ...row,
          consolidation_shipments: (row.consolidation_shipments || []).filter(
            (entry) => entry.shipment_id !== shipment.id
          ),
        }))
        .filter((row) => (row.consolidation_shipments || []).length > 0)
    );

    if (!options?.silent) {
      toast.success("Submitted item removed.");
    }
    setRemovingSubmittedShipmentId(null);
    return true;
  };

  const handleRemoveSubmittedShipment = async (shipment: ShipmentRow) => {
    await removeSubmittedShipment(shipment);
  };

  const updateShipmentStatus = async (
    shipmentId: string,
    status: string,
    successMessage: string,
    options?: { silent?: boolean },
  ) => {
    setIsUpdatingId(shipmentId);
    const { error } = await supabase
      .from("shipments")
      .update({ status: status as any })
      .eq("id", shipmentId);

    if (error) {
      if (!options?.silent) {
        toast.error(error.message || "Failed to update shipment.");
      }
      setIsUpdatingId(null);
      return false;
    }

    setShipments((prev) => prev.map((row) => (row.id === shipmentId ? { ...row, status } : row)));

    // Fire approved workflow notification for this transition
    try {
      const updatedRow = shipments.find((r) => r.id === shipmentId);
      const targetCustomerId = (updatedRow as any)?.customer_id || (updatedRow as any)?.customer?.id;
      if (targetCustomerId && updatedRow) {
        const handling = (updatedRow as any).handling_method === "consolidated" ? "consolidated" : "single";
        const tracking = updatedRow.custom_tracking_number || updatedRow.code || null;
        notifyStatusChange(targetCustomerId, tracking, shipmentId, status, { handlingMethod: handling })
          .catch((err) => console.error("notifyStatusChange failed:", err));
      }
    } catch (err) {
      console.error("notifyStatusChange dispatch failed:", err);
    }

    if (!options?.silent) {
      toast.success(successMessage);
    }
    setIsUpdatingId(null);
    return true;
  };

  const shipShipment = async (shipmentId: string, options?: { silent?: boolean; skipTabChange?: boolean }) => {
    const updated = await updateShipmentStatus(
      shipmentId,
      "assigned",
      "Shipment confirmed and queued for dispatch.",
      { silent: options?.silent }
    );
    if (updated && !options?.skipTabChange) {
      handleTabChange("outgoing");
    }
    return updated;
  };

  const handleShip = async (shipmentId: string) => {
    await shipShipment(shipmentId);
  };


  const shipConsolidation = async (
    consolidationId: string,
    options?: { silent?: boolean; skipTabChange?: boolean },
  ) => {
    setIsUpdatingConsolidationId(consolidationId);
    const { error } = await supabase
      .from("consolidations")
      .update({ status: "outgoing" })
      .eq("id", consolidationId);

    if (error) {
      if (!options?.silent) {
        toast.error(error.message || "Failed to approve shipment.");
      }
      setIsUpdatingConsolidationId(null);
      return false;
    }

    setConsolidations((prev) =>
      prev.map((row) =>
        row.id === consolidationId ? { ...row, status: "outgoing" } : row
      )
    );
    if (!options?.silent) {
      toast.success("Shipping approved. Consolidated shipment moved to Outgoing.");
    }
    setIsUpdatingConsolidationId(null);
    if (!options?.skipTabChange) {
      handleTabChange("outgoing");
    }
    return true;
  };

  const handleShipConsolidation = async (consolidationId: string) => {
    await shipConsolidation(consolidationId);
  };

  const handleBulkRemoveSubmitted = async () => {
    const selectedShipments = submittedShipmentRows
      .filter((row) => selectedSubmittedIds.has(row.id))
      .map((row) => row.sourceShipment)
      .filter(Boolean) as ShipmentRow[];

    if (selectedShipments.length === 0) {
      toast.error("Select at least one submitted parcel.");
      return;
    }

    const confirmed = window.confirm(
      `Remove ${selectedShipments.length} submitted item(s)?`,
    );
    if (!confirmed) return;

    setActiveBulkAction("submitted-remove");

    let successCount = 0;
    let failureCount = 0;

    for (const shipment of selectedShipments) {
      const removed = await removeSubmittedShipment(shipment, {
        requireConfirmation: false,
        silent: true,
      });
      if (removed) {
        successCount += 1;
      } else {
        failureCount += 1;
      }
    }

    setActiveBulkAction(null);

    if (successCount === 0) {
      toast.error("No submitted parcels were removed.");
      return;
    }

    setSelectedSubmittedIds(new Set());
    toast.success(
      failureCount > 0
        ? `Removed ${successCount} submitted parcel(s) and skipped ${failureCount}.`
        : `Removed ${successCount} submitted parcel(s).`,
    );
  };

  const handleBulkShipConfirm = async () => {
    const selectedRows = confirmRows.filter((row) =>
      selectedConfirmRowKeys.has(getUnifiedDashboardRowSelectionKey(row)),
    );

    if (selectedRows.length === 0) {
      toast.error("Select at least one confirm shipment row.");
      return;
    }

    setActiveBulkAction("confirm-ship");

    let successCount = 0;
    let failureCount = 0;

    for (const row of selectedRows) {
      const shipped =
        row.rowType === "consolidation" && row.sourceConsolidation
          ? await shipConsolidation(row.sourceConsolidation.id, {
            silent: true,
            skipTabChange: true,
          })
          : await shipShipment(row.id, {
            silent: true,
            skipTabChange: true,
          });

      if (shipped) {
        successCount += 1;
      } else {
        failureCount += 1;
      }
    }

    setActiveBulkAction(null);

    if (successCount === 0) {
      toast.error("No confirm shipments were moved to Outgoing.");
      return;
    }

    setSelectedConfirmRowKeys(new Set());
    handleTabChange("outgoing");
    toast.success(
      failureCount > 0
        ? `Moved ${successCount} shipment(s) to Outgoing and skipped ${failureCount}.`
        : `Moved ${successCount} shipment(s) to Outgoing.`,
    );
  };

  const counts = useMemo(() => {
    const result: Record<string, number> = {};
    tabDefs.forEach((t) => {
      result[t.key] =
        t.key === "all"
          ? allParcelDisplayRows.length
          : t.key === "all_shipments"
            ? allShipmentDisplayRows.length
            : t.key === "need_action"
              ? needActionUnifiedRows.length
              : filterUnifiedRows(unifiedRows, t.key).length;
    });
    return result;
  }, [allParcelDisplayRows, allShipmentDisplayRows, needActionUnifiedRows, unifiedRows]);

  const overviewCards: Array<{ key: TabKey; label: string; value: number; text: string; bg: string }> = [
    { key: "all", label: "All Parcels", value: counts.all, text: "text-slate-600", bg: "bg-slate-100" },
    { key: "all_shipments", label: "All Shipments", value: counts.all_shipments, text: "text-slate-700", bg: "bg-slate-100" },
    { key: "created", label: "Created", value: counts.created, text: "text-amber-600", bg: "bg-amber-50" },
    { key: "incoming", label: "Incoming Parcels", value: counts.incoming, text: "text-blue-600", bg: "bg-blue-50" },
    { key: "need_action", label: "Need Action", value: counts.need_action, text: "text-orange-600", bg: "bg-orange-50" },
    { key: "submitted", label: "Submitted", value: counts.submitted, text: "text-yellow-700", bg: "bg-yellow-50" },
    { key: "confirm", label: "Confirm Shipment", value: counts.confirm, text: "text-purple-600", bg: "bg-purple-50" },
    { key: "outgoing", label: "Outgoing Parcel", value: counts.outgoing, text: "text-indigo-600", bg: "bg-indigo-50" },
    { key: "intransit", label: "In Transit", value: counts.intransit, text: "text-cyan-600", bg: "bg-cyan-50" },
    { key: "arrived", label: "Ready for Collection", value: counts.arrived, text: "text-green-600", bg: "bg-green-50" },
    { key: "collected", label: "Collected", value: counts.collected, text: "text-emerald-700", bg: "bg-emerald-50" },
    { key: "unpaid", label: "Unpaid", value: counts.unpaid, text: "text-red-600", bg: "bg-red-50" },
    { key: "paid", label: "Paid", value: counts.paid, text: "text-green-600", bg: "bg-green-50" },
  ];

  {/* Quick Actions */ }
  const exportActiveTable = (format: "pdf" | "excel") => {
    const table = document.querySelector(
      `table[data-portal-export='agent-${activeTab}']`,
    ) as HTMLTableElement | null;

    if (!table) {
      toast.error("No table available to export.");
      return;
    }

    const fileName = `agent-${activeTab}-shipments`;
    if (format === "pdf") {
      exportHtmlTableToPdf(table, fileName);
      return;
    }
    exportHtmlTableToExcel(table, fileName);
  };

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

  const renderPaymentBadge = (row: UnifiedDashboardRow) => (
    <Badge variant={row.payment_status === "completed" ? "default" : "destructive"} className="text-xs">
      {row.payment_status === "completed" ? "Paid" : "Unpaid"}
    </Badge>
  );

  const renderStatusBadge = (row: UnifiedDashboardRow) => (
    <Badge variant="secondary" className="text-xs">
      {statusLabel[row.status] || row.status}
    </Badge>
  );

  const getRowTransitStatusMessage = (row: UnifiedDashboardRow) => {
    const directMessage = getTransitStatusMessage(row.notes);
    if (directMessage) return directMessage;
    if (row.rowType === "consolidation" && row.sourceConsolidation) {
      const childMessage = getResolvedConsolidationShipments(row.sourceConsolidation)
        .map((s) => getTransitStatusMessage(s.notes))
        .find((m) => !!m);
      if (childMessage) return childMessage;
    }
    return null;
  };

  const getConsolidationProductTypeLabel = (row: UnifiedDashboardRow) => {
    if (row.rowType !== "consolidation") return "-";
    if (row.sourceConsolidation) {
      const noteProductType = extractNoteValue(row.notes, "Product type");
      if (noteProductType) return noteProductType;

      const consolidationShipments = getResolvedConsolidationShipments(row.sourceConsolidation);

      const childProductTypes = Array.from(
        new Set(
          consolidationShipments
            .map((s) => extractNoteValue(s.notes, "Product type"))
            .filter((v): v is string => !!v && v.trim().length > 0)
        )
      );
      if (childProductTypes.length === 1) return childProductTypes[0];
      if (childProductTypes.length > 1) return "Mixed Products";
    }
    return "Mixed Products";
  };

  const viewRows = useMemo<DetailShipmentRow[]>(() => {
    if (!viewRow) return [];
    if (viewRow.rowType === "shipment" && viewRow.sourceShipment) {
      const s = viewRow.sourceShipment;
      return [{
        id: s.id, code: s.code, description: s.description, notes: s.notes, custom_tracking_number: s.custom_tracking_number,
        service_type: s.service_type, quantity: s.quantity, weight: s.weight, cbm: getShipmentCbmValue(s), length: s.length, width: s.width,
        height: s.height, total_cost: s.total_cost, shipping_cost: s.shipping_cost, receiver: s.receiver
      }];
    }
    if (viewRow.rowType === "consolidation" && viewRow.sourceConsolidation) {
      return getResolvedConsolidationShipments(viewRow.sourceConsolidation).map((s) => ({
        id: s.id, code: s.code, description: s.description, notes: s.notes, custom_tracking_number: s.custom_tracking_number,
        service_type: s.service_type, quantity: s.quantity, weight: s.weight, cbm: getShipmentCbmValue(s), length: s.length, width: s.width,
        height: s.height, total_cost: s.total_cost, shipping_cost: s.shipping_cost, receiver: s.receiver,
      }));
    }
    return [];
  }, [getResolvedConsolidationShipments, viewRow]);

  useEffect(() => {
    setSelectedConsolidationRemovalIds(new Set());
  }, [viewRow?.id, viewRow?.rowType]);

  const toggleConsolidationRemovalSelection = (shipmentId: string, checked: boolean) => {
    setSelectedConsolidationRemovalIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(shipmentId);
      } else {
        next.delete(shipmentId);
      }
      return next;
    });
  };

  const handleSaveConsolidationItemRemoval = async () => {
    if (!viewRow || viewRow.rowType !== "consolidation" || selectedConsolidationRemovalIds.size === 0) {
      return;
    }

    const selectedShipments = viewRows.filter((row) => selectedConsolidationRemovalIds.has(row.id));
    if (selectedShipments.length === 0) {
      toast.error("Select at least one item to remove.");
      return;
    }

    if (viewRows.length < 3) {
      toast.error("Item removal from consolidated shipments is only allowed when the shipment has 3 or more items.");
      return;
    }

    const remainingCount = viewRows.length - selectedShipments.length;
    if (remainingCount < 2) {
      toast.error("A consolidated shipment must have at least 2 items remaining. Please remove fewer items.");
      return;
    }

    setIsSavingConsolidationRemoval(true);
    let successCount = 0;
    let failureCount = 0;

    for (const selected of selectedShipments) {
      const shipment = shipmentsById.get(selected.id);
      if (!shipment) {
        failureCount += 1;
        continue;
      }

      const removed = await removeSubmittedShipment(shipment, {
        requireConfirmation: false,
        silent: true,
      });

      if (removed) {
        successCount += 1;
      } else {
        failureCount += 1;
      }
    }

    setIsSavingConsolidationRemoval(false);
    setSelectedConsolidationRemovalIds(new Set());

    if (successCount === 0) {
      toast.error("No consolidation items were removed.");
      return;
    }

    toast.success(
      failureCount > 0
        ? `Removed ${successCount} item(s) and skipped ${failureCount}.`
        : `Removed ${successCount} item(s).`,
    );
    setViewRow(null);
  };

  const columnsForTab = (tab: TabKey) => {
    const columns = {
      select: {
        key: "select",
        label: "",
        render: (row: UnifiedDashboardRow) =>
          row.rowType === "shipment" && row.sourceShipment ? (
            <Checkbox
              checked={selectedNeedActionIds.has(row.id)}
              onCheckedChange={(checked) => toggleNeedActionSelection(row.id, checked === true)}
              aria-label={`Select ${row.code}`}
            />
          ) : null,
      },
      client: {
        key: "client",
        label: "Client",
        render: (row: UnifiedDashboardRow) => (
          <div>
            <p>{row.customer_name}</p>
            <p className="text-xs text-muted-foreground font-mono">{row.customer_code}</p>
          </div>
        ),
      },
      serviceType: { key: "service_type", label: "Service Type", render: (row: UnifiedDashboardRow) => <Badge variant="outline">{formatServiceType(row.service_type)}</Badge> },
      productType: { key: "product_type", label: "Product Type", render: (row: UnifiedDashboardRow) => row.rowType === "consolidation" ? getConsolidationProductTypeLabel(row) : row.sourceShipment ? getProductType(row.sourceShipment) : "-" },
      item: { key: "item", label: "Item", render: (row: UnifiedDashboardRow) => <span className="truncate">{row.rowType === "consolidation" ? row.description || "-" : row.sourceShipment ? getItemLabel(row.sourceShipment) : "-"}</span> },
      cost: { key: "cost", label: "Cost", render: (row: UnifiedDashboardRow) => <span className="whitespace-nowrap">{renderCost(row)}</span> },
      tracking: {
        key: "tracking",
        label: "Tracking Number",
        render: (row: UnifiedDashboardRow) => {
          const tracking =
            row.rowType === "shipment"
              ? resolveTrackingByParcelTab(tab, row.status, row.sourceShipment?.notes || null, row.sourceShipment?.custom_tracking_number)
              : resolveTrackingByParcelTab(tab, row.status, row.sourceConsolidation?.notes || null, row.custom_tracking_number);
          return <span className="font-mono text-xs">{tracking || "Not provided"}</span>;
        },
      },
      receiver: {
        key: "receiver",
        label: "Receiver",
        render: (row: UnifiedDashboardRow) => {
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

          if (!row.sourceConsolidation) {
            return "-";
          }

          const consolidationShipments = getResolvedConsolidationShipments(row.sourceConsolidation);
          const names = Array.from(
            new Set(
              consolidationShipments
                .map((shipment) => shipment.receiver?.full_name || "")
                .filter(Boolean)
            )
          );
          const phones = Array.from(
            new Set(
              consolidationShipments
                .map((shipment) => shipment.receiver?.phone || "")
                .filter(Boolean)
            )
          );
          const addresses = Array.from(
            new Set(
              consolidationShipments
                .map((shipment) => shipment.receiver?.address || "")
                .filter(Boolean)
            )
          );

          return (
            <div>
              <p>{names.length === 1 ? names[0] : names.length > 1 ? "Multiple Receivers" : "-"}</p>
              <p className="text-xs text-muted-foreground">{phones.length === 1 ? phones[0] : "-"}</p>
              <p className="text-xs text-muted-foreground">{addresses.length === 1 ? addresses[0] : "-"}</p>
            </div>
          );
        },
      },
      createdDate: { key: "created_date", label: "Date Created", render: (row: UnifiedDashboardRow) => formatDateCell(row.created_at) },
      departureDateOrigin: { key: "departure_date_origin", label: "Departure Date (Origin)", render: (row: UnifiedDashboardRow) => formatDateCell(row.created_at) },
      warehouseArrivedDate: { key: "warehouse_arrived_date", label: "Arrival Date (Origin)", render: (row: UnifiedDashboardRow) => row.rowType !== "shipment" || !row.sourceShipment || !hasReachedWarehouse(row.status) ? "-" : formatDateCell(row.sourceShipment.updated_at || row.sourceShipment.created_at) },
      estimatedDate: {
        key: "estimated_date",
        label: "Estimated Date of Arrival",
        render: (row: UnifiedDashboardRow) => formatDateCell(row.estimated_delivery_date),
      },
      arrivalDateDestination: {
        key: "arrival_date_destination",
        label: "Arrival Date (Destination)",
        render: (row: UnifiedDashboardRow) => {
          const normalizedStatus = normalizeShipmentStatus(row.status);
          const hasArrivedDestination = ["delivered", "closed"].includes(normalizedStatus);
          if (!hasArrivedDestination) return "-";

          if (row.rowType === "shipment" && row.sourceShipment) {
            return formatDateCell(row.sourceShipment.updated_at || row.sourceShipment.created_at);
          }

          if (row.rowType === "consolidation" && row.sourceConsolidation) {
            return formatDateCell(row.sourceConsolidation.created_at);
          }

          return "-";
        },
      },
      airwayBill: { key: "airway_bill", label: "AWB/BL No.", render: (row: UnifiedDashboardRow) => <span className="font-mono text-xs">{row.airway_bill_number || "-"}</span> },
      qty: { key: "qty", label: "Quantity", render: (row: UnifiedDashboardRow) => row.quantity || 1 },
      wt: { key: "wt", label: "Weight", render: (row: UnifiedDashboardRow) => `${row.weight}kg` },
      dims: { key: "dims", label: "Dimensions", render: (row: UnifiedDashboardRow) => row.rowType === "consolidation" ? "-" : formatDims(row.length, row.width, row.height) },
      cbm: { key: "cbm", label: "Cubic Meters (CBM)", render: (row: UnifiedDashboardRow) => row.cbm == null ? "-" : row.cbm.toFixed(2) },
      shippingFee: { key: "shipping_fee", label: "Shipping Fee", render: (row: UnifiedDashboardRow) => {
        const earlyStages = new Set(["saved_pickup", "saved_dropoff", "received", "requested_pickup"]);
        if (earlyStages.has((row.status || "").toLowerCase()) || row.shipping_cost == null) {
          return <span className="whitespace-nowrap text-muted-foreground">—</span>;
        }
        return <span className="whitespace-nowrap">{formatAmount(row.shipping_cost)}</span>;
      } },
      status: { key: "status", label: "Status", render: (row: UnifiedDashboardRow) => tab === "intransit" ? <span className="text-xs text-muted-foreground">{getRowTransitStatusMessage(row) || "-"}</span> : renderStatusBadge(row) },
      paymentStatus: { key: "payment_status", label: "Payment Status", render: (row: UnifiedDashboardRow) => renderPaymentBadge(row) },
      collectedDateTime: {
        key: "collected_date_time",
        label: "Collected Date & Time",
        render: (row: UnifiedDashboardRow) => {
          if (row.rowType === "shipment") {
            const collectedAt =
              row.sourceShipment?.collected_at ||
              extractNoteValue(row.sourceShipment?.notes || null, "Collected at");
            return formatDateTimeCell(collectedAt || row.sourceShipment?.updated_at || row.created_at);
          }
          const collectedAt =
            row.sourceConsolidation?.collected_at ||
            extractNoteValue(row.sourceConsolidation?.notes || null, "Collected at");
          return formatDateTimeCell(collectedAt || row.created_at);
        },
      },
      collectedBy: {
        key: "collected_by",
        label: "Collected By",
        render: (row: UnifiedDashboardRow) => {
          const fallbackValue =
            row.rowType === "shipment"
              ? formatCollectedByValue(
                row.sourceShipment?.receiver?.full_name,
                row.sourceShipment?.receiver?.phone,
              )
              : (() => {
                if (!row.sourceConsolidation) return null;
                const consolidationShipments = getResolvedConsolidationShipments(row.sourceConsolidation);
                const names = Array.from(
                  new Set(
                    consolidationShipments
                      .map((shipment) => shipment.receiver?.full_name || "")
                      .filter(Boolean)
                  )
                );
                const phones = Array.from(
                  new Set(
                    consolidationShipments
                      .map((shipment) => shipment.receiver?.phone || "")
                      .filter(Boolean)
                  )
                );

                return formatCollectedByValue(
                  names.length === 1 ? names[0] : names.length > 1 ? "Multiple Receivers" : null,
                  phones.length === 1 ? phones[0] : null,
                );
              })();

          return resolveStoredCollectedByValue(
            row.rowType === "shipment"
              ? row.sourceShipment?.collected_by
              : row.sourceConsolidation?.collected_by,
            row.rowType === "shipment"
              ? row.sourceShipment?.notes || null
              : row.sourceConsolidation?.notes || null,
            fallbackValue,
          ) || "-";
        },
      },
      action: {
        key: "action",
        label: "Action",
        render: (row: UnifiedDashboardRow) => (
          <Button size="icon" variant="ghost" className="h-8 w-8 p-0" onClick={() => setViewRow(row)} title="View details">
            <Eye className="h-4 w-4 text-blue-600" />
          </Button>
        ),
      },
    };

    switch (tab) {
      case "all_shipments":
        return [columns.client, columns.serviceType, columns.productType, columns.cost, columns.tracking, columns.receiver, columns.departureDateOrigin, columns.arrivalDateDestination, columns.airwayBill, columns.wt, columns.cbm, columns.shippingFee, columns.status, columns.action];
      case "created":
        return [
          columns.client,
          columns.productType,
          columns.item,
          columns.cost,
          columns.tracking,
          columns.createdDate,
          columns.qty,
          columns.wt,
          columns.cbm,
          columns.dims,
          columns.serviceType,
          columns.status,
          {
            key: "action",
            label: "Action",
            render: (row: UnifiedDashboardRow) =>
              row.rowType === "shipment" && row.sourceShipment ? (
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8 p-0" onClick={() => setViewRow(row)} title="View details">
                    <Eye className="h-4 w-4 text-blue-600" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 p-0" onClick={() => openSubmittedEditDialog(row.sourceShipment)} title="Edit shipment">
                    <Pencil className="h-4 w-4 text-blue-600" />
                  </Button>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">-</span>
              ),
          },
        ];
      case "incoming":
        return [columns.client, columns.productType, columns.item, columns.cost, columns.tracking, columns.createdDate, columns.qty, columns.wt, columns.cbm, columns.dims, columns.serviceType, columns.status];
      case "need_action":
        return [columns.select, columns.client, columns.serviceType, columns.productType, columns.item, columns.cost, columns.tracking, columns.qty, columns.wt, columns.cbm, columns.dims, columns.status];
      case "submitted":
        return [
          {
            key: "select",
            label: "",
            render: (row: UnifiedDashboardRow) =>
              row.rowType === "shipment" && row.sourceShipment ? (
                <Checkbox
                  checked={selectedSubmittedIds.has(row.id)}
                  onCheckedChange={(checked) =>
                    toggleSubmittedSelection(row.id, checked === true)
                  }
                  aria-label={`Select submitted parcel ${row.code}`}
                />
              ) : (
                "-"
              ),
          },
          columns.client,
          columns.serviceType,
          columns.productType,
          columns.item,
          columns.cost,
          columns.receiver,
          columns.qty,
          columns.wt,
          columns.cbm,
          columns.dims,
          {
            key: "action",
            label: "Action",
            render: (row: UnifiedDashboardRow) => {
              if (row.rowType === "consolidation") {
                return (
                  <Button size="icon" variant="ghost" className="h-8 w-8 p-0" onClick={() => setViewRow(row)} title="View details">
                    <Eye className="h-4 w-4 text-blue-600" />
                  </Button>
                );
              }

              if (!row.sourceShipment) {
                return <span className="text-xs text-muted-foreground">-</span>;
              }

              return (
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8 p-0" onClick={() => setViewRow(row)} title="View details">
                    <Eye className="h-4 w-4 text-blue-600" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 p-0" onClick={() => openSubmittedEditDialog(row.sourceShipment)} title="Edit shipment">
                    <Pencil className="h-4 w-4 text-blue-600" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    onClick={() => handleRemoveSubmittedShipment(row.sourceShipment)}
                    disabled={removingSubmittedShipmentId === row.sourceShipment.id}
                    title="Remove shipment"
                  >
                    {removingSubmittedShipmentId === row.sourceShipment.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              );
            },
          },
        ];
      case "confirm":
        return [
          {
            key: "select",
            label: "",
            render: (row: UnifiedDashboardRow) => (
              <Checkbox
                checked={selectedConfirmRowKeys.has(
                  getUnifiedDashboardRowSelectionKey(row)
                )}
                onCheckedChange={(checked) =>
                  toggleConfirmSelection(row, checked === true)
                }
                aria-label={`Select confirm shipment ${row.code}`}
              />
            ),
          },
          columns.client,
          columns.serviceType,
          columns.productType,
          columns.qty,
          columns.cost,
          columns.wt,
          columns.cbm,
          columns.shippingFee,
          {
            key: "action",
            label: "Action",
            render: (row: UnifiedDashboardRow) =>
              row.rowType === "consolidation" && row.sourceConsolidation ? (
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8 p-0" onClick={() => setViewRow(row)} title="View details">
                    <Eye className="h-4 w-4 text-blue-600" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    onClick={() => handleShipConsolidation(row.sourceConsolidation!.id)}
                    disabled={isUpdatingConsolidationId === row.sourceConsolidation?.id}
                    title="Ship consolidation"
                  >
                    {isUpdatingConsolidationId === row.sourceConsolidation?.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4 text-green-600" />
                    )}
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8 p-0" onClick={() => setViewRow(row)} title="View details">
                    <Eye className="h-4 w-4 text-blue-600" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    onClick={() => handleShip(row.id)}
                    disabled={isUpdatingId === row.id}
                    title="Ship item"
                  >
                    {isUpdatingId === row.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4 text-green-600" />
                    )}
                  </Button>
                </div>
              ),
          },
        ];
      case "outgoing":
      case "intransit":
        return [columns.client, columns.serviceType, columns.productType, columns.cost, columns.tracking, columns.receiver, columns.departureDateOrigin, columns.estimatedDate, columns.airwayBill, columns.wt, columns.cbm, columns.shippingFee, columns.status, columns.action];
      case "arrived":
        return [columns.client, columns.serviceType, columns.productType, columns.cost, columns.tracking, columns.receiver, columns.airwayBill, columns.wt, columns.cbm, columns.shippingFee, columns.status, columns.paymentStatus, columns.action];
      case "collected":
        return [columns.client, columns.serviceType, columns.productType, columns.cost, columns.tracking, columns.receiver, columns.airwayBill, columns.wt, columns.cbm, columns.shippingFee, columns.collectedDateTime, columns.collectedBy, columns.status, columns.paymentStatus, columns.action];
      case "unpaid":
      case "paid":
        return [columns.client, columns.serviceType, columns.productType, columns.cost, columns.tracking, columns.receiver, columns.airwayBill, columns.wt, columns.cbm, columns.shippingFee, columns.status, columns.paymentStatus, columns.action];
      case "all":
      default:
        return [columns.client, columns.serviceType, columns.productType, columns.item, columns.cost, columns.tracking, columns.receiver, columns.createdDate, columns.warehouseArrivedDate, columns.qty, columns.wt, columns.cbm, columns.dims, columns.status];
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Shipment Management"
        actions={
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
            <Button asChild size="sm" className="h-9 bg-slate-900 text-white hover:bg-slate-800 shadow-sm font-bold transition-all">
              <Link to="/agent/place-order" className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Create
              </Link>
            </Button>
            <Button asChild size="sm" className="h-9 bg-blue-600 text-white hover:bg-blue-700 shadow-sm font-bold transition-all">
              <Link to="/agent/pricing" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Pricing
              </Link>
            </Button>
            <Button asChild size="sm" className="h-9 bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm font-bold transition-all">
              <Link to="/agent/customers/create" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Register
              </Link>
            </Button>
            <Button asChild size="sm" className="h-9 bg-orange-500 text-white hover:bg-orange-600 shadow-sm font-bold transition-all">
              <Link to="/agent/tracking" className="flex items-center gap-2">
                <QrCode className="h-4 w-4" />
                Tracking
              </Link>
            </Button>
          </div>
        }
      />



      {/* Quick Actions */}
      <div className="flex items-center gap-2 mb-6">
        <Button asChild variant="outline" size="sm">
          <Link to="/agent/customers">View Clients</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to="/agent/payments">Payments</Link>
        </Button>
        <Button variant="outline" size="sm" onClick={() => exportActiveTable("pdf")}>
          <FileText className="mr-2 h-4 w-4" />
          PDF
        </Button>
        <Button variant="outline" size="sm" onClick={() => exportActiveTable("excel")}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Excel
        </Button>
      </div>

      {/* Widget Navigation Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 mb-4">
        {overviewCards.map((item) => {
          const isActive = activeTab === item.key;
          return (
            <button
              key={item.key}
              onClick={() => handleTabChange(item.key)}
              className={`flex flex-col items-center justify-between p-2 rounded-md border transition-all duration-200 min-h-[75px] bg-white ${isActive
                  ? "border-slate-400 shadow-sm ring-1 ring-slate-400/10"
                  : "border-slate-100"
                }`}
            >
              <span className="text-xs font-semibold text-slate-500 mb-1 text-center leading-tight">
                {item.label}
              </span>
              <div className={`px-2 py-0 rounded-md ${item.bg} min-w-[35px] flex items-center justify-center`}>
                <span className={`text-lg font-bold ${item.text}`}>
                  {item.value}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Tabs Content */}
      <Tabs value={activeTab} onValueChange={(value) => handleTabChange(value as TabKey)} className="space-y-4">
        {/* Hidden TabsList for functionality if needed, but we use the widgets above */}
        <div className="hidden">
          <TabsList>
            {tabDefs.map((tab) => (
              <TabsTrigger key={tab.key} value={tab.key}>{tab.label}</TabsTrigger>
            ))}
          </TabsList>
        </div>
        {tabDefs.map((t) => (
          <TabsContent key={t.key} value={t.key}>
            <Card className="border-border/70">
              <CardContent className="p-0">
                {isLoading || isLoadingConsolidations ? (
                  <p className="text-sm text-muted-foreground p-4">Loading shipments...</p>
                ) : (
                  <div className="overflow-x-auto" data-table-export-ignore="true">
                    {(() => {
                      const columns = columnsForTab(t.key);
                        const rows =
                        t.key === "all"
                          ? allParcelDisplayRows
                          : t.key === "all_shipments"
                            ? allShipmentDisplayRows
                            : t.key === "need_action"
                              ? needActionUnifiedRows
                              : filterUnifiedRows(unifiedRows, t.key);
                      return (
                        <>
                          <table className="w-full text-sm" data-portal-export={`agent-${t.key}`}>
                            <thead>
                              <tr className="border-b bg-muted/50">
                                {columns.map((column) => (
                                  <th key={column.key} className="text-left p-3 font-medium text-muted-foreground">{column.label}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((row) => (
                                <tr key={`${row.rowType}-${row.id}`} className="border-b hover:bg-muted/30 transition-colors">
                                  {columns.map((column) => {
                                    const cellClass = column.key === "item" ? "p-3 max-w-[180px] truncate" : "p-3";
                                    return <td key={`${row.id}-${column.key}`} className={cellClass}>{column.render(row)}</td>;
                                  })}
                                </tr>
                              ))}
                              {rows.length === 0 && (
                                <tr>
                                  <td colSpan={columns.length} className="p-8 text-center text-muted-foreground">{t.key === "all_shipments" ? "No shipments found." : "No parcels found."}</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                          {t.key === "need_action" && (
                            <div className="flex flex-col gap-3 border-t bg-muted/20 p-4 md:flex-row md:items-center md:justify-between">
                              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                <div className="flex items-center gap-2">
                                  <Checkbox
                                    checked={needActionRows.length > 0 && needActionRows.every((row) => selectedNeedActionIds.has(row.id))}
                                    onCheckedChange={(checked) => handleSelectAllNeedAction(checked === true)}
                                    aria-label="Select all need action parcels"
                                  />
                                  <Label>Select all</Label>
                                </div>
                              </div>
                              <Button
                                onClick={handleSubmitConsolidation}
                                disabled={selectedNeedActionIds.size === 0 || isUpdatingConsolidationId === "create"}
                              >
                                {isUpdatingConsolidationId === "create" ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Submitting...
                                  </>
                                ) : (
                                  `Consolidate (${selectedNeedActionIds.size})`
                                )}
                              </Button>
                            </div>
                          )}

                          {t.key === "submitted" && (
                            <div className="flex flex-col gap-3 border-t bg-muted/20 p-4 md:flex-row md:items-center md:justify-between">
                              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                <div className="flex items-center gap-2">
                                  <Checkbox
                                    checked={
                                      submittedShipmentRows.length > 0 &&
                                      submittedShipmentRows.every((row) =>
                                        selectedSubmittedIds.has(row.id)
                                      )
                                    }
                                    onCheckedChange={(checked) =>
                                      handleSelectAllSubmitted(checked === true)
                                    }
                                    aria-label="Select all submitted parcels"
                                  />
                                  <Label>Select all</Label>
                                </div>
                              </div>
                              <Button
                                variant="destructive"
                                onClick={handleBulkRemoveSubmitted}
                                disabled={
                                  selectedSubmittedIds.size === 0 ||
                                  activeBulkAction === "submitted-remove"
                                }
                              >
                                {activeBulkAction === "submitted-remove" ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Removing...
                                  </>
                                ) : (
                                  `Remove (${selectedSubmittedIds.size})`
                                )}
                              </Button>
                            </div>
                          )}

                          {t.key === "confirm" && (
                            <div className="flex flex-col gap-3 border-t bg-muted/20 p-4 md:flex-row md:items-center md:justify-between">
                              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                <div className="flex items-center gap-2">
                                  <Checkbox
                                    checked={
                                      confirmRows.length > 0 &&
                                      confirmRows.every((row) =>
                                        selectedConfirmRowKeys.has(
                                          getUnifiedDashboardRowSelectionKey(row)
                                        )
                                      )
                                    }
                                    onCheckedChange={(checked) =>
                                      handleSelectAllConfirm(checked === true)
                                    }
                                    aria-label="Select all confirm shipments"
                                  />
                                  <Label>Select all</Label>
                                </div>
                              </div>
                              <Button
                                onClick={handleBulkShipConfirm}
                                disabled={
                                  selectedConfirmRowKeys.size === 0 ||
                                  activeBulkAction === "confirm-ship"
                                }
                              >
                                {activeBulkAction === "confirm-ship" ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Shipping...
                                  </>
                                ) : (
                                  `Ship (${selectedConfirmRowKeys.size})`
                                )}
                              </Button>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* View Details Dialog */}
      <Dialog open={!!viewRow} onOpenChange={(open) => !open && setViewRow(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Shipment Details</DialogTitle>
            
          </DialogHeader>
          <div className="space-y-3">
            {viewRows.map((shipment) => {
              const parsedPrice = Number(getUnitPrice(shipment));
              const itemCost = !Number.isNaN(parsedPrice) ? parsedPrice : shipment.total_cost || shipment.shipping_cost || 0;
              return (
                <div key={shipment.id} className="rounded-md border p-3 space-y-1 text-sm">
                  {activeTab === "submitted" && viewRow?.rowType === "consolidation" ? (
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Checkbox
                        checked={selectedConsolidationRemovalIds.has(shipment.id)}
                        onCheckedChange={(checked) =>
                          toggleConsolidationRemovalSelection(shipment.id, checked === true)
                        }
                      />
                      Remove this item from consolidation
                    </label>
                  ) : null}
                  <p className="font-semibold">{shipment.description || shipment.code}</p>
                  <p className="text-xs font-mono text-muted-foreground">
                    Tracking: {shipment.custom_tracking_number || "-"} | AWB/BL No.: {getAirwayBillNumber(shipment.notes) || "-"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Receiver: {shipment.receiver?.full_name || "-"} | {shipment.receiver?.phone || "-"} | {shipment.receiver?.address || "-"}
                  </p>
                  <p>
                    Service: {formatServiceType(shipment.service_type)} | Qty: {shipment.quantity || 1} | Weight: {(shipment.weight || 0).toFixed(2)} kg | CBM: {(getShipmentCbmValue(shipment) || 0).toFixed(4)} | Dimensions: {formatDims(shipment.length ?? null, shipment.width ?? null, shipment.height ?? null)}
                  </p>
                  <p>Item Cost: {formatAmount(itemCost)} | Shipping Fee: {formatAmount(shipment.shipping_cost || 0)}</p>
                </div>
              );
            })}
            {viewRows.length === 0 && <p className="text-sm text-muted-foreground">No shipment details found.</p>}
          </div>
          <DialogFooter>
            {activeTab === "submitted" && viewRow?.rowType === "consolidation" ? (
              <Button
                variant="destructive"
                onClick={handleSaveConsolidationItemRemoval}
                disabled={selectedConsolidationRemovalIds.size === 0 || isSavingConsolidationRemoval}
              >
                {isSavingConsolidationRemoval ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Remove Selected ({selectedConsolidationRemovalIds.size})
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => setViewRow(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingShipment} onOpenChange={(open) => !open && setEditingShipment(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Parcel</DialogTitle>
            
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="submitted-tracking">Tracking Number</Label>
              <Input
                id="submitted-tracking"
                placeholder="Enter tracking number"
                value={submittedEditForm.trackingNumber}
                onChange={(event) =>
                  setSubmittedEditForm((prev) => ({ ...prev, trackingNumber: event.target.value }))
                }
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="submitted-product-type">Product Type</Label>
                <Input
                  id="submitted-product-type"
                  value={submittedEditForm.productType}
                  onChange={(event) =>
                    setSubmittedEditForm((prev) => ({ ...prev, productType: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="submitted-item">Item</Label>
                <Input
                  id="submitted-item"
                  value={submittedEditForm.item}
                  onChange={(event) =>
                    setSubmittedEditForm((prev) => ({ ...prev, item: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="submitted-quantity">Quantity</Label>
                <Input
                  id="submitted-quantity"
                  type="number"
                  min="1"
                  value={submittedEditForm.quantity}
                  onChange={(event) =>
                    setSubmittedEditForm((prev) => ({ ...prev, quantity: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="submitted-price">Price</Label>
                <Input
                  id="submitted-price"
                  type="number"
                  min="0"
                  value={submittedEditForm.unitPrice}
                  onChange={(event) =>
                    setSubmittedEditForm((prev) => ({ ...prev, unitPrice: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="submitted-weight">Weight (kg)</Label>
                <Input
                  id="submitted-weight"
                  type="number"
                  min="0"
                  value={submittedEditForm.weight}
                  onChange={(event) =>
                    setSubmittedEditForm((prev) => ({ ...prev, weight: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="submitted-length">Length (cm)</Label>
                <Input
                  id="submitted-length"
                  type="number"
                  min="0"
                  value={submittedEditForm.length}
                  onChange={(event) =>
                    setSubmittedEditForm((prev) => ({ ...prev, length: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="submitted-width">Width (cm)</Label>
                <Input
                  id="submitted-width"
                  type="number"
                  min="0"
                  value={submittedEditForm.width}
                  onChange={(event) =>
                    setSubmittedEditForm((prev) => ({ ...prev, width: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="submitted-height">Height (cm)</Label>
                <Input
                  id="submitted-height"
                  type="number"
                  min="0"
                  value={submittedEditForm.height}
                  onChange={(event) =>
                    setSubmittedEditForm((prev) => ({ ...prev, height: event.target.value }))
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingShipment(null)}
              disabled={isSavingSubmittedEdit}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveSubmittedEdit} disabled={isSavingSubmittedEdit}>
              {isSavingSubmittedEdit ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AgentShipments;

