import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, Column } from "@/components/shared/DataTable";
import { FormCard } from "@/components/shared/FormCard";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SearchableSelect from "@/components/shared/SearchableSelect";
import { useUserDirectory } from "@/hooks/useUserDirectory";
import { appRoleOptions, formatRoleLabel, setSingleUserRole, type AppUserRole } from "@/lib/userAccess";
import { toast } from "sonner";

interface RoleAssignment {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
}

const RoleList = () => {
  const [assignments, setAssignments] = useState<RoleAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("customer");
  const { users, userMap, isLoading: isLoadingUsers, refreshUsers } = useUserDirectory();

  const userOptions = useMemo(
    () =>
      users.map((user) => ({
        value: user.user_id,
        label: user.full_name || user.email || user.user_id,
        keywords: `${user.email || ""} ${user.user_id} ${user.roles.join(" ")}`.trim(),
        description: `${user.email || "No email"} • ${formatRoleLabel(user.primaryRole)}`,
      })),
    [users],
  );

  const fetchAssignments = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("user_roles")
      .select("id, user_id, role, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load role assignments.");
      setAssignments([]);
    } else {
      setAssignments(data || []);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    fetchAssignments();
  }, []);

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
      await fetchAssignments();
    }
    setIsSaving(false);
  };

  const columns: Column<RoleAssignment>[] = [
    {
      key: "user_id",
      label: "User",
      render: (item) => {
        const profile = userMap.get(item.user_id);
        if (!profile) {
          return item.user_id;
        }
        return (
          <div className="space-y-1">
            <p className="font-medium">{profile.full_name || "Unknown user"}</p>
            <p className="text-xs text-muted-foreground">{profile.email || item.user_id}</p>
          </div>
        );
      },
    },
    { key: "role", label: "Role", render: (item) => formatRoleLabel(item.role) },
    {
      key: "created_at",
      label: "Assigned",
      render: (item) => new Date(item.created_at).toLocaleString(),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Role Assignments"
        
      />

      <FormCard title="Assign Role">
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
              disabled={isLoadingUsers}
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
          <Button onClick={handleAssignRole} disabled={isSaving || isLoadingUsers}>
            {isSaving ? "Assigning..." : "Assign Role"}
          </Button>
        </div>
      </FormCard>

      <DataTable
        columns={columns}
        data={assignments}
        isLoading={isLoading || isLoadingUsers}
        searchable
        searchPlaceholder="Search users or roles..."
      />
    </div>
  );
};

export default RoleList;

