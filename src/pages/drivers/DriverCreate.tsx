import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { FormCard } from "@/components/shared/FormCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Branch {
  id: string;
  name: string;
}

const DriverCreate = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [formData, setFormData] = useState({
    code: "",
    full_name: "",
    email: "",
    phone: "",
    license_number: "",
    vehicle_type: "",
    vehicle_plate: "",
    branch_id: "",
    wallet_balance: 0,
    is_active: true,
    create_login: false,
    password: "",
  });

  useEffect(() => {
    const fetchBranches = async () => {
      const { data } = await supabase
        .from("branches")
        .select("id, name")
        .eq("is_active", true)
        .eq("country", "China");
      setBranches(data || []);
    };
    fetchBranches();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const code = formData.code || `DRV-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    let userId: string | null = null;

    if (formData.create_login) {
      if (!formData.email) {
        toast.error("Email is required to create a login.");
        setIsLoading(false);
        return;
      }
      if (!formData.password || formData.password.length < 6) {
        toast.error("Password must be at least 6 characters.");
        setIsLoading(false);
        return;
      }

      const { data: authData, error: authError } = await supabase.functions.invoke("admin-create-user", {
        body: {
          email: formData.email,
          password: formData.password,
          full_name: formData.full_name,
          role: "driver",
        },
      });

      if (authError) {
        toast.error(authError.message || "Failed to create driver login.");
        setIsLoading(false);
        return;
      }

      userId = authData?.id || null;
    }

    const { error } = await supabase.from("drivers").insert({
      code,
      full_name: formData.full_name,
      email: formData.email || null,
      phone: formData.phone,
      license_number: formData.license_number || null,
      vehicle_type: formData.vehicle_type || null,
      vehicle_plate: formData.vehicle_plate || null,
      branch_id: formData.branch_id || null,
      wallet_balance: formData.wallet_balance,
      is_active: formData.is_active,
      user_id: userId,
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Driver created successfully");
      navigate("/drivers");
    }
    setIsLoading(false);
  };

  return (
    <div className="animate-fade-in">
      <PageHeader title="Create New Driver"  backLink="/drivers" />
      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
        <FormCard title="Driver Information">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="code">Driver Code</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="Auto-generated if empty"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name *</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone *</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="license_number">License Number</Label>
              <Input
                id="license_number"
                value={formData.license_number}
                onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vehicle_type">Vehicle Type</Label>
              <Input
                id="vehicle_type"
                value={formData.vehicle_type}
                onChange={(e) => setFormData({ ...formData, vehicle_type: e.target.value })}
                placeholder="e.g., Truck, Van, Motorcycle"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vehicle_plate">Vehicle Plate</Label>
              <Input
                id="vehicle_plate"
                value={formData.vehicle_plate}
                onChange={(e) => setFormData({ ...formData, vehicle_plate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch">Warehouse</Label>
              <Select
                value={formData.branch_id}
                onValueChange={(value) => setFormData({ ...formData, branch_id: value })}
              >
                <SelectTrigger>
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="wallet_balance">Initial Wallet Balance</Label>
              <Input
                id="wallet_balance"
                type="number"
                min="0"
                step="0.01"
                value={formData.wallet_balance}
                onChange={(e) => setFormData({ ...formData, wallet_balance: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active">Active</Label>
            </div>
            <div className="flex items-center space-x-2 md:col-span-2">
              <Switch
                id="create_login"
                checked={formData.create_login}
                onCheckedChange={(checked) => setFormData({ ...formData, create_login: checked })}
              />
              <Label htmlFor="create_login">Create login account for this driver</Label>
            </div>
            {formData.create_login && (
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="password">Login Password *</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Minimum 6 characters"
                  required={formData.create_login}
                />
              </div>
            )}
          </div>
        </FormCard>

        <div className="flex gap-4">
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Create Driver
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate("/drivers")}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
};

export default DriverCreate;

