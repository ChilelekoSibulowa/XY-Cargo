import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DeleteDialog } from "@/components/shared/DeleteDialog";
import { toast } from "sonner";

interface Receiver {
  id: string;
  code: string;
  full_name: string;
  phone: string;
  email: string | null;
  city: string | null;
  country: string | null;
  is_active: boolean | null;
}

const ReceiverList = () => {
  const [receivers, setReceivers] = useState<Receiver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteItem, setDeleteItem] = useState<Receiver | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchReceivers = async () => {
    const { data, error } = await supabase
      .from("receivers")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to fetch receivers");
    } else {
      setReceivers(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchReceivers();
  }, []);

  const handleDelete = async () => {
    if (!deleteItem) return;
    setIsDeleting(true);

    const { error } = await supabase.from("receivers").delete().eq("id", deleteItem.id);

    if (error) {
      toast.error("Failed to delete receiver");
    } else {
      toast.success("Receiver deleted successfully");
      fetchReceivers();
    }
    setIsDeleting(false);
    setDeleteItem(null);
  };

  const columns: Column<Receiver>[] = [
    { key: "code", label: "Code" },
    { key: "full_name", label: "Name" },
    { key: "phone", label: "Phone" },
    { key: "email", label: "Email" },
    { key: "city", label: "City" },
    { key: "country", label: "Country" },
    {
      key: "is_active",
      label: "Status",
      render: (item) => <StatusBadge status={item.is_active ? "active" : "inactive"} />,
    },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Receivers"
        
        createLink="/receivers/create"
        createLabel="Create New Receiver"
      />
      <DataTable
        columns={columns}
        data={receivers}
        isLoading={isLoading}
        searchPlaceholder="Search receivers..."
        editLink={(item) => `/receivers/${item.id}/edit`}
        onDelete={(item) => setDeleteItem(item)}
      />
      <DeleteDialog
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        title="Delete Receiver"
        description="Are you sure you want to delete this receiver?"
      />
    </div>
  );
};

export default ReceiverList;

