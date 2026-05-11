import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FormCard } from "@/components/shared/FormCard";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Customer {
  id: string;
  code: string;
  full_name: string;
}

const ReceiverCreate = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    country: "",
    customer_id: "",
    is_active: true,
  });

  useEffect(() => {
    const fetchCustomers = async () => {
      const { data } = await supabase.from("customers").select("id, code, full_name").eq("is_active", true);
      setCustomers(data || []);
    };
    fetchCustomers();
  }, []);

  const handleSubmit = async () => {
    if (!form.full_name || !form.phone) {
      toast.error("Please fill in required fields");
      return;
    }

    setIsLoading(true);

    const { data: codeData } = await supabase.rpc("generate_code", { prefix: "RCV" });

    const { error } = await supabase.from("receivers").insert({
      code: codeData || `RCV-${Date.now()}`,
      full_name: form.full_name,
      phone: form.phone,
      email: form.email || null,
      address: form.address || null,
      city: form.city || null,
      country: form.country || null,
      customer_id: form.customer_id || null,
      is_active: form.is_active,
    });

    if (error) {
      toast.error("Failed to create receiver");
    } else {
      toast.success("Receiver created successfully");
      navigate("/receivers");
    }
    setIsLoading(false);
  };

  return (
    <FormCard
      title="Create New Receiver"
      
      backLink="/receivers"
      onSubmit={handleSubmit}
      isLoading={isLoading}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="full_name">Full Name *</Label>
          <Input
            id="full_name"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone *</Label>
          <Input
            id="phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="customer_id">Customer</Label>
          <Select value={form.customer_id} onValueChange={(value) => setForm({ ...form, customer_id: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Select customer" />
            </SelectTrigger>
            <SelectContent>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.code} - {c.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="address">Address</Label>
          <Input
            id="address"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="country">Country</Label>
          <Input
            id="country"
            value={form.country}
            onChange={(e) => setForm({ ...form, country: e.target.value })}
          />
        </div>
        <div className="flex items-center gap-3">
          <Switch
            id="is_active"
            checked={form.is_active}
            onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
          />
          <Label htmlFor="is_active">Active</Label>
        </div>
      </div>
    </FormCard>
  );
};

export default ReceiverCreate;

