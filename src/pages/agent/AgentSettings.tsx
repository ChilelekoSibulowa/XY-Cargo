import { useEffect, useMemo, useState } from "react";
import { KeyRound } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useDefaultCurrency } from "@/hooks/useDefaultCurrency";
import { toast } from "sonner";
import TwoFactorAuthCard from "@/components/settings/TwoFactorAuthCard";

type ProfileRow = {
  full_name: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  email: string;
  wallet_balance: number | null;
  bank_name: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
};

const AgentSettings = () => {
  const { formatAmount } = useDefaultCurrency();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [existingMetadata, setExistingMetadata] = useState<Record<string, any>>({});
  const [profileForm, setProfileForm] = useState({ 
    full_name: "", 
    phone: "", 
    address: "",
    city: "",
    country: "" 
  });
  const [accountForm, setAccountForm] = useState({
    bank_name: "",
    account_name: "",
    account_number: "",
  });
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingAccount, setIsSavingAccount] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) {
        setIsLoading(false);
        return;
      }

      setExistingMetadata((user.user_metadata || {}) as Record<string, any>);

      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, phone, address, city, country, email, wallet_balance, bank_name, bank_account_name, bank_account_number")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        toast.error(error.message);
      } else if (data) {
        const row = data as ProfileRow;
        setProfile(row);
        setProfileForm({
          full_name: row.full_name || "",
          phone: row.phone || "",
          address: row.address || "",
          city: row.city || "",
          country: row.country || "",
        });
        setAccountForm({
          bank_name: row.bank_name || user.user_metadata?.bank_name || "",
          account_name: row.bank_account_name || user.user_metadata?.account_name || "",
          account_number: row.bank_account_number || user.user_metadata?.account_number || "",
        });
      }

      setIsLoading(false);
    };

    loadSettings();
  }, []);

  const mergedUserData = useMemo(
    () => ({
      full_name: profileForm.full_name,
      phone: profileForm.phone,
      address: profileForm.address,
      city: profileForm.city,
      country: profileForm.country,
      bank_name: accountForm.bank_name,
      account_name: accountForm.account_name,
      account_number: accountForm.account_number,
    }),
    [accountForm, profileForm],
  );

  const saveProfile = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return;

    if (!profileForm.full_name || !profileForm.phone || !profileForm.address || !profileForm.city || !profileForm.country) {
      toast.error("Full name, phone, address, city, and country are required.");
      return;
    }

    setIsSavingProfile(true);
    try {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: profileForm.full_name,
          phone: profileForm.phone || null,
          address: profileForm.address || null,
          city: profileForm.city || null,
          country: profileForm.country || null,
        })
        .eq("user_id", user.id);

      if (profileError) throw profileError;

      const { error: authError } = await supabase.auth.updateUser({
        data: { ...existingMetadata, ...mergedUserData },
      });
      if (authError) throw authError;

      setExistingMetadata((prev) => ({ ...prev, ...mergedUserData }));
      toast.success("Profile updated.");
    } catch (error: any) {
      toast.error(error?.message || "Failed to save profile.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const saveAccount = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return;

    if (!accountForm.bank_name || !accountForm.account_name || !accountForm.account_number) {
      toast.error("All bank details are required.");
      return;
    }

    setIsSavingAccount(true);
    try {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          bank_name: accountForm.bank_name,
          bank_account_name: accountForm.account_name,
          bank_account_number: accountForm.account_number,
        })
        .eq("user_id", user.id);

      if (profileError) throw profileError;

      const { error } = await supabase.auth.updateUser({
        data: { ...existingMetadata, ...mergedUserData },
      });
      if (error) throw error;
      setExistingMetadata((prev) => ({ ...prev, ...mergedUserData }));
      toast.success("Account settings updated.");
    } catch (error: any) {
      toast.error(error?.message || "Failed to save account settings.");
    } finally {
      setIsSavingAccount(false);
    }
  };

  const savePassword = async () => {
    if (password.length < 6) {
      toast.error("Use at least 6 characters for the new password.");
      return;
    }

    setIsSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPassword("");
      toast.success("Password updated.");
    } catch (error: any) {
      toast.error(error?.message || "Failed to update password.");
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleAgentMfaChange = async (enabled: boolean) => {
    const mfaPatch = {
      mfa_enabled: enabled,
      agent_mfa_enabled: enabled,
      two_factor_enabled: enabled,
    };

    const { error } = await supabase.auth.updateUser({
      data: { ...existingMetadata, ...mfaPatch },
    });

    if (error) {
      throw error;
    }

    setExistingMetadata((prev) => ({ ...prev, ...mfaPatch }));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Settings"
        
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Update Profile</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Full Name <span className="text-destructive">*</span></Label>
                <Input value={profileForm.full_name} onChange={(event) => setProfileForm((prev) => ({ ...prev, full_name: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={profile?.email || ""} disabled />
              </div>
              <div className="space-y-2">
                <Label>Phone <span className="text-destructive">*</span></Label>
                <Input value={profileForm.phone} onChange={(event) => setProfileForm((prev) => ({ ...prev, phone: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Address <span className="text-destructive">*</span></Label>
                <Input value={profileForm.address} onChange={(event) => setProfileForm((prev) => ({ ...prev, address: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>City <span className="text-destructive">*</span></Label>
                <Input value={profileForm.city} onChange={(event) => setProfileForm((prev) => ({ ...prev, city: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Country <span className="text-destructive">*</span></Label>
                <Input value={profileForm.country} onChange={(event) => setProfileForm((prev) => ({ ...prev, country: event.target.value }))} />
              </div>
            </div>
            <Button onClick={() => saveProfile()} disabled={isSavingProfile || isLoading} className="w-full">
              {isSavingProfile ? "Saving..." : "Save Profile"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Bank Details for Commission Payment</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Bank Name <span className="text-destructive">*</span></Label>
              <Input value={accountForm.bank_name} onChange={(event) => setAccountForm((prev) => ({ ...prev, bank_name: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Account Name <span className="text-destructive">*</span></Label>
              <Input value={accountForm.account_name} onChange={(event) => setAccountForm((prev) => ({ ...prev, account_name: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Account Number <span className="text-destructive">*</span></Label>
              <Input value={accountForm.account_number} onChange={(event) => setAccountForm((prev) => ({ ...prev, account_number: event.target.value }))} />
            </div>
            <Button onClick={() => saveAccount()} disabled={isSavingAccount || isLoading} className="w-full">
              {isSavingAccount ? "Saving..." : "Save Bank Details"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <TwoFactorAuthCard
        portalLabel="Agent Portal"
        accountLabel={profile?.email}
        onEnabledChange={handleAgentMfaChange}
      />

      <Card>
        <CardHeader><CardTitle>Agent Wallet</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <p className="text-3xl font-semibold">{formatAmount(Number(profile?.wallet_balance || 0))}</p>
          <p className="text-sm text-muted-foreground">
            Top up and use your wallet from the Agent Payments page.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> Change Password</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-[1fr_auto]">
          <div className="space-y-2">
            <Label>New Password</Label>
            <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter a new password" />
          </div>
          <div className="flex items-end">
            <Button onClick={() => savePassword()} disabled={isSavingPassword || isLoading}>
              {isSavingPassword ? "Updating..." : "Update Password"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AgentSettings;

