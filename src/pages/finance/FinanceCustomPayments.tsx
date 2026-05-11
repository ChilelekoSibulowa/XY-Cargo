import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useDefaultCurrency } from "@/hooks/useDefaultCurrency";

const FinanceCustomPayments = () => {
  const { formatAmount } = useDefaultCurrency();
  const [payments, setPayments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCustomPayments = async () => {
    setIsLoading(true);
    const { data, error } = await (supabase as any)
      .from("payments")
      .select("*")
      .or("payment_type.eq.custom_payment,shipment_id.is.null")
      .eq("status", "completed")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load custom payments.");
    } else {
      setPayments(data || []);
    }
    setIsLoading(false);
  };

  const confirmPayment = async (payment: any) => {
    if (payment.status === "completed") {
      toast.error("This payment has already been confirmed.");
      return;
    }

    const { error } = await (supabase as any)
      .from("payments")
      .update({
        status: "completed",
        callback_data: {
          ...(payment.callback_data || {}),
          confirmed_by_finance: true,
          confirmed_at: new Date().toISOString(),
        },
      })
      .eq("id", payment.id);

    if (error) {
      toast.error(error.message || "Failed to confirm payment.");
      return;
    }

    toast.success("Payment confirmed.");
    await fetchCustomPayments();
  };

  useEffect(() => {
    fetchCustomPayments();
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Custom Payments"
        
      />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : payments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No custom payments found.
                </TableCell>
              </TableRow>
            ) : (
              payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{new Date(p.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>{p.description || p.callback_data?.description || "-"}</TableCell>
                  <TableCell>{formatAmount(Number(p.amount || 0), p.currency || "ZMW")}</TableCell>
                  <TableCell>{p.payment_method || p.callback_data?.payment_method || p.payment_provider || "-"}</TableCell>
                  <TableCell><StatusBadge status={p.status || "pending"} /></TableCell>
                  <TableCell>
                    {["pending", "processing"].includes(p.status || "pending") ? (
                      <Button size="sm" onClick={() => confirmPayment(p)}>
                        Confirm Payment
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">Confirmed</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default FinanceCustomPayments;


