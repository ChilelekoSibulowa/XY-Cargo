import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { FormCard } from "@/components/shared/FormCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { notifyWelcome } from "@/lib/notifications";

interface Branch {
  id: string;
  name: string;
}

const CustomerCreate = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [formData, setFormData] = useState({
    code: "",
    full_name: "",
    email: "",
    password: "",
    create_login: false,
    phone: "",
    address: "",
    city: "",
    country: "Zambia",
    customer_type: "personal",
    branch_id: "",
    wallet_balance: 0,
    is_active: true,
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

    const code = formData.code || `CUS-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
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
          role: "customer",
        },
      });

      if (authError) {
        let message = authError.message || "Failed to create customer login.";
        
        // Try to extract a more descriptive message from the response context if available
        const response = (authError as any).context;
        if (response instanceof Response) {
          try {
            const errorPayload = await response.json();
            if (errorPayload && (errorPayload.error || errorPayload.message)) {
              message = errorPayload.error || errorPayload.message;
            }
          } catch (e) {
            // Ignore parse errors, keep original message
          }
        }
        
        toast.error(message);
        setIsLoading(false);
        return;
      }

      userId = authData?.id || null;
    }

    const { error } = await supabase.from("customers").insert({
      code,
      user_id: userId,
      full_name: formData.full_name,
      email: formData.email || null,
      phone: formData.phone,
      address: formData.address || null,
      city: formData.city || null,
      country: formData.country || null,
      customer_type: formData.customer_type,
      branch_id: formData.branch_id || null,
      wallet_balance: formData.wallet_balance,
      is_active: formData.is_active,
    });

    if (error) {
      toast.error(error.message);
    } else {
      // Fetch the created customer record and send welcome notification
      const { data: newCust } = await supabase
        .from("customers")
        .select("id")
        .eq("code", code)
        .maybeSingle();
      if (newCust?.id) {
        notifyWelcome(newCust.id, formData.full_name);
      }
      toast.success("Customer created successfully");
      navigate("/customers");
    }
    setIsLoading(false);
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Create New Customer"
        
        backLink="/customers"
      />
      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
        <FormCard title="Customer Information">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Account Type *</Label>
              <Select
                value={formData.customer_type}
                onValueChange={(value) => setFormData({ ...formData, customer_type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select account type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">Personal Account</SelectItem>
                  <SelectItem value="company">Company Account</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Customer Code</Label>
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
            <div className="flex items-center space-x-2 md:col-span-2">
              <Switch
                id="create_login"
                checked={formData.create_login}
                onCheckedChange={(checked) => setFormData({ ...formData, create_login: checked })}
              />
              <Label htmlFor="create_login">Create login account for this customer</Label>
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
            <div className="space-y-2">
              <Label htmlFor="phone">Phone *</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch">Warehouse (China)</Label>
              <Select
                value={formData.branch_id}
                onValueChange={(value) => setFormData({ ...formData, branch_id: value })}
              >
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
            <div className="flex items-center space-x-2 md:col-span-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active">Active</Label>
            </div>
          </div>
        </FormCard>

        <div className="flex gap-4">
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Create Customer
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate("/customers")}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
};

export default CustomerCreate;

