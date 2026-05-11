import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FormCard } from "@/components/shared/FormCard";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { appRoleOptions, getHighestRole, setSingleUserRole, type AppUserRole } from "@/lib/userAccess";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

const UserEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    role: "customer",
    user_id: "",
    commission_rate_kg: 0.5,
    commission_rate_cbm: 10.0,
  });

  useEffect(() => {
    const fetchUser = async () => {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", id)
        .single();

      if (error || !profile) {
        toast.error("User not found");
        navigate("/users");
        return;
      }

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", profile.user_id);

      setForm({
        full_name: profile.full_name,
        email: profile.email,
        phone: profile.phone || "",
        role: getHighestRole((roleData || []).map((item) => item.role)),
        user_id: profile.user_id,
        commission_rate_kg: profile.commission_rate_kg ?? 0.5,
        commission_rate_cbm: profile.commission_rate_cbm ?? 10.0,
      });
      setIsLoading(false);
    };

    fetchUser();
  }, [id, navigate]);

  const handleSubmit = async () => {
    if (!form.full_name || !form.email) {
      toast.error("Please fill in required fields");
      return;
    }

    setIsSaving(true);

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        full_name: form.full_name,
        phone: form.phone || null,
        commission_rate_kg: form.role === "agent" ? form.commission_rate_kg : null,
        commission_rate_cbm: form.role === "agent" ? form.commission_rate_cbm : null,
      })
      .eq("id", id);

    if (profileError) {
      toast.error("Failed to update profile");
      setIsSaving(false);
      return;
    }

    const { error: roleError } = await setSingleUserRole(
      supabase,
      form.user_id,
      form.role as AppUserRole,
    );

    if (roleError) {
      toast.error(roleError || "Failed to update role");
      setIsSaving(false);
      return;
    }

    toast.success("User updated successfully");
    navigate("/users");
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <FormCard
      title="Edit User"
      
      backLink="/users"
      onSubmit={handleSubmit}
      isLoading={isSaving}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="full_name">Full Name *</Label>
          <Input
            id="full_name"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={form.email} disabled className="bg-muted" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="role">Role *</Label>
          <Select value={form.role} onValueChange={(value) => setForm({ ...form, role: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {appRoleOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {form.role === "agent" && (
          <>
            <div className="space-y-2">
              <Label htmlFor="commission_rate_kg">Commission Rate per KG (USD) *</Label>
              <Input
                id="commission_rate_kg"
                type="number"
                step="0.01"
                value={form.commission_rate_kg}
                onChange={(e) => setForm({ ...form, commission_rate_kg: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="commission_rate_cbm">Commission Rate per CBM (USD) *</Label>
              <Input
                id="commission_rate_cbm"
                type="number"
                step="0.01"
                value={form.commission_rate_cbm}
                onChange={(e) => setForm({ ...form, commission_rate_cbm: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>
          </>
        )}
      </div>
    </FormCard>
  );
};

export default UserEdit;

