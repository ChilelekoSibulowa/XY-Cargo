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
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2 } from "lucide-react";

interface PickupDestination {
  id: string;
  name: string;
  requires_details: boolean;
  sort_order: number;
  is_active: boolean;
}

const emptyForm = {
  name: "",
  requires_details: false,
  sort_order: "0",
  is_active: true,
};

const PickupDestinations = () => {
  const [items, setItems] = useState<PickupDestination[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<PickupDestination | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editing, setEditing] = useState<PickupDestination | null>(null);
  const [form, setForm] = useState(emptyForm);

  const fetchItems = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("pickup_destinations")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      toast.error(error.message || "Failed to fetch pickup destinations");
    } else {
      setItems((data || []) as PickupDestination[]);
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

  const openEdit = (item: PickupDestination) => {
    setEditing(item);
    setForm({
      name: item.name,
      requires_details: item.requires_details,
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
      requires_details: form.requires_details,
      sort_order: Number(form.sort_order) || 0,
      is_active: form.is_active,
    };

    try {
      const { error } = editing
        ? await supabase.from("pickup_destinations").update(payload).eq("id", editing.id)
        : await supabase.from("pickup_destinations").insert(payload);

      if (error) {
        toast.error(error.message || "Failed to save pickup destination");
        return;
      }

      toast.success(editing ? "Pickup destination updated" : "Pickup destination created");
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

    const { error } = await supabase.from("pickup_destinations").delete().eq("id", deleteItem.id);

    if (error) {
      toast.error(error.message || "Failed to delete pickup destination");
    } else {
      toast.success("Pickup destination deleted");
      fetchItems();
    }
    setIsDeleting(false);
    setDeleteItem(null);
  };

  const columns: Column<PickupDestination>[] = [
    { key: "name", label: "Name" },
    {
      key: "requires_details",
      label: "Requires Details",
      render: (item) => (item.requires_details ? "Yes" : "No"),
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
          <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDeleteItem(item)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Pickup Destinations</h1>
          <p className="text-sm text-muted-foreground">Manage Zambia pickup destinations used in order forms.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Destination
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={items}
        isLoading={isLoading}
        searchPlaceholder="Search pickup destinations..."
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Pickup Destination" : "Create Pickup Destination"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Lusaka Warehouse"
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
                id="requires_details"
                checked={form.requires_details}
                onCheckedChange={(checked) => setForm({ ...form, requires_details: checked })}
              />
              <Label htmlFor="requires_details">Requires extra details</Label>
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
              {isSaving ? "Saving..." : editing ? "Update Destination" : "Create Destination"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <DeleteDialog
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        title="Delete Pickup Destination"
        description="Are you sure you want to delete this pickup destination?"
      />
    </div>
  );
};

export default PickupDestinations;
