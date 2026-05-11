import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { FormCard } from "@/components/shared/FormCard";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SearchableSelect from "@/components/shared/SearchableSelect";
import { useUserDirectory } from "@/hooks/useUserDirectory";
import { appRoleOptions, formatRoleLabel, setSingleUserRole, type AppUserRole } from "@/lib/userAccess";
import { toast } from "sonner";

const RoleCreate = () => {
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("customer");
  const [isSaving, setIsSaving] = useState(false);
  const { users, userMap, isLoading, refreshUsers } = useUserDirectory();

  const userOptions = users.map((user) => ({
    value: user.user_id,
    label: user.full_name || user.email || user.user_id,
    keywords: `${user.email || ""} ${user.user_id} ${user.roles.join(" ")}`.trim(),
    description: `${user.email || "No email"} • ${formatRoleLabel(user.primaryRole)}`,
  }));

  const handleAssignRole = async () => {
    if (!userId.trim()) {
      toast.error("Select a user first.");
      return;
    }
    setIsSaving(true);
    const { error } = await setSingleUserRole(
      supabase,
      userId.trim(),
      role as AppUserRole,
    );

    if (error) {
      toast.error(error || "Failed to assign role.");
    } else {
      toast.success("Role assigned.");
      setUserId("");
      setRole("customer");
      await refreshUsers();
    }
    setIsSaving(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Assign Role"
        
      />

      <FormCard title="Role Assignment">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium">User</label>
            <SearchableSelect
              value={userId}
              onValueChange={setUserId}
              options={userOptions}
              placeholder="Select a user"
              searchPlaceholder="Search users..."
              emptyMessage="No users found."
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Role</label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
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
        </div>
        {userId ? (
          <p className="text-xs text-muted-foreground">
            Current role: {formatRoleLabel(userMap.get(userId)?.primaryRole || "customer")}
          </p>
        ) : null}
        <div className="mt-4 flex justify-end">
          <Button onClick={handleAssignRole} disabled={isSaving || isLoading}>
            {isSaving ? "Assigning..." : "Assign Role"}
          </Button>
        </div>
      </FormCard>
    </div>
  );
};

export default RoleCreate;

