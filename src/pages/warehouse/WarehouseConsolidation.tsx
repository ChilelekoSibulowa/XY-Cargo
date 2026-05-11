import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { replaceConsolidationShipmentLinks } from "@/lib/consolidationLinks";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DataTable, Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Package, Plus, Trash2, Loader2, Eye, CheckCircle2, Check } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { upsertNoteValue, getWarehouseTrackingNumber, resolveTrackingByStatus } from "@/lib/shipmentNotes";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

type CustomerResult = {
  id: string;
  code: string;
  full_name: string;
};

type ShipmentRow = {
  id: string;
  code: string;
  description: string | null;
  custom_tracking_number: string | null;
  status: string;
  notes?: string | null;
  receiver?: { full_name: string | null; phone: string | null } | null;
  weight: number;
  total_cost: number | null;
  payment_status: string | null;
  created_at: string;
};

type ConsolidationRow = {
  id: string;
  code: string;
  customer_id: string | null;
  status: string;
  notes: string | null;
  item_count: number | null;
  total_weight: number | null;
  total_cost: number | null;
  created_at: string;
  customer: { full_name: string; code: string } | null;
  shipment_count: number;
  all_shipments_paid: boolean;
};

const normalizeConsolidationStatus = (status: string) => {
  const normalized = (status || "").toLowerCase().trim();
  if (normalized === "pending" || normalized === "requested" || normalized === "submitted") return "submitted";
  if (normalized === "processed" || normalized === "completed" || normalized === "confirmed") return "confirmed";
  if (normalized === "outgoing" || normalized === "assigned") return "outgoing";
  if (normalized === "in_transit" || normalized === "intransit" || normalized === "supplied") return "in_transit";
  if (normalized === "arrived" || normalized === "delivered") return "arrived";
  if (normalized === "collected" || normalized === "closed") return "collected";
  return "submitted";
};

const statusLabel: Record<string, string> = {
  submitted: "Submitted",
  confirmed: "Confirm Shipment",
  outgoing: "Outgoing Parcel",
  in_transit: "In Transit",
  arrived: "Ready for Collection",
  collected: "Collected",
};

const nextStatusMap: Record<string, string | null> = {
  submitted: "confirmed",
  confirmed: "outgoing",
  outgoing: "in_transit",
  in_transit: "arrived",
  arrived: "collected",
  collected: null,
};

const nextActionLabel: Record<string, string> = {
  submitted: "Send to Confirm Shipment",
  confirmed: "Mark Outgoing",
  outgoing: "Mark In Transit",
  in_transit: "Mark Ready for Collection",
  arrived: "Mark Collected",
};

const nextActionIcon = (nextStatus: string) => {
  if (nextStatus === "confirmed" || nextStatus === "collected") {
    return <CheckCircle2 className="h-4 w-4 text-green-600" />;
  }
  return <Check className="h-4 w-4 text-blue-600" />;
};

const isMissingConsolidationTotalsError = (error: { code?: string; message?: string } | null) =>
  !!error &&
  (error.code === "42703" ||
    /item_count|total_weight|total_cost/i.test(error.message || ""));

const getAutoItemCount = (shipments: ShipmentRow[]) => shipments.length;

const getAutoWeight = (shipments: ShipmentRow[]) =>
  shipments.reduce((sum, shipment) => sum + (shipment.weight || 0), 0);

const getAutoCost = (shipments: ShipmentRow[]) =>
  shipments.reduce((sum, shipment) => sum + (shipment.total_cost || 0), 0);

const areShipmentsFullyPaid = (shipments: Array<Pick<ShipmentRow, "payment_status">>) =>
  shipments.length > 0 && shipments.every((shipment) => shipment.payment_status === "completed");

const formatCollectedByValue = (name: string | null | undefined, phone: string | null | undefined) => {
  const normalizedName = (name || "").trim();
  const normalizedPhone = (phone || "").trim();
  if (normalizedName && normalizedPhone) return `${normalizedName} (${normalizedPhone})`;
  return normalizedName || normalizedPhone || null;
};

const WarehouseConsolidation = () => {
  const [customerCode, setCustomerCode] = useState("");
  const [customer, setCustomer] = useState<CustomerResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [shipments, setShipments] = useState<ShipmentRow[]>([]);
  const [selectedShipments, setSelectedShipments] = useState<Set<string>>(new Set());
  const [consolidations, setConsolidations] = useState<ConsolidationRow[]>([]);
  const [isLoadingConsolidations, setIsLoadingConsolidations] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [notes, setNotes] = useState("");
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedConsolidation, setSelectedConsolidation] = useState<ConsolidationRow | null>(null);
  const [consolidationShipments, setConsolidationShipments] = useState<ShipmentRow[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [itemCountInput, setItemCountInput] = useState("");
  const [totalWeightInput, setTotalWeightInput] = useState("");
  const [totalCostInput, setTotalCostInput] = useState("");
  const [isSavingDetails, setIsSavingDetails] = useState(false);

  // Fetch all consolidations
  const fetchConsolidations = async () => {
    const withTotals = await supabase
      .from("consolidations")
      .select(`
        id, code, customer_id, status, notes, item_count, total_weight, total_cost, created_at,
        customer:customers(full_name, code)
      `)
      .order("created_at", { ascending: false });

    let data = withTotals.data;
    let error = withTotals.error as { code?: string; message?: string } | null;

    if (error && isMissingConsolidationTotalsError(error)) {
      const fallback = await supabase
        .from("consolidations")
        .select(`
          id, code, customer_id, status, notes, created_at,
          customer:customers(full_name, code)
        `)
        .order("created_at", { ascending: false });

      data = (fallback.data || []).map((row: any) => ({
        ...row,
        item_count: null,
        total_weight: null,
        total_cost: null,
      }));
      error = fallback.error as { code?: string; message?: string } | null;
    }

    if (error) {
      toast.error("Failed to load consolidations");
      setIsLoadingConsolidations(false);
      return;
    }

    // Get shipment counts for each consolidation
    const consolidationsWithCounts = await Promise.all(
      (data || []).map(async (c) => {
        const [{ count }, { data: linkedShipments }] = await Promise.all([
          supabase
            .from("consolidation_shipments")
            .select("id", { count: "exact", head: true })
            .eq("consolidation_id", c.id),
          supabase
            .from("consolidation_shipments")
            .select("shipment:shipments(payment_status)")
            .eq("consolidation_id", c.id),
        ]);

        const shipmentPayments = ((linkedShipments || []).map((row: any) => row.shipment).filter(Boolean) || []) as Array<Pick<ShipmentRow, "payment_status">>;
        return {
          ...c,
          shipment_count: count || 0,
          all_shipments_paid: areShipmentsFullyPaid(shipmentPayments),
        };
      })
    );

    setConsolidations(consolidationsWithCounts as ConsolidationRow[]);
    setIsLoadingConsolidations(false);
  };

  useEffect(() => {
    fetchConsolidations();
  }, []);

  // Search for customer by code
  const handleFindCustomer = async () => {
    if (!customerCode.trim()) {
      toast.error("Please enter a customer code");
      return;
    }

    setIsSearching(true);
    setCustomer(null);
    setShipments([]);
    setSelectedShipments(new Set());

    const { data: customerData, error: customerError } = await supabase
      .from("customers")
      .select("id, code, full_name")
      .ilike("code", `%${customerCode.trim()}%`)
      .limit(1)
      .single();

    if (customerError || !customerData) {
      toast.error("Customer not found");
      setIsSearching(false);
      return;
    }

    setCustomer(customerData);

    // Fetch customer's shipments that can be consolidated (Need Action status, not already in a consolidation)
    const { data: shipmentData, error: shipmentError } = await supabase
      .from("shipments")
      .select("id, code, description, custom_tracking_number, status, weight, total_cost, payment_status, created_at")
      .eq("customer_id", customerData.id)
      .eq("status", "received")
      .order("created_at", { ascending: false });

    if (shipmentError) {
      toast.error("Failed to load shipments");
    } else {
      // Filter out shipments already in a consolidation
      const { data: existingConsolidations } = await supabase
        .from("consolidation_shipments")
        .select("shipment_id");

      const consolidatedIds = new Set(existingConsolidations?.map(c => c.shipment_id) || []);
      const availableShipments = (shipmentData || []).filter(s => !consolidatedIds.has(s.id));
      setShipments(availableShipments);
    }

    setIsSearching(false);
  };

  // Toggle shipment selection
  const toggleShipment = (shipmentId: string) => {
    setSelectedShipments(prev => {
      const next = new Set(prev);
      if (next.has(shipmentId)) {
        next.delete(shipmentId);
      } else {
        next.add(shipmentId);
      }
      return next;
    });
  };

  // Create consolidation
  const handleCreateConsolidation = async () => {
    if (!customer || selectedShipments.size < 1) {
      toast.error("Select at least one shipment to consolidate");
      return;
    }

    setIsCreating(true);
    const selectedShipmentRows = shipments.filter((shipment) => selectedShipments.has(shipment.id));
    const autoItemCount = getAutoItemCount(selectedShipmentRows);
    const autoWeight = getAutoWeight(selectedShipmentRows);
    const autoCost = getAutoCost(selectedShipmentRows);

    // Generate consolidation code
    const code = `CON-${Date.now().toString(36).toUpperCase()}`;

    let consolidation: { id: string } | null = null;
    let consolidationError: { code?: string; message?: string } | null = null;

    const withTotalsInsert = await supabase
      .from("consolidations")
      .insert({
        code,
        customer_id: customer.id,
        notes: notes || null,
        status: "submitted",
        item_count: autoItemCount,
        total_weight: autoWeight,
        total_cost: autoCost,
      })
      .select()
      .single();

    consolidation = withTotalsInsert.data as { id: string } | null;
    consolidationError = withTotalsInsert.error as { code?: string; message?: string } | null;

    if (consolidationError && isMissingConsolidationTotalsError(consolidationError)) {
      const fallbackInsert = await supabase
        .from("consolidations")
        .insert({
          code,
          customer_id: customer.id,
          notes: notes || null,
          status: "submitted",
        })
        .select()
        .single();

      consolidation = fallbackInsert.data as { id: string } | null;
      consolidationError = fallbackInsert.error as { code?: string; message?: string } | null;
    }

    if (consolidationError || !consolidation) {
      toast.error("Failed to create consolidation");
      setIsCreating(false);
      return;
    }

    // Add shipments to consolidation
    const { error: shipmentsError } = await replaceConsolidationShipmentLinks(
      consolidation.id,
      Array.from(selectedShipments),
    );

    if (shipmentsError) {
      toast.error("Failed to add shipments to consolidation");
    } else {
      toast.success(`Consolidation ${code} created with ${selectedShipments.size} shipments`);
      setCustomer(null);
      setShipments([]);
      setSelectedShipments(new Set());
      setNotes("");
      setCustomerCode("");
      fetchConsolidations();
    }

    setIsCreating(false);
  };

  // View consolidation details
  const handleViewConsolidation = async (consolidation: ConsolidationRow) => {
    setSelectedConsolidation(consolidation);
    setViewDialogOpen(true);
    setIsLoadingDetails(true);
    setItemCountInput(consolidation.item_count !== null ? String(consolidation.item_count) : "");
    setTotalWeightInput(consolidation.total_weight !== null ? String(consolidation.total_weight) : "");
    setTotalCostInput(consolidation.total_cost !== null ? String(consolidation.total_cost) : "");

    const { data, error } = await supabase
      .from("consolidation_shipments")
      .select(`
        shipment:shipments(id, code, description, custom_tracking_number, status, weight, total_cost, payment_status, created_at)
      `)
      .eq("consolidation_id", consolidation.id);

    if (error) {
      toast.error("Failed to load consolidation details");
      setConsolidationShipments([]);
    } else {
      const details = (data || []).map(d => d.shipment).filter(Boolean) as ShipmentRow[];
      const autoItemCount = getAutoItemCount(details);
      const autoWeight = getAutoWeight(details);
      const autoCost = getAutoCost(details);

      setConsolidationShipments(details);
      setItemCountInput(String(consolidation.item_count ?? autoItemCount));
      setTotalWeightInput((consolidation.total_weight ?? autoWeight).toFixed(2));
      setTotalCostInput((consolidation.total_cost ?? autoCost).toFixed(2));
    }
    setIsLoadingDetails(false);
  };

  // Update consolidation status
  const handleUpdateStatus = async (id: string, newStatus: string) => {
    let linkedShipmentDetails: Array<{
      id: string;
      payment_status: string | null;
      notes: string | null;
      receiver: { full_name: string | null; phone: string | null } | null;
    }> = [];

    if (newStatus === "collected") {
      const { data: linkedShipments, error: linkedShipmentsError } = await supabase
        .from("consolidation_shipments")
        .select("shipment:shipments(id, payment_status, notes, receiver:receivers(full_name, phone))")
        .eq("consolidation_id", id);

      if (linkedShipmentsError) {
        toast.error("Failed to validate payment status before collection.");
        return;
      }

      linkedShipmentDetails = ((linkedShipments || []) as Array<{ shipment: {
        id: string;
        payment_status: string | null;
        notes: string | null;
        receiver: { full_name: string | null; phone: string | null } | null;
      } | null }>)
        .map((row) => row.shipment)
        .filter(Boolean) as Array<{
          id: string;
          payment_status: string | null;
          notes: string | null;
          receiver: { full_name: string | null; phone: string | null } | null;
        }>;

      const hasUnpaid = linkedShipmentDetails.some((row) => row.payment_status !== "completed");
      if (hasUnpaid) {
        toast.error("Cannot mark as Collected until all linked shipments are paid.");
        return;
      }
    }

    const attemptedStatuses = [newStatus];
    if (newStatus === "in_transit") attemptedStatuses.push("supplied");
    if (newStatus === "arrived") attemptedStatuses.push("delivered");
    if (newStatus === "collected") attemptedStatuses.push("closed");

    const collectionTimestamp = new Date().toISOString();
    const collectedByCandidates = Array.from(
      new Set(
        linkedShipmentDetails
          .map((shipment) =>
            formatCollectedByValue(shipment.receiver?.full_name, shipment.receiver?.phone),
          )
          .filter((value): value is string => !!value),
      ),
    );
    const consolidationCollectedBy =
      collectedByCandidates.length === 1
        ? collectedByCandidates[0]
        : collectedByCandidates.length > 1
          ? "Multiple Receivers"
          : "Warehouse";
    const currentConsolidation =
      consolidations.find((row) => row.id === id) || (selectedConsolidation?.id === id ? selectedConsolidation : null);
    const collectionNotes = upsertNoteValue(
      upsertNoteValue(currentConsolidation?.notes || null, "Collected by", consolidationCollectedBy),
      "Collected at",
      collectionTimestamp,
    );

    let updateError: { message: string } | null = null;
    for (const statusValue of attemptedStatuses) {
      const isCollectingStatus = newStatus === "collected" && (statusValue === "collected" || statusValue === "closed");
      const { error } = await supabase
        .from("consolidations")
        .update({
          status: statusValue,
          ...(isCollectingStatus
            ? {
                collected_by: consolidationCollectedBy,
                collected_at: collectionTimestamp,
                notes: collectionNotes,
              }
            : {}),
        })
        .eq("id", id);

      if (!error) {
        updateError = null;
        break;
      }
      updateError = error;
    }

    if (updateError) {
      toast.error("Failed to update status");
    } else {
      if (newStatus === "collected" && linkedShipmentDetails.length > 0) {
        const childUpdates = await Promise.all(
          linkedShipmentDetails.map((shipment) => {
            const childCollectedBy =
              formatCollectedByValue(shipment.receiver?.full_name, shipment.receiver?.phone) ||
              consolidationCollectedBy;
            const nextShipmentNotes = upsertNoteValue(
              upsertNoteValue(shipment.notes, "Collected by", childCollectedBy),
              "Collected at",
              collectionTimestamp,
            );

            return supabase
              .from("shipments")
              .update({
                status: "closed",
                collected_by: childCollectedBy,
                collected_at: collectionTimestamp,
                notes: nextShipmentNotes,
              })
              .eq("id", shipment.id);
          }),
        );

        const childError = childUpdates.find((result) => !!result.error)?.error;
        if (childError) {
          toast.error(childError.message || "Failed to update linked shipments with collection details.");
          return;
        }
      }

      toast.success("Status updated");


      fetchConsolidations();
      if (selectedConsolidation?.id === id) {
        setSelectedConsolidation(prev => prev ? { ...prev, status: newStatus } : null);
      }
    }
  };

  const handleSaveConsolidationDetails = async () => {
    if (!selectedConsolidation) return;

    const parsedItemCount = Number(itemCountInput);
    const parsedWeight = Number(totalWeightInput);
    const parsedCost = Number(totalCostInput);

    if (!Number.isInteger(parsedItemCount) || parsedItemCount < 0) {
      toast.error("Item count must be a whole number greater than or equal to 0.");
      return;
    }
    if (Number.isNaN(parsedWeight) || parsedWeight < 0) {
      toast.error("Total weight must be a valid number greater than or equal to 0.");
      return;
    }
    if (Number.isNaN(parsedCost) || parsedCost < 0) {
      toast.error("Total cost must be a valid number greater than or equal to 0.");
      return;
    }

    setIsSavingDetails(true);
    const normalizedCurrentStatus = normalizeConsolidationStatus(selectedConsolidation.status);
    const nextStatus = normalizedCurrentStatus === "submitted" ? "confirmed" : normalizedCurrentStatus;

    const { error } = await supabase
      .from("consolidations")
      .update({
        item_count: parsedItemCount,
        total_weight: parsedWeight,
        total_cost: parsedCost,
        status: nextStatus,
      })
      .eq("id", selectedConsolidation.id);

    if (error) {
      if (isMissingConsolidationTotalsError(error as { code?: string; message?: string })) {
        toast.error("Please run latest database migrations to enable editable totals.");
      } else {
        toast.error("Failed to save consolidation details.");
      }
      setIsSavingDetails(false);
      return;
    }

    setConsolidations((prev) =>
      prev.map((row) =>
        row.id === selectedConsolidation.id
          ? {
              ...row,
              item_count: parsedItemCount,
              total_weight: parsedWeight,
              total_cost: parsedCost,
            }
          : row
      )
    );
    setSelectedConsolidation((prev) =>
      prev
        ? {
            ...prev,
            item_count: parsedItemCount,
            total_weight: parsedWeight,
            total_cost: parsedCost,
            status: nextStatus,
          }
        : prev
    );
    toast.success(
      normalizedCurrentStatus === "submitted"
        ? "Consolidation details updated and moved to Confirm Shipment."
        : "Consolidation details updated."
    );


    setIsSavingDetails(false);
  };

  const consolidationColumns: Column<ConsolidationRow>[] = [
    { key: "code", label: "Code" },
    {
      key: "customer",
      label: "Customer",
      render: (row) => row.customer?.full_name || "-",
    },
    {
      key: "shipment_count",
      label: "Shipments",
      render: (row) => row.shipment_count,
    },
    {
      key: "item_count",
      label: "Items",
      render: (row) => row.item_count ?? row.shipment_count,
    },
    {
      key: "total_weight",
      label: "Total Weight",
      render: (row) => `${(row.total_weight ?? 0).toFixed(2)}kg`,
    },
    {
      key: "total_cost",
      label: "Total Cost",
      render: (row) => `$${(row.total_cost ?? 0).toFixed(2)}`,
    },
    {
      key: "status",
      label: "Status",
      render: (row) => {
        const normalizedStatus = normalizeConsolidationStatus(row.status);
        return <StatusBadge status={normalizedStatus} label={statusLabel[normalizedStatus]} />;
      },
    },
    {
      key: "created_at",
      label: "Created",
      render: (row) => format(new Date(row.created_at), "PP"),
    },
    {
      key: "actions",
      label: "Actions",
      render: (row) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 p-0" onClick={() => handleViewConsolidation(row)} title="View consolidation">
            <Eye className="h-4 w-4 text-blue-600" />
          </Button>
          {nextStatusMap[normalizeConsolidationStatus(row.status)] && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 p-0"
              disabled={
                normalizeConsolidationStatus(row.status) === "arrived" && !row.all_shipments_paid
              }
              onClick={() =>
                handleUpdateStatus(
                  row.id,
                  nextStatusMap[normalizeConsolidationStatus(row.status)] as string
                )
              }
              title={nextActionLabel[normalizeConsolidationStatus(row.status)]}
            >
              {(() => {
                const next = nextStatusMap[normalizeConsolidationStatus(row.status)];
                if (next === "confirmed" || next === "collected") {
                  return <CheckCircle2 className="h-4 w-4 text-green-600" />;
                }
                if (next === "arrived") {
                  return <CheckCircle2 className="h-4 w-4 text-green-600" />;
                }
                return <Check className="h-4 w-4 text-blue-600" />;
              })()}
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Consolidation Requests"
        
      />

      {/* Customer Lookup */}
      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>Customer Lookup</CardTitle>
          
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="customer_code">Customer Code</Label>
              <Input
                id="customer_code"
                value={customerCode}
                onChange={(event) => setCustomerCode(event.target.value)}
                placeholder="e.g., CUST-9G7L"
              />
            </div>
            <Button type="button" onClick={handleFindCustomer} disabled={isSearching}>
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {isSearching ? "Searching..." : "Find Customer"}
            </Button>
          </div>

          {/* Customer found - show their shipments */}
          {customer && (
            <div className="mt-6 space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="font-medium">{customer.full_name}</p>
                <p className="text-sm text-muted-foreground">{customer.code}</p>
              </div>

              {shipments.length > 0 ? (
                <>
                  <div className="space-y-2">
                    <Label>Select shipments to consolidate</Label>
                    <div className="border rounded-lg divide-y">
                      {shipments.map((shipment) => (
                        <div
                          key={shipment.id}
                          className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer"
                          onClick={() => toggleShipment(shipment.id)}
                        >
                          <Checkbox
                            checked={selectedShipments.has(shipment.id)}
                            onCheckedChange={() => toggleShipment(shipment.id)}
                          />
                          <div className="flex-1">
                            <p className="font-medium">{shipment.code}</p>
                            <p className="text-sm text-muted-foreground">
                              {shipment.description || "No description"} - {shipment.weight}kg
                            </p>
                          </div>
                          <StatusBadge status={shipment.status} />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes (optional)</Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Add any notes about this consolidation..."
                    />
                  </div>

                  <Button
                    onClick={handleCreateConsolidation}
                    disabled={selectedShipments.size < 1 || isCreating}
                    className="w-full"
                  >
                    {isCreating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                    Create Consolidation ({selectedShipments.size} shipments)
                  </Button>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No available shipments to consolidate</p>
                  <p className="text-sm">Shipments must be in Need Action and not already consolidated</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Existing Consolidations */}
      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>Consolidation Requests</CardTitle>
          
        </CardHeader>
        <CardContent>
          <DataTable
            columns={consolidationColumns}
            data={consolidations}
            isLoading={isLoadingConsolidations}
            searchPlaceholder="Search consolidations..."
          />
        </CardContent>
      </Card>

      {/* View Consolidation Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Consolidation {selectedConsolidation?.code}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Customer:</span>
                <p className="font-medium">{selectedConsolidation?.customer?.full_name}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Status:</span>
                <div className="mt-1">
                  {(() => {
                    const normalizedStatus = normalizeConsolidationStatus(selectedConsolidation?.status || "");
                    return <StatusBadge status={normalizedStatus} label={statusLabel[normalizedStatus]} />;
                  })()}
                </div>
              </div>
              {selectedConsolidation?.notes && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Notes:</span>
                  <p>{selectedConsolidation.notes}</p>
                </div>
              )}
            </div>

            <div className="space-y-3 border rounded-lg p-4">
              <p className="text-sm font-medium">Pricing, Weight, and Item Details</p>
              <p className="text-xs text-muted-foreground">
                Auto-detected products in consolidation: {getAutoItemCount(consolidationShipments)}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="item_count">Total Items</Label>
                  <Input
                    id="item_count"
                    type="number"
                    min="0"
                    step="1"
                    value={itemCountInput}
                    onChange={(event) => setItemCountInput(event.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="total_weight">Total Weight (kg)</Label>
                  <Input
                    id="total_weight"
                    type="number"
                    min="0"
                    step="0.01"
                    value={totalWeightInput}
                    onChange={(event) => setTotalWeightInput(event.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="total_cost">Total Cost ($)</Label>
                  <Input
                    id="total_cost"
                    type="number"
                    min="0"
                    step="0.01"
                    value={totalCostInput}
                    onChange={(event) => setTotalCostInput(event.target.value)}
                  />
                </div>
              </div>
              <Button onClick={handleSaveConsolidationDetails} disabled={isSavingDetails}>
                {isSavingDetails ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save Details
              </Button>
            </div>

            <div>
              <Label className="mb-2 block">Shipments in this consolidation</Label>
              {isLoadingDetails ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="border rounded-lg divide-y">
                  {consolidationShipments.map((shipment) => (
                    <div key={shipment.id} className="flex items-center justify-between p-3">
                      <div>
                        <p className="font-medium">{shipment.code}</p>
                        <p className="text-sm text-muted-foreground">
                          {shipment.description || "No description"} - {shipment.weight}kg
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Tracking: {resolveTrackingByStatus(shipment.status, shipment.notes, shipment.custom_tracking_number) || "Tracking pending"} | Cost: ${shipment.total_cost?.toFixed(2) || "0.00"}
                        </p>
                      </div>
                      <StatusBadge status={shipment.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            {selectedConsolidation && nextStatusMap[normalizeConsolidationStatus(selectedConsolidation.status)] && (
              <Button
                disabled={
                  normalizeConsolidationStatus(selectedConsolidation.status) === "arrived" &&
                  !areShipmentsFullyPaid(consolidationShipments)
                }
                onClick={() => {
                  const normalizedStatus = normalizeConsolidationStatus(selectedConsolidation.status);
                  const nextStatus = nextStatusMap[normalizedStatus];
                  if (!nextStatus) return;
                  handleUpdateStatus(selectedConsolidation.id, nextStatus);
                  setViewDialogOpen(false);
                }}
              >
                {nextActionLabel[normalizeConsolidationStatus(selectedConsolidation.status)]}
              </Button>
            )}
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WarehouseConsolidation;

