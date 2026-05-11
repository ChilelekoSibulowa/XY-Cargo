import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, Column } from "@/components/shared/DataTable";
import { DeleteDialog } from "@/components/shared/DeleteDialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { toast } from "sonner";

type Row = {
  id: string;
  user_id: string;
  role_label: string;
  is_active: boolean | null;
  notes: string | null;
  created_at: string;
  branch_id: string | null;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  branch_name?: string | null;
};

const WarehouseStaff = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteItem, setDeleteItem] = useState<Row | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const { data, error } = await supabase
        .from("shipment_team")
        .select(
          "id, user_id, role_label, is_active, notes, created_at, branch_id",
        )
        .order("created_at", { ascending: false });

      if (error) {
        toast.error("Failed to load warehouse staff.");
        setRows([]);
        setIsLoading(false);
        return;
      }

      const userIds = Array.from(
        new Set((data || []).map((d: any) => d.user_id).filter(Boolean)),
      );
      const branchIds = Array.from(
        new Set((data || []).map((d: any) => d.branch_id).filter(Boolean)),
      );

      let profileMap: Record<
        string,
        { full_name: string | null; email: string | null; phone: string | null }
      > = {};
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("user_id, full_name, email, phone")
          .in("user_id", userIds);
        profileMap = (profilesData || []).reduce(
          (acc, profile) => {
            acc[profile.user_id] = {
              full_name: profile.full_name,
              email: profile.email,
              phone: profile.phone,
            };
            return acc;
          },
          {} as Record<
            string,
            {
              full_name: string | null;
              email: string | null;
              phone: string | null;
            }
          >,
        );
      }

      let branchMap: Record<string, string> = {};
      if (branchIds.length > 0) {
        const { data: branchData } = await supabase
          .from("branches")
          .select("id, name")
          .in("id", branchIds);
        branchMap = (branchData || []).reduce(
          (acc, branch) => {
            acc[branch.id] = branch.name;
            return acc;
          },
          {} as Record<string, string>,
        );
      }

      const mapped = (data || []).map((d: any) => ({
        ...d,
        full_name: profileMap[d.user_id]?.full_name || "-",
        email: profileMap[d.user_id]?.email || "-",
        phone: profileMap[d.user_id]?.phone || "-",
        branch_name: d.notes || "-",
      }));

      setRows(mapped as Row[]);
      setIsLoading(false);
    };
    fetch();
  }, []);

  const handleDelete = async () => {
    if (!deleteItem) return;
    setIsDeleting(true);

    const { error } = await supabase
      .from("shipment_team")
      .delete()
      .eq("id", deleteItem.id);

    if (error) {
      toast.error("Failed to delete warehouse staff member.");
    } else {
      toast.success("Warehouse staff member removed.");
      setRows((prev) => prev.filter((row) => row.id !== deleteItem.id));
    }

    setIsDeleting(false);
    setDeleteItem(null);
  };

  const columns: Column<Row>[] = [
    {
      key: "user_id",
      label: "Staff ID",
      render: (r) => (
        <span className="font-mono text-xs font-semibold">
          WH-{r.user_id.substring(0, 5).toUpperCase()}
        </span>
      ),
    },
    { key: "full_name", label: "Name" },
    { key: "phone", label: "Mobile No." },
    { key: "email", label: "Email" },
    { key: "branch_name", label: "Branch" },
    {
      key: "is_active",
      label: "Status",
      render: (r) => (
        <StatusBadge status={r.is_active ? "active" : "inactive"} />
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Warehouse Staffs"
        
      />
      <div className="grid gap-4 md:grid-cols-[1fr_auto] items-center">
        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Total Warehouse Staff</p>
          <p className="text-3xl font-semibold">{rows.length}</p>
        </div>
      </div>
      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        searchPlaceholder="Search staff..."
        onDelete={(item) => setDeleteItem(item)}
      />
      <DeleteDialog
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        title="Delete Warehouse Staff"
        description="Are you sure you want to delete this warehouse staff record?"
      />
    </div>
  );
};

export default WarehouseStaff;

