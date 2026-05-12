import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, Column } from "@/components/shared/DataTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
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
import {
  extractNoteValue,
  getAirwayBillNumber,
  getInsuranceLabel,
  getTransitStatusMessage,
  getItemPrice,
  getProductType,
  getWarehouseTrackingNumber,
  resolveTrackingByParcelTab,
  resolveTrackingByStatus,
  resolveStoredCollectedByValue,
  getSpecialPackagingLabel,
  getValueAddedServicesSummary,
  setAirwayBillNumber,
  upsertNoteValue,
  setTransitStatusMessage,
} from "@/lib/shipmentNotes";
import {
  getWarehouseArrivalTransition,
  getPortalShipmentWorkflowStatus,
  isSingleHandlingMethod,
} from "@/lib/parcelWorkflow";
import {
  isShipmentStageStatus,

  mapConsolidationStatusToShipmentStatus,
  normalizeConsolidationStatus,
  normalizeShipmentStatus,
} from "@/lib/warehouseTabFilters";
import { Check, CheckCircle2, Eye, Loader2, Pencil, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { notifyStatusChange, notifyBulkTransitUpdate, notifyWarehouseTrackingAssigned, notifyShippingFeeAdded } from "@/lib/notifications";

type ShipmentRow = {
  id: string;
  code: string;
  customer_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  estimated_delivery_date: string | null;
  collected_at: string | null;
  collected_by: string | null;
  service_type: string;
  description: string | null;
  notes: string | null;
  custom_tracking_number: string | null;
  weight: number | null;
  cbm: number | null;
  total_cost: number | null;
  shipping_cost: number | null;
  payment_status: string | null;
  quantity: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
  handling_method: string | null;
  consolidation_id?: string | null;
  receiver_id: string | null;
  customers: { full_name: string | null; code: string | null; phone: string | null } | null;
  receiver: { full_name: string | null; phone: string | null; address: string | null } | null;
};

type ConsolidationChild = {
  shipment_id: string;
  shipment: {
    id: string;
    code: string;
    created_at: string;
    updated_at: string;
    collected_at: string | null;
    collected_by: string | null;
    description: string | null;
    notes: string | null;
    service_type: string;
    custom_tracking_number: string | null;
    estimated_delivery_date: string | null;
    status: string;
    quantity: number | null;
    weight: number | null;
    cbm: number | null;
    total_cost: number | null;
    shipping_cost: number | null;
    payment_status: string | null;
    length: number | null;
    width: number | null;
    height: number | null;
    handling_method: string | null;
    consolidation_id?: string | null;
    receiver_id: string | null;
    receiver: { full_name: string | null; phone: string | null; address: string | null } | null;
  } | null;
};

type ConsolidationRow = {
  id: string;
  code: string;
  customer_id: string | null;
  status: string;
  notes: string | null;
  item_count: number | null;
  total_weight: number | null;
  total_cbm: number | null;
  total_cost: number | null;
  tracking_code: string | null;
  created_at: string;
  updated_at: string;
  collected_at: string | null;
  collected_by: string | null;
  customers: { full_name: string | null; code: string | null; phone: string | null } | null;
  consolidation_shipments: ConsolidationChild[];
};

type UnifiedRow = {
  id: string;
  rowType: "shipment" | "consolidation";
  isConsolidatedChild?: boolean;
  code: string;
  status: string;
  created_at: string;
  serviceType: string;
  productType: string;
  item: string;
  tracking: string;
  airwayBill: string;
  qty: number;
  weight: number;
  cbm: number;
  dimensions: string;
  itemCost: number;
  shippingFee: number;
  paymentStatus: string | null;
  estimatedDeliveryDate: string | null;
  customerName: string;
  customerCode: string;
  receiverName: string;
  receiverPhone: string;
  receiverAddress: string;
  handlingMethod: string | null;
  sourceShipment?: ShipmentRow;
  sourceConsolidation?: ConsolidationRow;
};

type EditableItem = {
  id: string;
  shipmentId?: string;
  description: string;
  quantity: string;
  weight: string;
  cbm: string;
  itemCost: string;
  length: string;
  width: string;
  height: string;
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
const isValidTab = (value: string | null): value is TabKey => !!value && tabDefs.some((tab) => tab.key === value);
const warehouseBulkActionTabs = new Set<TabKey>(["created", "incoming", "outgoing", "intransit", "arrived"]);
const getUnifiedRowSelectionKey = (row: UnifiedRow) => `${row.rowType}:${row.id}`;
const legacyTabAliases: Record<string, TabKey> = {
  offer: "confirm",
  offers: "confirm",
};
const resolveTabKey = (value: string | null): TabKey | null => {
  if (isValidTab(value)) return value;
  if (!value) return null;
  return legacyTabAliases[value.toLowerCase().trim()] || null;
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

const sanitizePhoneNumber = (value: string | null | undefined) => {
  if (!value) return null;
  const cleaned = value.replace(/[^0-9+]/g, "").trim();
  return cleaned.length >= 9 ? cleaned : null;
};

const buildWarehouseStatusSms = (reference: string, status: string) => {
  const label = statusLabel[status] || status;
  return `XY Cargo update: Shipment ${reference} is now ${label}.`;
};

const getShipmentReference = (code: string, customTrackingNumber?: string | null) => {
  const tracking = (customTrackingNumber || "").trim();
  return tracking || code;
};

const isMissingConsolidationTotalsError = (error: { code?: string; message?: string } | null) =>
  !!error &&
  (error.code === "42703" ||
    /item_count|total_weight|total_cbm|total_cost|tracking_code/i.test(error.message || ""));

const isMissingColumnError = (
  error: { code?: string; message?: string } | null | undefined,
  columnPattern: RegExp
) =>
  !!error &&
  (error.code === "42703" || /does not exist/i.test(error.message || "")) &&
  columnPattern.test(error.message || "");

const isDefaultOnlyColumnError = (
  error: { code?: string; message?: string } | null | undefined,
  columnPattern: RegExp
) =>
  !!error &&
  /can only be updated to DEFAULT/i.test(error.message || "") &&
  columnPattern.test(error.message || "");

const isColumnWriteRestrictedError = (
  error: { code?: string; message?: string } | null | undefined,
  columnPattern: RegExp
) => isMissingColumnError(error, columnPattern) || isDefaultOnlyColumnError(error, columnPattern);

const shouldHideConsolidatedChildInStageView = (row: UnifiedRow) =>
  row.rowType === "shipment" && !!row.isConsolidatedChild;

const filterByTab = (rows: UnifiedRow[], tab: TabKey) => {
  if (tab === "all") {
    // Show every parcel ever created (all shipment rows across all stages,
    // including those rolled into consolidations).
    return rows.filter((row) => row.rowType === "shipment");
  }

  if (tab === "all_shipments") {
    // Show only "Shipments" (Submitted and onwards)
    return rows.filter(
      (row) =>
        !["saved_pickup", "saved_dropoff", "received"].includes(normalizeShipmentStatus(row.status)) &&
        isShipmentStageStatus(row.status) &&
        !shouldHideConsolidatedChildInStageView(row) &&
        (row.rowType === "consolidation" || row.handlingMethod === "single")
    );
  }

  if (tab === "paid") {
    return rows.filter((row) => row.paymentStatus === "completed" && !shouldHideConsolidatedChildInStageView(row));
  }
  if (tab === "unpaid") {
    return rows.filter((row) => row.paymentStatus !== "completed" && !shouldHideConsolidatedChildInStageView(row));
  }
  const map: Record<string, string> = {
    created: "saved_pickup",
    incoming: "saved_dropoff",
    need_action: "received",
    submitted: "requested_pickup",
    confirm: "approved",
    outgoing: "assigned",
    intransit: "supplied",
    arrived: "delivered",
    collected: "closed",
  };
  const isShipmentStage = !["created", "incoming", "need_action"].includes(tab);
  return rows.filter((row) => {
    const statusMatches = row.status === map[tab];
    if (!statusMatches) return false;
    if (shouldHideConsolidatedChildInStageView(row)) return false;
    if (isShipmentStage && row.rowType === "shipment" && !isSingleHandlingMethod(row as any)) return false;
    return true;
  });
};

const getTabCount = (rows: UnifiedRow[], tab: TabKey) => {
  return filterByTab(rows, tab).length;
};

const formatDimensions = (length?: number | null, width?: number | null, height?: number | null) => {
  const l = Number(length || 0);
  const w = Number(width || 0);
  const h = Number(height || 0);
  if (l <= 0 && w <= 0 && h <= 0) return "-";
  return `${l} x ${w} x ${h} cm`;
};

const formatServiceType = (serviceType: string | null | undefined) => {
  const normalized = (serviceType || "").toLowerCase().trim();
  if (normalized === "air") return "Air Freight";
  if (normalized === "sea") return "Sea Freight";
  if (normalized === "mixed" || normalized === "consolidated") return "Mixed Service";
  return "Air Freight"; // Default fallback to ensure it's never blank
};

const getValueAddedRequestLabel = (row: UnifiedRow) => {
  if (row.rowType === "shipment") {
    return getValueAddedServicesSummary(row.sourceShipment?.notes || null);
  }

  const childServices = Array.from(
    new Set(
      (row.sourceConsolidation?.consolidation_shipments || [])
        .map((entry) => getValueAddedServicesSummary(entry.shipment?.notes || null))
        .filter((value) => value && value !== "None")
    )
  );

  if (childServices.length > 0) {
    return childServices.join(", ");
  }

  return getValueAddedServicesSummary(row.sourceConsolidation?.notes || null);
};

const normalizeServiceType = (serviceType: string | null | undefined): "air" | "sea" | null => {
  const normalized = (serviceType || "").toLowerCase().trim();
  if (normalized === "air" || normalized === "air_freight" || normalized === "air freight") return "air";
  if (normalized === "sea" || normalized === "sea_freight" || normalized === "sea freight") return "sea";
  return null;
};

const getShipmentItemCost = (shipment: {
  notes: string | null;
  total_cost: number | null;
}) => {
  const notePrice = Number(getItemPrice(shipment.notes));
  if (!Number.isNaN(notePrice) && notePrice >= 0) return notePrice;
  return shipment.total_cost || 0;
};

const getConsolidationCbmFromNotes = (notes: string | null) => {
  const value = extractNoteValue(notes, "CBM");
  if (!value) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const getShipmentCbm = (shipment: { cbm: number | null; notes: string | null }) => {
  const fromNotes = getConsolidationCbmFromNotes(shipment.notes);
  if (fromNotes !== null) return fromNotes;
  return shipment.cbm || 0;
};

const setConsolidationCbmInNotes = (notes: string | null, cbm: number) =>
  upsertNoteValue(notes, "CBM", cbm.toFixed(4));

const toInputNumberValue = (value: number | null | undefined, fallback = "") => {
  if (value === null || value === undefined) return fallback;
  if (value === 0) return fallback;
  return String(value);
};

const getCollectedByValue = (
  storedValue: string | null | undefined,
  notes: string | null,
  fallback?: string | null,
) => resolveStoredCollectedByValue(storedValue, notes, fallback) ?? "-";

const getCollectedAtFromNotes = (notes: string | null) => extractNoteValue(notes, "Collected at");

const getOriginArrivalAtFromNotes = (notes: string | null) =>
  extractNoteValue(notes, "Origin Arrival Date") ||
  extractNoteValue(notes, "Arrival at Origin");



const formatDateTimeCell = (value: string | null | undefined) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};

const formatDateCell = (value: string | null | undefined) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatCollectedByValue = (name: string | null | undefined, phone: string | null | undefined) => {
  const normalizedName = (name || "").trim();
  const normalizedPhone = (phone || "").trim();
  const safeName = normalizedName && normalizedName !== "-" ? normalizedName : "";
  const safePhone = normalizedPhone && normalizedPhone !== "-" ? normalizedPhone : "";

  if (safeName && safePhone) return `${safeName} (${safePhone})`;
  return safeName || safePhone || null;
};

const getLatestEstimatedDeliveryDate = (
  values: Array<string | null | undefined>,
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

const toDateInputValue = (value: string | null | undefined) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value.slice(0, 10);
  }
  return parsed.toISOString().slice(0, 10);
};

const WarehouseAllParcels = () => {
  const { formatAmount } = useDefaultCurrency();
  const [searchParams, setSearchParams] = useSearchParams();
  const [shipments, setShipments] = useState<ShipmentRow[]>([]);
  const [consolidations, setConsolidations] = useState<ConsolidationRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    const tab = searchParams.get("tab");
    return resolveTabKey(tab) ?? "all";
  });
  const [viewRow, setViewRow] = useState<UnifiedRow | null>(null);
  const [editRow, setEditRow] = useState<UnifiedRow | null>(null);
  const [editItemCount, setEditItemCount] = useState("");
  const [editWeight, setEditWeight] = useState("");
  const [editCbm, setEditCbm] = useState("");
  const [editShippingFee, setEditShippingFee] = useState("");
  const [editTrackingNumber, setEditTrackingNumber] = useState("");
  const [editAirwayBill, setEditAirwayBill] = useState("");
  const [editEstimatedDate, setEditEstimatedDate] = useState("");
  const [editTransitStatusMessage, setEditTransitStatusMessage] = useState("");
  const [editServiceType, setEditServiceType] = useState<"air" | "sea">("air");
  const [editProductType, setEditProductType] = useState("");
  const [editItems, setEditItems] = useState<EditableItem[]>([]);
  const [visibleRows, setVisibleRows] = useState<UnifiedRow[]>([]);
  const [selectedBulkRowKeys, setSelectedBulkRowKeys] = useState<Set<string>>(new Set());
  const [bulkTransitStatusMessage, setBulkTransitStatusMessage] = useState("");
  const [bulkAirwayBillNumber, setBulkAirwayBillNumber] = useState("");
  const [bulkTrackingNumber, setBulkTrackingNumber] = useState("");
  const [activeBulkAction, setActiveBulkAction] = useState<string | null>(null);
  const [editItemShippingFees, setEditItemShippingFees] = useState<Record<string, string>>({});
  const [collectionActorLabel, setCollectionActorLabel] = useState("Warehouse");
  const [collectedByEdits, setCollectedByEdits] = useState<Record<string, string>>({});
  const [savingCollectedBy, setSavingCollectedBy] = useState<string | null>(null);
  const [editReceiver, setEditReceiver] = useState<ShipmentRow["receiver"] | null>(null);
  const [selectedConsolidationRemovalIds, setSelectedConsolidationRemovalIds] = useState<Set<string>>(new Set());
  const [isSavingConsolidationRemoval, setIsSavingConsolidationRemoval] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    const [shipmentsRes, consolidationsRes] = await Promise.all([
      supabase
        .from("shipments")
        .select("id, code, customer_id, status, created_at, updated_at, estimated_delivery_date, collected_at, collected_by, service_type, description, notes, custom_tracking_number, weight, cbm, total_cost, shipping_cost, payment_status, quantity, length, width, height, handling_method, consolidation_id, receiver_id, customers(full_name, code, phone), receiver:receivers(full_name, phone, address)")
        .order("created_at", { ascending: false }),
      supabase
        .from("consolidations")
        .select("id, code, customer_id, status, notes, item_count, total_weight, total_cbm, total_cost, tracking_code, created_at, updated_at, collected_at, collected_by, customers(full_name, code, phone), consolidation_shipments(shipment_id, shipment:shipments(id, code, created_at, updated_at, estimated_delivery_date, collected_at, collected_by, description, notes, service_type, custom_tracking_number, status, quantity, weight, cbm, total_cost, shipping_cost, payment_status, length, width, height, handling_method, consolidation_id, receiver_id, receiver:receivers(full_name, phone, address))))")
        .order("created_at", { ascending: false }),
    ]);

    let shipmentsData = shipmentsRes.data;
    let shipmentsError = shipmentsRes.error as { code?: string; message?: string } | null;

    if (shipmentsError && isMissingColumnError(shipmentsError, /\b(consolidation_id|receiver_id)\b/i)) {
      const fallbackShipmentsRes = await supabase
        .from("shipments")
        .select("id, code, customer_id, status, created_at, updated_at, estimated_delivery_date, collected_at, collected_by, service_type, description, notes, custom_tracking_number, weight, cbm, total_cost, shipping_cost, payment_status, quantity, length, width, height, handling_method, customers(full_name, code, phone), receiver:receivers(full_name, phone, address)")
        .order("created_at", { ascending: false });
      shipmentsData = (fallbackShipmentsRes.data || []).map(row => ({
        ...row,
        handling_method: null,
        consolidation_id: null,
        receiver_id: null,
      })) as any;
      shipmentsError = fallbackShipmentsRes.error as { code?: string; message?: string } | null;
    }

    let consolidationsData = consolidationsRes.data;
    let consolidationsError = consolidationsRes.error as { code?: string; message?: string } | null;

    if (consolidationsError && isMissingConsolidationTotalsError(consolidationsError)) {
      const fallback = await supabase
        .from("consolidations")
        .select("id, code, customer_id, status, notes, created_at, updated_at, collected_at, collected_by, customers(full_name, code, phone), consolidation_shipments(shipment_id, shipment:shipments(id, code, created_at, updated_at, estimated_delivery_date, collected_at, collected_by, description, notes, service_type, custom_tracking_number, status, quantity, weight, cbm, total_cost, shipping_cost, payment_status, length, width, height, handling_method, receiver:receivers(full_name, phone, address)))")
        .order("created_at", { ascending: false });
      consolidationsData = (fallback.data || []).map((row: any) => ({
        ...row,
        item_count: null,
        total_weight: null,
        total_cbm: null,
        total_cost: null,
        tracking_code: null,
      }));
      consolidationsError = fallback.error as { code?: string; message?: string } | null;
    }

    if (shipmentsError) {
      toast.error("Failed to load parcels.");
      setShipments([]);
    } else {
      setShipments((shipmentsData || []) as ShipmentRow[]);
    }
    if (consolidationsError) {
      toast.error("Failed to load consolidations.");
      setConsolidations([]);
    } else {
      setConsolidations((consolidationsData || []) as unknown as ConsolidationRow[]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel("warehouse-parcels-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "shipments" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "consolidations" }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadActorLabel = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      const nextLabel = user?.email || user?.id || "Warehouse";
      if (mounted) {
        setCollectionActorLabel(nextLabel);
      }
    };
    void loadActorLabel();
    return () => {
      mounted = false;
    };
  }, []);

  const removeShipmentFromLoadedState = (shipmentId: string) => {
    setShipments((prev) => prev.filter((shipment) => shipment.id !== shipmentId));
    setConsolidations((prev) =>
      prev
        .map((consolidation) => {
          const remainingChildren = (consolidation.consolidation_shipments || []).filter(
            (entry) => entry.shipment_id !== shipmentId && entry.shipment?.id !== shipmentId,
          );

          if (remainingChildren.length === (consolidation.consolidation_shipments || []).length) {
            return consolidation;
          }

          const remainingShipments = remainingChildren
            .map((entry) => entry.shipment)
            .filter(Boolean) as NonNullable<ConsolidationChild["shipment"]>[];

          return {
            ...consolidation,
            item_count: remainingShipments.reduce(
              (sum, shipment) => sum + (shipment.quantity || 1),
              0,
            ),
            total_weight: remainingShipments.reduce(
              (sum, shipment) => sum + (shipment.weight || 0),
              0,
            ),
            total_cbm: remainingShipments.reduce(
              (sum, shipment) => sum + getShipmentCbm(shipment),
              0,
            ),
            total_cost: remainingShipments.reduce(
              (sum, shipment) => sum + (shipment.shipping_cost || 0),
              0,
            ),
            consolidation_shipments: remainingChildren,
          };
        })
        .filter((consolidation) => (consolidation.consolidation_shipments || []).length > 0),
    );
    setSelectedBulkRowKeys((prev) => {
      const next = new Set(prev);
      next.delete(`shipment:${shipmentId}`);
      return next;
    });
    setViewRow((prev) => {
      if (!prev) return prev;
      if (prev.rowType === "shipment" && prev.id === shipmentId) return null;
      if (
        prev.rowType === "consolidation" &&
        prev.sourceConsolidation?.consolidation_shipments?.some(
          (entry) => entry.shipment_id === shipmentId || entry.shipment?.id === shipmentId,
        )
      ) {
        return null;
      }
      return prev;
    });
    setEditRow((prev) => {
      if (!prev) return prev;
      if (prev.rowType === "shipment" && prev.id === shipmentId) return null;
      if (
        prev.rowType === "consolidation" &&
        prev.sourceConsolidation?.consolidation_shipments?.some(
          (entry) => entry.shipment_id === shipmentId || entry.shipment?.id === shipmentId,
        )
      ) {
        return null;
      }
      return prev;
    });
    setVisibleRows((prev) =>
      prev.filter((row) => {
        if (row.rowType === "shipment") {
          return row.id !== shipmentId;
        }
        return !row.sourceConsolidation?.consolidation_shipments?.some(
          (entry) => entry.shipment_id === shipmentId || entry.shipment?.id === shipmentId,
        );
      }),
    );
  };

  const activeConsolidationShipmentIds = useMemo(() => {
    const ids = new Set<string>();
    const activeConsolidationCodes = new Set<string>();
    for (const consolidation of consolidations) {
      const status = normalizeConsolidationStatus(consolidation.status);
      if (!["submitted", "confirmed", "outgoing", "in_transit", "arrived", "collected"].includes(status)) {
        continue;
      }
      activeConsolidationCodes.add((consolidation.code || "").trim().toLowerCase());
      for (const child of consolidation.consolidation_shipments || []) {
        if (child.shipment_id) {
          ids.add(child.shipment_id);
        }
      }
    }
    for (const shipment of shipments) {
      const consolidationCode = extractNoteValue(shipment.notes, "Consolidation")?.trim().toLowerCase();
      if (consolidationCode && activeConsolidationCodes.has(consolidationCode)) {
        ids.add(shipment.id);
      }
    }
    return ids;
  }, [consolidations, shipments]);

  useEffect(() => {
    const tab = searchParams.get("tab");
    const resolvedTab = resolveTabKey(tab);
    setActiveTab(resolvedTab ?? "all");
  }, [searchParams]);

  const rows = useMemo(() => {
    const allConsolidationShipmentIds = new Set<string>();
    const shipmentsByConsolidationCode = new Map<string, ShipmentRow[]>();

    for (const shipment of shipments) {
      const consolidationCode = extractNoteValue(shipment.notes, "Consolidation")?.trim().toLowerCase();
      if (!consolidationCode) continue;
      const existing = shipmentsByConsolidationCode.get(consolidationCode) || [];
      existing.push(shipment);
      shipmentsByConsolidationCode.set(consolidationCode, existing);
    }

    for (const consolidation of consolidations) {
      for (const child of consolidation.consolidation_shipments || []) {
        if (child.shipment_id) {
          allConsolidationShipmentIds.add(child.shipment_id);
        }
      }
    }

    const shipmentRows: UnifiedRow[] = shipments
      .map((shipment) => {
        const normalizedStatus = normalizeShipmentStatus(shipment.status);
        const shouldHideTracking = ["requested_pickup", "approved"].includes(normalizedStatus);
        return {
          id: shipment.id,
          rowType: "shipment",
          isConsolidatedChild: !!shipment.consolidation_id,
          code: shipment.code,
          status: normalizedStatus,
          created_at: shipment.created_at,
          serviceType: formatServiceType(shipment.service_type),
          productType: getProductType(shipment.notes, shipment.description),
          item: shipment.description || "-",
          tracking: shouldHideTracking ? "" : resolveTrackingByStatus(normalizedStatus, shipment.notes, shipment.custom_tracking_number) || "",
          airwayBill: getAirwayBillNumber(shipment.notes) || "",
          qty: shipment.quantity || 1,
          weight: shipment.weight || 0,
          cbm: getShipmentCbm(shipment),
          dimensions: formatDimensions(shipment.length, shipment.width, shipment.height),
          itemCost: getShipmentItemCost(shipment),
          shippingFee: shipment.shipping_cost || 0,
          paymentStatus: shipment.payment_status,
          estimatedDeliveryDate: shipment.estimated_delivery_date,
          customerName: shipment.customers?.full_name || "-",
          customerCode: shipment.customers?.code || "-",
          receiverName: shipment.receiver?.full_name || "-",
          receiverPhone: shipment.receiver?.phone || "-",
          receiverAddress: shipment.receiver?.address || "-",
          handlingMethod: shipment.handling_method,
          sourceShipment: shipment,
        };
      });

    const consolidationRows: UnifiedRow[] = consolidations.map((consolidation) => {
      const childrenById = new Map<string, NonNullable<ConsolidationChild["shipment"]>>();

      (consolidation.consolidation_shipments || [])
        .map((entry) => entry.shipment)
        .filter(Boolean)
        .forEach((shipment) => childrenById.set(shipment.id, shipment as NonNullable<ConsolidationChild["shipment"]>));

      (shipmentsByConsolidationCode.get((consolidation.code || "").trim().toLowerCase()) || []).forEach((shipment) => {
        if (childrenById.has(shipment.id)) return;
        childrenById.set(shipment.id, shipment as NonNullable<ConsolidationChild["shipment"]>);
      });

      const children = Array.from(childrenById.values());
      const childItemCost = children.reduce((sum, child) => sum + getShipmentItemCost(child), 0);
      const childShippingFee = children.reduce((sum, child) => sum + (child.shipping_cost || 0), 0);
      const primaryTracking = children.find((child) => child.custom_tracking_number)?.custom_tracking_number || "";
      const primaryAirwayBill =
        getAirwayBillNumber(consolidation.notes) ||
        children.map((child) => getAirwayBillNumber(child.notes)).find((value) => !!value) ||
        "";
      const serviceTypes = Array.from(
        new Set(
          children
            .map((child) => (child.service_type || "").toLowerCase().trim())
            .map((type) => {
              if (type === "air" || type === "air freight" || type === "air_freight") return "air";
              if (type === "sea" || type === "sea freight" || type === "sea_freight") return "sea";
              return type;
            })
            .filter(Boolean),
        ),
      );
      const receiverNames = Array.from(
        new Set(children.map((child) => child.receiver?.full_name || "").filter(Boolean))
      );
      const receiverPhones = Array.from(
        new Set(children.map((child) => child.receiver?.phone || "").filter(Boolean))
      );
      const receiverAddresses = Array.from(
        new Set(children.map((child) => child.receiver?.address || "").filter(Boolean))
      );
      const noteServiceType = normalizeServiceType(extractNoteValue(consolidation.notes, "Service type"));
      const consolidationServiceType =
        noteServiceType ||
        (serviceTypes.length === 1 ? normalizeServiceType(serviceTypes[0]) || serviceTypes[0] : serviceTypes.length > 1 ? "mixed" : "");
      const isMixedConsolidation = children.length > 1;
      const noteProductType = extractNoteValue(consolidation.notes, "Product type");
      const childProductTypes = Array.from(
        new Set(
          children
            .map((child) => getProductType(child.notes, child.description))
            .map((value) => value.trim())
            .filter(Boolean)
        )
      );
      const consolidationProductType = noteProductType
        ? noteProductType
        : isMixedConsolidation
          ? (childProductTypes.length === 1 ? childProductTypes[0] : "Mixed Products")
          : childProductTypes[0] || "Mixed Products";
      const item = isMixedConsolidation
        ? (noteProductType || "Mixed Products")
        : children[0]?.description || children[0]?.code || "Consolidated shipment";
      const qty = consolidation.item_count ?? children.reduce((sum, child) => sum + (child.quantity || 1), 0);
      const totalWeight = consolidation.total_weight ?? children.reduce((sum, child) => sum + (child.weight || 0), 0);
      const totalCbm =
        consolidation.total_cbm ??
        getConsolidationCbmFromNotes(consolidation.notes) ??
        children.reduce((sum, child) => sum + getShipmentCbm(child), 0);
      const shippingFee = consolidation.total_cost ?? childShippingFee;
      const estimatedDeliveryDate = getLatestEstimatedDeliveryDate(
        children.map((child) => child.estimated_delivery_date),
      );
      const mappedStatus = mapConsolidationStatusToShipmentStatus[normalizeConsolidationStatus(consolidation.status)] || "requested_pickup";
      const shouldHideTracking = ["requested_pickup", "approved"].includes(mappedStatus);
      return {
        id: consolidation.id,
        rowType: "consolidation",
        code: consolidation.code,
        status: mappedStatus,
        created_at: consolidation.created_at,
        serviceType: formatServiceType(consolidationServiceType),
        productType: consolidationProductType,
        item,
        tracking: shouldHideTracking ? "" : resolveTrackingByStatus(mappedStatus, consolidation.notes, primaryTracking) || "",
        airwayBill: primaryAirwayBill,
        qty,
        weight: totalWeight,
        cbm: totalCbm,
        dimensions: children.length === 1
          ? formatDimensions(children[0].length, children[0].width, children[0].height)
          : "Multiple",
        itemCost: childItemCost,
        shippingFee,
        paymentStatus: children.length && children.every((child) => child.payment_status === "completed") ? "completed" : "pending",
        estimatedDeliveryDate,
        customerName: consolidation.customers?.full_name || "-",
        customerCode: consolidation.customers?.code || "-",
        receiverName:
          receiverNames.length === 0
            ? "-"
            : receiverNames.length === 1
              ? receiverNames[0]
              : "Multiple Receivers",
        receiverPhone: receiverPhones.length === 1 ? receiverPhones[0] : "-",
        receiverAddress: receiverAddresses.length === 1 ? receiverAddresses[0] : "-",
        handlingMethod: "consolidated",
        sourceConsolidation: consolidation,
      };
    });
    return [...shipmentRows, ...consolidationRows].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [shipments, consolidations, activeConsolidationShipmentIds]);

  const counts = useMemo(
    () => tabDefs.reduce((acc, tab) => ({ ...acc, [tab.key]: getTabCount(rows, tab.key) }), {} as Record<TabKey, number>),
    [rows],
  );
  const filteredRows = useMemo(() => filterByTab(rows, activeTab), [rows, activeTab]);
  const canBulkSelectRow = (row: UnifiedRow) => {
    if (!warehouseBulkActionTabs.has(activeTab)) return false;
    if (activeTab === "arrived") {
      return row.paymentStatus === "completed";
    }
    return true;
  };

  useEffect(() => {
    setVisibleRows(filteredRows);
  }, [filteredRows]);

  useEffect(() => {
    const validKeys = new Set(
      filteredRows
        .filter((row) => canBulkSelectRow(row))
        .map((row) => getUnifiedRowSelectionKey(row)),
    );

    setSelectedBulkRowKeys((prev) => {
      const next = new Set<string>();
      prev.forEach((key) => {
        if (validKeys.has(key)) {
          next.add(key);
        }
      });
      return next;
    });

    if (activeTab !== "intransit") {
      setBulkTransitStatusMessage("");
    }

    if (activeTab !== "outgoing") {
      setBulkAirwayBillNumber("");
    }

    if (activeTab !== "outgoing") {
      setBulkTrackingNumber("");
    }
  }, [activeTab, filteredRows]);

  const bulkSelectableRows = useMemo(
    () => visibleRows.filter((row) => canBulkSelectRow(row)),
    [visibleRows, activeTab],
  );

  const toggleBulkRowSelection = (row: UnifiedRow, checked: boolean) => {
    const rowKey = getUnifiedRowSelectionKey(row);
    setSelectedBulkRowKeys((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(rowKey);
      } else {
        next.delete(rowKey);
      }
      return next;
    });
  };

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

    const selectedChildren = viewChildren.filter((child) => selectedConsolidationRemovalIds.has(child.id));
    if (selectedChildren.length === 0) {
      toast.error("Select at least one item to remove.");
      return;
    }

    if (viewChildren.length < 3) {
      toast.error("Item removal from consolidated shipments is only allowed when the shipment has 3 or more items.");
      return;
    }

    const remainingCount = viewChildren.length - selectedChildren.length;
    if (remainingCount < 2) {
      toast.error("A consolidated shipment must have at least 2 items remaining. Please remove fewer items.");
      return;
    }

    const confirmed = window.confirm(`Remove ${selectedChildren.length} item(s) from this consolidation? They will move back to Need Action.`);
    if (!confirmed) return;

    setIsSavingConsolidationRemoval(true);
    let successCount = 0;
    let failureCount = 0;

    for (const child of selectedChildren) {
      const { error } = await supabase.rpc("remove_submitted_shipment", { p_shipment_id: child.id });
      if (error) {
        failureCount++;
      } else {
        successCount++;
      }
    }

    if (successCount > 0) {
      toast.success(`Removed ${successCount} item(s) from consolidation.`);
      await fetchData();
    }
    if (failureCount > 0) {
      toast.error(`Failed to remove ${failureCount} item(s).`);
    }

    setIsSavingConsolidationRemoval(false);
    setSelectedConsolidationRemovalIds(new Set());
    setViewRow(null);
  };

  const handleSelectAllBulkRows = (checked: boolean) => {
    if (checked) {
      setSelectedBulkRowKeys(new Set(bulkSelectableRows.map((row) => getUnifiedRowSelectionKey(row))));
      return;
    }
    setSelectedBulkRowKeys(new Set());
  };

  const runShipmentUpdate = async (
    id: string,
    status: string,
    message: string,
    options?: { refresh?: boolean; silent?: boolean },
  ) => {
    const targetShipment = shipments.find((row) => row.id === id);
    if (status === "closed" && targetShipment?.payment_status !== "completed") {
      if (!options?.silent) {
        toast.error("The shipment must be paid in full before warehouse can mark it as Collected.");
      }
      return false;
    }

    // ENFORCE: Consolidation parcels can NEVER reach Submitted unless they have
    // already been grouped into a consolidation by the customer/agent.
    if (
      status === "requested_pickup" &&
      targetShipment &&
      !isSingleHandlingMethod(targetShipment as any)
    ) {
      const { data: links } = await supabase
        .from("consolidation_shipments")
        .select("id")
        .eq("shipment_id", id)
        .limit(1);
      if (!links || links.length === 0) {
        if (!options?.silent) {
          toast.error(
            "This parcel uses Consolidation handling. The customer/agent must consolidate it before it can move to Submitted.",
          );
        }
        return false;
      }
    }

    setUpdatingId(id);
    const isCollecting = status === "closed";
    const collectionTimestamp = new Date().toISOString();
    const originArrivalTimestamp = new Date().toISOString();
    const collectedByValue =
      formatCollectedByValue(
        targetShipment?.receiver?.full_name,
        targetShipment?.receiver?.phone,
      ) || collectionActorLabel;
    const attemptedTransitions: string[][] = [[status]];

    if (status === "received" && targetShipment) {
      attemptedTransitions.unshift(getWarehouseArrivalTransition(targetShipment, shipments));
    }

    if (status === "supplied") {
      attemptedTransitions.push(["assigned", "supplied"]);
    } else if (status === "delivered") {
      attemptedTransitions.push(["supplied", "delivered"]);
      attemptedTransitions.push(["assigned", "supplied", "delivered"]);
    } else if (status === "closed") {
      attemptedTransitions.push(["delivered", "closed"]);
      attemptedTransitions.push(["supplied", "delivered", "closed"]);
      attemptedTransitions.push(["assigned", "supplied", "delivered", "closed"]);
    }

    let updateError: { message: string } | null = null;
    let appliedTransition: string[] = [];
    for (const transition of attemptedTransitions) {
      let failed = false;
      for (const nextStatus of transition) {
        let nextNotes = targetShipment?.notes || null;
        if (nextStatus === "received") {
          nextNotes = upsertNoteValue(nextNotes, "Origin Arrival Date", originArrivalTimestamp);
        }
        if (isCollecting && nextStatus === "closed") {
          nextNotes = upsertNoteValue(nextNotes, "Collected by", collectedByValue);
          nextNotes = upsertNoteValue(nextNotes, "Collected at", collectionTimestamp);
        }
        const { error } = await supabase
          .from("shipments")
          .update({
            status: nextStatus as any,
            ...(isCollecting && nextStatus === "closed"
              ? { collected_by: collectedByValue, collected_at: collectionTimestamp }
              : {}),
            ...((nextStatus === "received" || nextStatus === "requested_pickup" || (isCollecting && nextStatus === "closed"))
              ? { notes: nextNotes }
              : {}),
          })
          .eq("id", id);
        if (error) {
          updateError = error;
          failed = true;
          break;
        }
      }
      if (!failed) {
        updateError = null;
        appliedTransition = transition;
        break;
      }
    }

    setUpdatingId(null);
    if (updateError) {
      if (!options?.silent) {
        toast.error(updateError.message || "Failed to update shipment.");
      }
      return false;
    }

    // Fire notifications for every status step that was actually applied
    if (targetShipment?.customer_id && appliedTransition.length > 0) {
      const handlingMethod = isSingleHandlingMethod(targetShipment as any) ? "single" : "consolidated";
      for (const stepStatus of appliedTransition) {
        const trackingNumber = resolveTrackingByStatus(
          stepStatus,
          targetShipment.notes,
          targetShipment.custom_tracking_number,
        );
        notifyStatusChange(
          targetShipment.customer_id,
          trackingNumber,
          targetShipment.id,
          stepStatus,
          { handlingMethod },
        ).catch((err) => console.error("notifyStatusChange failed:", err));
      }
    }

    if (!options?.silent) {
      toast.success(message);
    }
    if (options?.refresh !== false) {
      await fetchData();
    }
    return true;
  };

  const runConsolidationUpdate = async (
    id: string,
    status: string,
    message: string,
    updates?: Record<string, number | string>,
    options?: { refresh?: boolean; silent?: boolean },
  ) => {
    const targetRow = rows.find((row) => row.rowType === "consolidation" && row.id === id);
    if (status === "collected" && targetRow?.paymentStatus !== "completed") {
      if (!options?.silent) {
        toast.error("All linked shipments must be paid in full before warehouse can mark this consolidation as Collected.");
      }
      return false;
    }

    setUpdatingId(id);
    const isCollecting = status === "collected";
    const collectionTimestamp = new Date().toISOString();
    const collectedByValue =
      formatCollectedByValue(
        targetRow?.receiverName,
        targetRow?.receiverPhone,
      ) || collectionActorLabel;
    const attemptedStatuses = [status];
    if (status === "in_transit") attemptedStatuses.push("supplied");
    if (status === "arrived") attemptedStatuses.push("delivered");
    if (status === "collected") attemptedStatuses.push("closed");

    let updateError: { message: string } | null = null;
    for (const statusValue of attemptedStatuses) {
      let nextNotes = targetRow?.sourceConsolidation?.notes || null;
      if (isCollecting && (statusValue === "collected" || statusValue === "closed")) {
        nextNotes = upsertNoteValue(nextNotes, "Collected by", collectedByValue);
        nextNotes = upsertNoteValue(nextNotes, "Collected at", collectionTimestamp);
      }
      const { error } = await supabase
        .from("consolidations")
        .update({
          status: statusValue,
          ...(isCollecting && (statusValue === "collected" || statusValue === "closed")
            ? { collected_by: collectedByValue, collected_at: collectionTimestamp }
            : {}),
          ...updates,
          ...(isCollecting && (statusValue === "collected" || statusValue === "closed") ? { notes: nextNotes } : {}),
        })
        .eq("id", id);

      if (!error) {
        updateError = null;
        break;
      }
      updateError = error;
    }

    setUpdatingId(null);
    if (updateError) {
      if (!options?.silent) {
        toast.error(updateError.message || "Failed to update consolidation.");
      }
      return false;
    }

    if (isCollecting && targetRow?.sourceConsolidation) {
      const childShipments = (targetRow.sourceConsolidation.consolidation_shipments || [])
        .map((entry) => entry.shipment)
        .filter(Boolean) as NonNullable<ConsolidationChild["shipment"]>[];
      const childUpdateResults = await Promise.all(
        childShipments.map((shipment) => {
          const childCollectedByValue =
            formatCollectedByValue(
              shipment.receiver?.full_name,
              shipment.receiver?.phone,
            ) || collectedByValue;
          let nextNotes = upsertNoteValue(shipment.notes, "Collected by", childCollectedByValue);
          nextNotes = upsertNoteValue(nextNotes, "Collected at", collectionTimestamp);
          return supabase
            .from("shipments")
            .update({
              status: "closed",
              notes: nextNotes,
              collected_by: childCollectedByValue,
              collected_at: collectionTimestamp,
            })
            .eq("id", shipment.id);
        }),
      );
      const failedChildUpdate = childUpdateResults.find((result) => !!result.error);
      if (failedChildUpdate?.error) {
        if (!options?.silent) {
          toast.error(failedChildUpdate.error.message || "Failed to update linked shipment collection details.");
        }
        return false;
      }
    }

    // Fire status notification for the consolidation owner (one per call)
    const customerId = (targetRow?.sourceConsolidation as any)?.customer_id || null;
    if (customerId) {
      const consNoteForTracking = (targetRow?.sourceConsolidation as any)?.tracking_code
        || (targetRow?.sourceConsolidation as any)?.code
        || null;
      const finalConsStatus = (status === "in_transit" || status === "arrived" || status === "collected" || status === "submitted" || status === "confirmed" || status === "outgoing")
        ? mapConsolidationStatusToShipmentStatus[status as keyof typeof mapConsolidationStatusToShipmentStatus] || status
        : status;
      notifyStatusChange(
        customerId,
        consNoteForTracking,
        id,
        finalConsStatus,
        { handlingMethod: "consolidated" },
      ).catch((err) => console.error("notifyStatusChange (consolidation) failed:", err));
    }

    if (!options?.silent) {
      toast.success(message);
    }
    if (options?.refresh !== false) {
      await fetchData();
    }
    return true;
  };

  const updateTransitStatusForRow = async (
    row: UnifiedRow,
    nextTransitStatusMessage: string,
    options?: {
      refresh?: boolean;
      silent?: boolean;
      estimatedDeliveryDate?: string | null;
    },
  ) => {
    const trimmedMessage = nextTransitStatusMessage.trim();
    setUpdatingId(row.id);

    if (row.rowType === "shipment") {
      const shipmentUpdates: Record<string, unknown> = {
        notes: setTransitStatusMessage(row.sourceShipment?.notes || null, trimmedMessage || null),
      };
      if (options?.estimatedDeliveryDate !== undefined) {
        shipmentUpdates.estimated_delivery_date = options.estimatedDeliveryDate;
      }

      const { error } = await supabase
        .from("shipments")
        .update(shipmentUpdates)
        .eq("id", row.id);

      setUpdatingId(null);

      if (error) {
        if (!options?.silent) {
          toast.error(error.message || "Failed to update transit status message.");
        }
        return false;
      }

      if (!options?.silent) {
        toast.success("Transit status message updated.");
      }
      // Fire transit-update notification (SMS/Email/Bell)
      if (trimmedMessage && row.sourceShipment?.customer_id) {
        const tracking = resolveTrackingByStatus(row.status, row.sourceShipment.notes || null, row.sourceShipment.custom_tracking_number);
        notifyBulkTransitUpdate(row.sourceShipment.customer_id, tracking, row.id, trimmedMessage).catch(() => undefined);
      }
      if (options?.refresh !== false) {
        await fetchData();
      }
      return true;
    }

    const { error: consolidationError } = await supabase
      .from("consolidations")
      .update({
        notes: setTransitStatusMessage(row.sourceConsolidation?.notes || null, trimmedMessage || null),
      })
      .eq("id", row.id);

    if (!consolidationError && row.sourceConsolidation) {
      const childShipments = (row.sourceConsolidation.consolidation_shipments || [])
        .map((entry) => entry.shipment)
        .filter(Boolean) as NonNullable<ConsolidationChild["shipment"]>[];

      const childUpdateResults = await Promise.all(
        childShipments.map((shipment) => {
          const shipmentUpdates: Record<string, unknown> = {
            notes: setTransitStatusMessage(shipment.notes, trimmedMessage || null),
          };
          if (options?.estimatedDeliveryDate !== undefined) {
            shipmentUpdates.estimated_delivery_date = options.estimatedDeliveryDate;
          }

          return (
            supabase
              .from("shipments")
              .update(shipmentUpdates)
              .eq("id", shipment.id)
          );
        }
        ),
      );

      const failedUpdate = childUpdateResults.find((result) => !!result.error);
      if (failedUpdate?.error) {
        setUpdatingId(null);
        if (!options?.silent) {
          toast.error(
            failedUpdate.error.message || "Failed to update transit status on linked items.",
          );
        }
        return false;
      }
    }

    setUpdatingId(null);

    if (consolidationError) {
      if (!options?.silent) {
        toast.error(consolidationError.message || "Failed to update transit status message.");
      }
      return false;
    }

    if (!options?.silent) {
      toast.success("Transit status message updated.");
    }
    // Notify consolidation owner for transit message (single notification per consolidation)
    if (trimmedMessage && row.sourceConsolidation?.customer_id) {
      const consTracking = resolveTrackingByStatus(
        row.status,
        row.sourceConsolidation.notes || null,
        row.sourceConsolidation.tracking_code,
      );
      notifyBulkTransitUpdate(
        row.sourceConsolidation.customer_id,
        consTracking,
        row.id,
        trimmedMessage,
      ).catch(() => undefined);
    }
    if (options?.refresh !== false) {
      await fetchData();
    }
    return true;
  };

  const updateAirwayBillForRow = async (
    row: UnifiedRow,
    nextAirwayBillNumber: string,
    options?: { refresh?: boolean; silent?: boolean },
  ) => {
    const trimmedAirwayBillNumber = nextAirwayBillNumber.trim();
    setUpdatingId(row.id);

    if (row.rowType === "shipment") {
      const { error } = await supabase
        .from("shipments")
        .update({
          notes: setAirwayBillNumber(row.sourceShipment?.notes || null, trimmedAirwayBillNumber || null),
        })
        .eq("id", row.id);

      setUpdatingId(null);

      if (error) {
        if (!options?.silent) {
          toast.error(error.message || "Failed to update AWB/BL No.");
        }
        return false;
      }

      if (!options?.silent) {
        toast.success("AWB/BL No. updated.");
      }
      if (options?.refresh !== false) {
        await fetchData();
      }
      return true;
    }

    const { error: consolidationError } = await supabase
      .from("consolidations")
      .update({
        notes: setAirwayBillNumber(row.sourceConsolidation?.notes || null, trimmedAirwayBillNumber || null),
      })
      .eq("id", row.id);

    if (!consolidationError && row.sourceConsolidation) {
      const childShipments = (row.sourceConsolidation.consolidation_shipments || [])
        .map((entry) => entry.shipment)
        .filter(Boolean) as NonNullable<ConsolidationChild["shipment"]>[];

      const childUpdateResults = await Promise.all(
        childShipments.map((shipment) =>
          supabase
            .from("shipments")
            .update({
              notes: setAirwayBillNumber(shipment.notes, trimmedAirwayBillNumber || null),
            })
            .eq("id", shipment.id),
        ),
      );

      const failedUpdate = childUpdateResults.find((result) => !!result.error);
      if (failedUpdate?.error) {
        setUpdatingId(null);
        if (!options?.silent) {
          toast.error(failedUpdate.error.message || "Failed to update AWB/BL No. on linked items.");
        }
        return false;
      }
    }

    setUpdatingId(null);

    if (consolidationError) {
      if (!options?.silent) {
        toast.error(consolidationError.message || "Failed to update AWB/BL No.");
      }
      return false;
    }

    if (!options?.silent) {
      toast.success("AWB/BL No. updated.");
    }
    if (options?.refresh !== false) {
      await fetchData();
    }
    return true;
  };

  const updateTrackingNumberForRow = async (
    row: UnifiedRow,
    nextTrackingNumber: string,
    options?: { refresh?: boolean; silent?: boolean },
  ) => {
    const trimmedTrackingNumber = nextTrackingNumber.trim();
    setUpdatingId(row.id);

    if (row.rowType === "shipment") {
      const nextNotes = upsertNoteValue(
        row.sourceShipment?.notes || null,
        "Warehouse Tracking Number",
        trimmedTrackingNumber || null,
      );
      const { error } = await supabase
        .from("shipments")
        .update({ notes: nextNotes })
        .eq("id", row.id);

      setUpdatingId(null);

      if (error) {
        if (!options?.silent) {
          toast.error(error.message || "Failed to update tracking number.");
        }
        return false;
      }


      if (!options?.silent) {
        toast.success("Tracking number updated.");
      }
      if (options?.refresh !== false) {
        await fetchData();
      }
      return true;
    }

    const consolidationNotes = upsertNoteValue(
      row.sourceConsolidation?.notes || null,
      "Warehouse Tracking Number",
      trimmedTrackingNumber || null,
    );

    let { error: consolidationError } = await supabase
      .from("consolidations")
      .update({
        tracking_code: trimmedTrackingNumber || null,
        notes: consolidationNotes,
      })
      .eq("id", row.id);

    if (consolidationError && isMissingColumnError(consolidationError, /\btracking_code\b/i)) {
      const retry = await supabase
        .from("consolidations")
        .update({ notes: consolidationNotes })
        .eq("id", row.id);
      consolidationError = retry.error;
    }

    if (!consolidationError && row.sourceConsolidation) {
      const childShipments = (row.sourceConsolidation.consolidation_shipments || [])
        .map((entry) => entry.shipment)
        .filter(Boolean) as NonNullable<ConsolidationChild["shipment"]>[];

      const childUpdateResults = await Promise.all(
        childShipments.map((shipment) =>
          supabase
            .from("shipments")
            .update({
              notes: upsertNoteValue(
                shipment.notes,
                "Warehouse Tracking Number",
                trimmedTrackingNumber || null,
              ),
            })
            .eq("id", shipment.id),
        ),
      );

      const failedUpdate = childUpdateResults.find((result) => !!result.error);
      if (failedUpdate?.error) {
        setUpdatingId(null);
        if (!options?.silent) {
          toast.error(failedUpdate.error.message || "Failed to update tracking on linked items.");
        }
        return false;
      }
    }

    setUpdatingId(null);

    if (consolidationError) {
      if (!options?.silent) {
        toast.error(consolidationError.message || "Failed to update tracking number.");
      }
      return false;
    }


    if (!options?.silent) {
      toast.success("Tracking number updated.");
    }
    if (options?.refresh !== false) {
      await fetchData();
    }
    return true;
  };

  const handleWarehouseBulkAction = async (action: "incoming" | "arrival" | "awb_update" | "tracking_update" | "transit_message" | "in_transit" | "arrived" | "collected") => {
    const selectedRows = filteredRows.filter(
      (row) =>
        canBulkSelectRow(row) &&
        selectedBulkRowKeys.has(getUnifiedRowSelectionKey(row)),
    );

    if (selectedRows.length === 0) {
      toast.error("Select at least one parcel first.");
      return;
    }

    if (action === "transit_message" && !bulkTransitStatusMessage.trim()) {
      toast.error("Enter the custom transit message to send.");
      return;
    }

    if (action === "awb_update" && !bulkAirwayBillNumber.trim()) {
      toast.error("Enter the AWB/BL No. to apply.");
      return;
    }

    if (action === "tracking_update" && !bulkTrackingNumber.trim()) {
      toast.error("Enter the tracking number to apply.");
      return;
    }

    setActiveBulkAction(action);

    let successCount = 0;
    let failureCount = 0;

    for (const row of selectedRows) {
      let succeeded = false;

      if (action === "incoming" && row.rowType === "shipment") {
        succeeded = await runShipmentUpdate(
          row.id,
          "saved_dropoff",
          "Moved to Incoming.",
          { refresh: false, silent: true },
        );
      } else if (action === "arrival" && row.rowType === "shipment") {
        succeeded = await runShipmentUpdate(
          row.id,
          "received",
          getWarehouseArrivalTransition(row.sourceShipment!, shipments).at(-1) === "requested_pickup"
            ? "Single parcel moved straight to Submitted."
            : "Moved to Need Action.",
          { refresh: false, silent: true },
        );
      } else if (action === "in_transit") {
        succeeded =
          row.rowType === "consolidation"
            ? await runConsolidationUpdate(
              row.id,
              "in_transit",
              "Moved to In Transit.",
              undefined,
              { refresh: false, silent: true },
            )
            : await runShipmentUpdate(
              row.id,
              "supplied",
              "Moved to In Transit.",
              { refresh: false, silent: true },
            );
      } else if (action === "transit_message") {
        succeeded = await updateTransitStatusForRow(row, bulkTransitStatusMessage, {
          refresh: false,
          silent: true,
        });
      } else if (action === "awb_update") {
        succeeded = await updateAirwayBillForRow(row, bulkAirwayBillNumber, {
          refresh: false,
          silent: true,
        });
      } else if (action === "tracking_update") {
        succeeded = await updateTrackingNumberForRow(row, bulkTrackingNumber, {
          refresh: false,
          silent: true,
        });
      } else if (action === "arrived") {
        succeeded =
          row.rowType === "consolidation"
            ? await runConsolidationUpdate(
              row.id,
              "arrived",
              "Moved to Ready for Collection.",
              undefined,
              { refresh: false, silent: true },
            )
            : await runShipmentUpdate(
              row.id,
              "delivered",
              "Moved to Ready for Collection.",
              { refresh: false, silent: true },
            );
      } else if (action === "collected") {
        succeeded =
          row.rowType === "consolidation"
            ? await runConsolidationUpdate(
              row.id,
              "collected",
              "Moved to Collected.",
              undefined,
              { refresh: false, silent: true },
            )
            : await runShipmentUpdate(
              row.id,
              "closed",
              "Moved to Collected.",
              { refresh: false, silent: true },
            );
      }

      if (succeeded) {
        successCount += 1;
        // Send notifications for status changes
        const customerId = row.rowType === "shipment"
          ? row.sourceShipment?.customer_id
          : row.sourceConsolidation?.customer_id || null;
        // Notifications are handled inside runShipmentUpdate, runConsolidationUpdate, etc.
        // so we don't need to call them again here to avoid duplicates.
      } else {
        failureCount += 1;
      }
    }

    setActiveBulkAction(null);

    if (successCount > 0) {
      setSelectedBulkRowKeys(new Set());
      if (action === "transit_message") {
        setBulkTransitStatusMessage("");
      }
      if (action === "awb_update") {
        setBulkAirwayBillNumber("");
      }
      if (action === "tracking_update") {
        setBulkTrackingNumber("");
      }
      await fetchData();
    }

    if (successCount === 0) {
      toast.error("No selected parcels could be updated.");
      return;
    }

    const actionLabel =
      action === "incoming"
        ? "moved to Incoming"
        : action === "arrival"
          ? "processed on arrival"
          : action === "in_transit"
            ? "moved to In Transit"
            : action === "awb_update"
              ? "updated AWB/BL No. for"
              : action === "tracking_update"
                ? "updated tracking numbers for"
                : action === "transit_message"
                  ? "sent the transit message for"
                  : action === "arrived"
                    ? "marked Ready for Collection"
                    : "marked Collected";

    toast.success(
      failureCount > 0
        ? `Updated ${successCount} parcel(s) and skipped ${failureCount}.`
        : `Successfully ${actionLabel} ${successCount} parcel(s).`,
    );
  };

  const handleDeleteShipment = async (row: UnifiedRow) => {
    if (row.rowType !== "shipment") return;

    const confirmed = window.confirm("Delete this shipment and all linked records?");
    if (!confirmed) return;

    setUpdatingId(row.id);
    const { error } = await supabase.rpc("delete_shipment_record" as any, {
      _shipment_id: row.id,
    } as any);

    setUpdatingId(null);

    if (error) {
      toast.error(error.message || "Failed to delete shipment.");
      return;
    }

    removeShipmentFromLoadedState(row.id);
    toast.success("Shipment deleted successfully.");
    void fetchData();
  };

  const handleDeleteAllParcels = async () => {
    const confirmed = window.confirm(
      "Delete all parcels and linked shipment records from every portal? This removes shipments, invoices, payments, support tickets, claims, consolidations, and parcel tracking notifications.",
    );
    if (!confirmed) return;

    setIsDeletingAll(true);
    const { data, error } = await supabase.rpc("delete_all_parcel_records" as any);
    setIsDeletingAll(false);

    if (error) {
      toast.error(error.message || "Failed to delete all parcels.");
      return;
    }

    setViewRow(null);
    setEditRow(null);
    toast.success(`${Number(data || 0)} parcel(s) deleted successfully.`);
    fetchData();
  };

  const openEditDialog = (row: UnifiedRow) => {
    const buildEditableItems = (): EditableItem[] => {
      if (row.rowType === "shipment" && row.sourceShipment) {
        return [
          {
            id: row.sourceShipment.id,
            shipmentId: row.sourceShipment.id,
            description: row.sourceShipment.description || row.sourceShipment.code || "",
            quantity: toInputNumberValue(row.sourceShipment.quantity, "1"),
            // Pre-fill existing customer-entered values for all fields except Shipping Fee
            weight: toInputNumberValue(row.sourceShipment.weight),
            cbm: toInputNumberValue(getShipmentCbm(row.sourceShipment)),
            itemCost: toInputNumberValue(getShipmentItemCost(row.sourceShipment)),
            length: toInputNumberValue(row.sourceShipment.length),
            width: toInputNumberValue(row.sourceShipment.width),
            height: toInputNumberValue(row.sourceShipment.height),
          },
        ];
      }

      const consolidationChildren = (row.sourceConsolidation?.consolidation_shipments || [])
        .map((entry) => entry.shipment)
        .filter(Boolean) as NonNullable<ConsolidationChild["shipment"]>[];

      return consolidationChildren.map((child) => ({
        id: child.id,
        shipmentId: child.id,
        description: child.description || child.code || "",
        quantity: toInputNumberValue(child.quantity, "1"),
        // Pre-fill existing customer-entered values for all fields except Shipping Fee
        weight: toInputNumberValue(child.weight),
        cbm: toInputNumberValue(getShipmentCbm(child)),
        itemCost: toInputNumberValue(getShipmentItemCost(child)),
        length: toInputNumberValue(child.length),
        width: toInputNumberValue(child.width),
        height: toInputNumberValue(child.height),
      }));
    };

    const getInitialServiceType = (): "air" | "sea" => {
      if (row.rowType === "shipment" && row.sourceShipment) {
        return normalizeServiceType(row.sourceShipment.service_type) || "air";
      }

      const consolidationNoteServiceType = normalizeServiceType(
        extractNoteValue(row.sourceConsolidation?.notes || null, "Service type")
      );
      if (consolidationNoteServiceType) return consolidationNoteServiceType;

      const children = (row.sourceConsolidation?.consolidation_shipments || [])
        .map((entry) => entry.shipment)
        .filter(Boolean) as NonNullable<ConsolidationChild["shipment"]>[];
      const firstChildServiceType = normalizeServiceType(children[0]?.service_type);
      return firstChildServiceType || "air";
    };

    const getInitialProductType = () => {
      if (row.rowType === "shipment" && row.sourceShipment) {
        const value = getProductType(row.sourceShipment.notes, row.sourceShipment.description);
        return value === "-" ? "" : value;
      }

      const noteProductType = extractNoteValue(row.sourceConsolidation?.notes || null, "Product type");
      if (noteProductType) return noteProductType;

      const children = (row.sourceConsolidation?.consolidation_shipments || [])
        .map((entry) => entry.shipment)
        .filter(Boolean) as NonNullable<ConsolidationChild["shipment"]>[];
      const childProductTypes = Array.from(
        new Set(
          children
            .map((child) => getProductType(child.notes, child.description))
            .filter((value) => value && value !== "-")
        )
      );
      if (childProductTypes.length === 1) return childProductTypes[0];
      return "";
    };

    setEditRow(row);
    setEditShippingFee(toInputNumberValue(row.shippingFee));
    setEditTrackingNumber(row.tracking || "");
    setEditAirwayBill(row.airwayBill || "");
    setEditEstimatedDate(toDateInputValue(row.estimatedDeliveryDate));
    setEditTransitStatusMessage(
      row.rowType === "shipment"
        ? getTransitStatusMessage(row.sourceShipment?.notes || null) || ""
        : getTransitStatusMessage(row.sourceConsolidation?.notes || null) || ""
    );
    setEditItemCount(toInputNumberValue(row.qty));
    setEditWeight(toInputNumberValue(row.weight));
    setEditCbm(toInputNumberValue(row.cbm));
    setEditServiceType(getInitialServiceType());
    setEditProductType(getInitialProductType());
    setEditItems(buildEditableItems());
    setEditReceiver(
      row.rowType === "shipment"
        ? row.sourceShipment?.receiver || { full_name: row.receiverName, phone: row.receiverPhone, address: row.receiverAddress }
        : { full_name: row.receiverName, phone: row.receiverPhone, address: row.receiverAddress }
    );
    if (row.rowType === "consolidation") {
      const consolidationChildren = (row.sourceConsolidation?.consolidation_shipments || [])
        .map((entry) => entry.shipment)
        .filter(Boolean) as NonNullable<ConsolidationChild["shipment"]>[];
      const fees: Record<string, string> = {};
      for (const child of consolidationChildren) {
        // At Submitted stage, shipping fee must be blank initially
        fees[child.id] = activeTab === "submitted" ? "" : toInputNumberValue(child.shipping_cost);
      }
      setEditItemShippingFees(fees);
    } else if (row.sourceShipment) {
      setEditItemShippingFees({
        // At Submitted stage, shipping fee must be blank initially
        [row.sourceShipment.id]: activeTab === "submitted" ? "" : toInputNumberValue(row.sourceShipment.shipping_cost),
      });
    } else {
      setEditItemShippingFees({});
    }
  };

  const updateEditItem = (itemId: string, key: keyof Omit<EditableItem, "id" | "shipmentId">, value: string) => {
    setEditItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, [key]: value } : item))
    );
  };

  const submittedEditTotals = useMemo(() => {
    const totalItems = editItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const totalWeight = editItems.reduce((sum, item) => sum + Number(item.weight || 0), 0);
    const totalCbm = editItems.reduce((sum, item) => sum + Number(item.cbm || 0), 0);
    const totalShippingFee = editItems.reduce(
      (sum, item) => sum + Number(editItemShippingFees[item.id] || 0),
      0,
    );

    return {
      totalItems: Number.isFinite(totalItems) ? totalItems : 0,
      totalWeight: Number.isFinite(totalWeight) ? totalWeight : 0,
      totalCbm: Number.isFinite(totalCbm) ? totalCbm : 0,
      totalShippingFee: Number.isFinite(totalShippingFee) ? totalShippingFee : 0,
    };
  }, [editItemShippingFees, editItems]);

  const saveEdit = async () => {
    if (!editRow) return;

    const parsedShippingFee = Number(editShippingFee || 0);
    const parsedWeight = Number(editWeight || 0);
    const parsedCbm = Number(editCbm || 0);
    const parsedItemCount = Number(editItemCount || 0);
    const nextProductType = editProductType.trim();
    const nextServiceType = editServiceType;
    const nextEstimatedDate = editEstimatedDate.trim() || null;

    setUpdatingId(editRow.id);

    const releaseState = () => {
      setUpdatingId(null);
      setEditRow(null);
      setEditItems([]);
      setEditItemShippingFees({});
      setEditEstimatedDate("");
    };

    const upsertMetadataInNotes = (notes: string | null) => {
      let nextNotes = upsertNoteValue(notes, "Product type", nextProductType || null);
      nextNotes = upsertNoteValue(nextNotes, "Service type", nextServiceType);
      return nextNotes;
    };

    if (activeTab === "submitted") {
      const invalidItem = editItems.find((item) => {
        const qty = Number(item.quantity);
        const weight = Number(item.weight);
        const cbm = Number(item.cbm);
        const itemCost = Number(item.itemCost);
        const shippingFee = Number(editItemShippingFees[item.id] || 0);
        return (
          Number.isNaN(qty) ||
          Number.isNaN(weight) ||
          Number.isNaN(cbm) ||
          Number.isNaN(itemCost) ||
          Number.isNaN(shippingFee) ||
          qty < 0 ||
          weight < 0 ||
          cbm < 0 ||
          itemCost < 0 ||
          shippingFee < 0
        );
      });
      if (invalidItem) {
        setUpdatingId(null);
        return toast.error("Each item row must have valid non-negative quantity, weight, CBM, shipping fee, and cost.");
      }

      const computedItemCount = editItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
      const computedWeight = editItems.reduce((sum, item) => sum + Number(item.weight || 0), 0);
      const computedCbm = editItems.reduce((sum, item) => sum + Number(item.cbm || 0), 0);
      const computedShippingFee = editItems.reduce(
        (sum, item) => sum + Number(editItemShippingFees[item.id] || 0),
        0,
      );

      // Strict validation for Submitted ->
      // Only Shipping Fee is required before moving to Confirm Shipment.
      // Weight, CBM, and other fields are optional.
      const missingShippingFee = editItems.some((item) => {
        const fee = editItemShippingFees[item.id];
        return fee === undefined || fee === "" || Number(fee) <= 0;
      });

      if (missingShippingFee) {
        setUpdatingId(null);
        return toast.error("Shipping Fee is required for all items before moving to Confirm Shipment.");
      }

      if (editRow.rowType === "shipment") {
        const firstItem = editItems[0];
        const updates: Record<string, unknown> = {
          weight: computedWeight,
          cbm: computedCbm,
          shipping_cost: computedShippingFee,
          status: "approved",
          notes: upsertNoteValue(
            upsertMetadataInNotes(editRow.sourceShipment?.notes || null),
            "CBM",
            computedCbm.toFixed(4)
          ),
        };

        if (firstItem) {
          updates.description = firstItem.description || null;
          updates.quantity = Number(firstItem.quantity || 0);
          updates.total_cost = Number(firstItem.itemCost || 0);
          updates.length = Number(firstItem.length || 0);
          updates.width = Number(firstItem.width || 0);
          updates.height = Number(firstItem.height || 0);
        }

        let { error } = await supabase.from("shipments").update(updates).eq("id", editRow.id);
        if (error && isColumnWriteRestrictedError(error, /\bcbm\b/i)) {
          const fallbackUpdates = {
            ...updates,
          };
          delete fallbackUpdates.cbm;
          const retryResult = await supabase
            .from("shipments")
            .update(fallbackUpdates)
            .eq("id", editRow.id);
          error = retryResult.error;
        }
        setUpdatingId(null);
        if (error) return toast.error(error.message || "Failed to update shipment.");


        toast.success("Updated and moved to Confirm Shipment.");
        releaseState();
        setSearchParams({ tab: "confirm" });
        fetchData();
        return;
      }

      const childRows = editItems.filter((item) => !!item.shipmentId);
      for (const item of childRows) {
        const childPayload: Record<string, unknown> = {
          description: item.description || null,
          quantity: Number(item.quantity || 0),
          weight: Number(item.weight || 0),
          cbm: Number(item.cbm || 0),
          shipping_cost: Number(editItemShippingFees[item.id] || 0),
          total_cost: Number(item.itemCost || 0),
          length: Number(item.length || 0),
          width: Number(item.width || 0),
          height: Number(item.height || 0),
          notes: upsertNoteValue(
            upsertMetadataInNotes(
              editRow.sourceConsolidation?.consolidation_shipments
                ?.find((entry) => entry.shipment_id === item.shipmentId)
                ?.shipment?.notes || null,
            ),
            "CBM",
            Number(item.cbm || 0).toFixed(4)
          ),
        };
        const childWithoutCbm = { ...childPayload };
        delete childWithoutCbm.cbm;

        let { error: childError } = await supabase
          .from("shipments")
          .update(childPayload)
          .eq("id", item.shipmentId as string);

        if (childError && isColumnWriteRestrictedError(childError, /\bcbm\b/i)) {
          const retryResult = await supabase
            .from("shipments")
            .update(childWithoutCbm)
            .eq("id", item.shipmentId as string);
          childError = retryResult.error;
        }

        if (childError) {
          setUpdatingId(null);
          return toast.error(childError.message || "Failed to update one or more item rows.");
        }
      }

      const consolidationUpdates: Record<string, unknown> = {
        item_count: computedItemCount,
        total_weight: computedWeight,
        total_cbm: computedCbm,
        total_cost: computedShippingFee,
        status: "confirmed",
        notes: setConsolidationCbmInNotes(
          upsertMetadataInNotes(editRow.sourceConsolidation?.notes || null),
          computedCbm
        ),
      };

      let { error: consolidationError } = await supabase
        .from("consolidations")
        .update(consolidationUpdates)
        .eq("id", editRow.id);

      if (consolidationError && isColumnWriteRestrictedError(consolidationError, /\btotal_cbm\b/i)) {
        const fallbackPayload = {
          item_count: computedItemCount,
          total_weight: computedWeight,
          total_cost: computedShippingFee,
          status: "confirmed",
          notes: setConsolidationCbmInNotes(
            editRow.sourceConsolidation?.notes || null,
            computedCbm
          ),
        };
        const retryResult = await supabase
          .from("consolidations")
          .update(fallbackPayload)
          .eq("id", editRow.id);
        consolidationError = retryResult.error;
      }

      setUpdatingId(null);
      if (consolidationError) {
        return toast.error(consolidationError.message || "Failed to update consolidation.");
      }
      toast.success("Updated and moved to Confirm Shipment.");
      releaseState();
      setSearchParams({ tab: "confirm" });
      fetchData();
      return;
    }

    if (activeTab === "outgoing") {
      if (
        Number.isNaN(parsedShippingFee) ||
        Number.isNaN(parsedWeight) ||
        Number.isNaN(parsedCbm) ||
        parsedShippingFee < 0 ||
        parsedWeight < 0 ||
        parsedCbm < 0
      ) {
        setUpdatingId(null);
        return toast.error("Shipping fee, weight, and CBM must be valid non-negative values.");
      }

      if (editRow.rowType === "shipment") {
        const baseNotes = setAirwayBillNumber(
          upsertMetadataInNotes(editRow.sourceShipment?.notes || null),
          editAirwayBill.trim() || null
        );
        const nextNotes = upsertNoteValue(
          upsertNoteValue(baseNotes, "CBM", parsedCbm.toFixed(4)),
          "Warehouse Tracking Number",
          editTrackingNumber.trim() || null,
        );

        const { error } = await supabase
          .from("shipments")
          .update({
            estimated_delivery_date: nextEstimatedDate,
            notes: nextNotes,
            shipping_cost: parsedShippingFee,
            weight: parsedWeight,
            cbm: parsedCbm,
            service_type: nextServiceType,
          })
          .eq("id", editRow.id);

        let nextError = error;
        if (nextError && isColumnWriteRestrictedError(nextError, /\bcbm\b/i)) {
          const retryResult = await supabase
            .from("shipments")
            .update({
              estimated_delivery_date: nextEstimatedDate,
              notes: nextNotes,
              shipping_cost: parsedShippingFee,
              weight: parsedWeight,
              service_type: nextServiceType,
            })
            .eq("id", editRow.id);
          nextError = retryResult.error;
        }

        setUpdatingId(null);
        if (nextError) return toast.error(nextError.message || "Failed to update outgoing details.");
        toast.success("Outgoing details updated.");
        if (editTrackingNumber.trim() && editRow.sourceShipment?.customer_id) {
          notifyWarehouseTrackingAssigned(editRow.sourceShipment.customer_id, editRow.id)
            .catch((err) => console.error("notifyWarehouseTrackingAssigned failed:", err));
        }
        releaseState();
        fetchData();
        return;
      }

      let consolidationNotes = setAirwayBillNumber(
        upsertMetadataInNotes(editRow.sourceConsolidation?.notes || null),
        editAirwayBill.trim() || null
      );
      consolidationNotes = setConsolidationCbmInNotes(consolidationNotes, parsedCbm);
      consolidationNotes = upsertNoteValue(
        consolidationNotes,
        "Warehouse Tracking Number",
        editTrackingNumber.trim() || null,
      );

      const consolidationPayload: Record<string, unknown> = {
        tracking_code: editTrackingNumber.trim() || null,
        notes: consolidationNotes,
        total_cost: parsedShippingFee,
        total_weight: parsedWeight,
        total_cbm: parsedCbm,
      };

      let { error: consolidationError } = await supabase
        .from("consolidations")
        .update(consolidationPayload)
        .eq("id", editRow.id);

      if (consolidationError && isMissingColumnError(consolidationError, /\btracking_code\b/i) && "tracking_code" in consolidationPayload) {
        delete consolidationPayload.tracking_code;
        const retryResult = await supabase
          .from("consolidations")
          .update(consolidationPayload)
          .eq("id", editRow.id);
        consolidationError = retryResult.error;
      }

      if (consolidationError && isColumnWriteRestrictedError(consolidationError, /\btotal_cbm\b/i) && "total_cbm" in consolidationPayload) {
        delete consolidationPayload.total_cbm;
        const retryResult = await supabase
          .from("consolidations")
          .update(consolidationPayload)
          .eq("id", editRow.id);
        consolidationError = retryResult.error;
      }

      if (consolidationError && isMissingColumnError(consolidationError, /\btracking_code\b/i) && "tracking_code" in consolidationPayload) {
        delete consolidationPayload.tracking_code;
        const retryResult = await supabase
          .from("consolidations")
          .update(consolidationPayload)
          .eq("id", editRow.id);
        consolidationError = retryResult.error;
      }

      if (editRow.sourceConsolidation) {
        const childShipments = (editRow.sourceConsolidation.consolidation_shipments || [])
          .map((entry) => entry.shipment)
          .filter(Boolean) as NonNullable<ConsolidationChild["shipment"]>[];

        const childUpdateResults = await Promise.all(
          childShipments.map((shipment) =>
            supabase
              .from("shipments")
              .update({
                estimated_delivery_date: nextEstimatedDate,
                notes: upsertNoteValue(
                  setAirwayBillNumber(
                    upsertMetadataInNotes(shipment.notes),
                    editAirwayBill.trim() || null
                  ),
                  "Warehouse Tracking Number",
                  editTrackingNumber.trim() || null,
                ),
                service_type: nextServiceType,
              })
              .eq("id", shipment.id)
          )
        );

        const failedUpdate = childUpdateResults.find((result) => !!result.error);
        if (failedUpdate?.error) {
          setUpdatingId(null);
          return toast.error(
            failedUpdate.error.message || "Failed to update AWB/BL No. on linked items."
          );
        }
      }

      setUpdatingId(null);
      if (consolidationError) return toast.error(consolidationError.message || "Failed to update outgoing details.");
      toast.success("Outgoing details updated.");
      if (editTrackingNumber.trim()) {
        const consCustomerId = (editRow.sourceConsolidation as any)?.customer_id;
        if (consCustomerId) {
          notifyWarehouseTrackingAssigned(consCustomerId, editRow.id)
            .catch((err) => console.error("notifyWarehouseTrackingAssigned failed:", err));
        }
      }
      releaseState();
      fetchData();
      return;
    }

    if (["all", "created", "incoming"].includes(activeTab)) {
      if (editRow.rowType === "shipment") {
        const firstItem = editItems[0];
        const baseNotes = upsertMetadataInNotes(editRow.sourceShipment?.notes || null);
        const nextNotes = upsertNoteValue(
          upsertNoteValue(baseNotes, "CBM", parsedCbm.toFixed(4)),
          "Warehouse Tracking Number",
          editTrackingNumber.trim() || null,
        );

        const updates: Record<string, unknown> = {
          notes: nextNotes,
          shipping_cost: parsedShippingFee,
          weight: parsedWeight,
          cbm: parsedCbm,
          service_type: nextServiceType,
          custom_tracking_number: editTrackingNumber.trim() || null,
        };

        if (firstItem) {
          updates.description = firstItem.description || null;
          updates.quantity = Number(firstItem.quantity || 0);
          updates.total_cost = Number(firstItem.itemCost || 0);
          updates.length = Number(firstItem.length || 0);
          updates.width = Number(firstItem.width || 0);
          updates.height = Number(firstItem.height || 0);
        }

        const { error } = await supabase.from("shipments").update(updates).eq("id", editRow.id);

        if (editReceiver && editRow.sourceShipment?.receiver_id) {
          await supabase
            .from("receivers")
            .update({
              full_name: editReceiver.full_name,
              phone: editReceiver.phone,
              address: editReceiver.address,
            })
            .eq("id", editRow.sourceShipment.receiver_id);
        }

        setUpdatingId(null);
        if (error) return toast.error(error.message || "Failed to update shipment details.");
        toast.success("Shipment details updated.");
        releaseState();
        fetchData();
        return;
      }
    }

    if (activeTab === "intransit") {
      const updated = await updateTransitStatusForRow(editRow, editTransitStatusMessage, {
        refresh: false,
        estimatedDeliveryDate: nextEstimatedDate,
      });
      if (!updated) return;
      releaseState();
      await fetchData();
      return;
    }

    if (activeTab === "confirm") {
      if (
        Number.isNaN(parsedShippingFee) ||
        Number.isNaN(parsedWeight) ||
        Number.isNaN(parsedCbm) ||
        parsedShippingFee < 0 ||
        parsedWeight < 0 ||
        parsedCbm < 0
      ) {
        setUpdatingId(null);
        return toast.error("Shipping fee, weight, and CBM must be valid non-negative values.");
      }

      if (editRow.rowType === "shipment") {
        const nextNotes = upsertNoteValue(
          upsertMetadataInNotes(editRow.sourceShipment?.notes || null),
          "CBM",
          parsedCbm.toFixed(4)
        );

        let { error } = await supabase
          .from("shipments")
          .update({
            shipping_cost: parsedShippingFee,
            weight: parsedWeight,
            cbm: parsedCbm,
            service_type: nextServiceType,
            notes: nextNotes,
          })
          .eq("id", editRow.id);

        if (error && isColumnWriteRestrictedError(error, /\bcbm\b/i)) {
          const retryResult = await supabase
            .from("shipments")
            .update({
              shipping_cost: parsedShippingFee,
              weight: parsedWeight,
              service_type: nextServiceType,
              notes: nextNotes,
            })
            .eq("id", editRow.id);
          error = retryResult.error;
        }

        setUpdatingId(null);
        if (error) return toast.error(error.message || "Failed to update shipment.");
        toast.success("Shipment details updated.");
        releaseState();
        fetchData();
        return;
      }

      const computedTotalFee = Object.values(editItemShippingFees).length > 0
        ? Object.values(editItemShippingFees).reduce((sum, v) => sum + Number(v || 0), 0)
        : parsedShippingFee;

      const consolidationPayload: Record<string, unknown> = {
        total_cost: computedTotalFee,
        total_weight: parsedWeight,
        total_cbm: parsedCbm,
        notes: setConsolidationCbmInNotes(
          upsertMetadataInNotes(editRow.sourceConsolidation?.notes || null),
          parsedCbm
        ),
      };

      let { error: consolidationError } = await supabase
        .from("consolidations")
        .update(consolidationPayload)
        .eq("id", editRow.id);

      if (consolidationError && isColumnWriteRestrictedError(consolidationError, /\btotal_cbm\b/i) && "total_cbm" in consolidationPayload) {
        delete consolidationPayload.total_cbm;
        const retryResult = await supabase
          .from("consolidations")
          .update(consolidationPayload)
          .eq("id", editRow.id);
        consolidationError = retryResult.error;
      }

      if (!consolidationError && editRow.sourceConsolidation) {
        const childShipments = (editRow.sourceConsolidation.consolidation_shipments || [])
          .map((entry) => entry.shipment)
          .filter(Boolean) as NonNullable<ConsolidationChild["shipment"]>[];

        const childUpdateResults = await Promise.all(
          childShipments.map((shipment) =>
            supabase
              .from("shipments")
              .update({
                service_type: nextServiceType,
                notes: upsertMetadataInNotes(shipment.notes),
                shipping_cost: Number(editItemShippingFees[shipment.id] || 0),
              })
              .eq("id", shipment.id)
          )
        );

        const failedChildUpdate = childUpdateResults.find((result) => !!result.error);
        if (failedChildUpdate?.error) {
          setUpdatingId(null);
          return toast.error(
            failedChildUpdate.error.message || "Failed to update linked item details."
          );
        }
      }

      setUpdatingId(null);
      if (consolidationError) return toast.error(consolidationError.message || "Failed to update consolidation.");
      toast.success("Consolidation details updated.");
      releaseState();
      fetchData();
      return;
    }

    if (Number.isNaN(parsedShippingFee) || parsedShippingFee < 0) {
      setUpdatingId(null);
      return toast.error("Shipping fee must be a valid non-negative number.");
    }

    if (editRow.rowType === "shipment") {
      const { error } = await supabase
        .from("shipments")
        .update({ shipping_cost: parsedShippingFee })
        .eq("id", editRow.id);
      setUpdatingId(null);
      if (error) return toast.error(error.message || "Failed to update shipment.");
      toast.success("Shipment updated.");
      releaseState();
      fetchData();
      return;
    }

    const { error: consolidationError } = await supabase
      .from("consolidations")
      .update({ total_cost: parsedShippingFee })
      .eq("id", editRow.id);

    setUpdatingId(null);
    if (consolidationError) return toast.error(consolidationError.message || "Failed to update consolidation.");
    toast.success("Consolidation updated.");
    releaseState();
    fetchData();
  };

  const showItemsColumn = !["submitted", "confirm", "outgoing"].includes(activeTab);
  const showDescriptionColumn = ["all", "created"].includes(activeTab);
  const showQtyColumn = !["submitted", "confirm", "outgoing"].includes(activeTab);
  const showDimensionsColumn = ["all", "created", "incoming"].includes(activeTab);
  const showShippingFeeColumn = true;
  const showAirwayColumn = ["outgoing", "intransit", "arrived", "collected"].includes(activeTab);
  const showTrackingColumn = ["all", "created", "incoming", "outgoing", "intransit", "arrived", "collected", "unpaid", "paid"].includes(activeTab);

  const getRowTransitStatusMessage = (row: UnifiedRow) => {
    if (row.rowType === "shipment") {
      return getTransitStatusMessage(row.sourceShipment?.notes || null);
    }

    const consolidationMessage = getTransitStatusMessage(row.sourceConsolidation?.notes || null);
    if (consolidationMessage) return consolidationMessage;

    const childMessage = (row.sourceConsolidation?.consolidation_shipments || [])
      .map((entry) => getTransitStatusMessage(entry.shipment?.notes || null))
      .find((message) => !!message);
    return childMessage || null;
  };

  const getRowCollectedBy = (row: UnifiedRow) => {
    if (row.rowType === "shipment") {
      return (
        getCollectedByValue(
          row.sourceShipment?.collected_by,
          row.sourceShipment?.notes || null,
          formatCollectedByValue(
            row.sourceShipment?.receiver?.full_name,
            row.sourceShipment?.receiver?.phone,
          ),
        ) || "-"
      );
    }

    const fromConsolidation = getCollectedByValue(
      row.sourceConsolidation?.collected_by,
      row.sourceConsolidation?.notes || null,
    );
    if (fromConsolidation !== "-") return fromConsolidation;

    const childValue = (row.sourceConsolidation?.consolidation_shipments || [])
      .map((entry) =>
        getCollectedByValue(
          entry.shipment?.collected_by,
          entry.shipment?.notes || null,
          formatCollectedByValue(
            entry.shipment?.receiver?.full_name,
            entry.shipment?.receiver?.phone,
          ),
        ),
      )
      .find((value) => value && value !== "-");
    return childValue || formatCollectedByValue(row.receiverName, row.receiverPhone) || "-";
  };

  const getCollectedByEditKey = (row: UnifiedRow) => `${row.rowType}:${row.id}`;

  const getRowCollectedAt = (row: UnifiedRow) => {
    if (row.rowType === "shipment") {
      return (
        row.sourceShipment?.collected_at ||
        getCollectedAtFromNotes(row.sourceShipment?.notes || null) ||
        row.sourceShipment?.updated_at ||
        row.created_at
      );
    }

    const fromConsolidation =
      row.sourceConsolidation?.collected_at ||
      getCollectedAtFromNotes(row.sourceConsolidation?.notes || null);
    if (fromConsolidation) return fromConsolidation;

    const childValue = (row.sourceConsolidation?.consolidation_shipments || [])
      .map((entry) => entry.shipment?.collected_at || getCollectedAtFromNotes(entry.shipment?.notes || null))
      .find((value) => !!value);

    return childValue || row.sourceConsolidation?.updated_at || row.created_at;
  };

  const getRowOriginArrivalAt = (row: UnifiedRow) => {
    if (row.rowType === "shipment") {
      const fromNotes = getOriginArrivalAtFromNotes(row.sourceShipment?.notes || null);
      if (fromNotes) return fromNotes;

      if (["received", "requested_pickup"].includes(row.status)) {
        return row.sourceShipment?.updated_at || row.created_at;
      }

      return null;
    }

    const fromConsolidation = getOriginArrivalAtFromNotes(row.sourceConsolidation?.notes || null);
    if (fromConsolidation) return fromConsolidation;

    const childValues = (row.sourceConsolidation?.consolidation_shipments || [])
      .map((entry) => {
        const shipment = entry.shipment;
        if (!shipment) return null;

        const fromChildNotes = getOriginArrivalAtFromNotes(shipment.notes || null);
        if (fromChildNotes) return fromChildNotes;

        const childStatus = normalizeShipmentStatus(shipment.status);
        if (["received", "requested_pickup"].includes(childStatus)) {
          return shipment.updated_at || shipment.created_at;
        }

        return null;
      })
      .filter((value): value is string => !!value)
      .sort((a, b) => {
        const aTime = new Date(a).getTime();
        const bTime = new Date(b).getTime();

        if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
        if (Number.isNaN(aTime)) return 1;
        if (Number.isNaN(bTime)) return -1;
        return aTime - bTime;
      });

    return childValues[0] || null;
  };

  const columns: Column<UnifiedRow>[] = useMemo(() => {
    const base: Column<UnifiedRow>[] = [];

    if (activeTab === "all_shipments") {
      return [
        { key: "serviceType", label: "Service Type", render: (row) => row.serviceType },
        { key: "productType", label: "Product Type", render: (row) => row.productType },
        { key: "itemCost", label: "Item Cost", render: (row) => formatAmount(row.itemCost || 0) },
        {
          key: "tracking",
          label: "Tracking Number",
          render: (row) => {
            const tracking =
              row.rowType === "shipment"
                ? resolveTrackingByParcelTab(activeTab, row.status, row.sourceShipment?.notes || null, row.sourceShipment?.custom_tracking_number)
                : resolveTrackingByParcelTab(activeTab, row.status, row.sourceConsolidation?.notes || null, row.sourceConsolidation?.tracking_code);
            return <span className="font-mono text-xs">{tracking || "Not provided"}</span>;
          },
        },
        {
          key: "receiver",
          label: "Receiver",
          render: (row) => (
            <div>
              <p>{row.receiverName || "-"}</p>
              <p className="text-xs text-muted-foreground">{row.receiverPhone || "-"}</p>
            </div>
          ),
        },
        {
          key: "departureDateOrigin",
          label: "Departure Date (Origin)",
          render: (row) => {
            const departure = row.rowType === "shipment"
              ? extractNoteValue(row.sourceShipment?.notes || null, "Departure Date")
              : extractNoteValue(row.sourceConsolidation?.notes || null, "Departure Date");
            return formatDateCell(departure);
          },
        },
        {
          key: "arrivalDateDestination",
          label: "Arrival Date (Destination)",
          render: (row) => formatDateCell(row.estimatedDeliveryDate),
        },
        {
          key: "airwayBill",
          label: "AWB/BL No.",
          render: (row) => <span className="font-mono text-xs">{row.airwayBill || "-"}</span>,
        },
        {
          key: "weight",
          label: "Weight",
          render: (row) => `${row.weight.toFixed(2)} kg`,
        },
        {
          key: "cbm",
          label: "Cubic Meters (CBM)",
          render: (row) => (row.cbm == null ? "-" : row.cbm.toFixed(4)),
        },
        {
          key: "shippingFee",
          label: "Shipping Fee",
          // Shipping Fee is always blank at Submitted stage — warehouse enters it in the edit pop-up
          render: () => <span className="text-muted-foreground">—</span>,
        },
        {
          key: "status",
          label: "Status",
          render: (row) => <Badge variant="secondary">{statusLabel[row.status] || row.status}</Badge>,
        },
        {
          key: "action",
          label: "Action",
          render: (row) => (
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" className="h-8 w-8 p-0" onClick={() => setViewRow(row)} title="View details">
                <Eye className="h-4 w-4 text-blue-600" />
              </Button>
            </div>
          ),
        },
      ];
    }

    if (warehouseBulkActionTabs.has(activeTab)) {
      base.push({
        key: "select",
        label: "",
        render: (row) =>
          canBulkSelectRow(row) ? (
            <Checkbox
              checked={selectedBulkRowKeys.has(getUnifiedRowSelectionKey(row))}
              onCheckedChange={(checked) => toggleBulkRowSelection(row, checked === true)}
              aria-label={`Select ${row.code}`}
            />
          ) : (
            <span className="text-xs text-muted-foreground">-</span>
          ),
      });
    }

    base.push(
      {
        key: "customerName",
        label: "Customer Name",
        render: (row) => (
          <div>
            <p>{row.customerName}</p>
            <p className="text-xs text-muted-foreground font-mono">{row.customerCode}</p>
          </div>
        ),
      },
      {
        key: "receiver",
        label: "Receiver",
        render: (row) => (
          <div>
            <p>{row.receiverName || "-"}</p>
            <p className="text-xs text-muted-foreground">{row.receiverPhone || "-"}</p>
            <p className="text-xs text-muted-foreground">{row.receiverAddress || "-"}</p>
          </div>
        ),
      },
      { key: "serviceType", label: "Service Type" },
      { key: "productType", label: "Product Type" },
    );

    if (showDescriptionColumn) {
      base.push({
        key: "description",
        label: "Description",
        render: (row) => {
          const desc = row.rowType === "shipment"
            ? row.sourceShipment?.description || "-"
            : (row.sourceConsolidation?.consolidation_shipments || [])
              .map((entry) => entry.shipment?.description)
              .filter(Boolean)
              .join(", ") || "-";
          return <span className="max-w-[200px] block truncate" title={desc}>{desc}</span>;
        },
      });
    }

    if (activeTab === "all") {
      base.push(
        {
          key: "dateCreated",
          label: "Date Created",
          render: (row) => formatDateTimeCell(row.created_at),
        },
        {
          key: "arrivalDateOrigin",
          label: "Arrival Date (Origin)",
          render: (row) => formatDateTimeCell(getRowOriginArrivalAt(row)),
        },
      );
    }

    if (showItemsColumn) {
      base.push({
        key: "item",
        label: "Items",
        render: (row) => <span className="max-w-[200px] block truncate">{row.item}</span>,
      });
    }

    if (showTrackingColumn) {
      base.push({
        key: "tracking",
        label: "Tracking Number",
        render: (row) => {
          const tracking =
            row.rowType === "shipment"
              ? resolveTrackingByParcelTab(activeTab, row.status, row.sourceShipment?.notes || null, row.sourceShipment?.custom_tracking_number)
              : resolveTrackingByParcelTab(activeTab, row.status, row.sourceConsolidation?.notes || null, row.sourceConsolidation?.tracking_code);
          return <span className="font-mono text-xs">{tracking || "Not provided"}</span>;
        },
      });
    }

    if (showAirwayColumn) {
      base.push({
        key: "airwayBill",
        label: "AWB/BL No.",
        render: (row) => <span className="font-mono text-xs">{row.airwayBill || "-"}</span>,
      });
    }

    if (showQtyColumn) {
      base.push({ key: "qty", label: "Quantity" });
    }

    base.push({
      key: "weight",
      label: "Weight",
      render: (row) => `${row.weight.toFixed(2)} kg`,
    });

    base.push({
      key: "cbm",
      label: "Cubic Meters (CBM)",
      render: (row) => (row.cbm == null ? "-" : row.cbm.toFixed(4)),
    });

    if (showDimensionsColumn) {
      base.push({ key: "dimensions", label: "Dimensions" });
    }

    base.push({
      key: "itemCost",
      label: "Item Cost",
      render: (row) => formatAmount(row.itemCost || 0),
    });

    base.push({
      key: "valueAdded",
      label: "Value Added",
      render: (row) => getValueAddedRequestLabel(row),
    });

    if (showShippingFeeColumn) {
      base.push({
        key: "shippingFee",
        label: "Shipping Fee",
        // Blank at Incoming/Need Action/Submitted; visible from Confirm Shipment onwards
        render: (row) => (["incoming", "need_action", "submitted"].includes(activeTab))
          ? <span className="text-muted-foreground">—</span>
          : formatAmount(row.shippingFee || 0),
      });
    }

    if (activeTab === "collected") {
      base.push({
        key: "collectedAt",
        label: "Collected Date",
        render: (row) => formatDateTimeCell(getRowCollectedAt(row)),
      });
      base.push({
        key: "collectedBy",
        label: "Collected By",
        render: (row) => {
          const editKey = getCollectedByEditKey(row);
          const displayedValue = getRowCollectedBy(row);
          const current = collectedByEdits[editKey] ?? (displayedValue === "-" ? "" : displayedValue);
          return (
            <div className="flex items-start gap-1 min-w-[240px]">
              <Textarea
                className="min-h-[64px] w-[260px] text-xs px-2 py-1 resize-y"
                value={current}
                placeholder="Enter custom collected-by message"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                onChange={(e) =>
                  setCollectedByEdits((prev) => ({ ...prev, [editKey]: e.target.value }))
                }
              />
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-7 w-7 shrink-0 mt-1"
                disabled={savingCollectedBy === editKey}
                title="Save"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={async (e) => {
                  e.stopPropagation();
                  const draftValue = collectedByEdits[editKey];
                  const value = (draftValue ?? "").trim();
                  setSavingCollectedBy(editKey);
                  try {
                    if (row.rowType === "consolidation") {
                      const nextNotes = upsertNoteValue(
                        row.sourceConsolidation?.notes || null,
                        "Collected by",
                        value || null,
                      );
                      const { error: consolidationError } = await supabase
                        .from("consolidations")
                        .update({ notes: nextNotes, collected_by: value || null })
                        .eq("id", row.id);

                      if (consolidationError) {
                        throw consolidationError;
                      }

                      const childShipments = (row.sourceConsolidation?.consolidation_shipments || [])
                        .map((entry) => entry.shipment)
                        .filter(Boolean) as NonNullable<ConsolidationChild["shipment"]>[];

                      if (childShipments.length > 0) {
                        const childUpdateResults = await Promise.all(
                          childShipments.map((shipment) => {
                            const nextShipmentNotes = upsertNoteValue(
                              shipment.notes,
                              "Collected by",
                              value || null,
                            );
                            return supabase
                              .from("shipments")
                              .update({ notes: nextShipmentNotes, collected_by: value || null })
                              .eq("id", shipment.id);
                          }),
                        );

                        const failedChildUpdate = childUpdateResults.find((result) => !!result.error);
                        if (failedChildUpdate?.error) {
                          throw failedChildUpdate.error;
                        }
                      }
                    } else {
                      const nextNotes = upsertNoteValue(
                        row.sourceShipment?.notes || null,
                        "Collected by",
                        value || null,
                      );
                      const { error } = await supabase
                        .from("shipments")
                        .update({ notes: nextNotes, collected_by: value || null })
                        .eq("id", row.id);

                      if (error) {
                        throw error;
                      }
                    }

                    setCollectedByEdits((prev) => {
                      const next = { ...prev };
                      delete next[editKey];
                      return next;
                    });
                    toast.success(value ? "Collected by updated." : "Collected by cleared.");
                    await fetchData();
                  } catch (error) {
                    const message =
                      error && typeof error === "object" && "message" in error
                        ? String(error.message)
                        : "Failed to update collected by.";
                    toast.error(message);
                  } finally {
                    setSavingCollectedBy(null);
                  }
                }}
              >
                {savingCollectedBy === editKey ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              </Button>
            </div>
          );
        },
      });
    }



    if (["outgoing", "intransit"].includes(activeTab)) {
      base.push({
        key: "estimatedDate",
        label: "Estimated Date of Arrival",
        render: (row) => formatDateCell(row.estimatedDeliveryDate),
      });
    }

    base.push({
      key: "status",
      label: "Status",
      render: (row) => {
        if (activeTab === "intransit") {
          return (
            <span className="text-xs text-muted-foreground">
              {getRowTransitStatusMessage(row) || "-"}
            </span>
          );
        }
        return <Badge variant="secondary">{statusLabel[row.status] || row.status}</Badge>;
      },
    });

    base.push({
      key: "action",
      label: "Action",
      render: (row) => (
        <div className="flex gap-1 whitespace-nowrap">
          <Button size="icon" variant="ghost" className="h-8 w-8 p-0" onClick={() => setViewRow(row)} title="View">
            <Eye className="h-4 w-4 text-blue-600" />
          </Button>

          {row.rowType === "shipment" ? (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={() => void handleDeleteShipment(row)}
              disabled={updatingId === row.id}
              title="Delete"
            >
              {updatingId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
            </Button>
          ) : null}

          {activeTab === "created" && row.rowType === "shipment" ? (
            <>
              <Button size="icon" variant="ghost" className="h-8 w-8 p-0" onClick={() => openEditDialog(row)} disabled={updatingId === row.id} title="Edit">
                <Pencil className="h-4 w-4 text-blue-600" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 p-0"
                onClick={() => runShipmentUpdate(row.id, "saved_dropoff", "Moved to Incoming.")}
                disabled={updatingId === row.id}
                title="Move to Incoming"
              >
                {updatingId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4 text-blue-600" />}
              </Button>
            </>
          ) : null}

          {activeTab === "incoming" && row.rowType === "shipment" ? (
            <>
              <Button size="icon" variant="ghost" className="h-8 w-8 p-0" onClick={() => openEditDialog(row)} disabled={updatingId === row.id} title="Edit">
                <Pencil className="h-4 w-4 text-blue-600" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 p-0"
                onClick={() =>
                  runShipmentUpdate(
                    row.id,
                    "received",
                    getWarehouseArrivalTransition(row.sourceShipment!, shipments).at(-1) === "requested_pickup"
                      ? "Single parcel moved straight to Submitted."
                      : "Moved to Need Action.",
                  )
                }
                disabled={updatingId === row.id}
                title={getWarehouseArrivalTransition(row.sourceShipment!, shipments).at(-1) === "requested_pickup" ? "Move to Submitted" : "Move to Need Action"}
              >
                {updatingId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 text-green-600" />}
              </Button>
            </>
          ) : null}

          {activeTab === "submitted" ? (
            <Button size="icon" variant="ghost" className="h-8 w-8 p-0" onClick={() => openEditDialog(row)} disabled={updatingId === row.id} title="Edit & Submit">
              <Check className="h-4 w-4 text-green-600" />
            </Button>
          ) : null}

          {activeTab === "confirm" ? (
            <Button size="icon" variant="ghost" className="h-8 w-8 p-0" onClick={() => openEditDialog(row)} disabled={updatingId === row.id} title="Edit">
              <Check className="h-4 w-4 text-green-600" />
            </Button>
          ) : null}

          {activeTab === "outgoing" ? (
            <>
              <Button size="icon" variant="ghost" className="h-8 w-8 p-0" onClick={() => openEditDialog(row)} disabled={updatingId === row.id} title="Edit">
                <Pencil className="h-4 w-4 text-blue-600" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 p-0"
                disabled={updatingId === row.id}
                onClick={() =>
                  row.rowType === "consolidation"
                    ? runConsolidationUpdate(row.id, "in_transit", "Moved to In Transit.")
                    : runShipmentUpdate(row.id, "supplied", "Moved to In Transit.")
                }
                title="Move to In Transit"
              >
                {updatingId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 text-blue-600" />}
              </Button>
            </>
          ) : null}

          {activeTab === "intransit" ? (
            <>
              <Button size="icon" variant="ghost" className="h-8 w-8 p-0" onClick={() => openEditDialog(row)} disabled={updatingId === row.id} title="Edit">
                <Pencil className="h-4 w-4 text-blue-600" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 p-0"
                disabled={updatingId === row.id}
                onClick={() =>
                  row.rowType === "consolidation"
                    ? runConsolidationUpdate(row.id, "arrived", "Moved to Ready for Collection.")
                    : runShipmentUpdate(row.id, "delivered", "Moved to Ready for Collection.")
                }
                title="Move to Ready for Collection"
              >
                {updatingId === row.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                )}
              </Button>
            </>
          ) : null}

          {activeTab === "arrived" ? (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 p-0"
              disabled={row.paymentStatus !== "completed" || updatingId === row.id}
              onClick={() =>
                row.rowType === "consolidation"
                  ? runConsolidationUpdate(row.id, "collected", "Moved to Collected.")
                  : runShipmentUpdate(row.id, "closed", "Moved to Collected.")
              }
              title="Mark Collected"
            >
              {updatingId === row.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4 text-green-600" />
              )}
            </Button>
          ) : null}
        </div>
      ),
    });

    return base;
  }, [
    activeTab,
    collectedByEdits,
    formatAmount,
    shipments,
    savingCollectedBy,
    selectedBulkRowKeys,
    showAirwayColumn,
    showDimensionsColumn,
    showDescriptionColumn,
    showItemsColumn,
    showQtyColumn,
    showShippingFeeColumn,
    showTrackingColumn,
    updatingId,
  ]);

  const viewChildren = useMemo(() => {
    if (!viewRow) return [];
    if (viewRow.rowType === "shipment" && viewRow.sourceShipment) {
      return [viewRow.sourceShipment];
    }
    return (viewRow.sourceConsolidation?.consolidation_shipments || [])
      .map((entry) => entry.shipment)
      .filter(Boolean) as NonNullable<ConsolidationChild["shipment"]>[];
  }, [viewRow]);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Warehouse Management" />

      <div className="flex justify-end">
        <Button
          variant="destructive"
          onClick={() => void handleDeleteAllParcels()}
          disabled={isDeletingAll || isLoading}
        >
          {isDeletingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Delete All Parcels
        </Button>
      </div>


      {/* Widget Navigation Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-4">
        {tabDefs.map((tab) => {
          const isActive = activeTab === tab.key;
          const widgetStyles: Record<string, { text: string; bg: string }> = {
            all: { text: "text-slate-600", bg: "bg-slate-100" },
            all_shipments: { text: "text-slate-700", bg: "bg-slate-100" },
            created: { text: "text-amber-600", bg: "bg-amber-50" },
            incoming: { text: "text-blue-600", bg: "bg-blue-50" },
            need_action: { text: "text-orange-600", bg: "bg-orange-50" },
            submitted: { text: "text-yellow-700", bg: "bg-yellow-50" },
            confirm: { text: "text-purple-600", bg: "bg-purple-50" },
            outgoing: { text: "text-indigo-600", bg: "bg-indigo-50" },
            intransit: { text: "text-cyan-600", bg: "bg-cyan-50" },
            arrived: { text: "text-green-600", bg: "bg-green-50" },
            collected: { text: "text-emerald-700", bg: "bg-emerald-50" },
            unpaid: { text: "text-red-600", bg: "bg-red-50" },
            paid: { text: "text-green-600", bg: "bg-green-50" },
          };

          const style = widgetStyles[tab.key] || { text: "text-slate-700", bg: "bg-slate-100" };

          return (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                setSearchParams(tab.key === "all" ? {} : { tab: tab.key });
              }}
              className={`flex flex-col items-center justify-between p-2 rounded-md border transition-all duration-200 min-h-[75px] bg-white ${isActive
                  ? "border-slate-400 shadow-sm ring-1 ring-slate-400/10"
                  : "border-slate-100"
                }`}
            >
              <span className="text-xs font-semibold text-slate-500 mb-1 text-center leading-tight">
                {tab.label}
              </span>
              <div className={`px-2 py-0 rounded-md ${style.bg} min-w-[35px] flex items-center justify-center`}>
                <span className={`text-lg font-bold ${style.text}`}>
                  {counts[tab.key] || 0}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <Tabs value={activeTab} onValueChange={(value) => {
        setActiveTab(value as TabKey);
        setSearchParams(value === "all" ? {} : { tab: value });
      }} className="space-y-4">
        {/* Hidden TabsList for functionality */}
        <div className="hidden">
          <TabsList>
            {tabDefs.map((tab) => (
              <TabsTrigger key={tab.key} value={tab.key}>{tab.label}</TabsTrigger>
            ))}
          </TabsList>
        </div>

        {tabDefs.map((t) => (
          <TabsContent key={t.key} value={t.key} className="space-y-4">
            {warehouseBulkActionTabs.has(t.key) && (
              <div className="rounded-xl border border-border/50 bg-card p-4 shadow-[0_1px_3px_0_rgba(0,0,0,0.04)]">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <Checkbox
                        checked={
                          bulkSelectableRows.length > 0 &&
                          bulkSelectableRows.every((row) =>
                            selectedBulkRowKeys.has(getUnifiedRowSelectionKey(row)),
                          )
                        }
                        onCheckedChange={(checked) => handleSelectAllBulkRows(checked === true)}
                        aria-label="Select all visible parcels"
                      />
                      Select all
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    {t.key === "created" && (
                      <Button
                        onClick={() => void handleWarehouseBulkAction("incoming")}
                        disabled={selectedBulkRowKeys.size === 0 || !!activeBulkAction}
                      >
                        {activeBulkAction === "incoming" ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Move to Incoming
                      </Button>
                    )}

                    {t.key === "incoming" && (
                      <Button
                        onClick={() => void handleWarehouseBulkAction("arrival")}
                        disabled={selectedBulkRowKeys.size === 0 || !!activeBulkAction}
                      >
                        {activeBulkAction === "arrival" ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Process Arrival
                      </Button>
                    )}

                    {t.key === "outgoing" && (
                      <Button
                        onClick={() => void handleWarehouseBulkAction("in_transit")}
                        disabled={selectedBulkRowKeys.size === 0 || !!activeBulkAction}
                      >
                        {activeBulkAction === "in_transit" ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Move to In Transit
                      </Button>
                    )}

                    {t.key === "arrived" && (
                      <Button
                        onClick={() => void handleWarehouseBulkAction("collected")}
                        disabled={selectedBulkRowKeys.size === 0 || !!activeBulkAction}
                      >
                        {activeBulkAction === "collected" ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Mark Collected
                      </Button>
                    )}
                  </div>
                </div>

                {t.key === "outgoing" && (
                  <div className="mt-4 grid gap-3 border-t border-border/50 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="bulk-airway-bill-number">Bulk AWB/BL No.</Label>
                      <Input
                        id="bulk-airway-bill-number"
                        value={bulkAirwayBillNumber}
                        onChange={(event) => setBulkAirwayBillNumber(event.target.value)}
                        placeholder="Enter AWB/BL No. for selected parcels"
                      />
                    </div>
                    <div>
                      <Button
                        variant="outline"
                        onClick={() => void handleWarehouseBulkAction("awb_update")}
                        disabled={selectedBulkRowKeys.size === 0 || !!activeBulkAction}
                      >
                        {activeBulkAction === "awb_update" ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Update AWB/BL No.
                      </Button>
                    </div>
                  </div>
                )}

                {t.key === "intransit" && (
                  <div className="mt-4 grid gap-3 border-t border-border/50 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="bulk-transit-status-message">Bulk Transit Message</Label>
                      <Textarea
                        id="bulk-transit-status-message"
                        value={bulkTransitStatusMessage}
                        onChange={(event) => setBulkTransitStatusMessage(event.target.value)}
                        placeholder="Example: Your shipment is now in transit and expected next week."
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        onClick={() => void handleWarehouseBulkAction("transit_message")}
                        disabled={selectedBulkRowKeys.size === 0 || !!activeBulkAction}
                      >
                        {activeBulkAction === "transit_message" ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Send Bulk Message
                      </Button>
                      <Button
                        onClick={() => void handleWarehouseBulkAction("arrived")}
                        disabled={selectedBulkRowKeys.size === 0 || !!activeBulkAction}
                      >
                        {activeBulkAction === "arrived" ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Mark Ready for Collection
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="rounded-xl border border-border/50 bg-card p-0 shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] overflow-hidden">
              <DataTable
                columns={columns}
                data={visibleRows}
                isLoading={isLoading}
                emptyMessage="No parcels found matching the current filters."
              />
            </div>
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={!!viewRow} onOpenChange={(open) => !open && setViewRow(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Parcel Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {viewChildren.map((entry) => (
              <div key={entry.id} className="rounded-md border p-3 space-y-1 text-sm">
                {activeTab === "submitted" && viewRow?.rowType === "consolidation" ? (
                  <label className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    <Checkbox
                      checked={selectedConsolidationRemovalIds.has(entry.id)}
                      onCheckedChange={(checked) =>
                        toggleConsolidationRemovalSelection(entry.id, checked === true)
                      }
                    />
                    Remove this item from consolidation
                  </label>
                ) : null}
                <p className="font-semibold">{entry.description || entry.code}</p>
                <p className="text-xs font-mono text-muted-foreground">
                  Tracking: {resolveTrackingByStatus(entry.status, entry.notes, entry.custom_tracking_number) || "Tracking pending"}
                  {" | "}
                  AWB/BL No.: {getAirwayBillNumber(entry.notes) || "-"}
                </p>
                <p>
                  Qty: {entry.quantity || 1} | Weight: {(entry.weight || 0).toFixed(2)} kg | Dimensions:{" "}
                  {formatDimensions(entry.length, entry.width, entry.height)}
                </p>
                <p>
                  CBM: {getShipmentCbm(entry).toFixed(4)} |{" "}
                  Item Cost: {formatAmount(getShipmentItemCost(entry))} | Shipping Fee: {formatAmount(entry.shipping_cost || 0)}
                </p>
                <p>
                  Insurance: {getInsuranceLabel(entry.notes)} | Special Packaging:{" "}
                  {getSpecialPackagingLabel(entry.notes)}
                </p>
              </div>
            ))}
            {viewChildren.length === 0 ? (
              <p className="text-sm text-muted-foreground">No item details found.</p>
            ) : null}
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
            <Button variant="outline" onClick={() => setViewRow(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editRow} onOpenChange={(open) => !open && setEditRow(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {activeTab === "submitted"
                ? "Submitted: Edit & Confirm"
                : activeTab === "confirm"
                  ? "Confirm Shipment: Edit"
                  : activeTab === "outgoing"
                    ? "Outgoing: Edit"
                    : activeTab === "intransit"
                      ? "In Transit: Edit Status Message"
                      : "Edit Shipment"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            {activeTab === "submitted" ? (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="items">Items (Total)</Label>
                    <Input
                      id="items"
                      readOnly
                      value={String(submittedEditTotals.totalItems)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="weight">Total Weight (kg)</Label>
                    <Input
                      id="weight"
                      readOnly
                      className="bg-muted/50"
                      value={submittedEditTotals.totalWeight.toFixed(2)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cbm">Total CBM</Label>
                    <Input
                      id="cbm"
                      readOnly
                      className="bg-muted/50"
                      value={submittedEditTotals.totalCbm.toFixed(4)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shippingFee">Total Shipping Fee</Label>
                    <Input
                      id="shippingFee"
                      readOnly
                      className="bg-muted/50"
                      value={submittedEditTotals.totalShippingFee > 0 ? submittedEditTotals.totalShippingFee.toFixed(2) : ""}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="submittedProductType">Product Type</Label>
                  <Input
                    id="submittedProductType"
                    value={editProductType}
                    onChange={(event) => setEditProductType(event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Items</Label>
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {editItems.map((item, index) => (
                      <div key={item.id} className="rounded-md border p-3 space-y-2">
                        <p className="text-sm font-medium">
                          {item.description || `Item ${index + 1}`}
                        </p>
                        <div className="grid gap-2 md:grid-cols-3">
                          <div className="space-y-2">
                            <Label htmlFor={`description-${item.id}`}>Item Name</Label>
                            <Input
                              id={`description-${item.id}`}
                              value={item.description}
                              onChange={(event) => updateEditItem(item.id, "description", event.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`quantity-${item.id}`}>Quantity</Label>
                            <Input
                              id={`quantity-${item.id}`}
                              type="number"
                              min="0"
                              step="1"
                              value={item.quantity}
                              onChange={(event) => updateEditItem(item.id, "quantity", event.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`item-cost-${item.id}`}>Item Cost</Label>
                            <Input
                              id={`item-cost-${item.id}`}
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.itemCost}
                              onChange={(event) => updateEditItem(item.id, "itemCost", event.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`weight-${item.id}`}>Weight (kg)</Label>
                            <Input
                              id={`weight-${item.id}`}
                              type="text"
                              inputMode="decimal"
                              value={item.weight}
                              onChange={(event) => updateEditItem(item.id, "weight", event.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`length-${item.id}`}>Length (cm)</Label>
                            <Input
                              id={`length-${item.id}`}
                              type="number"
                              min="0"
                              value={item.length || ""}
                              onChange={(event) => updateEditItem(item.id, "length", event.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`width-${item.id}`}>Width (cm)</Label>
                            <Input
                              id={`width-${item.id}`}
                              type="number"
                              min="0"
                              value={item.width || ""}
                              onChange={(event) => updateEditItem(item.id, "width", event.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`height-${item.id}`}>Height (cm)</Label>
                            <Input
                              id={`height-${item.id}`}
                              type="number"
                              min="0"
                              value={item.height || ""}
                              onChange={(event) => updateEditItem(item.id, "height", event.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`cbm-${item.id}`}>CBM</Label>
                            <Input
                              id={`cbm-${item.id}`}
                              type="text"
                              inputMode="decimal"
                              value={item.cbm}
                              onChange={(event) => updateEditItem(item.id, "cbm", event.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`shipping-fee-${item.id}`}>
                              Shipping Fee <span className="text-destructive">*</span>
                            </Label>
                            <Input
                              id={`shipping-fee-${item.id}`}
                              type="text"
                              inputMode="decimal"
                              placeholder="Enter shipping fee"
                              value={editItemShippingFees[item.id] ?? ""}
                              onChange={(event) =>
                                setEditItemShippingFees((prev) => ({ ...prev, [item.id]: event.target.value }))
                              }
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                    {editItems.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No items found for this record.</p>
                    ) : null}
                  </div>
                </div>
              </>
            ) : null}

            {activeTab === "outgoing" ? (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="trackingNumber">Tracking Number</Label>
                    <Input
                      id="trackingNumber"
                      value={editTrackingNumber}
                      onChange={(event) => setEditTrackingNumber(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="airwayBill">AWB/BL No.</Label>
                    <Input
                      id="airwayBill"
                      value={editAirwayBill}
                      onChange={(event) => setEditAirwayBill(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="outgoingShippingFee">Shipping Fee</Label>
                    <Input
                      id="outgoingShippingFee"
                      type="number"
                      min="0"
                      step="0.01"
                      value={editShippingFee}
                      onChange={(event) => setEditShippingFee(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="outgoingWeight">Weight (kg)</Label>
                    <Input
                      id="outgoingWeight"
                      type="number"
                      min="0"
                      step="0.01"
                      value={editWeight}
                      onChange={(event) => setEditWeight(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="outgoingCbm">CBM</Label>
                    <Input
                      id="outgoingCbm"
                      type="number"
                      min="0"
                      step="0.0001"
                      value={editCbm}
                      onChange={(event) => setEditCbm(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="outgoingEstimatedDate">Estimated Date of Arrival</Label>
                    <Input
                      id="outgoingEstimatedDate"
                      type="date"
                      value={editEstimatedDate}
                      onChange={(event) => setEditEstimatedDate(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="outgoingServiceType">Service Type</Label>
                    <Select
                      value={editServiceType}
                      onValueChange={(value) => setEditServiceType(value === "sea" ? "sea" : "air")}
                    >
                      <SelectTrigger id="outgoingServiceType">
                        <SelectValue placeholder="Select service type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="air">Air Freight</SelectItem>
                        <SelectItem value="sea">Sea Freight</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="outgoingProductType">Product Type</Label>
                  <Input
                    id="outgoingProductType"
                    value={editProductType}
                    onChange={(event) => setEditProductType(event.target.value)}
                  />
                </div>
              </>
            ) : null}

            {activeTab === "intransit" ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="transitStatusMessage">Custom Status Message</Label>
                  <Input
                    id="transitStatusMessage"
                    placeholder="e.g. Cleared customs"
                    value={editTransitStatusMessage}
                    onChange={(event) => setEditTransitStatusMessage(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inTransitEstimatedDate">Estimated Date of Arrival</Label>
                  <Input
                    id="inTransitEstimatedDate"
                    type="date"
                    value={editEstimatedDate}
                    onChange={(event) => setEditEstimatedDate(event.target.value)}
                  />
                </div>
              </div>
            ) : null}

            {activeTab === "confirm" ? (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  {editRow?.rowType !== "consolidation" ? (
                    <div className="space-y-2">
                      <Label htmlFor="confirmShippingFee">Shipping Fee</Label>
                      <Input
                        id="confirmShippingFee"
                        type="number"
                        min="0"
                        step="0.01"
                        value={editShippingFee}
                        onChange={(event) => setEditShippingFee(event.target.value)}
                      />
                    </div>
                  ) : null}
                  <div className="space-y-2">
                    <Label htmlFor="confirmWeight">Weight (kg)</Label>
                    <Input
                      id="confirmWeight"
                      type="number"
                      min="0"
                      step="0.01"
                      value={editWeight}
                      onChange={(event) => setEditWeight(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmCbm">CBM</Label>
                    <Input
                      id="confirmCbm"
                      type="number"
                      min="0"
                      step="0.0001"
                      value={editCbm}
                      onChange={(event) => setEditCbm(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmServiceType">Service Type</Label>
                    <Select
                      value={editServiceType}
                      onValueChange={(value) => setEditServiceType(value === "sea" ? "sea" : "air")}
                    >
                      <SelectTrigger id="confirmServiceType">
                        <SelectValue placeholder="Select service type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="air">Air Freight</SelectItem>
                        <SelectItem value="sea">Sea Freight</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {editRow?.rowType === "consolidation" ? (
                  <div className="space-y-2">
                    <Label>Shipping Fee per Item</Label>
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {editItems.map((item, index) => (
                        <div key={item.id} className="rounded-md border p-3">
                          <p className="text-xs font-medium mb-2">{item.description || `Item ${index + 1}`}</p>
                          <div className="flex items-center gap-2">
                            <Label htmlFor={`fee-${item.id}`} className="text-xs whitespace-nowrap text-muted-foreground">Fee</Label>
                            <Input
                              id={`fee-${item.id}`}
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              value={editItemShippingFees[item.id] ?? ""}
                              onChange={(event) =>
                                setEditItemShippingFees((prev) => ({ ...prev, [item.id]: event.target.value }))
                              }
                            />
                          </div>
                        </div>
                      ))}
                      {editItems.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No items found for this consolidation.</p>
                      ) : null}
                    </div>
                    <div className="flex items-center justify-between rounded-md border border-dashed p-3 text-sm">
                      <span className="text-muted-foreground">Total Shipping Fee:</span>
                      <span className="font-semibold">
                        {formatAmount(
                          Object.values(editItemShippingFees).reduce((sum, v) => sum + Number(v || 0), 0)
                        )}
                      </span>
                    </div>
                  </div>
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor="confirmProductType">Product Type</Label>
                  <Input
                    id="confirmProductType"
                    value={editProductType}
                    onChange={(event) => setEditProductType(event.target.value)}
                  />
                </div>
              </>
            ) : null}

            {["all", "created", "incoming"].includes(activeTab) ? (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="generalTrackingNumber">Tracking Number</Label>
                    <Input
                      id="generalTrackingNumber"
                      value={editTrackingNumber}
                      onChange={(event) => setEditTrackingNumber(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="generalAirwayBill">AWB/BL No.</Label>
                    <Input
                      id="generalAirwayBill"
                      value={editAirwayBill}
                      onChange={(event) => setEditAirwayBill(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="generalShippingFee">Shipping Fee</Label>
                    <Input
                      id="generalShippingFee"
                      type="number"
                      min="0"
                      step="0.01"
                      value={editShippingFee}
                      onChange={(event) => setEditShippingFee(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="generalWeight">Weight (kg)</Label>
                    <Input
                      id="generalWeight"
                      type="number"
                      min="0"
                      step="0.01"
                      value={editWeight}
                      onChange={(event) => setEditWeight(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="generalCbm">CBM</Label>
                    <Input
                      id="generalCbm"
                      type="number"
                      min="0"
                      step="0.0001"
                      value={editCbm}
                      onChange={(event) => setEditCbm(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="generalServiceType">Service Type</Label>
                    <Select
                      value={editServiceType}
                      onValueChange={(value) => setEditServiceType(value === "sea" ? "sea" : "air")}
                    >
                      <SelectTrigger id="generalServiceType">
                        <SelectValue placeholder="Select service type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="air">Air Freight</SelectItem>
                        <SelectItem value="sea">Sea Freight</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="generalProductType">Product Type</Label>
                  <Input
                    id="generalProductType"
                    value={editProductType}
                    onChange={(event) => setEditProductType(event.target.value)}
                  />
                </div>
                {editRow?.rowType === "shipment" && (
                  <div className="space-y-2">
                    <Label>Items</Label>
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {editItems.map((item, index) => (
                        <div key={item.id} className="rounded-md border p-3 space-y-2">
                          <p className="text-sm font-medium">
                            {item.description || `Item ${index + 1}`}
                          </p>
                          <div className="grid gap-2 md:grid-cols-3">
                            <div className="space-y-2">
                              <Label htmlFor={`desc-${item.id}`}>Description</Label>
                              <Input
                                id={`desc-${item.id}`}
                                value={item.description}
                                onChange={(e) => updateEditItem(item.id, "description", e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`qty-${item.id}`}>Quantity</Label>
                              <Input
                                id={`qty-${item.id}`}
                                type="number"
                                min="0"
                                value={item.quantity}
                                onChange={(e) => updateEditItem(item.id, "quantity", e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`cost-${item.id}`}>Cost</Label>
                              <Input
                                id={`cost-${item.id}`}
                                type="number"
                                min="0"
                                value={item.itemCost}
                                onChange={(e) => updateEditItem(item.id, "itemCost", e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`length-${item.id}`}>Length (cm)</Label>
                              <Input
                                id={`length-${item.id}`}
                                type="number"
                                min="0"
                                value={item.length || ""}
                                onChange={(e) => updateEditItem(item.id, "length", e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`width-${item.id}`}>Width (cm)</Label>
                              <Input
                                id={`width-${item.id}`}
                                type="number"
                                min="0"
                                value={item.width || ""}
                                onChange={(e) => updateEditItem(item.id, "width", e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`height-${item.id}`}>Height (cm)</Label>
                              <Input
                                id={`height-${item.id}`}
                                type="number"
                                min="0"
                                value={item.height || ""}
                                onChange={(e) => updateEditItem(item.id, "height", e.target.value)}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRow(null)}>
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={updatingId === editRow?.id}>
              {updatingId === editRow?.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WarehouseAllParcels;
