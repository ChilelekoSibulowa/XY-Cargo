import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FormCard } from "@/components/shared/FormCard";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

interface Branch {
  id: string;
  name: string;
}

interface Driver {
  id: string;
  full_name: string;
  code: string;
}

const missionTypes = [
  { value: "pickup", label: "Pickup" },
  { value: "delivery", label: "Delivery" },
  { value: "transfer", label: "Transfer" },
  { value: "supply", label: "Supply" },
];

const missionStatuses = [
  { value: "requested", label: "Requested" },
  { value: "assigned", label: "Assigned" },
  { value: "approved", label: "Approved" },
  { value: "received", label: "Received" },
  { value: "done", label: "Done" },
  { value: "closed", label: "Closed" },
];

const MissionEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [form, setForm] = useState({
    mission_type: "pickup",
    status: "requested",
    branch_id: "",
    destination_branch_id: "",
    driver_id: "",
    notes: "",
  });

  useEffect(() => {
    const fetchData = async () => {
      const [missionRes, branchesRes, driversRes] = await Promise.all([
        supabase.from("missions").select("*").eq("id", id).single(),
        supabase.from("branches").select("id, name").eq("is_active", true).eq("country", "China"),
        supabase.from("drivers").select("id, full_name, code").eq("is_active", true),
      ]);

      if (missionRes.error || !missionRes.data) {
        toast.error("Mission not found");
        navigate("/missions");
        return;
      }

      setBranches(branchesRes.data || []);
      setDrivers(driversRes.data || []);

      const m = missionRes.data;
      setForm({
        mission_type: m.mission_type,
        status: m.status,
        branch_id: m.branch_id,
        destination_branch_id: m.destination_branch_id || "",
        driver_id: m.driver_id || "",
        notes: m.notes || "",
      });
      setIsLoading(false);
    };
    fetchData();
  }, [id, navigate]);

  const handleSubmit = async () => {
    if (!form.branch_id) {
      toast.error("Please select a warehouse");
      return;
    }

    setIsSaving(true);

    const { error } = await supabase
      .from("missions")
      .update({
        mission_type: form.mission_type as "pickup" | "delivery" | "transfer" | "supply",
        status: form.status as "requested" | "assigned" | "approved" | "received" | "done" | "closed",
        branch_id: form.branch_id,
        destination_branch_id: form.destination_branch_id || null,
        driver_id: form.driver_id || null,
        notes: form.notes || null,
      })
      .eq("id", id);

    if (error) {
      toast.error("Failed to update mission");
    } else {
      toast.success("Mission updated successfully");
      navigate("/missions");
    }
    setIsSaving(false);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <FormCard
      title="Edit Mission"
      
      backLink="/missions"
      onSubmit={handleSubmit}
      isLoading={isSaving}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="mission_type">Mission Type *</Label>
          <Select value={form.mission_type} onValueChange={(value) => setForm({ ...form, mission_type: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {missionTypes.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Status *</Label>
          <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {missionStatuses.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="branch_id">Origin Warehouse *</Label>
          <Select value={form.branch_id} onValueChange={(value) => setForm({ ...form, branch_id: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Select warehouse" />
            </SelectTrigger>
            <SelectContent>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="destination_branch_id">Destination Warehouse</Label>
          <Select
            value={form.destination_branch_id}
            onValueChange={(value) => setForm({ ...form, destination_branch_id: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select destination warehouse" />
            </SelectTrigger>
            <SelectContent>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="driver_id">Assign Driver</Label>
          <Select value={form.driver_id} onValueChange={(value) => setForm({ ...form, driver_id: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Select driver" />
            </SelectTrigger>
            <SelectContent>
              {drivers.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.code} - {d.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>
      </div>
    </FormCard>
  );
};

export default MissionEdit;

