import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FormCard } from "@/components/shared/FormCard";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

const MissionCreate = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [form, setForm] = useState({
    mission_type: "pickup",
    branch_id: "",
    destination_branch_id: "",
    driver_id: "",
    notes: "",
  });

  useEffect(() => {
    const fetchData = async () => {
      const [branchesRes, driversRes] = await Promise.all([
        supabase.from("branches").select("id, name").eq("is_active", true).eq("country", "China"),
        supabase.from("drivers").select("id, full_name, code").eq("is_active", true),
      ]);
      setBranches(branchesRes.data || []);
      setDrivers(driversRes.data || []);
    };
    fetchData();
  }, []);

  const handleSubmit = async () => {
    if (!form.branch_id || !form.mission_type) {
      toast.error("Please fill in required fields");
      return;
    }

    setIsLoading(true);

    const { data: codeData } = await supabase.rpc("generate_code", { prefix: "MSN" });

    const { error } = await supabase.from("missions").insert({
      code: codeData || `MSN-${Date.now()}`,
      mission_type: form.mission_type as "pickup" | "delivery" | "transfer" | "supply",
      branch_id: form.branch_id,
      destination_branch_id: form.destination_branch_id || null,
      driver_id: form.driver_id || null,
      notes: form.notes || null,
      status: "requested",
    });

    if (error) {
      toast.error("Failed to create mission");
    } else {
      toast.success("Mission created successfully");
      navigate("/missions");
    }
    setIsLoading(false);
  };

  return (
    <FormCard
      title="Create New Mission"
      
      backLink="/missions"
      onSubmit={handleSubmit}
      isLoading={isLoading}
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
            placeholder="Additional instructions..."
          />
        </div>
      </div>
    </FormCard>
  );
};

export default MissionCreate;

