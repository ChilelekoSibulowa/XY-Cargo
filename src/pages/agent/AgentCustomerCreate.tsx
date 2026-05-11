import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { FormCard } from "@/components/shared/FormCard";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { notifyWelcome } from "@/lib/notifications";

interface BranchOption {
  id: string;
  name: string;
}

const AgentCustomerCreate = () => {
  const navigate = useNavigate();
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    country: "",
    branch_id: "",
  });

  useEffect(() => {
    const fetchBranches = async () => {
      const { data } = await supabase
        .from("branches")
        .select("id, name")
        .eq("is_active", true)
        .eq("country", "China");
      setBranches((data || []) as BranchOption[]);
    };
    fetchBranches();
  }, []);

  const handleSubmit = async () => {
    if (!form.full_name || !form.phone) {
      toast.error("Full name and phone are required.");
      return;
    }

    setIsLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      toast.error("Please sign in again.");
      setIsLoading(false);
      return;
    }

    const { data: codeData } = await supabase.rpc("generate_code", { prefix: "CUST" });

    const { data: insertedCustomer, error } = await supabase.from("customers").insert({
      code: codeData || `CUST-${Date.now()}`,
      full_name: form.full_name,
      email: form.email || null,
      phone: form.phone,
      address: form.address || null,
      city: form.city || null,
      country: form.country || null,
      branch_id: form.branch_id || null,
      agent_id: userId,
    }).select("id").single();

    if (error) {
      toast.error(error.message);
    } else {
      if (insertedCustomer?.id) {
        notifyWelcome(insertedCustomer.id, form.full_name);
      }
      toast.success("Customer registered.");
      navigate("/agent/customers");
    }
    setIsLoading(false);
  };

  return (
    <FormCard
      title="Register Customer"
      
      backLink="/agent/customers"
      onSubmit={handleSubmit}
      isLoading={isLoading}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="full_name">Full Name *</Label>
          <Input
            id="full_name"
            value={form.full_name}
            onChange={(event) => setForm({ ...form, full_name: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone *</Label>
          <Input
            id="phone"
            value={form.phone}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="address">Address</Label>
          <Input
            id="address"
            value={form.address}
            onChange={(event) => setForm({ ...form, address: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            value={form.city}
            onChange={(event) => setForm({ ...form, city: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="country">Country</Label>
          <Input
            id="country"
            value={form.country}
            onChange={(event) => setForm({ ...form, country: event.target.value })}
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="branch_id">Preferred Warehouse (China)</Label>
          <Select value={form.branch_id} onValueChange={(value) => setForm({ ...form, branch_id: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Select origin warehouse" />
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
      </div>
    </FormCard>
  );
};

export default AgentCustomerCreate;

