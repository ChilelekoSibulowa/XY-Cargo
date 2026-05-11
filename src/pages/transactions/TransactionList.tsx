import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DeleteDialog } from "@/components/shared/DeleteDialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { useDefaultCurrency } from "@/hooks/useDefaultCurrency";
import { useCurrency } from "@/hooks/useCurrencyContext";

interface Transaction {
  id: string;
  code: string;
  transaction_type: string;
  amount: number;
  payment_method: string | null;
  status: string | null;
  customer_name: string | null;
  created_at: string;
}

const TransactionList = () => {
  const { symbol } = useDefaultCurrency();
  const { convert } = useCurrency();
  const fmt = (amount: number) => `${symbol} ${convert(amount).toFixed(2)}`;
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteItem, setDeleteItem] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchTransactions = async () => {
    const { data, error } = await supabase
      .from("transactions")
      .select(`
        *,
        customers(full_name)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to fetch transactions");
    } else {
      const formatted = (data || []).map((t) => ({
        id: t.id,
        code: t.code,
        transaction_type: t.transaction_type,
        amount: t.amount,
        payment_method: t.payment_method,
        status: t.status,
        customer_name: t.customers?.full_name || null,
        created_at: t.created_at,
      }));
      setTransactions(formatted);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const handleDelete = async () => {
    if (!deleteItem) return;
    setIsDeleting(true);

    const { error } = await supabase.from("transactions").delete().eq("id", deleteItem.id);

    if (error) {
      toast.error("Failed to delete transaction");
    } else {
      toast.success("Transaction deleted successfully");
      fetchTransactions();
    }
    setIsDeleting(false);
    setDeleteItem(null);
  };

  const getStatusVariant = (status: string | null): "active" | "pending" | "inactive" => {
    switch (status) {
      case "completed":
        return "active";
      case "pending":
        return "pending";
      default:
        return "inactive";
    }
  };

  const columns: Column<Transaction>[] = [
    { key: "code", label: "Code" },
    {
      key: "transaction_type",
      label: "Type",
      render: (item) => <span className="capitalize">{item.transaction_type.replace("_", " ")}</span>,
    },
    { key: "customer_name", label: "Customer" },
    {
      key: "amount",
      label: "Amount",
      align: "center",
      
      render: (item) => fmt(item.amount),
    },
    {
      key: "payment_method",
      label: "Method",
      render: (item) => (item.payment_method ? item.payment_method.replace("_", " ") : "-"),
    },
    {
      key: "status",
      label: "Status",
      render: (item) => (
        <StatusBadge status={getStatusVariant(item.status)} label={item.status || "unknown"} />
      ),
    },
    {
      key: "created_at",
      label: "Date",
      render: (item) => format(new Date(item.created_at), "PP"),
    },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Transactions"
        
        createLink="/transactions/create"
        createLabel="Create Transaction"
      />
      <DataTable
        columns={columns}
        data={transactions}
        isLoading={isLoading}
        searchPlaceholder="Search transactions..."
        editLink={(item) => `/transactions/${item.id}/edit`}
        onDelete={(item) => setDeleteItem(item)}
      />
      <DeleteDialog
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        title="Delete Transaction"
        description="Are you sure you want to delete this transaction?"
      />
    </div>
  );
};

export default TransactionList;

