import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { toast } from "sonner";

type ShipmentLookup = {
  id: string;
  code: string;
  status: string;
  internal_notes: string | null;
  customer: { full_name: string | null } | null;
};

const SupportInternalNotes = () => {
  const [code, setCode] = useState("");
  const [shipment, setShipment] = useState<ShipmentLookup | null>(null);
  const [note, setNote] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!shipment) {
      setNote("");
    }
  }, [shipment]);

  const handleLookup = async () => {
    const trimmed = code.trim();
    if (!trimmed) {
      toast.error("Enter a shipment code.");
      return;
    }

    setIsLoading(true);
    const { data, error } = await supabase
      .from("shipments")
      .select("id, code, status, internal_notes, customer:customers(full_name)")
      .ilike("code", trimmed)
      .maybeSingle();

    if (error || !data) {
      toast.error("Shipment not found.");
      setShipment(null);
    } else {
      setShipment(data as ShipmentLookup);
    }
    setIsLoading(false);
  };

  const handleSave = async () => {
    if (!shipment) {
      return;
    }
    if (!note.trim()) {
      toast.error("Add a note before saving.");
      return;
    }

    setIsLoading(true);
    const entry = `Support note: ${note.trim()}`;
    const updatedNotes = shipment.internal_notes ? `${shipment.internal_notes}\n${entry}` : entry;

    const { error } = await supabase
      .from("shipments")
      .update({ internal_notes: updatedNotes })
      .eq("id", shipment.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Internal note updated.");
      setShipment({ ...shipment, internal_notes: updatedNotes });
      setNote("");
    }
    setIsLoading(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Internal Notes"
        
      />

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>Shipment Lookup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="shipment_code">Shipment Code</Label>
              <Input
                id="shipment_code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
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
              Lookup
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
                  {shipment.customer?.full_name || "Customer"}
                </p>
              </div>
            </div>

            {shipment.internal_notes && (
              <div className="rounded-lg border border-border bg-muted/40 p-4 text-xs text-muted-foreground whitespace-pre-line">
                {shipment.internal_notes}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="internal_note">Add Note</Label>
              <Textarea
                id="internal_note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Add internal notes or case updates."
              />
            </div>

            <div className="flex items-center gap-3">
              <Button type="button" onClick={handleSave} disabled={isLoading}>
                Save Note
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShipment(null);
                  setCode("");
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

export default SupportInternalNotes;

