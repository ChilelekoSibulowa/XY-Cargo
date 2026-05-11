import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, Column } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Pencil } from "lucide-react";

type BranchOption = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  country: string | null;
};

type Row = {
  id: string;
  code: string;
  full_name: string;
  email: string | null;
  phone: string;
  city: string | null;
  is_active: boolean | null;
  wallet_balance: number | null;
  branch_id: string | null;
  branch: { name: string | null } | null;
};

const SupportCustomerProfiles = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingRow, setEditingRow] = useState<Row | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase
        .from("customers")
        .select("id, code, full_name, email, phone, city, is_active, wallet_balance, branch_id, branch:branches(name)")
        .order("full_name"),
      supabase
        .from("branches")
        .select("id, name, address, city, country")
        .eq("is_active", true)
        .order("name"),
    ]).then(([customersRes, branchesRes]) => {
      setRows((customersRes.data as Row[] | null) || []);
      setBranches((branchesRes.data as BranchOption[] | null) || []);
      setIsLoading(false);
    });
  }, []);

  const openEditWarehouseDialog = (row: Row) => {
    setEditingRow(row);
    setSelectedBranchId(row.branch_id || "");
  };

  const saveWarehouseAddress = async () => {
    if (!editingRow) return;

    setIsSaving(true);
    const { error } = await supabase
      .from("customers")
      .update({ branch_id: selectedBranchId || null })
      .eq("id", editingRow.id);

    setIsSaving(false);
    if (error) {
      toast.error(error.message || "Failed to update warehouse assignment.");
      return;
    }

    const selectedBranch = branches.find((branch) => branch.id === selectedBranchId);
    setRows((prev) =>
      prev.map((row) =>
        row.id === editingRow.id
          ? { ...row, branch_id: selectedBranchId || null, branch: { name: selectedBranch?.name || null } }
          : row
      )
    );
    toast.success("Customer warehouse address updated.");
    setEditingRow(null);
  };

  const columns: Column<Row>[] = [
    { key: "code", label: "ID", render: (r) => <span className="font-mono text-xs">{r.code}</span> },
    { key: "full_name", label: "Name" },
    { key: "phone", label: "Phone" },
    { key: "email", label: "Email", render: (r) => r.email || "-" },
    { key: "city", label: "City", render: (r) => r.city || "-" },
    { key: "branch", label: "Warehouse", render: (r) => r.branch?.name || "Not assigned" },
    { key: "is_active", label: "Status", render: (r) => <Badge variant={r.is_active ? "default" : "secondary"}>{r.is_active ? "Active" : "Inactive"}</Badge> },
    {
      key: "action",
      label: "Action",
      render: (r) => (
        <Button size="icon" variant="ghost" className="h-8 w-8 p-0" onClick={() => openEditWarehouseDialog(r)} title="Edit warehouse">
          <Pencil className="h-4 w-4 text-blue-600" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Customer Profiles"  />
      <DataTable columns={columns} data={rows} isLoading={isLoading} searchPlaceholder="Search customers..." />

      <Dialog open={!!editingRow} onOpenChange={(open) => !open && setEditingRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Customer Warehouse</DialogTitle>
            
          </DialogHeader>

          <div className="space-y-2">
            <Label>Warehouse Branch</Label>
            <Select value={selectedBranchId || "none"} onValueChange={(value) => setSelectedBranchId(value === "none" ? "" : value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select warehouse branch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No warehouse assignment</SelectItem>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRow(null)}>
              Cancel
            </Button>
            <Button onClick={saveWarehouseAddress} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SupportCustomerProfiles;

