import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { CustomerProfileGate } from "@/components/customer/CustomerProfileGate";
import { useCustomerRecord } from "@/hooks/useCustomerRecord";
import { toast } from "sonner";

const CustomerPayOnBehalf = () => {
  const navigate = useNavigate();
  const { customer } = useCustomerRecord();
  const [form, setForm] = useState({
    trackingCode: "",
    amount: 0,
    paymentMethod: "lipila",
  });
  const [displayAmount, setDisplayAmount] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async () => {
    if (!customer) return;
    if (!form.trackingCode || form.amount <= 0) {
      toast.error("Tracking code and amount are required.");
      return;
    }
    setIsSaving(true);
    const { error } = await supabase.from("transactions").insert({
      code: `TRX-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      transaction_type: "payment" as const,
      amount: form.amount,
      payment_method: form.paymentMethod as "lipila",
      customer_id: customer.id,
      notes: `Pay freight on behalf for shipment ${form.trackingCode}`,
    });
    if (error) {
      toast.error("Failed to record payment.");
    } else {
      toast.success("Payment recorded.");
      setForm({ trackingCode: "", amount: 0, paymentMethod: "lipila" });
      navigate("/customer/payments");
    }
    setIsSaving(false);
  };

  return (
    <CustomerProfileGate>
      <div className="space-y-6">
        <PageHeader title="Pay Freight on Behalf"  />
        <Card className="border-border/70">
          <CardContent className="space-y-4 p-6">
            <div className="space-y-2">
              <Label>Tracking / Waybill Number</Label>
              <Input
                value={form.trackingCode}
                onChange={(e) => setForm({ ...form, trackingCode: e.target.value })}
                placeholder="SHP-XXXXX"
              />
            </div>
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input
                type="text"
                inputMode="decimal"
                className="no-spinners"
                value={displayAmount}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "" || /^[0-9]*\.?[0-9]*$/.test(val)) {
                    setDisplayAmount(val);
                    const num = parseFloat(val);
                    setForm({ ...form, amount: isNaN(num) ? 0 : num });
                  }
                }}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={form.paymentMethod} onValueChange={(v) => setForm({ ...form, paymentMethod: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lipila">Lipila</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? "Submitting..." : "Submit Payment"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </CustomerProfileGate>
  );
};

export default CustomerPayOnBehalf;

