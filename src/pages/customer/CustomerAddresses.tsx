import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { CustomerProfileGate } from "@/components/customer/CustomerProfileGate";
import { useCustomerRecord } from "@/hooks/useCustomerRecord";
import { toast } from "sonner";

type Receiver = {
  id: string;
  full_name: string;
  phone: string;
  address: string;
  city: string | null;
  country: string | null;
};

const CustomerAddresses = () => {
  const { customer } = useCustomerRecord();
  const [receivers, setReceivers] = useState<Receiver[]>([]);
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    address: "",
    city: "",
    country: "",
  });

  const fetchReceivers = async () => {
    if (!customer) return;
    const { data } = await supabase
      .from("receivers")
      .select("id, full_name, phone, address, city, country")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false });
    setReceivers(data || []);
  };

  useEffect(() => {
    fetchReceivers();
  }, [customer]);

  const handleAdd = async () => {
    if (!customer) return;
    if (!form.full_name || !form.phone || !form.address) {
      toast.error("Name, phone, and address are required.");
      return;
    }
    const { error } = await supabase.from("receivers").insert({
      code: `RCV-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
      full_name: form.full_name,
      phone: form.phone,
      address: form.address,
      city: form.city || null,
      country: form.country || null,
      customer_id: customer.id,
    });
    if (error) {
      toast.error("Failed to add receiver.");
      return;
    }
    setForm({ full_name: "", phone: "", address: "", city: "", country: "" });
    fetchReceivers();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("receivers").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete receiver.");
      return;
    }
    fetchReceivers();
  };

  return (
    <CustomerProfileGate>
      <div className="space-y-6">
        <PageHeader title="My Addresses"  />

        <Card className="border-border/70">
          <CardContent className="space-y-4 p-6">
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                placeholder="Full name"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
              <Input
                placeholder="Phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
              <Input
                placeholder="Address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
              <Input
                placeholder="City"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
              <Input
                placeholder="Country"
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
              />
            </div>
            <Button onClick={handleAdd}>Add Address</Button>
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardContent className="space-y-3 p-6 text-sm text-muted-foreground">
            {receivers.length === 0 && <p>No saved addresses yet.</p>}
            {receivers.map((receiver) => (
              <div key={receiver.id} className="flex items-center justify-between border-b pb-2">
                <div>
                  <p className="font-semibold text-foreground">{receiver.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {receiver.address}, {receiver.city || "-"}, {receiver.country || "-"} - {receiver.phone}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => handleDelete(receiver.id)}>
                  Remove
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </CustomerProfileGate>
  );
};

export default CustomerAddresses;


