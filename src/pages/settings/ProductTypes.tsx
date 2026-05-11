import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DataTable, Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DeleteDialog } from "@/components/shared/DeleteDialog";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2 } from "lucide-react";

interface ProductType {
  id: string;
  name: string;
  service_type: "air" | "sea";
  description: string | null;
  sort_order: number;
  is_active: boolean;
}

const emptyForm = {
  name: "",
  service_type: "air" as "air" | "sea",
  description: "",
  sort_order: "0",
  is_active: true,
};

const ProductTypes = () => {
  const [items, setItems] = useState<ProductType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<ProductType | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editing, setEditing] = useState<ProductType | null>(null);
  const [form, setForm] = useState(emptyForm);

  const fetchItems = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("product_types")
      .select("*")
      .order("service_type", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      toast.error(error.message || "Failed to fetch product types");
    } else {
      setItems((data || []) as ProductType[]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (item: ProductType) => {
    setEditing(item);
    setForm({
      name: item.name,
      service_type: item.service_type,
      description: item.description || "",
      sort_order: String(item.sort_order ?? 0),
      is_active: item.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Please enter a name");
      return;
    }

    setIsSaving(true);
    const payload = {
      name: form.name.trim(),
      service_type: form.service_type,
      description: form.description.trim() ? form.description.trim() : null,
      sort_order: Number(form.sort_order) || 0,
      is_active: form.is_active,
    };

    try {
      const { error } = editing
        ? await supabase.from("product_types").update(payload).eq("id", editing.id)
        : await supabase.from("product_types").insert(payload);

      if (error) {
        toast.error(error.message || "Failed to save product type");
        return;
      }

      toast.success(editing ? "Product type updated" : "Product type created");
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
      fetchItems();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    setIsDeleting(true);

    const { error } = await supabase.from("product_types").delete().eq("id", deleteItem.id);

    if (error) {
      toast.error(error.message || "Failed to delete product type");
    } else {
      toast.success("Product type deleted");
      fetchItems();
    }
    setIsDeleting(false);
    setDeleteItem(null);
  };

  const columns: Column<ProductType>[] = [
    { key: "name", label: "Name" },
    {
      key: "service_type",
      label: "Service",
      render: (item) => (item.service_type === "air" ? "Air" : "Sea"),
    },
    {
      key: "sort_order",
      label: "Sort",
      render: (item) => item.sort_order ?? 0,
    },
    {
      key: "is_active",
      label: "Status",
      render: (item) => <StatusBadge status={item.is_active ? "active" : "inactive"} />,
    },
    {
      key: "actions",
      label: "Actions",
      render: (item) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 p-0" onClick={() => openEdit(item)}>
            <Pencil className="h-4 w-4 text-blue-600" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 p-0"
            onClick={() => setDeleteItem(item)}
          >
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
          <h1 className="page-title">Product Types</h1>
          <p className="text-sm text-muted-foreground">Manage product types by service.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Product Type
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={items}
        isLoading={isLoading}
        searchPlaceholder="Search product types..."
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Product Type" : "Create Product Type"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Mobile Phones"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="service_type">Service Type *</Label>
              <Select
                value={form.service_type}
                onValueChange={(value: "air" | "sea") => setForm({ ...form, service_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="air">Air Freight</SelectItem>
                  <SelectItem value="sea">Sea Freight</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Optional description..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sort_order">Sort Order</Label>
              <Input
                id="sort_order"
                type="number"
                min="0"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
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
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : editing ? "Update Product Type" : "Create Product Type"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <DeleteDialog
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        title="Delete Product Type"
        description="Are you sure you want to delete this product type?"
      />
    </div>
  );
};

export default ProductTypes;
