import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DeleteDialog } from "@/components/shared/DeleteDialog";
import { toast } from "sonner";

interface Branch {
  id: string;
  code: string;
  name: string;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean | null;
  created_at: string;
}

const BranchList = () => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteItem, setDeleteItem] = useState<Branch | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchBranches = async () => {
    const { data, error } = await supabase
      .from("branches")
      .select("*")
      .eq("country", "China")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to fetch warehouses");
    } else {
      setBranches(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  const handleDelete = async () => {
    if (!deleteItem) return;
    setIsDeleting(true);

    const { error } = await supabase
      .from("branches")
      .update({ is_active: false })
      .eq("id", deleteItem.id);

    if (error) {
      toast.error("Failed to deactivate warehouse");
    } else {
      toast.success("Warehouse deactivated successfully");
      fetchBranches();
    }
    setIsDeleting(false);
    setDeleteItem(null);
  };

  const columns: Column<Branch>[] = [
    { key: "code", label: "Code" },
    { key: "name", label: "Name" },
    { key: "city", label: "City" },
    { key: "country", label: "Country" },
    { key: "phone", label: "Phone" },
    { key: "email", label: "Email" },
    {
      key: "is_active",
      label: "Status",
      render: (item) => (
        <StatusBadge status={item.is_active ? "active" : "inactive"} />
      ),
    },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Warehouses"
        
        createLink="/warehouses/create"
        createLabel="Create Warehouse"
      />
      <DataTable
        columns={columns}
        data={branches}
        isLoading={isLoading}
        searchPlaceholder="Search warehouses..."
        editLink={(item) => `/warehouses/${item.id}/edit`}
        onDelete={(item) => setDeleteItem(item)}
      />
      <DeleteDialog
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        title="Deactivate Warehouse"
        description="This will hide the warehouse from selection lists. You can re-enable it later."
      />
    </div>
  );
};

export default BranchList;

