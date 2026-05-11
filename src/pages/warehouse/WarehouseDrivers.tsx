import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, Column } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Row = {
  id: string;
  code: string;
  full_name: string;
  phone: string;
  email: string | null;
  branch_id: string | null;
  vehicle_plate: string | null;
  is_active: boolean | null;
  branch_name?: string | null;
};

const WarehouseDrivers = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data, error } = await supabase
        .from("drivers")
        .select("id, code, full_name, phone, email, branch_id, vehicle_plate, is_active")
        .order("full_name");

      if (error) {
        toast.error("Failed to load drivers.");
        setRows([]);
        setIsLoading(false);
        return;
      }

      const branchIds = Array.from(new Set((data || []).map((d: any) => d.branch_id).filter(Boolean)));
      let branchMap: Record<string, string> = {};
      if (branchIds.length > 0) {
        const { data: branchData } = await supabase
          .from("branches")
          .select("id, name")
          .in("id", branchIds);
        branchMap = (branchData || []).reduce((acc, branch) => {
          acc[branch.id] = branch.name;
          return acc;
        }, {} as Record<string, string>);
      }

      const mapped = (data || []).map((d: any) => ({
        ...d,
        branch_name: d.branch_id ? branchMap[d.branch_id] || "-" : "-",
      }));

      setRows(mapped as Row[]);
      setIsLoading(false);
    };
    fetch();
  }, []);

  const columns: Column<Row>[] = [
    { key: "code", label: "Customer ID", render: (r) => <span className="font-mono text-xs">{r.code}</span> },
    { key: "full_name", label: "Name" },
    { key: "phone", label: "Mobile No." },
    { key: "email", label: "Email", render: (r) => r.email || "-" },
    { key: "branch_name", label: "Branch", render: (r) => r.branch_name || "-" },
    { key: "vehicle_plate", label: "Vehicle Plate", render: (r) => r.vehicle_plate || "-" },
    { key: "is_active", label: "Status", render: (r) => <Badge variant={r.is_active ? "default" : "secondary"}>{r.is_active ? "Active" : "Inactive"}</Badge> },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="All Drivers"  />
      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        searchPlaceholder="Search drivers..."
        editLink={(item) => `/drivers/${item.id}/edit`}
      />
    </div>
  );
};

export default WarehouseDrivers;

