import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentDriverContext } from "@/lib/driverPortal";
import TwoFactorAuthCard from "@/components/settings/TwoFactorAuthCard";

const DriverSettings = () => {
  const [driverId, setDriverId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    vehicleType: "",
    vehiclePlate: "",
    weeklyFuelConsumption: "",
  });
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { user, driver } = await getCurrentDriverContext();
        setDriverId(driver?.id || null);
        setUserId(user?.id || null);

        if (!user || !driver) {
          setIsLoading(false);
          return;
        }

        setForm({
          fullName: driver.full_name || "",
          email: driver.email || user.email || "",
          phone: driver.phone || "",
          vehicleType: driver.vehicle_type || "",
          vehiclePlate: driver.vehicle_plate || "",
          weeklyFuelConsumption: String(
            Number(user.user_metadata?.driver_weekly_fuel_consumption || 0) || 0,
          ),
        });
      } catch (error: any) {
        toast.error(error?.message || "Failed to load driver settings.");
      } finally {
        setIsLoading(false);
      }
    };

    void loadSettings();
  }, []);

  const handleSaveProfile = async () => {
    if (!driverId || !userId) {
      toast.error("Driver profile not found.");
      return;
    }
    if (!form.fullName.trim() || !form.email.trim() || !form.phone.trim()) {
      toast.error("Full name, email, and phone are required.");
      return;
    }

    setIsSavingProfile(true);

    try {
      const driverUpdate = await supabase
        .from("drivers")
        .update({
          full_name: form.fullName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          vehicle_type: form.vehicleType.trim() || null,
          vehicle_plate: form.vehiclePlate.trim() || null,
        })
        .eq("id", driverId);

      if (driverUpdate.error) throw driverUpdate.error;

      const profileUpdate = await supabase
        .from("profiles")
        .update({
          full_name: form.fullName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
        })
        .eq("user_id", userId);

      if (profileUpdate.error) throw profileUpdate.error;

      const metadataUpdate = await supabase.auth.updateUser({
        email: form.email.trim(),
        data: {
          full_name: form.fullName.trim(),
          driver_weekly_fuel_consumption: Number(form.weeklyFuelConsumption || 0),
        },
      });

      if (metadataUpdate.error) throw metadataUpdate.error;

      toast.success("Driver settings updated.");
    } catch (error: any) {
      toast.error(error?.message || "Failed to update driver settings.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleDriverMfaChange = async (enabled: boolean) => {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      throw userError;
    }

    const { error } = await supabase.auth.updateUser({
      data: {
        ...(user?.user_metadata || {}),
        mfa_enabled: enabled,
        driver_mfa_enabled: enabled,
      },
    });

    if (error) {
      throw error;
    }
  };

  const handleSavePassword = async () => {
    if (newPassword.trim().length < 6) {
      toast.error("Use at least 6 characters for the new password.");
      return;
    }

    setIsSavingPassword(true);

    const { error } = await supabase.auth.updateUser({
      password: newPassword.trim(),
    });

    if (error) {
      toast.error(error.message || "Failed to update password.");
    } else {
      toast.success("Password updated.");
      setNewPassword("");
    }

    setIsSavingPassword(false);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Driver Settings"  />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Driver Settings"
        
      />

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>Update Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="driver-full-name">Full Name</Label>
              <Input
                id="driver-full-name"
                value={form.fullName}
                onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="driver-email">Email</Label>
              <Input
                id="driver-email"
                type="email"
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="driver-phone">Phone</Label>
              <Input
                id="driver-phone"
                value={form.phone}
                onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="driver-vehicle-type">Vehicle Type</Label>
              <Input
                id="driver-vehicle-type"
                value={form.vehicleType}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, vehicleType: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="driver-vehicle-plate">Vehicle Plate</Label>
              <Input
                id="driver-vehicle-plate"
                value={form.vehiclePlate}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, vehiclePlate: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="driver-fuel">Weekly Fuel Consumption (L)</Label>
              <Input
                id="driver-fuel"
                type="number"
                min="0"
                step="0.1"
                value={form.weeklyFuelConsumption}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    weeklyFuelConsumption: event.target.value,
                  }))
                }
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveProfile} disabled={isSavingProfile}>
              {isSavingProfile ? "Saving..." : "Save Profile"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <TwoFactorAuthCard
        portalLabel="Driver Portal"
        accountLabel={form.email}
        onEnabledChange={handleDriverMfaChange}
      />

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 md:max-w-md">
            <Label htmlFor="driver-password">New Password</Label>
            <Input
              id="driver-password"
              type="password"
              minLength={6}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="Use at least 6 characters"
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSavePassword} disabled={isSavingPassword}>
              {isSavingPassword ? "Updating..." : "Update Password"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DriverSettings;

