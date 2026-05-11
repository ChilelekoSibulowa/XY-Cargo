import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { toast } from "sonner";

type ShipmentLookup = {
  id: string;
  code: string;
  status: string;
  payment_status: string | null;
  internal_notes: string | null;
  customer: { full_name: string | null; code: string | null } | null;
  receiver: { full_name: string | null; phone: string | null } | null;
};

const problemReasons = [
  { value: "damaged", label: "Damaged parcel" },
  { value: "wrong_declaration", label: "Wrong declaration" },
  { value: "unpaid_duty", label: "Unpaid duty" },
  { value: "missing_documents", label: "Missing documents" },
  { value: "other", label: "Other" },
];

const WarehouseProblemParcels = () => {
  const [scanCode, setScanCode] = useState("");
  const [shipment, setShipment] = useState<ShipmentLookup | null>(null);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!shipment) {
      setReason("");
      setNotes("");
    }
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
        payment_status,
        internal_notes,
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
      setShipment(data as ShipmentLookup);
    }
    setIsLoading(false);
  };

  const handleFlag = async () => {
    if (!shipment) {
      return;
    }
    if (!reason) {
      toast.error("Select a problem reason.");
      return;
    }

    setIsLoading(true);
    const reasonLabel = problemReasons.find((item) => item.value === reason)?.label || reason;
    const entry = `Problem flagged - ${reasonLabel}${notes ? `: ${notes}` : ""}`;
    const updatedNotes = shipment.internal_notes ? `${shipment.internal_notes}\n${entry}` : entry;

    const { error } = await supabase
      .from("shipments")
      .update({ internal_notes: updatedNotes })
      .eq("id", shipment.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Problem parcel flagged.");
      setShipment({ ...shipment, internal_notes: updatedNotes });
    }
    setIsLoading(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Mark Problem Parcels"
        
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="problem_reason">Problem Reason</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger id="problem_reason">
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  {problemReasons.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="problem_notes">Notes</Label>
              <Textarea
                id="problem_notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Add supporting details or actions needed."
              />
            </div>

            <div className="flex items-center gap-3">
              <Button type="button" onClick={handleFlag} disabled={isLoading}>
                Flag Problem Parcel
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

export default WarehouseProblemParcels;

