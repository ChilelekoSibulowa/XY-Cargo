import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { toast } from "sonner";
import { getWarehouseArrivalTransition, isUnconsolidatedConsolidationParcel } from "@/lib/parcelWorkflow";
import {
  getAirwayBillNumber,
  getWarehouseTrackingNumber,
  resolveTrackingByStatus,
  setAirwayBillNumber,
  upsertNoteValue,
} from "@/lib/shipmentNotes";
import { notifyStatusChange } from "@/lib/notifications";

type ShipmentLookup = {
  id: string;
  code: string;
  status: string;
  collected_at: string | null;
  collected_by: string | null;
  payment_status: string | null;
  weight: number | null;
  cbm: number | null;
  shipping_cost: number | null;
  estimated_delivery_date: string | null;
  customer_id: string | null;
  service_type: string;
  created_at: string;
  custom_tracking_number: string | null;
  notes: string | null;
  branch: { name: string | null } | null;
  destination_branch: { name: string | null } | null;
  customer: { full_name: string | null; code: string | null } | null;
  receiver: { full_name: string | null; phone: string | null } | null;
  is_consolidation?: boolean;
};

const statusStages = [
  { value: "saved_pickup", label: "Created" },
  { value: "saved_dropoff", label: "Incoming" },
  { value: "received", label: "Need Action" },
  { value: "requested_pickup", label: "Submitted" },
  { value: "approved", label: "Confirm Shipment" },
  { value: "assigned", label: "Outgoing Parcel" },
  { value: "supplied", label: "In Transit" },
  { value: "delivered", label: "Ready for Collection" },
  { value: "closed", label: "Collected" },
];

const warehouseNextStatus: Record<string, string | undefined> = {
  saved_pickup: "saved_dropoff",
  saved_dropoff: "received",
  requested_pickup: "approved",
  assigned: "supplied",
  supplied: "delivered",
  delivered: "closed",
};

const isShipmentFullyPaid = (shipment: Pick<ShipmentLookup, "payment_status"> | null) =>
  shipment?.payment_status === "completed";

const formatCollectedByValue = (name: string | null | undefined, phone: string | null | undefined) => {
  const normalizedName = (name || "").trim();
  const normalizedPhone = (phone || "").trim();
  if (normalizedName && normalizedPhone) return `${normalizedName} (${normalizedPhone})`;
  return normalizedName || normalizedPhone || null;
};

const hasRequiredText = (value: string | null | undefined) => !!value?.trim();

const isPositiveNumberValue = (value: number | string | null | undefined) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0;
};

const toDateInputValue = (value: string | null | undefined) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const normalizeServiceType = (serviceType: string | null | undefined) => {
  const normalized = (serviceType || "").toLowerCase().trim();
  if (normalized === "air" || normalized === "air_freight" || normalized === "air freight") return "air";
  if (normalized === "sea" || normalized === "sea_freight" || normalized === "sea freight") return "sea";
  return "";
};

const getMissingOutgoingShipmentFields = (shipment: ShipmentLookup) => {
  const missing: string[] = [];
  if (!hasRequiredText(getWarehouseTrackingNumber(shipment.notes))) missing.push("Tracking Number");
  if (!hasRequiredText(getAirwayBillNumber(shipment.notes))) missing.push("Airbill Number");
  if (!hasRequiredText(shipment.estimated_delivery_date)) missing.push("Estimated Date of Arrival");
  if (!isPositiveNumberValue(shipment.shipping_cost)) missing.push("Shipping Fee");
  if (!isPositiveNumberValue(shipment.weight)) missing.push("Weight");
  if (!isPositiveNumberValue(shipment.cbm)) missing.push("CBM");
  if (!normalizeServiceType(shipment.service_type)) missing.push("Service Type");
  return missing;
};

const formatMissingOutgoingFields = (fields: string[]) =>
  `Complete required Outgoing Parcel details before moving to In Transit: ${fields.join(", ")}.`;

const WarehouseStatusUpdate = () => {
  const [scanCode, setScanCode] = useState("");
  const [shipment, setShipment] = useState<ShipmentLookup | null>(null);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [customTrackingNumber, setCustomTrackingNumber] = useState("");
  const [awbNumber, setAwbNumber] = useState("");
  const [transitWeight, setTransitWeight] = useState("");
  const [transitCbm, setTransitCbm] = useState("");
  const [transportShippingFee, setTransportShippingFee] = useState("");
  const [estimatedArrivalDate, setEstimatedArrivalDate] = useState("");

  useEffect(() => {
    if (!shipment) {
      setSelectedStatus("");
      setCustomTrackingNumber("");
      setAwbNumber("");
      setTransitWeight("");
      setTransitCbm("");
      setTransportShippingFee("");
      setEstimatedArrivalDate("");
      return;
    }
    setSelectedStatus(shipment.status);
    setCustomTrackingNumber(shipment.status === "assigned" ? "" : getWarehouseTrackingNumber(shipment.notes) || "");
    setTransitWeight(shipment.weight != null ? String(shipment.weight) : "");
    setTransportShippingFee(shipment.shipping_cost != null ? String(shipment.shipping_cost) : "");
    setEstimatedArrivalDate(shipment.status === "assigned" ? "" : toDateInputValue(shipment.estimated_delivery_date));

    // Extract AWB number from notes
    setAwbNumber(getAirwayBillNumber(shipment.notes) || "");

    // Extract CBM from notes
    const cbmMatch = shipment.notes?.match(/CBM:\s*([^|]+)/i);
    setTransitCbm(cbmMatch ? cbmMatch[1].trim() : shipment.cbm != null ? String(shipment.cbm) : "");
  }, [shipment]);

  const availableStatuses = useMemo(() => {
    if (!shipment) {
      return statusStages;
    }
    const currentStage = statusStages.find((stage) => stage.value === shipment.status);
    if (!currentStage) {
      return statusStages;
    }
    const next = warehouseNextStatus[shipment.status];
    if (!next) {
      return [currentStage];
    }
    if (next === "closed" && !isShipmentFullyPaid(shipment)) {
      return [currentStage];
    }
    return statusStages.filter((stage) => stage.value === shipment.status || stage.value === next);
  }, [shipment]);

  const handleLookup = async () => {
    const trimmed = scanCode.trim();
    if (!trimmed) {
      toast.error("Enter a shipment code to scan.");
      return;
    }

    setIsLoading(true);
    const { data, error } = await supabase
      .from("shipments")
      .select(
        `
        id,
        code,
        status,
        collected_at,
        collected_by,
        payment_status,
        weight,
        cbm,
        shipping_cost,
        estimated_delivery_date,
        customer_id,
        service_type,
        custom_tracking_number,
        notes,
        created_at,
        branch_id,
        destination_branch_id,
        customer:customers(full_name, code),
        receiver:receivers(full_name, phone)
      `,
      )
      .ilike("code", trimmed)
      .maybeSingle();

    if (error || !data) {
      // Try searching consolidations if not found in shipments
      const { data: consData, error: consError } = await supabase
        .from("consolidations")
        .select(`
          id,
          code,
          status,
          notes,
          created_at,
          total_cost,
          total_weight,
          total_cbm,
          tracking_code,
          customer_id,
          customer:customers(full_name, code)
        `)
        .ilike("code", trimmed)
        .maybeSingle();

      if (consError || !consData) {
        toast.error("Shipment or Consolidation not found.");
        setShipment(null);
      } else {
        // Map consolidation to ShipmentLookup format
        const normalizedConsStatus = (consData.status || "submitted").toLowerCase();
        const mappedStatus =
          normalizedConsStatus === "submitted" ? "requested_pickup" :
            normalizedConsStatus === "confirmed" ? "approved" :
              normalizedConsStatus === "outgoing" ? "assigned" :
                normalizedConsStatus === "in_transit" ? "supplied" :
                  normalizedConsStatus === "arrived" ? "delivered" :
                    normalizedConsStatus === "collected" ? "closed" :
                      normalizedConsStatus;

        setShipment({
          id: consData.id,
          code: consData.code,
          status: mappedStatus,
          notes: consData.notes,
          created_at: consData.created_at,
          customer_id: consData.customer_id,
          customer: consData.customer,
          is_consolidation: true,
          service_type: "Mixed",
          payment_status: "pending",
          weight: Number(consData.total_weight || 0),
          cbm: Number(consData.total_cbm || 0),
          shipping_cost: Number(consData.total_cost || 0),
          estimated_delivery_date: null,
          custom_tracking_number: consData.tracking_code || null,
        } as any);
      }
    } else {
      // Fetch branch names separately to avoid relation ambiguity
      let branchName: string | null = null;
      let destBranchName: string | null = null;

      const branchIds = [data.branch_id, data.destination_branch_id].filter(Boolean);
      if (branchIds.length > 0) {
        const { data: branchesData } = await supabase
          .from("branches")
          .select("id, name")
          .in("id", branchIds);

        if (branchesData) {
          branchName = branchesData.find(b => b.id === data.branch_id)?.name || null;
          destBranchName = branchesData.find(b => b.id === data.destination_branch_id)?.name || null;
        }
      }

      setShipment({
        ...data,
        branch: { name: branchName },
        destination_branch: { name: destBranchName },
      } as ShipmentLookup);
    }
    setIsLoading(false);
  };

  const handleUpdate = async () => {
    if (!shipment) {
      return;
    }
    if (!selectedStatus) {
      toast.error("Select the next status.");
      return;
    }
    if (selectedStatus === shipment.status) {
      toast.error("Select the next workflow stage.");
      return;
    }
    if (selectedStatus === "closed" && !isShipmentFullyPaid(shipment)) {
      // Removed instruction about payment required before collection (per requirements)
      return;
    }

    // Block manual push of an unconsolidated consolidated parcel into Submitted
    if (
      !shipment.is_consolidation &&
      selectedStatus === "requested_pickup" &&
      isUnconsolidatedConsolidationParcel(shipment as any)
    ) {
      toast.error(
        "This parcel uses Consolidation handling. It must be consolidated by the customer/agent before it can move to Submitted.",
      );
      setIsLoading(false);
      return;
    }

    if (selectedStatus === "supplied") {
      if (shipment.is_consolidation) {
        toast.error("Complete consolidated Outgoing Parcel transport details from Warehouse Management before moving to In Transit.");
        return;
      }

      const missingFields = getMissingOutgoingShipmentFields(shipment);
      if (missingFields.length > 0) {
        toast.error(formatMissingOutgoingFields(missingFields));
        return;
      }
    }

    setIsLoading(true);
    let transition = [selectedStatus];

    if (shipment.status === "saved_dropoff" && selectedStatus === "received" && shipment.customer_id) {
      const { data: siblingRows } = await supabase
        .from("shipments")
        .select("id, status, customer_id, service_type, notes")
        .eq("customer_id", shipment.customer_id)
        .in("status", ["saved_pickup", "saved_dropoff", "received"]);

      transition = getWarehouseArrivalTransition(
        shipment,
        ((siblingRows || []) as Array<Pick<ShipmentLookup, "id" | "status" | "customer_id" | "service_type" | "notes">>)
      );
    }

    for (const nextStatus of transition) {
      const isCollecting = nextStatus === "closed";
      const collectionTimestamp = new Date().toISOString();
      const collectedByValue =
        formatCollectedByValue(shipment.receiver?.full_name, shipment.receiver?.phone) || "Warehouse";
      const nextNotes =
        isCollecting
          ? upsertNoteValue(
            upsertNoteValue(shipment.notes, "Collected by", collectedByValue),
            "Collected at",
            collectionTimestamp,
          )
          : shipment.notes;

      if (shipment.is_consolidation) {
        const consStatus =
          nextStatus === "requested_pickup" ? "submitted" :
            nextStatus === "approved" ? "confirmed" :
              nextStatus === "assigned" ? "outgoing" :
                nextStatus === "supplied" ? "in_transit" :
                  nextStatus === "delivered" ? "arrived" :
                    nextStatus === "closed" ? "collected" :
                      nextStatus;

        const { error } = await supabase
          .from("consolidations")
          .update({
            status: consStatus as any,
            ...(isCollecting
              ? {
                collected_by: collectedByValue,
                collected_at: collectionTimestamp,
                notes: nextNotes,
              }
              : {}),
          })
          .eq("id", shipment.id);

        if (error) {
          toast.error(error.message);
          setIsLoading(false);
          return;
        }

        // Also update all linked shipments
        await supabase
          .from("shipments")
          .update({
            status: nextStatus as any,
            ...(isCollecting
              ? {
                collected_by: collectedByValue,
                collected_at: collectionTimestamp,
                notes: nextNotes,
              }
              : {}),
          })
          .in("id", (
            await supabase
              .from("consolidation_shipments")
              .select("shipment_id")
              .eq("consolidation_id", shipment.id)
          ).data?.map(s => s.shipment_id) || []);

      } else {
        const { error } = await supabase
          .from("shipments")
          .update({
            status: nextStatus as any,
            ...(isCollecting
              ? {
                collected_by: collectedByValue,
                collected_at: collectionTimestamp,
                notes: nextNotes,
              }
              : {}),
          })
          .eq("id", shipment.id);

        if (error) {
          toast.error(error.message);
          setIsLoading(false);
          return;
        }
      }

      // Fire notifications for each status transition
      if (shipment.customer_id) {
        const trackingNumber = resolveTrackingByStatus(
          nextStatus,
          shipment.notes,
          shipment.custom_tracking_number,
        );
        notifyStatusChange(
          shipment.customer_id,
          trackingNumber,
          shipment.id,
          nextStatus,
          { handlingMethod: shipment.is_consolidation ? "consolidated" : "single" },
        ).catch((err) => console.error("notifyStatusChange failed:", err));
      }
    }

    const finalStatus = transition.at(-1) || selectedStatus;


    toast.success(
      finalStatus === "requested_pickup" && selectedStatus === "received"
        ? "Single parcel moved straight to Submitted."
        : "Shipment status updated.",
    );
    setShipment((prev) => {
      if (!prev) return prev;
      if (finalStatus !== "closed") {
        return { ...prev, status: finalStatus };
      }

      const collectionTimestamp = new Date().toISOString();
      const collectedByValue =
        formatCollectedByValue(prev.receiver?.full_name, prev.receiver?.phone) || "Warehouse";
      const nextNotes = upsertNoteValue(
        upsertNoteValue(prev.notes, "Collected by", collectedByValue),
        "Collected at",
        collectionTimestamp,
      );

      return {
        ...prev,
        status: finalStatus,
        collected_by: collectedByValue,
        collected_at: collectionTimestamp,
        notes: nextNotes,
      };
    });
    setIsLoading(false);
  };

  const handleUpdateTracking = async () => {
    if (!shipment) {
      return;
    }

    const nextWeight = Number(transitWeight);
    if (transitWeight.trim() && (Number.isNaN(nextWeight) || nextWeight < 0)) {
      toast.error("Weight must be a valid number.");
      return;
    }

    const nextCbm = Number(transitCbm);
    if (transitCbm.trim() && (Number.isNaN(nextCbm) || nextCbm < 0)) {
      toast.error("CBM must be a valid number.");
      return;
    }

    const nextShippingFee = Number(transportShippingFee);
    if (transportShippingFee.trim() && (Number.isNaN(nextShippingFee) || nextShippingFee < 0)) {
      toast.error("Shipping fee must be a valid number.");
      return;
    }

    if (shipment.status === "assigned") {
      const missingFields: string[] = [];
      if (!customTrackingNumber.trim()) missingFields.push("Tracking Number");
      if (!awbNumber.trim()) missingFields.push("Airbill Number");
      if (!estimatedArrivalDate.trim()) missingFields.push("Estimated Date of Arrival");
      if (!isPositiveNumberValue(transportShippingFee)) missingFields.push("Shipping Fee");
      if (!isPositiveNumberValue(transitWeight)) missingFields.push("Weight");
      if (!isPositiveNumberValue(transitCbm)) missingFields.push("CBM");
      if (!normalizeServiceType(shipment.service_type)) missingFields.push("Service Type");

      if (missingFields.length > 0) {
        toast.error(formatMissingOutgoingFields(missingFields));
        return;
      }
    }

    setIsLoading(true);

    const noteParts = (shipment.notes || "")
      .split("|")
      .map((part) => part.trim())
      .filter(Boolean)
      .filter((part) =>
        !/^AWB\/BL No\.:/i.test(part) &&
        !/^CBM:/i.test(part) &&
        !/^Warehouse Tracking Number:/i.test(part) &&
        !/^Warehouse Tracking:/i.test(part)
      );

    if (customTrackingNumber.trim()) {
      noteParts.push(`Warehouse Tracking Number: ${customTrackingNumber.trim()}`);
    }

    let updatedNotes = setAirwayBillNumber(noteParts.join(" | ") || null, awbNumber.trim() || null);

    if (transitCbm.trim()) {
      updatedNotes = upsertNoteValue(updatedNotes, "CBM", String(nextCbm));
    }

    const { error } = await supabase
      .from("shipments")
      .update({
        ...(shipment.status === "assigned" ? {} : { custom_tracking_number: customTrackingNumber.trim() || null }),
        weight: transitWeight.trim() ? nextWeight : null,
        cbm: transitCbm.trim() ? nextCbm : null,
        shipping_cost: transportShippingFee.trim() ? nextShippingFee : null,
        estimated_delivery_date: estimatedArrivalDate.trim() || null,
        notes: updatedNotes || null,
      })
      .eq("id", shipment.id);

    if (error) {
      toast.error(error.message);
      setIsLoading(false);
      return;
    }

    toast.success("Tracking information updated.");
    setShipment({
      ...shipment,
      custom_tracking_number: shipment.status === "assigned" ? shipment.custom_tracking_number : customTrackingNumber.trim() || null,
      weight: transitWeight.trim() ? nextWeight : null,
      cbm: transitCbm.trim() ? nextCbm : null,
      shipping_cost: transportShippingFee.trim() ? nextShippingFee : null,
      estimated_delivery_date: estimatedArrivalDate.trim() || null,
      notes: updatedNotes || null,
    });
    setIsLoading(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Update Parcel Status"

      />

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>Scan / Enter Shipment Code</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="scan_code">Shipment Code</Label>
              <Input
                id="scan_code"
                value={scanCode}
                onChange={(event) => setScanCode(event.target.value)}
                placeholder="e.g., SHP-8F2A1B"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleLookup();
                  }
                }}
              />
            </div>
            <Button type="button" onClick={handleLookup} disabled={isLoading}>
              Lookup Shipment
            </Button>
          </div>
        </CardContent>
      </Card>

      {shipment && (
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>Shipment Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Code</p>
                <p className="text-sm font-semibold">{shipment.code}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Current Status</p>
                <StatusBadge status={shipment.status} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Payment Status</p>
                <StatusBadge status={shipment.payment_status || "pending"} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Customer</p>
                <p className="text-sm font-semibold">
                  {shipment.customer?.full_name || "-"}{" "}
                  {shipment.customer?.code ? `(${shipment.customer.code})` : ""}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Receiver</p>
                <p className="text-sm font-semibold">
                  {shipment.receiver?.full_name || "-"}{" "}
                  {shipment.receiver?.phone ? `- ${shipment.receiver.phone}` : ""}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Origin Warehouse</p>
                <p className="text-sm font-semibold">{shipment.branch?.name || "Not assigned"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Destination Warehouse</p>
                <p className="text-sm font-semibold">
                  {shipment.destination_branch?.name || "Not assigned"}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Update Status</Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger id="status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {availableStatuses.map((stage) => (
                    <SelectItem key={stage.value} value={stage.value}>
                      {stage.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Status moves forward through the full warehouse and client workflow.
                {/* Removed instruction about payment required before collection (per requirements) */}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                type="button"
                onClick={handleUpdate}
                disabled={isLoading || (selectedStatus === "closed" && !isShipmentFullyPaid(shipment))}
              >
                Save Status
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShipment(null);
                  setScanCode("");
                }}
              >
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {shipment && (
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>Update Tracking Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="tracking_number">
                  Tracking Number {shipment.status === "assigned" ? <span className="text-destructive">*</span> : null}
                </Label>
                <Input
                  id="tracking_number"
                  value={customTrackingNumber}
                  onChange={(event) => setCustomTrackingNumber(event.target.value)}
                  placeholder="Enter tracking number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="awb_number">
                  AWB/BL Number {shipment.status === "assigned" ? <span className="text-destructive">*</span> : null}
                </Label>
                <Input
                  id="awb_number"
                  value={awbNumber}
                  onChange={(event) => setAwbNumber(event.target.value)}
                  placeholder="Enter AWB/BL number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="estimated_arrival_date">
                  Estimated Date of Arrival {shipment.status === "assigned" ? <span className="text-destructive">*</span> : null}
                </Label>
                <Input
                  id="estimated_arrival_date"
                  type="date"
                  value={estimatedArrivalDate}
                  onChange={(event) => setEstimatedArrivalDate(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shipping_fee">
                  Shipping Fee {shipment.status === "assigned" ? <span className="text-destructive">*</span> : null}
                </Label>
                <Input
                  id="shipping_fee"
                  type="number"
                  min="0"
                  step="0.01"
                  value={transportShippingFee}
                  onChange={(event) => setTransportShippingFee(event.target.value)}
                  placeholder="Enter shipping fee"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="transit_weight">
                  Weight {shipment.status === "assigned" ? <span className="text-destructive">*</span> : null}
                </Label>
                <Input
                  id="transit_weight"
                  type="number"
                  min="0"
                  step="0.01"
                  value={transitWeight}
                  onChange={(event) => setTransitWeight(event.target.value)}
                  placeholder="Enter weight"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="transit_cbm">
                  CBM {shipment.status === "assigned" ? <span className="text-destructive">*</span> : null}
                </Label>
                <Input
                  id="transit_cbm"
                  type="number"
                  min="0"
                  step="0.0001"
                  value={transitCbm}
                  onChange={(event) => setTransitCbm(event.target.value)}
                  placeholder="Enter CBM"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                type="button"
                onClick={handleUpdateTracking}
                disabled={isLoading}
              >
                Update Tracking Info
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
};

export default WarehouseStatusUpdate;
