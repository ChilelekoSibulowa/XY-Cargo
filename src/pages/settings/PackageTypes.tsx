import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DataTable, Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DeleteDialog } from "@/components/shared/DeleteDialog";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Plus } from "lucide-react";

interface PackageType {
  id: string;
  name: string;
  description: string | null;
  max_weight: number | null;
  max_length: number | null;
  max_width: number | null;
  max_height: number | null;
  is_active: boolean | null;
}

const PackageTypes = () => {
  const [packages, setPackages] = useState<PackageType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteItem, setDeleteItem] = useState<PackageType | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    max_weight: "",
    max_length: "",
    max_width: "",
    max_height: "",
    is_active: true,
  });

  const fetchPackages = async () => {
    const { data, error } = await supabase
      .from("package_types")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      toast.error("Failed to fetch package types");
    } else {
      setPackages(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchPackages();
  }, []);

  const handleDelete = async () => {
    if (!deleteItem) return;
    setIsDeleting(true);

    const { error } = await supabase.from("package_types").delete().eq("id", deleteItem.id);

    if (error) {
      toast.error("Failed to delete package type");
    } else {
      toast.success("Package type deleted");
      fetchPackages();
    }
    setIsDeleting(false);
    setDeleteItem(null);
  };

  const handleCreate = async () => {
    if (!form.name) {
      toast.error("Please enter a name");
      return;
    }

    const { error } = await supabase.from("package_types").insert({
      name: form.name,
      description: form.description || null,
      max_weight: form.max_weight ? parseFloat(form.max_weight) : null,
      max_length: form.max_length ? parseFloat(form.max_length) : null,
      max_width: form.max_width ? parseFloat(form.max_width) : null,
      max_height: form.max_height ? parseFloat(form.max_height) : null,
      is_active: form.is_active,
    });

    if (error) {
      toast.error("Failed to create package type");
    } else {
      toast.success("Package type created");
      setDialogOpen(false);
      setForm({
        name: "",
        description: "",
        max_weight: "",
        max_length: "",
        max_width: "",
        max_height: "",
        is_active: true,
      });
      fetchPackages();
    }
  };

  const columns: Column<PackageType>[] = [
    { key: "name", label: "Name" },
    { key: "description", label: "Description" },
    {
      key: "max_weight",
      label: "Max Weight",
      render: (item) => (item.max_weight ? `${item.max_weight} kg` : "-"),
    },
    {
      key: "max_length",
      label: "Dimensions (LxWxH)",
      render: (item) => {
        if (!item.max_length && !item.max_width && !item.max_height) return "-";
        return `${item.max_length || 0} x ${item.max_width || 0} x ${item.max_height || 0} cm`;
      },
    },
    {
      key: "is_active",
      label: "Status",
      render: (item) => <StatusBadge status={item.is_active ? "active" : "inactive"} />,
    },
  ];

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Package Types</h1>
          <p className="text-sm text-muted-foreground">Define package types and size limits.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Package Type
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Package Type</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., Small Box"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Package description..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_weight">Max Weight (kg)</Label>
                <Input
                  id="max_weight"
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.max_weight}
                  onChange={(e) => setForm({ ...form, max_weight: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="max_length">Length (cm)</Label>
                  <Input
                    id="max_length"
                    type="number"
                    min="0"
                    value={form.max_length}
                    onChange={(e) => setForm({ ...form, max_length: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max_width">Width (cm)</Label>
                  <Input
                    id="max_width"
                    type="number"
                    min="0"
                    value={form.max_width}
                    onChange={(e) => setForm({ ...form, max_width: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max_height">Height (cm)</Label>
                  <Input
                    id="max_height"
                    type="number"
                    min="0"
                    value={form.max_height}
                    onChange={(e) => setForm({ ...form, max_height: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  id="is_active"
                  checked={form.is_active}
                  onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
                />
                <Label htmlFor="is_active">Active</Label>
              </div>
              <Button onClick={handleCreate}>Create Package Type</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <DataTable
        columns={columns}
        data={packages}
        isLoading={isLoading}
        searchPlaceholder="Search package types..."
        onDelete={(item) => setDeleteItem(item)}
      />

      <DeleteDialog
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        title="Delete Package Type"
        description="Are you sure you want to delete this package type?"
      />
    </div>
  );
};

export default PackageTypes;
