import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, Column } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useDefaultCurrency } from "@/hooks/useDefaultCurrency";
import { toast } from "sonner";
import { Eye, Pencil } from "lucide-react";
import { getProductType, getShipmentCbmValue, getValueAddedServicesSummary, getWarehouseTrackingNumber, resolveTrackingByStatus } from "@/lib/shipmentNotes";

type ShipmentRow = {
  id: string;
  code: string;
  status: string;
  service_type: string;
  total_cost: number;
  shipping_cost: number;
  weight: number;
  cbm: number | null;
  payment_status: string | null;
  payment_method: string | null;
  pickup_date: string | null;
  estimated_delivery_date: string | null;
  actual_delivery_date: string | null;
  custom_tracking_number: string | null;
  notes: string | null;
  description: string | null;
  created_at: string;
  branch_id: string | null;
  consolidation_id?: string | null;
  customers: { full_name: string | null; code: string | null; phone: string | null } | null;
  receiver: { full_name: string | null; phone: string | null; address: string | null } | null;
};

type ConsolidationRow = {
  id: string;
  code: string;
  status: string;
  item_count: number | null;
  total_weight: number | null;
  total_cost: number | null;
  created_at: string;
  customers: { full_name: string | null; code: string | null; phone: string | null } | null;
  consolidation_shipments: {
    shipment_id: string;
    shipment: {
      id: string;
      description: string | null;
      notes: string | null;
      payment_status: string | null;
      quantity: number | null;
      weight: number | null;
      total_cost: number | null;
      shipping_cost: number | null;
      branch_id: string | null;
      pickup_date: string | null;
      estimated_delivery_date: string | null;
      actual_delivery_date: string | null;
      receiver: { full_name: string | null; phone: string | null; address: string | null } | null;
    } | null;
  }[];
};

type Row = {
  id: string;
  code: string;
  status: string;
  service_type: string;
  total_cost: number;
  shipping_cost: number;
  weight: number;
  cbm: number | null;
  payment_status: string | null;
  payment_method: string | null;
  pickup_date: string | null;
  estimated_delivery_date: string | null;
  actual_delivery_date: string | null;
  custom_tracking_number: string | null;
  notes: string | null;
  description: string | null;
  created_at: string;
  branch_id: string | null;
  consolidation_id?: string | null;
  customer_name: string;
  customer_code: string;
  customer_phone: string;
  receiver_name: string;
  receiver_phone: string;
  receiver_address: string;
  branch_name: string | null;
};

const statusLabel: Record<string, string> = {
  approved: "Confirm Shipment",
  assigned: "Outgoing",
  supplied: "In Transit",
  delivered: "Ready for Collection",
  closed: "Collected",
};

const normalizeShipmentStatus = (status: string) => {
  const normalized = (status || "").toLowerCase().trim();
  const aliasMap: Record<string, string> = {
    confirmed: "approved",
    confirm_shipment: "approved",
    outgoing: "assigned",
    in_transit: "supplied",
    arrived: "delivered",
    collected: "closed",
  };

  return aliasMap[normalized] || normalized;
};

const normalizeConsolidationStatus = (status: string) => {
  const normalized = (status || "").toLowerCase().trim();
  if (["processed", "completed", "confirmed"].includes(normalized)) return "approved";
  if (["outgoing", "assigned"].includes(normalized)) return "assigned";
  if (["in_transit", "intransit", "supplied"].includes(normalized)) return "supplied";
  if (["arrived", "delivered"].includes(normalized)) return "delivered";
  if (["collected", "closed"].includes(normalized)) return "closed";
  return "";
};

const isMissingConsolidationTotalsError = (error: { code?: string; message?: string } | null) =>
  !!error && (error.code === "42703" || /item_count|total_weight|total_cost/i.test(error.message || ""));
const isMissingColumnError = (
  error: { code?: string; message?: string } | null | undefined,
  columnPattern: RegExp,
) =>
  !!error &&
  (error.code === "42703" || /does not exist/i.test(error.message || "")) &&
  columnPattern.test(error.message || "");

const formatServiceType = (type: string) => {
  if (type === "consolidated") return "Consolidated";
  return type === "air" ? "Air Freight" : "Sea Freight";
};

const formatPaymentMethod = (method: string | null) => {
  if (!method) return "-";
  const mapping: Record<string, string> = {
    cash: "Cash",
    wallet: "Wallet",
    bank_transfer: "Bank Transfer",
    mobile_money: "Mobile Money",
    lipila: "Lipila",
  };
  return mapping[method] || method;
};

const formatDate = (value: string | null) => (value ? new Date(value).toLocaleDateString() : "-");

type EditTrackingState = {
  id: string;
  code: string;
  customTrackingNumber: string;
  awbNumber: string;
  weight: string;
  cbm: string;
  notes: string | null;
} | null;

const WarehouseAllShipments = () => {
  const { formatAmount } = useDefaultCurrency();
  const [rows, setRows] = useState<Row[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewRow, setViewRow] = useState<Row | null>(null);
  const [editTracking, setEditTracking] = useState<EditTrackingState>(null);
  const [isSaving, setIsSaving] = useState(false);

  const openEditTracking = (row: Row) => {
    const awbMatch = row.notes?.match(/AWB\/BL No\.:\s*([^|]+)/i);
    const cbmMatch = row.notes?.match(/CBM:\s*([^|]+)/i);
    setEditTracking({
      id: row.id,
      code: row.code,
      customTrackingNumber: row.custom_tracking_number || "",
      awbNumber: awbMatch ? awbMatch[1].trim() : "",
      weight: row.weight != null ? String(row.weight) : "",
      cbm: cbmMatch ? cbmMatch[1].trim() : (row.cbm != null ? String(row.cbm) : ""),
      notes: row.notes,
    });
  };

  const handleSaveTracking = async () => {
    if (!editTracking) return;

    const nextWeight = Number(editTracking.weight);
    if (editTracking.weight.trim() && (Number.isNaN(nextWeight) || nextWeight < 0)) {
      toast.error("Weight must be a valid number.");
      return;
    }
    const nextCbm = Number(editTracking.cbm);
    if (editTracking.cbm.trim() && (Number.isNaN(nextCbm) || nextCbm < 0)) {
      toast.error("CBM must be a valid number.");
      return;
    }

    setIsSaving(true);
    const noteParts = (editTracking.notes || "")
      .split("|")
      .map((p) => p.trim())
      .filter(Boolean)
      .filter((p) => !/^AWB\/BL No\.:/i.test(p) && !/^CBM:/i.test(p));

    if (editTracking.awbNumber.trim()) noteParts.push(`AWB/BL No.: ${editTracking.awbNumber.trim()}`);
    if (editTracking.cbm.trim()) noteParts.push(`CBM: ${nextCbm}`);
    const updatedNotes = noteParts.join(" | ");

    const { error } = await supabase
      .from("shipments")
      .update({
        custom_tracking_number: editTracking.customTrackingNumber.trim() || null,
        weight: editTracking.weight.trim() ? nextWeight : null,
        cbm: editTracking.cbm.trim() ? nextCbm : null,
        notes: updatedNotes || null,
      })
      .eq("id", editTracking.id);

    setIsSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Tracking information updated.");
    setRows((prev) =>
      prev.map((r) =>
        r.id === editTracking.id
          ? {
            ...r,
            custom_tracking_number: editTracking.customTrackingNumber.trim() || null,
            weight: editTracking.weight.trim() ? nextWeight : r.weight,
            cbm: editTracking.cbm.trim() ? nextCbm : r.cbm,
            notes: updatedNotes || null,
          }
          : r,
      ),
    );
    setEditTracking(null);
  };

  useEffect(() => {
    const fetch = async () => {
      try {
        let shipmentsData: ShipmentRow[] | null = null;
        let shipmentsError: { code?: string; message?: string } | null = null;
        const shipmentsRes = await supabase
          .from("shipments")
          .select("id, code, status, service_type, total_cost, shipping_cost, weight, cbm, payment_status, payment_method, pickup_date, estimated_delivery_date, actual_delivery_date, custom_tracking_number, notes, description, created_at, branch_id, consolidation_id, customers(full_name, code, phone), receiver:receivers(full_name, phone, address)")
          .order("created_at", { ascending: false });

        shipmentsData = (shipmentsRes.data || []) as ShipmentRow[];
        shipmentsError = shipmentsRes.error as { code?: string; message?: string } | null;

        if (
          shipmentsError &&
          isMissingColumnError(
            shipmentsError,
            /\b(payment_method|actual_delivery_date|custom_tracking_number|cbm|consolidation_id)\b/i,
          )
        ) {
          const fallbackRes = await supabase
            .from("shipments")
            .select("id, code, status, service_type, total_cost, shipping_cost, weight, payment_status, pickup_date, estimated_delivery_date, notes, description, created_at, branch_id, customers(full_name, code, phone), receiver:receivers(full_name, phone, address)")
            .order("created_at", { ascending: false });

          shipmentsData = (fallbackRes.data || []).map((row: any) => ({
            ...row,
            cbm: null,
            payment_method: null,
            actual_delivery_date: null,
            custom_tracking_number: null,
            consolidation_id: null,
          })) as ShipmentRow[];
          shipmentsError = fallbackRes.error as { code?: string; message?: string } | null;
        }

        const consolidationsRes = await supabase
          .from("consolidations")
          .select("id, code, status, item_count, total_weight, total_cost, created_at, customers(full_name, code, phone), consolidation_shipments(shipment_id, shipment:shipments(id, description, notes, payment_status, quantity, weight, total_cost, shipping_cost, branch_id, pickup_date, estimated_delivery_date, actual_delivery_date, receiver:receivers(full_name, phone, address)))")
          .order("created_at", { ascending: false });

        let consolidationsData = consolidationsRes.data;
        let consolidationsError = consolidationsRes.error as { code?: string; message?: string } | null;

        if (consolidationsError && isMissingConsolidationTotalsError(consolidationsError)) {
          const fallback = await supabase
            .from("consolidations")
            .select("id, code, status, created_at, customers(full_name, code, phone), consolidation_shipments(shipment_id, shipment:shipments(id, description, notes, payment_status, quantity, weight, total_cost, shipping_cost, branch_id, pickup_date, estimated_delivery_date, actual_delivery_date, receiver:receivers(full_name, phone, address)))")
            .order("created_at", { ascending: false });
          consolidationsData = (fallback.data || []).map((row: any) => ({
            ...row,
            item_count: null,
            total_weight: null,
            total_cost: null,
          }));
          consolidationsError = fallback.error as { code?: string; message?: string } | null;
        }

        if (shipmentsError || consolidationsError) {
          toast.error("Failed to load shipments.");
          setRows([]);
          setIsLoading(false);
          return;
        }

        const shipmentRows = shipmentsData || [];
        const consolidations = (consolidationsData || []) as ConsolidationRow[];
        const branchIds = Array.from(
          new Set([
            ...shipmentRows.map((item) => item.branch_id).filter(Boolean),
            ...consolidations.flatMap((consolidation) =>
              (consolidation.consolidation_shipments || [])
                .map((entry) => entry.shipment?.branch_id || null)
                .filter(Boolean),
            ),
          ]),
        );
        let branchMap: Record<string, string> = {};
        if (branchIds.length > 0) {
          const { data: branchData } = await supabase.from("branches").select("id, name").in("id", branchIds);
          branchMap = (branchData || []).reduce((acc, branch) => ({ ...acc, [branch.id]: branch.name }), {} as Record<string, string>);
        }

        const mappedShipments: Row[] = shipmentRows
          .filter((shipment) => !shipment.consolidation_id)
          .map((shipment) => ({
            id: shipment.id,
            code: shipment.code,
            status: normalizeShipmentStatus(shipment.status),
            service_type: shipment.service_type,
            total_cost: shipment.total_cost || 0,
            shipping_cost: shipment.shipping_cost || 0,
            weight: shipment.weight || 0,
            cbm: getShipmentCbmValue(shipment),
            payment_status: shipment.payment_status,
            payment_method: shipment.payment_method,
            pickup_date: shipment.pickup_date,
            estimated_delivery_date: shipment.estimated_delivery_date,
            actual_delivery_date: shipment.actual_delivery_date,
            custom_tracking_number: shipment.custom_tracking_number,
            notes: shipment.notes,
            description: shipment.description,
            created_at: shipment.created_at,
            branch_id: shipment.branch_id,
            consolidation_id: shipment.consolidation_id,
            customer_name: shipment.customers?.full_name || "-",
            customer_code: shipment.customers?.code || "-",
            customer_phone: shipment.customers?.phone || "-",
            receiver_name: shipment.receiver?.full_name || "-",
            receiver_phone: shipment.receiver?.phone || "-",
            receiver_address: shipment.receiver?.address || "-",
            branch_name: shipment.branch_id ? branchMap[shipment.branch_id] || "-" : "-",
          }));

        const mappedConsolidations: Row[] = consolidations
          .map((consolidation) => {
            const normalizedStatus = normalizeConsolidationStatus(consolidation.status);
            if (!normalizedStatus) return null;
            const children = (consolidation.consolidation_shipments || []).map((entry) => entry.shipment).filter(Boolean);
            const paymentStatus = children.length > 0 && children.every((child) => child?.payment_status === "completed") ? "completed" : "pending";
            const consolidatedItemCost = children.reduce((sum, child) => sum + (child?.total_cost || 0), 0);
            const consolidatedShippingFee =
              consolidation.total_cost ?? children.reduce((sum, child) => sum + (child?.shipping_cost || 0), 0);
            const receiverNames = Array.from(new Set(children.map((child) => child?.receiver?.full_name || "").filter(Boolean)));
            const receiverPhones = Array.from(new Set(children.map((child) => child?.receiver?.phone || "").filter(Boolean)));
            const receiverAddresses = Array.from(new Set(children.map((child) => child?.receiver?.address || "").filter(Boolean)));
            return {
              id: consolidation.id,
              code: consolidation.code,
              status: normalizedStatus,
              service_type: "consolidated",
              total_cost: consolidatedItemCost,
              shipping_cost: consolidatedShippingFee,
              weight: consolidation.total_weight ?? children.reduce((sum, child) => sum + (child?.weight || 0), 0),
              cbm: null,
              payment_status: paymentStatus,
              payment_method: null,
              pickup_date: children[0]?.pickup_date || null,
              estimated_delivery_date: children[0]?.estimated_delivery_date || null,
              actual_delivery_date: children[0]?.actual_delivery_date || null,
              custom_tracking_number: consolidation.code,
              notes: null,
              description: `Consolidated shipment (${consolidation.item_count ?? children.length} items)`,
              created_at: consolidation.created_at,
              branch_id: children[0]?.branch_id || null,
              customer_name: consolidation.customers?.full_name || "-",
              customer_code: consolidation.customers?.code || "-",
              customer_phone: consolidation.customers?.phone || "-",
              receiver_name:
                receiverNames.length === 0 ? "-" : receiverNames.length === 1 ? receiverNames[0] : "Multiple Receivers",
              receiver_phone: receiverPhones.length === 1 ? receiverPhones[0] : "-",
              receiver_address:
                receiverAddresses.length === 0 ? "-" : receiverAddresses.length === 1 ? receiverAddresses[0] : "Multiple Addresses",
              branch_name: children[0]?.branch_id ? branchMap[children[0].branch_id] || "-" : "-",
              consolidation_id: consolidation.id,
            };
          })
          .filter(Boolean) as Row[];

        setRows(
          [...mappedShipments, ...mappedConsolidations].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
          ),
        );
        setIsLoading(false);
      } catch {
        toast.error("Failed to load shipments.");
        setRows([]);
        setIsLoading(false);
      }
    };
    fetch();
  }, []);

  const columns: Column<Row>[] = [
    { key: "customer_code", label: "Customer ID", render: (r) => <span className="font-mono text-xs">{r.customer_code}</span> },
    { key: "customer_name", label: "Name" },
    { key: "status", label: "Status", render: (r) => <Badge variant="secondary">{statusLabel[r.status] || r.status}</Badge> },
    { key: "customer_phone", label: "Mobile No." },
    {
      key: "receiver",
      label: "Receiver",
      render: (r) => (
        <div>
          <p>{r.receiver_name}</p>
          <p className="text-xs text-muted-foreground">{r.receiver_phone}</p>
          <p className="text-xs text-muted-foreground">{r.receiver_address}</p>
        </div>
      ),
    },
    { key: "branch_name", label: "Branch" },
    { key: "product_type", label: "Product Type", render: (r) => (r.service_type === "consolidated" ? (getProductType(r.notes) !== "-" ? getProductType(r.notes) : "Mixed Products") : getProductType(r.notes, r.description)) },
    { key: "service_type", label: "Service Type", render: (r) => formatServiceType(r.service_type) },
    { key: "value_added", label: "Value Added", render: (r) => getValueAddedServicesSummary(r.notes) },
    { key: "tracking", label: "Tracking No.", render: (r) => <span className="font-mono text-xs">{resolveTrackingByStatus(r.status, r.notes, r.custom_tracking_number) || "Tracking pending"}</span> },
    { key: "weight", label: "WT", render: (r) => `${r.weight}kg` },
    { key: "cbm", label: "Cubic Meters (CBM)", render: (r) => (r.cbm == null ? "-" : r.cbm.toFixed(2)) },
    { key: "shipping_cost", label: "Shipping Cost", render: (r) => formatAmount(r.shipping_cost || 0) },
    { key: "pickup_date", label: "Departure Date", render: (r) => formatDate(r.pickup_date || r.created_at) },
    { key: "payment_method", label: "Payment Method", render: (r) => formatPaymentMethod(r.payment_method) },
    { key: "arrival_date", label: "Arrival Date", render: (r) => formatDate(r.actual_delivery_date || r.estimated_delivery_date) },
    { key: "payment_status", label: "Payment Status", render: (r) => <Badge variant={r.payment_status === "completed" ? "default" : "destructive"}>{r.payment_status === "completed" ? "Paid" : "Unpaid"}</Badge> },
    {
      key: "actions",
      label: "Actions",
      render: (r) => (
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={(e) => {
              e.stopPropagation();
              setViewRow(r);
            }}
            title="View shipment"
          >
            <Eye className="h-4 w-4 text-blue-600" />
          </Button>
          {r.status === "supplied" && r.service_type !== "consolidated" && (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={(e) => {
                e.stopPropagation();
                openEditTracking(r);
              }}
              title="Edit tracking"
            >
              <Pencil className="h-4 w-4 text-blue-600" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="All Shipments"  />
      <DataTable columns={columns} data={rows} isLoading={isLoading} searchPlaceholder="Search shipped items..." />

      <Dialog open={!!viewRow} onOpenChange={(open) => { if (!open) setViewRow(null); }}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Shipment Details - {viewRow?.code}</DialogTitle>
          </DialogHeader>
          {viewRow && (
            <div className="grid gap-4 py-2 md:grid-cols-2">
              {[
                { label: "Customer ID", value: viewRow.customer_code },
                { label: "Customer", value: viewRow.customer_name },
                { label: "Customer Phone", value: viewRow.customer_phone },
                { label: "Status", value: statusLabel[viewRow.status] || viewRow.status },
                { label: "Service Type", value: formatServiceType(viewRow.service_type) },
                { label: "Product Type", value: viewRow.service_type === "consolidated" ? "Mixed Products" : getProductType(viewRow.notes, viewRow.description) },
                { label: "Tracking No.", value: resolveTrackingByStatus(viewRow.status, viewRow.notes, viewRow.custom_tracking_number) || "Tracking pending" },
                { label: "Branch", value: viewRow.branch_name || "-" },
                { label: "Receiver", value: viewRow.receiver_name },
                { label: "Receiver Phone", value: viewRow.receiver_phone },
                { label: "Receiver Address", value: viewRow.receiver_address },
                { label: "Weight", value: `${viewRow.weight || 0}kg` },
                { label: "CBM", value: viewRow.cbm == null ? "-" : viewRow.cbm.toFixed(2) },
                { label: "Shipping Cost", value: formatAmount(viewRow.shipping_cost || 0) },
                { label: "Payment Method", value: formatPaymentMethod(viewRow.payment_method) },
                { label: "Payment Status", value: viewRow.payment_status === "completed" ? "Paid" : "Unpaid" },
                { label: "Departure Date", value: formatDate(viewRow.pickup_date || viewRow.created_at) },
                { label: "Arrival Date", value: formatDate(viewRow.actual_delivery_date || viewRow.estimated_delivery_date) },
                { label: "Value Added", value: getValueAddedServicesSummary(viewRow.notes) },
                { label: "Description", value: viewRow.description || "-" },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border border-border/60 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.label}</p>
                  <p className="mt-1 text-sm font-medium text-foreground">{item.value}</p>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewRow(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editTracking} onOpenChange={(open) => { if (!open) setEditTracking(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Tracking – {editTracking?.code}</DialogTitle>
          </DialogHeader>
          {editTracking && (
            <div className="grid gap-4 py-2 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="et_tracking">Tracking Number</Label>
                <Input
                  id="et_tracking"
                  value={editTracking.customTrackingNumber}
                  onChange={(e) => setEditTracking({ ...editTracking, customTrackingNumber: e.target.value })}
                  placeholder="Enter tracking number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="et_awb">AWB/BL Number</Label>
                <Input
                  id="et_awb"
                  value={editTracking.awbNumber}
                  onChange={(e) => setEditTracking({ ...editTracking, awbNumber: e.target.value })}
                  placeholder="Enter AWB/BL number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="et_weight">Weight (kg)</Label>
                <Input
                  id="et_weight"
                  type="number"
                  min="0"
                  step="0.01"
                  value={editTracking.weight}
                  onChange={(e) => setEditTracking({ ...editTracking, weight: e.target.value })}
                  placeholder="Enter weight"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="et_cbm">CBM</Label>
                <Input
                  id="et_cbm"
                  type="number"
                  min="0"
                  step="0.0001"
                  value={editTracking.cbm}
                  onChange={(e) => setEditTracking({ ...editTracking, cbm: e.target.value })}
                  placeholder="Enter CBM"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTracking(null)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSaveTracking} disabled={isSaving}>
              {isSaving ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WarehouseAllShipments;

