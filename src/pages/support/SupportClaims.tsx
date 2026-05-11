import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format } from "date-fns";
import { Check, CircleDollarSign, RotateCcw, X } from "lucide-react";

type ClaimRow = {
  id: string;
  shipment_code: string | null;
  description: string;
  status: string | null;
  created_at: string;
  customer: { full_name: string | null; code: string | null } | null;
};

const statusOptions = ["submitted", "approved", "rejected", "refunded"];

const statusActionIcon = (status: string) => {
  if (status === "approved") return <Check className="h-4 w-4" />;
  if (status === "rejected") return <X className="h-4 w-4" />;
  if (status === "refunded") return <CircleDollarSign className="h-4 w-4" />;
  return <RotateCcw className="h-4 w-4" />;
};

const SupportClaims = () => {
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  const fetchClaims = async () => {
    const { data, error } = await supabase
      .from("customer_claims")
      .select("id, shipment_code, description, status, created_at, customer:customers(full_name, code)")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load claims.");
      setClaims([]);
    } else {
      setClaims((data || []) as ClaimRow[]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchClaims();
  }, []);

  const updateStatus = async (id: string, status: string) => {
    setIsUpdating(id);
    const { error } = await supabase
      .from("customer_claims")
      .update({ status })
      .eq("id", id);

    if (error) {
      toast.error("Failed to update claim.");
    } else {
      toast.success(`Claim marked as ${status}.`);
      setClaims((prev) => prev.map((claim) => (claim.id === id ? { ...claim, status } : claim)));
    }
    setIsUpdating(null);
  };

  const columns: Column<ClaimRow>[] = [
    {
      key: "customer",
      label: "Customer",
      render: (item) =>
        `${item.customer?.full_name || "Customer"}${item.customer?.code ? ` (${item.customer.code})` : ""}`,
    },
    {
      key: "shipment_code",
      label: "Shipment",
      render: (item) => item.shipment_code || "-",
    },
    { key: "description", label: "Issue" },
    {
      key: "status",
      label: "Status",
      render: (item) => (
        <StatusBadge status={item.status || "pending"} label={item.status || "submitted"} />
      ),
    },
    {
      key: "created_at",
      label: "Submitted",
      render: (item) => format(new Date(item.created_at), "PP"),
    },
    {
      key: "actions",
      label: "Actions",
      render: (item) => (
        <div className="flex items-center gap-1">
          {statusOptions.map((status) => (
            <Button
              key={status}
              size="icon"
              variant="ghost"
              className="h-8 w-8 p-0"
              disabled={isUpdating === item.id}
              onClick={() => updateStatus(item.id, status)}
              title={`Mark ${status}`}
            >
              <span className={
                status === "approved" ? "text-green-600" :
                status === "rejected" ? "text-destructive" :
                status === "refunded" ? "text-blue-600" :
                "text-muted-foreground"
              }>
                {statusActionIcon(status)}
              </span>
            </Button>
          ))}
        </div>
      ),
    },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Claims Queue"
        
      />
      <DataTable
        columns={columns}
        data={claims}
        isLoading={isLoading}
        searchPlaceholder="Search claims..."
      />
    </div>
  );
};

export default SupportClaims;

