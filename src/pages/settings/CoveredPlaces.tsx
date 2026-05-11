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
import { Switch } from "@/components/ui/switch";
import { Plus } from "lucide-react";

interface CoveredArea {
  id: string;
  name: string;
  city: string;
  country: string;
  zone: string | null;
  is_active: boolean | null;
}

const CoveredPlaces = () => {
  const [areas, setAreas] = useState<CoveredArea[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteItem, setDeleteItem] = useState<CoveredArea | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    city: "",
    country: "",
    zone: "",
    is_active: true,
  });

  const fetchAreas = async () => {
    const { data, error } = await supabase
      .from("covered_areas")
      .select("*")
      .order("country", { ascending: true });

    if (error) {
      toast.error("Failed to fetch areas");
    } else {
      setAreas(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchAreas();
  }, []);

  const handleDelete = async () => {
    if (!deleteItem) return;
    setIsDeleting(true);

    const { error } = await supabase.from("covered_areas").delete().eq("id", deleteItem.id);

    if (error) {
      toast.error("Failed to delete area");
    } else {
      toast.success("Area deleted");
      fetchAreas();
    }
    setIsDeleting(false);
    setDeleteItem(null);
  };

  const handleCreate = async () => {
    if (!form.name || !form.city || !form.country) {
      toast.error("Please fill required fields");
      return;
    }

    const { error } = await supabase.from("covered_areas").insert({
      name: form.name,
      city: form.city,
      country: form.country,
      zone: form.zone || null,
      is_active: form.is_active,
    });

    if (error) {
      toast.error("Failed to create area");
    } else {
      toast.success("Area created");
      setDialogOpen(false);
      setForm({ name: "", city: "", country: "", zone: "", is_active: true });
      fetchAreas();
    }
  };

  const columns: Column<CoveredArea>[] = [
    { key: "name", label: "Name" },
    { key: "city", label: "City" },
    { key: "country", label: "Country" },
    { key: "zone", label: "Zone" },
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
          <h1 className="page-title">Covered Places</h1>
          <p className="text-sm text-muted-foreground">Manage areas for shipping coverage.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Area
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Covered Area</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Country *</Label>
                  <Input
                    id="country"
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="zone">Zone</Label>
                <Input
                  id="zone"
                  value={form.zone}
                  onChange={(e) => setForm({ ...form, zone: e.target.value })}
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
              <Button onClick={handleCreate}>Create Area</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <DataTable
        columns={columns}
        data={areas}
        isLoading={isLoading}
        searchPlaceholder="Search areas..."
        onDelete={(item) => setDeleteItem(item)}
      />

      <DeleteDialog
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        title="Delete Area"
        description="Are you sure you want to delete this covered area?"
      />
    </div>
  );
};

export default CoveredPlaces;
