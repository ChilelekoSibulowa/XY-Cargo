import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { FormCard } from "@/components/shared/FormCard";
import { DataTable, Column } from "@/components/shared/DataTable";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface PackageRow {
  id: string;
  name: string;
  description: string | null;
  max_weight: number | null;
  max_length: number | null;
  max_width: number | null;
  max_height: number | null;
}

const Packages = () => {
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    max_weight: "",
    max_length: "",
    max_width: "",
    max_height: "",
  });

  const fetchPackages = async () => {
    const { data, error } = await supabase
      .from("package_types")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      toast.error("Failed to load packages.");
      setPackages([]);
    } else {
      setPackages(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchPackages();
  }, []);

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast.error("Name is required.");
      return;
    }
    setIsSaving(true);
    const { error } = await supabase.from("package_types").insert({
      name: formData.name.trim(),
      description: formData.description || null,
      max_weight: formData.max_weight ? Number(formData.max_weight) : null,
      max_length: formData.max_length ? Number(formData.max_length) : null,
      max_width: formData.max_width ? Number(formData.max_width) : null,
      max_height: formData.max_height ? Number(formData.max_height) : null,
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Package type saved.");
      setFormData({ name: "", description: "", max_weight: "", max_length: "", max_width: "", max_height: "" });
      fetchPackages();
    }
    setIsSaving(false);
  };

  const columns: Column<PackageRow>[] = [
    { key: "name", label: "Name" },
    { key: "description", label: "Description" },
    {
      key: "max_weight",
      label: "Max weight",
      render: (item) => (item.max_weight ? `${item.max_weight} kg` : "-"),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Packages"  />
      <FormCard title="Add Package Type">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium">Name *</label>
            <Input value={formData.name} onChange={(event) => setFormData({ ...formData, name: event.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium">Max weight (kg)</label>
            <Input type="number" value={formData.max_weight} onChange={(event) => setFormData({ ...formData, max_weight: event.target.value })} />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm font-medium">Description</label>
            <Input value={formData.description} onChange={(event) => setFormData({ ...formData, description: event.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium">Max length</label>
            <Input type="number" value={formData.max_length} onChange={(event) => setFormData({ ...formData, max_length: event.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium">Max width</label>
            <Input type="number" value={formData.max_width} onChange={(event) => setFormData({ ...formData, max_width: event.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium">Max height</label>
            <Input type="number" value={formData.max_height} onChange={(event) => setFormData({ ...formData, max_height: event.target.value })} />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={handleCreate} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Package"}
          </Button>
        </div>
      </FormCard>
      <DataTable columns={columns} data={packages} isLoading={isLoading} searchPlaceholder="Search packages..." />
    </div>
  );
};

export default Packages;

