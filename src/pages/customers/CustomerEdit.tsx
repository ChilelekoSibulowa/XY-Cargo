import { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
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

interface Branch {
  id: string;
  name: string;
}

const CustomerEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const source = searchParams.get("from");
  const returnPath = source === "agent" ? "/agent/customers" : "/customers";
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [formData, setFormData] = useState({
    code: "",
    full_name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    country: "",
    branch_id: "",
    wallet_balance: 0,
    is_active: true,
  });

  useEffect(() => {
    const fetchData = async () => {
      const [customerRes, branchesRes] = await Promise.all([
        supabase.from("customers").select("*").eq("id", id).single(),
        supabase.from("branches").select("id, name").eq("is_active", true).eq("country", "China"),
      ]);

      if (customerRes.error) {
        toast.error("Customer not found");
        navigate(returnPath);
      } else if (customerRes.data) {
        setFormData({
          code: customerRes.data.code,
          full_name: customerRes.data.full_name,
          email: customerRes.data.email || "",
          phone: customerRes.data.phone,
          address: customerRes.data.address || "",
          city: customerRes.data.city || "",
          country: customerRes.data.country || "",
          branch_id: customerRes.data.branch_id || "",
          wallet_balance: customerRes.data.wallet_balance || 0,
          is_active: customerRes.data.is_active ?? true,
        });
      }
      setBranches(branchesRes.data || []);
      setIsFetching(false);
    };

    fetchData();
  }, [id, navigate, returnPath]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await supabase
      .from("customers")
      .update({
        ...formData,
        branch_id: formData.branch_id || null,
      })
      .eq("id", id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Customer updated successfully");
      navigate(returnPath);
    }
    setIsLoading(false);
  };

  if (isFetching) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Edit Customer"
        backLink={returnPath}
      />
      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
        <FormCard title="Customer Information">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="code">Customer Code</Label>
              <Input id="code" value={formData.code} disabled />
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
              <Label htmlFor="wallet_balance">Wallet Balance</Label>
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
            Update Customer
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate(returnPath)}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
};

export default CustomerEdit;


