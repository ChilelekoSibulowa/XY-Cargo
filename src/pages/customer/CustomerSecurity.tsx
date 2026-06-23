import { useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CustomerProfileGate } from "@/components/customer/CustomerProfileGate";
import { useCustomerRecord } from "@/hooks/useCustomerRecord";
import TwoFactorAuthCard from "@/components/settings/TwoFactorAuthCard";

const CustomerSecurity = () => {
  const { customer, refreshCustomer } = useCustomerRecord();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const updateCustomerMfa = async (enabled: boolean) => {
    if (!customer?.id) return;
    const { error } = await supabase
      .from("customers")
      .update({ mfa_enabled: enabled })
      .eq("id", customer.id);

    if (error) {
      return;
    }
    await refreshCustomer();
  };

  const handleUpdate = async () => {
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    setIsSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast.error("Failed to update password.");
    } else {
      toast.success("Password updated.");
      setPassword("");
      setConfirmPassword("");
    }
    setIsSaving(false);
  };

  return (
    <CustomerProfileGate>
      <div className="space-y-6">
        <PageHeader title="Settings"  />

        <TwoFactorAuthCard
          portalLabel="Customer Portal"
          accountLabel={customer?.email}
          onEnabledChange={updateCustomerMfa}
        />

        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Confirm Password</Label>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
            <Button onClick={handleUpdate} disabled={isSaving}>
              {isSaving ? "Saving..." : "Update Password"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </CustomerProfileGate>
  );
};

export default CustomerSecurity;
