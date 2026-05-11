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
import { subscribeToPushNotifications } from "@/lib/pushNotifications";
import { Bell, ShieldCheck } from "lucide-react";

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
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Push Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Get real-time updates on your parcels and shipment status directly on your device.
            </p>
            <div className="flex items-center justify-between gap-4 p-4 rounded-lg bg-muted/50 border border-border/50">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Notification Pop-ups</p>
                <p className="text-xs text-muted-foreground">Enabled for this device</p>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={async () => {
                  await subscribeToPushNotifications();
                  toast.success("Push notifications enabled!");
                }}
              >
                Enable Notifications
              </Button>
            </div>
          </CardContent>
        </Card>

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

