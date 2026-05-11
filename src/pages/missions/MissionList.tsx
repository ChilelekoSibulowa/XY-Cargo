import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DeleteDialog } from "@/components/shared/DeleteDialog";
import { toast } from "sonner";
import { format } from "date-fns";

interface Mission {
  id: string;
  code: string;
  mission_type: string;
  status: string;
  scheduled_date: string | null;
  driver_name: string | null;
  branch_name: string | null;
  created_at: string;
}

const MissionList = () => {
  const [searchParams] = useSearchParams();
  const statusFilter = searchParams.get("status");
  const [missions, setMissions] = useState<Mission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteItem, setDeleteItem] = useState<Mission | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchMissions = async () => {
    const baseQuery = supabase
      .from("missions")
      .select(`
        *,
        drivers(full_name),
        branches!missions_branch_id_fkey(name)
      `)
      .order("created_at", { ascending: false });

    const query = statusFilter
      ? baseQuery.eq("status", statusFilter as "requested" | "assigned" | "approved" | "received" | "done" | "closed")
      : baseQuery;

    const { data, error } = await query;

    if (error) {
      toast.error("Failed to fetch missions");
    } else {
      const formatted = (data || []).map((m) => ({
        id: m.id,
        code: m.code,
        mission_type: m.mission_type,
        status: m.status,
        scheduled_date: m.scheduled_date,
        driver_name: m.drivers?.full_name || null,
        branch_name: m.branches?.name || null,
        created_at: m.created_at,
      }));
      setMissions(formatted);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchMissions();
  }, [statusFilter]);

  const handleDelete = async () => {
    if (!deleteItem) return;
    setIsDeleting(true);

    const { error } = await supabase.from("missions").delete().eq("id", deleteItem.id);

    if (error) {
      toast.error("Failed to delete mission");
    } else {
      toast.success("Mission deleted successfully");
      fetchMissions();
    }
    setIsDeleting(false);
    setDeleteItem(null);
  };

  const getStatusVariant = (status: string): "active" | "pending" | "inactive" => {
    switch (status) {
      case "done":
      case "closed":
        return "active";
      case "assigned":
      case "approved":
      case "received":
        return "pending";
      default:
        return "inactive";
    }
  };

  const columns: Column<Mission>[] = [
    { key: "code", label: "Code" },
    {
      key: "mission_type",
      label: "Type",
      render: (item) => <span className="capitalize">{item.mission_type}</span>,
    },
    { key: "driver_name", label: "Driver" },
    { key: "branch_name", label: "Warehouse" },
    {
      key: "scheduled_date",
      label: "Scheduled",
      render: (item) => (item.scheduled_date ? format(new Date(item.scheduled_date), "PP") : "-"),
    },
    {
      key: "status",
      label: "Status",
      render: (item) => (
        <StatusBadge status={getStatusVariant(item.status)} label={item.status.replace("_", " ")} />
      ),
    },
  ];

  const title = statusFilter
    ? `Missions - ${statusFilter.replace("_", " ")}`
    : "All Missions";

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={title}
        
        createLink="/missions/create"
        createLabel="Create New Mission"
      />
      <DataTable
        columns={columns}
        data={missions}
        isLoading={isLoading}
        searchPlaceholder="Search missions..."
        editLink={(item) => `/missions/${item.id}/edit`}
        onDelete={(item) => setDeleteItem(item)}
      />
      <DeleteDialog
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        title="Delete Mission"
        description="Are you sure you want to delete this mission?"
      />
    </div>
  );
};

export default MissionList;

