import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FormCard } from "@/components/shared/FormCard";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SearchableSelect from "@/components/shared/SearchableSelect";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { notifyPaymentReceived } from "@/lib/notifications";

interface Customer {
  id: string;
  code: string;
  full_name: string;
}

const transactionTypes = [
  { value: "payment", label: "Payment" },
  { value: "refund", label: "Refund" },
  { value: "wallet_topup", label: "Wallet Top-up" },
  { value: "wallet_deduction", label: "Wallet Deduction" },
];

const paymentMethods = [
  { value: "lipila", label: "Lipila" },
];

const TransactionCreate = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [form, setForm] = useState({
    transaction_type: "payment",
    amount: "",
    payment_method: "lipila",
    customer_id: "",
    notes: "",
  });

  useEffect(() => {
    const fetchCustomers = async () => {
      const { data } = await supabase.from("customers").select("id, code, full_name").eq("is_active", true);
      setCustomers(data || []);
    };
    fetchCustomers();
  }, []);

  const handleSubmit = async () => {
    if (!form.amount || !form.transaction_type) {
      toast.error("Please fill in required fields");
      return;
    }

    setIsLoading(true);

    const { data: codeData } = await supabase.rpc("generate_code", { prefix: "TXN" });

    const { error } = await supabase.from("transactions").insert({
      code: codeData || `TXN-${Date.now()}`,
      transaction_type: form.transaction_type as "payment" | "refund" | "wallet_topup" | "wallet_deduction",
      amount: parseFloat(form.amount),
      payment_method: form.payment_method as "lipila",
      customer_id: form.customer_id || null,
      notes: form.notes || null,
      status: "completed",
    });

    if (error) {
      toast.error("Failed to create transaction");
    } else {
      // Notify customer of payment
      if (form.customer_id && form.transaction_type === "payment") {
        notifyPaymentReceived(form.customer_id, form.amount);
      }
      toast.success("Transaction created successfully");
      navigate("/transactions");
    }
    setIsLoading(false);
  };

  return (
    <FormCard
      title="Create Transaction"
      
      backLink="/transactions"
      onSubmit={handleSubmit}
      isLoading={isLoading}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="transaction_type">Transaction Type *</Label>
          <Select
            value={form.transaction_type}
            onValueChange={(value) => setForm({ ...form, transaction_type: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {transactionTypes.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="amount">Amount *</Label>
          <Input
            id="amount"
            type="number"
            min="0"
            step="0.01"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            placeholder="0.00"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="payment_method">Payment Method</Label>
          <Select
            value={form.payment_method}
            onValueChange={(value) => setForm({ ...form, payment_method: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {paymentMethods.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="customer_id">Customer</Label>
          <SearchableSelect
            value={form.customer_id}
            onValueChange={(value) => setForm({ ...form, customer_id: value })}
            options={customers.map((c) => ({
              value: c.id,
              label: `${c.code} - ${c.full_name}`,
              keywords: `${c.full_name} ${c.code}`,
            }))}
            placeholder="Select customer"
            searchPlaceholder="Search customer by name or code..."
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Transaction notes..."
          />
        </div>
      </div>
    </FormCard>
  );
};

export default TransactionCreate;

