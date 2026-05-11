import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { toast } from "sonner";

type ManifestRow = {
  id: string;
  code: string;
  status: string | null;
  departure_date: string | null;
  origin: { name: string | null } | null;
  destination: { name: string | null } | null;
};

const WarehouseOutgoingContainers = () => {
  const [manifests, setManifests] = useState<ManifestRow[]>([]);
  const [selectedManifest, setSelectedManifest] = useState<ManifestRow | null>(null);
  const [departureDate, setDepartureDate] = useState("");
  const [status, setStatus] = useState("pending");
  const [isLoading, setIsLoading] = useState(false);

  const fetchManifests = async () => {
    const { data, error } = await supabase
      .from("manifests")
      .select(
        `
        id,
        code,
        status,
        departure_date,
        origin:branches!manifests_origin_branch_id_fkey(name),
        destination:branches!manifests_destination_branch_id_fkey(name)
      `,
      )
      .in("status", ["pending", "in_transit"])
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load outgoing manifests.");
    } else {
      setManifests((data || []) as unknown as ManifestRow[]);
    }
  };

  useEffect(() => {
    fetchManifests();
  }, []);

  const handleSelect = (manifest: ManifestRow) => {
    setSelectedManifest(manifest);
    setDepartureDate(manifest.departure_date ? manifest.departure_date.slice(0, 16) : "");
    setStatus(manifest.status || "pending");
  };

  const handleSave = async () => {
    if (!selectedManifest) {
      return;
    }

    setIsLoading(true);
    const { error } = await supabase
      .from("manifests")
      .update({
        departure_date: departureDate || null,
        status,
      })
      .eq("id", selectedManifest.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Outgoing container updated.");
      await fetchManifests();
    }
    setIsLoading(false);
  };

  const handleClose = async () => {
    if (!selectedManifest) {
      return;
    }

    setIsLoading(true);
    const { error } = await supabase
      .from("manifests")
      .update({
        departure_date: departureDate || null,
        status: "closed",
      })
      .eq("id", selectedManifest.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Manifest closed.");
      setSelectedManifest(null);
      await fetchManifests();
    }
    setIsLoading(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Outgoing Containers"
        
      />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>Pending Manifests</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            {manifests.length === 0 && <p>No outgoing manifests yet.</p>}
            {manifests.map((manifest) => (
              <button
                key={manifest.id}
                type="button"
                onClick={() => handleSelect(manifest)}
                className={`flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left transition-colors ${
                  selectedManifest?.id === manifest.id
                    ? "border-primary bg-primary/10"
                    : "border-border/60 hover:border-border"
                }`}
              >
                <div>
                  <p className="font-semibold text-foreground">{manifest.code}</p>
                  <p className="text-xs text-muted-foreground">
                    {manifest.origin?.name || "Origin"} {" -> "} {manifest.destination?.name || "Destination"}
                  </p>
                </div>
                <StatusBadge status={manifest.status || "pending"} />
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>Container Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedManifest && (
              <p className="text-sm text-muted-foreground">
                Select a manifest to assign container details.
              </p>
            )}
            {selectedManifest && (
              <>
                <div className="space-y-2">
                  <Label>Manifest</Label>
                  <p className="text-sm font-semibold text-foreground">{selectedManifest.code}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="departure_date">Departure Date</Label>
                  <Input
                    id="departure_date"
                    type="datetime-local"
                    value={departureDate}
                    onChange={(event) => setDepartureDate(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in_transit">In Transit</SelectItem>
                      <SelectItem value="arrived">Arrived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-3">
                  <Button type="button" onClick={handleSave} disabled={isLoading}>
                    Save Updates
                  </Button>
                  <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
                    Close Manifest
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default WarehouseOutgoingContainers;

