import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthContext } from "@/components/auth/AuthContext";
import TwoFactorAuthCard from "@/components/settings/TwoFactorAuthCard";
import { updateCurrentUserMfaMetadata } from "@/lib/authMfa";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Profile = () => {
  const { userRole } = useAuthContext();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const normalizedRole = (userRole || "").toLowerCase();
  const portalLabel =
    normalizedRole === "customer"
      ? "Customer Portal"
      : normalizedRole === "agent"
        ? "Agent Portal"
        : normalizedRole === "driver"
          ? "Driver Portal"
          : "Staff Portal";

  const handlePasswordChange = async () => {
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setIsSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast.error(error.message || "Failed to change password.");
      setIsSavingPassword(false);
      return;
    }

    setNewPassword("");
    setConfirmPassword("");
    setIsSavingPassword(false);
    toast.success("Password changed successfully.");
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Profile</h1>
          <p className="text-sm text-muted-foreground">Manage your personal information and preferences.</p>
        </div>
      </div>

      <Card className="border-border/70 bg-card">
        <CardContent className="space-y-4 p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input id="fullName" placeholder="Your full name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" placeholder="+260..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="idNumber">ID Number</Label>
              <Input id="idNumber" placeholder="National ID or passport" />
            </div>
          </div>
          <Button className="w-full md:w-auto">Save Changes</Button>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card">
        <CardContent className="space-y-4 p-6">
          <div>
            <h2 className="text-lg font-semibold">Change Password</h2>
            <p className="text-sm text-muted-foreground">Update your account password securely.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                minLength={6}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="Use at least 6 characters"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                minLength={6}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Re-enter your password"
              />
            </div>
          </div>
          <Button onClick={handlePasswordChange} disabled={isSavingPassword} className="w-full md:w-auto">
            {isSavingPassword ? "Updating..." : "Update Password"}
          </Button>
        </CardContent>
      </Card>

      <TwoFactorAuthCard
        portalLabel={portalLabel}
        onEnabledChange={(enabled) =>
          updateCurrentUserMfaMetadata({
            mfa_enabled: enabled,
            [`${normalizedRole || "staff"}_mfa_enabled`]: enabled,
          })
        }
      />
    </div>
  );
};

export default Profile;
