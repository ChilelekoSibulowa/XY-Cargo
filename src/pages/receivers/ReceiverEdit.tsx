import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FormCard } from "@/components/shared/FormCard";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

interface Customer {
  id: string;
  code: string;
  full_name: string;
}

const ReceiverEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
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
    const fetchData = async () => {
      const [receiverRes, customersRes] = await Promise.all([
        supabase.from("receivers").select("*").eq("id", id).single(),
        supabase.from("customers").select("id, code, full_name").eq("is_active", true),
      ]);

      if (receiverRes.error || !receiverRes.data) {
        toast.error("Receiver not found");
        navigate("/receivers");
        return;
      }

      setCustomers(customersRes.data || []);
      const r = receiverRes.data;
      setForm({
        full_name: r.full_name,
        phone: r.phone,
        email: r.email || "",
        address: r.address || "",
        city: r.city || "",
        country: r.country || "",
        customer_id: r.customer_id || "",
        is_active: r.is_active ?? true,
      });
      setIsLoading(false);
    };
    fetchData();
  }, [id, navigate]);

  const handleSubmit = async () => {
    if (!form.full_name || !form.phone) {
      toast.error("Please fill in required fields");
      return;
    }

    setIsSaving(true);

    const { error } = await supabase
      .from("receivers")
      .update({
        full_name: form.full_name,
        phone: form.phone,
        email: form.email || null,
        address: form.address || null,
        city: form.city || null,
        country: form.country || null,
        customer_id: form.customer_id || null,
        is_active: form.is_active,
      })
      .eq("id", id);

    if (error) {
      toast.error("Failed to update receiver");
    } else {
      toast.success("Receiver updated successfully");
      navigate("/receivers");
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
      title="Edit Receiver"
      
      backLink="/receivers"
      onSubmit={handleSubmit}
      isLoading={isSaving}
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

export default ReceiverEdit;

