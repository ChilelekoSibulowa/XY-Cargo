import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, Column } from "@/components/shared/DataTable";
import { DeleteDialog } from "@/components/shared/DeleteDialog";
import { Badge } from "@/components/ui/badge";
import { useDefaultCurrency } from "@/hooks/useDefaultCurrency";
import { toast } from "sonner";

type Row = {
  id: string;
  code: string;
  full_name: string;
  email: string | null;
  phone: string;
  address: string | null;
  city: string | null;
  country: string | null;
  customer_type: string | null;
  company_name: string | null;
  company_registration_number: string | null;
  company_email: string | null;
  company_phone: string | null;
  company_address: string | null;
  wallet_balance: number | null;
  is_active: boolean | null;
  created_at: string;
};

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

const WarehouseCustomers = () => {
  const { formatAmount } = useDefaultCurrency();
  const [rows, setRows] = useState<Row[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteItem, setDeleteItem] = useState<Row | null>(null);
  const [viewItem, setViewItem] = useState<Row | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchCustomers = () => {
    supabase
      .from("customers")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          toast.error("Failed to load customers.");
          setRows([]);
        } else {
          setRows((data as Row[] | null) || []);
        }
        setIsLoading(false);
      });
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleDelete = async () => {
    if (!deleteItem) return;

    setIsDeleting(true);
    const { error } = await supabase.rpc("delete_customer_account" as any, {
      _customer_id: deleteItem.id,
    } as any);

    if (error) {
      toast.error(error.message || "Failed to delete customer.");
    } else {
      toast.success("Customer deleted successfully.");
      fetchCustomers();
    }

    setIsDeleting(false);
    setDeleteItem(null);
  };

  const columns: Column<Row>[] = [
    { key: "code", label: "Customer ID", render: (r) => <span className="font-mono text-xs">{r.code}</span> },
    { key: "full_name", label: "Name" },
    { key: "phone", label: "Mobile No." },
    { key: "email", label: "Email", render: (r) => r.email || "-" },
    {
      key: "customer_type",
      label: "Type",
      render: (item) => (
        <Badge variant="outline" className="capitalize">
          {item.customer_type || "personal"}
        </Badge>
      ),
    },
    { key: "wallet_balance", label: "Wallet", render: (r) => (r.wallet_balance != null ? formatAmount(r.wallet_balance) : "-") },
    { key: "is_active", label: "Status", render: (r) => <Badge variant={r.is_active ? "default" : "secondary"}>{r.is_active ? "Active" : "Inactive"}</Badge> },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader 
        title="All Customers" 
         
        createLink="/customers/create"
        createLabel="Create New Customer"
      />
      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        searchPlaceholder="Search customers..."
        editLink={(item) => `/customers/${item.id}/edit`}
        onDelete={(item) => setDeleteItem(item)}
        customActions={(item) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewItem(item)}
            className="h-8 w-8 p-0"
          >
            <Eye className="h-4 w-4 text-blue-600" />
          </Button>
        )}
      />

      <Dialog open={!!viewItem} onOpenChange={() => setViewItem(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              Customer Profile: {viewItem?.full_name}
              <Badge className="capitalize">{viewItem?.customer_type || "personal"}</Badge>
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <section>
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Personal Details</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Full Name</p>
                  <p className="font-medium">{viewItem?.full_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Email</p>
                  <p className="font-medium">{viewItem?.email || "N/A"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Phone</p>
                  <p className="font-medium">{viewItem?.phone}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Address</p>
                  <p className="font-medium">{viewItem?.address || "N/A"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">City</p>
                  <p className="font-medium">{viewItem?.city || "N/A"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Country</p>
                  <p className="font-medium">{viewItem?.country || "N/A"}</p>
                </div>
              </div>
            </section>

            {viewItem?.customer_type === "company" && (
              <section className="pt-4 border-t">
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Company Details</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Company Name</p>
                    <p className="font-medium">{viewItem?.company_name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Registration Number</p>
                    <p className="font-medium">{viewItem?.company_registration_number}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Company Email</p>
                    <p className="font-medium">{viewItem?.company_email || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Company Phone</p>
                    <p className="font-medium">{viewItem?.company_phone || "N/A"}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Company Address</p>
                    <p className="font-medium">{viewItem?.company_address || "N/A"}</p>
                  </div>
                </div>
              </section>
            )}

            <section className="pt-4 border-t">
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Account Info</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Customer Code</p>
                  <p className="font-medium">{viewItem?.code}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Wallet Balance</p>
                  <p className="font-medium text-primary font-bold">{viewItem?.wallet_balance != null ? formatAmount(viewItem.wallet_balance) : "N/A"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Member Since</p>
                  <p className="font-medium">{viewItem?.created_at ? new Date(viewItem.created_at).toLocaleDateString() : "N/A"}</p>
                </div>
              </div>
            </section>
          </div>
        </DialogContent>
      </Dialog>

      <DeleteDialog
        open={Boolean(deleteItem)}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        title="Delete Customer"
        description="Delete this customer account and all linked shipments, invoices, payments, tickets, and profile records."
      />
    </div>
  );
};

export default WarehouseCustomers;

