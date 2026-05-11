import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { getWarehouseArrivalTransition } from "@/lib/parcelWorkflow";
import { getWarehouseTrackingNumber, resolveTrackingByStatus } from "@/lib/shipmentNotes";

type BranchOption = { id: string; name: string };

type ShipmentLookup = {
  id: string;
  code: string;
  status: string;
  customer_id: string | null;
  service_type: string;
  notes: string | null;
  custom_tracking_number: string | null;
  created_at: string;
  branch_id: string | null;
  customer: { full_name: string | null; code: string | null } | null;
  receiver: { full_name: string | null; phone: string | null } | null;
  branch: { name: string | null } | null;
};

const WarehouseReceive = () => {
  const [scanCode, setScanCode] = useState("");
  const [shipment, setShipment] = useState<ShipmentLookup | null>(null);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [defaultBranchId, setDefaultBranchId] = useState<string>("");
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const { data: branchesData } = await supabase
        .from("branches")
        .select("id, name")
        .eq("is_active", true)
        .eq("country", "China");
      setBranches(branchesData || []);

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) {
        return;
      }

      const { data: staffRow } = await supabase
        .from("shipment_team")
        .select("branch_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (staffRow?.branch_id) {
        setDefaultBranchId(staffRow.branch_id);
        setSelectedBranchId(staffRow.branch_id);
        return;
      }

      const { data: managerBranch } = await supabase
        .from("branches")
        .select("id")
        .eq("manager_id", userId)
        .maybeSingle();

      if (managerBranch?.id) {
        setDefaultBranchId(managerBranch.id);
        setSelectedBranchId(managerBranch.id);
      }
    };

    loadData();
  }, []);

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
        customer_id,
        service_type,
        notes,
        custom_tracking_number,
        created_at,
        branch_id,
        customer:customers(full_name, code),
        receiver:receivers(full_name, phone)
      `,
      )
      .ilike("code", trimmed)
      .maybeSingle();

    if (error || !data) {
      toast.error("Shipment not found. Confirm the code or create a shipment first.");
      setShipment(null);
    } else {
      // Fetch branch name separately to avoid relation ambiguity
      let branchName: string | null = null;
      if (data.branch_id) {
        const { data: branchData } = await supabase
          .from("branches")
          .select("name")
          .eq("id", data.branch_id)
          .maybeSingle();
        branchName = branchData?.name || null;
      }
      setShipment({ ...data, branch: { name: branchName } } as ShipmentLookup);
      const nextBranchId = data.branch_id || defaultBranchId || "";
      setSelectedBranchId(nextBranchId);
    }
    setIsLoading(false);
  };

  const handleReceive = async () => {
    if (!shipment) {
      return;
    }

    setIsLoading(true);
    const updatePayload: { status: "received"; branch_id?: string | null } = { status: "received" };
    if (selectedBranchId) {
      updatePayload.branch_id = selectedBranchId;
    }

    let transition: Array<"received" | "requested_pickup"> = ["received"];

    if (shipment.customer_id) {
      const { data: siblingRows } = await supabase
        .from("shipments")
        .select("id, status, customer_id, service_type, notes")
        .eq("customer_id", shipment.customer_id)
        .in("status", ["saved_pickup", "saved_dropoff", "received"]);

      transition = getWarehouseArrivalTransition(
        shipment,
        ((siblingRows || []) as Array<Pick<ShipmentLookup, "id" | "status" | "customer_id" | "service_type" | "notes">>)
      ) as Array<"received" | "requested_pickup">;
    }

    const [firstStatus, ...remainingStatuses] = transition;

    const { error: firstError } = await supabase
      .from("shipments")
      .update({ ...updatePayload, status: firstStatus })
      .eq("id", shipment.id);

    if (firstError) {
      toast.error(firstError.message);
      setIsLoading(false);
      return;
    }

    for (const nextStatus of remainingStatuses) {
      const { error } = await supabase
        .from("shipments")
        .update({ status: nextStatus })
        .eq("id", shipment.id);

      if (error) {
        toast.error(error.message);
        setIsLoading(false);
        return;
      }
    }

    const finalStatus = remainingStatuses.at(-1) || firstStatus;


    toast.success(
      finalStatus === "requested_pickup"
        ? "Single parcel moved straight to Submitted."
        : "Shipment marked as received.",
    );
    setShipment({
      ...shipment,
      status: finalStatus,
      branch_id: selectedBranchId || shipment.branch_id,
    });
    setIsLoading(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Receive Shipments"
        
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
                <p className="text-xs text-muted-foreground">Status</p>
                <StatusBadge status={shipment.status} />
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
                <p className="text-xs text-muted-foreground">Service Type</p>
                <p className="text-sm font-semibold">{shipment.service_type}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Current Warehouse</p>
                <p className="text-sm font-semibold">{shipment.branch?.name || "Not assigned"}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="branch_id">Assign Warehouse</Label>
              <Select
                value={selectedBranchId}
                onValueChange={(value) => setSelectedBranchId(value)}
              >
                <SelectTrigger id="branch_id">
                  <SelectValue placeholder="Select warehouse" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {defaultBranchId && selectedBranchId === defaultBranchId && (
                <p className="text-xs text-muted-foreground">
                  Defaulted to your assigned warehouse.
                </p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Button type="button" onClick={handleReceive} disabled={isLoading}>
                Mark as Received
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
    </div>
  );
};

export default WarehouseReceive;

