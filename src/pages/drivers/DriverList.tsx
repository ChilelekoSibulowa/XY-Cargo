import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DeleteDialog } from "@/components/shared/DeleteDialog";
import { toast } from "sonner";
import { useDefaultCurrency } from "@/hooks/useDefaultCurrency";

interface Driver {
  id: string;
  code: string;
  full_name: string;
  email: string | null;
  phone: string;
  vehicle_type: string | null;
  vehicle_plate: string | null;
  wallet_balance: number | null;
  is_active: boolean | null;
}

const DriverList = () => {
  const { symbol } = useDefaultCurrency();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteItem, setDeleteItem] = useState<Driver | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchDrivers = async () => {
    const { data, error } = await supabase
      .from("drivers")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to fetch drivers");
    } else {
      setDrivers(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

  const handleDelete = async () => {
    if (!deleteItem) return;
    setIsDeleting(true);

    const { error } = await supabase.from("drivers").delete().eq("id", deleteItem.id);

    if (error) {
      toast.error("Failed to delete driver");
    } else {
      toast.success("Driver deleted successfully");
      fetchDrivers();
    }
    setIsDeleting(false);
    setDeleteItem(null);
  };

  const columns: Column<Driver>[] = [
    { key: "code", label: "Code" },
    { key: "full_name", label: "Name" },
    { key: "phone", label: "Phone" },
    { key: "vehicle_type", label: "Vehicle" },
    { key: "vehicle_plate", label: "Plate" },
    {
      key: "wallet_balance",
      label: "Wallet",
      render: (item) => `${symbol} ${(item.wallet_balance || 0).toFixed(2)}`,
    },
    {
      key: "is_active",
      label: "Status",
      render: (item) => <StatusBadge status={item.is_active ? "active" : "inactive"} />,
    },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Drivers"
        
        createLink="/drivers/create"
        createLabel="Create New Driver"
      />
      <DataTable
        columns={columns}
        data={drivers}
        isLoading={isLoading}
        searchPlaceholder="Search drivers..."
        editLink={(item) => `/drivers/${item.id}/edit`}
        onDelete={(item) => setDeleteItem(item)}
      />
      <DeleteDialog
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        title="Delete Driver"
        description="Are you sure you want to delete this driver?"
      />
    </div>
  );
};

export default DriverList;

