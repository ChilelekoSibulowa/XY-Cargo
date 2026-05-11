import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
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

interface DeliveryTimeEntry {
  id: string;
  name: string;
  min_days: number;
  max_days: number;
  service_type: string | null;
  is_active: boolean | null;
}

const DeliveryTime = () => {
  const [times, setTimes] = useState<DeliveryTimeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteItem, setDeleteItem] = useState<DeliveryTimeEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DeliveryTimeEntry | null>(null);

  const emptyForm = { name: "", min_days: "", max_days: "", service_type: "air", is_active: true };
  const [form, setForm] = useState(emptyForm);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (item: DeliveryTimeEntry) => {
    setEditing(item);
    setForm({
      name: item.name,
      min_days: String(item.min_days),
      max_days: String(item.max_days),
      service_type: item.service_type || "air",
      is_active: item.is_active ?? true,
    });
    setDialogOpen(true);
  };

  const fetchTimes = async () => {
    const { data, error } = await supabase
      .from("delivery_times")
      .select("*")
      .order("min_days", { ascending: true });

    if (error) {
      toast.error("Failed to fetch delivery times");
    } else {
      setTimes(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchTimes();
  }, []);

  const handleDelete = async () => {
    if (!deleteItem) return;
    setIsDeleting(true);

    const { error } = await supabase.from("delivery_times").delete().eq("id", deleteItem.id);

    if (error) {
      toast.error("Failed to delete");
    } else {
      toast.success("Deleted successfully");
      fetchTimes();
    }
    setIsDeleting(false);
    setDeleteItem(null);
  };

  const handleSave = async () => {
    if (!form.name || !form.min_days || !form.max_days) {
      toast.error("Please fill required fields");
      return;
    }

    const payload = {
      name: form.name,
      min_days: parseInt(form.min_days),
      max_days: parseInt(form.max_days),
      service_type: form.service_type as "air" | "sea",
      is_active: form.is_active,
    };

    const { error } = editing
      ? await supabase.from("delivery_times").update(payload).eq("id", editing.id)
      : await supabase.from("delivery_times").insert(payload);

    if (error) {
      toast.error(editing ? "Failed to update" : "Failed to create");
    } else {
      toast.success(editing ? "Updated successfully" : "Created successfully");
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
      fetchTimes();
    }
  };

  const columns: Column<DeliveryTimeEntry>[] = [
    { key: "name", label: "Name" },
    {
      key: "min_days",
      label: "Delivery Time",
      render: (item) => `${item.min_days} - ${item.max_days} days`,
    },
    {
      key: "service_type",
      label: "Service",
      render: (item) => (item.service_type ? <StatusBadge status={item.service_type} /> : "-"),
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
          <Button variant="ghost" size="icon" onClick={() => openEdit(item)} title="Edit">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setDeleteItem(item)} title="Delete">
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
          <h1 className="page-title">Delivery Time</h1>
          <p className="text-sm text-muted-foreground">Configure estimated delivery times.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Delivery Time
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={times}
        isLoading={isLoading}
        searchPlaceholder="Search..."
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Delivery Time" : "Create Delivery Time"}</DialogTitle>
          </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., Express Air"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="min_days">Min Days *</Label>
                  <Input
                    id="min_days"
                    type="number"
                    min="1"
                    value={form.min_days}
                    onChange={(e) => setForm({ ...form, min_days: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max_days">Max Days *</Label>
                  <Input
                    id="max_days"
                    type="number"
                    min="1"
                    value={form.max_days}
                    onChange={(e) => setForm({ ...form, max_days: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="service_type">Service Type</Label>
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
              <div className="flex items-center gap-3">
                <Switch
                  id="is_active"
                  checked={form.is_active}
                  onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
                />
                <Label htmlFor="is_active">Active</Label>
              </div>
              <Button onClick={handleSave}>{editing ? "Update" : "Create"}</Button>
            </div>
          </DialogContent>
        </Dialog>

      <DeleteDialog
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        title="Delete Delivery Time"
        description="Are you sure you want to delete this delivery time?"
      />
    </div>
  );
};

export default DeliveryTime;
