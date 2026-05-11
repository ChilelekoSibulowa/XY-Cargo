import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DeleteDialog } from "@/components/shared/DeleteDialog";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useDefaultCurrency } from "@/hooks/useDefaultCurrency";

interface ShippingRate {
  id: string;
  name: string;
  service_type: string;
  rate_per_kg: number | null;
  rate_per_cbm: number | null;
  minimum_charge: number | null;
  is_active: boolean | null;
}

const ShippingRates = () => {
  const { symbol } = useDefaultCurrency();
  const [rates, setRates] = useState<ShippingRate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteItem, setDeleteItem] = useState<ShippingRate | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ShippingRate | null>(null);

  const emptyForm = { name: "", service_type: "air", rate_per_kg: "", rate_per_cbm: "", minimum_charge: "50", is_active: true };
  const [form, setForm] = useState(emptyForm);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (item: ShippingRate) => {
    setEditing(item);
    setForm({
      name: item.name,
      service_type: item.service_type,
      rate_per_kg: item.rate_per_kg != null ? String(item.rate_per_kg) : "",
      rate_per_cbm: item.rate_per_cbm != null ? String(item.rate_per_cbm) : "",
      minimum_charge: item.minimum_charge != null ? String(item.minimum_charge) : "50",
      is_active: item.is_active ?? true,
    });
    setDialogOpen(true);
  };

  const fetchRates = async () => {
    const { data, error } = await supabase
      .from("shipping_rates")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      toast.error("Failed to fetch shipping rates");
    } else {
      setRates(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchRates();
  }, []);

  const handleDelete = async () => {
    if (!deleteItem) return;
    setIsDeleting(true);

    const { error } = await supabase.from("shipping_rates").delete().eq("id", deleteItem.id);

    if (error) {
      toast.error("Failed to delete rate");
    } else {
      toast.success("Rate deleted successfully");
      fetchRates();
    }
    setIsDeleting(false);
    setDeleteItem(null);
  };

  const handleSave = async () => {
    if (!form.name || !form.service_type) {
      toast.error("Please fill in required fields");
      return;
    }

    const payload = {
      name: form.name,
      service_type: form.service_type as "air" | "sea",
      rate_per_kg: form.rate_per_kg ? parseFloat(form.rate_per_kg) : null,
      rate_per_cbm: form.rate_per_cbm ? parseFloat(form.rate_per_cbm) : null,
      minimum_charge: form.minimum_charge ? parseFloat(form.minimum_charge) : 50,
      is_active: form.is_active,
    };

    const { error } = editing
      ? await supabase.from("shipping_rates").update(payload).eq("id", editing.id)
      : await supabase.from("shipping_rates").insert(payload);

    if (error) {
      toast.error(editing ? "Failed to update rate" : "Failed to create rate");
    } else {
      toast.success(editing ? "Rate updated successfully" : "Rate created successfully");
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
      fetchRates();
    }
  };

  const columns: Column<ShippingRate>[] = [
    { key: "name", label: "Name" },
    {
      key: "service_type",
      label: "Service",
      render: (item) => <StatusBadge status={item.service_type} />,
    },
    {
      key: "rate_per_kg",
      label: "Rate/KG",
      render: (item) => (item.rate_per_kg ? `${symbol} ${item.rate_per_kg}` : "-"),
    },
    {
      key: "rate_per_cbm",
      label: "Rate/CBM",
      render: (item) => (item.rate_per_cbm ? `${symbol} ${item.rate_per_cbm}` : "-"),
    },
    {
      key: "minimum_charge",
      label: "Min Charge",
      render: (item) => (item.minimum_charge ? `${symbol} ${item.minimum_charge}` : "-"),
    },
    {
      key: "is_active",
      label: "Status",
      render: (item) => <StatusBadge status={item.is_active ? "active" : "inactive"} />,
    },
    {
      key: "actions",
      label: "",
      render: (item) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 p-0" onClick={() => openEdit(item)} title="Edit">
            <Pencil className="h-4 w-4 text-blue-600" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 p-0" onClick={() => setDeleteItem(item)} title="Delete">
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Shipping Rates</h1>
          <p className="text-sm text-muted-foreground">
            Define shipping rates by service type, weight, and volume.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Rate
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={rates}
        isLoading={isLoading}
        searchPlaceholder="Search rates..."
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Shipping Rate" : "Create Shipping Rate"}</DialogTitle>
          </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., China to Zambia - Air"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="service_type">Service Type *</Label>
                <Select
                  value={form.service_type}
                  onValueChange={(value) => setForm({ ...form, service_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="air">Air</SelectItem>
                    <SelectItem value="sea">Sea</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rate_per_kg">Rate per KG</Label>
                  <Input
                    id="rate_per_kg"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.rate_per_kg}
                    onChange={(e) => setForm({ ...form, rate_per_kg: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rate_per_cbm">Rate per CBM</Label>
                  <Input
                    id="rate_per_cbm"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.rate_per_cbm}
                    onChange={(e) => setForm({ ...form, rate_per_cbm: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="minimum_charge">Minimum Charge</Label>
                <Input
                  id="minimum_charge"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.minimum_charge}
                  onChange={(e) => setForm({ ...form, minimum_charge: e.target.value })}
                  placeholder="50.00"
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
              <Button onClick={handleSave}>{editing ? "Update Rate" : "Create Rate"}</Button>
            </div>
          </DialogContent>
        </Dialog>

      <DeleteDialog
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        title="Delete Shipping Rate"
        description="Are you sure you want to delete this shipping rate?"
      />
    </div>
  );
};

export default ShippingRates;
