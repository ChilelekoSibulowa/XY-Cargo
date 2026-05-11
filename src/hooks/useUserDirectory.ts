import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getHighestRole } from "@/lib/userAccess";

type ProfileRow = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
};

type RoleRow = {
  user_id: string;
  role: string;
};

export type UserDirectoryEntry = ProfileRow & {
  roles: string[];
  primaryRole: string;
};

export const useUserDirectory = () => {
  const [users, setUsers] = useState<UserDirectoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUsers = async () => {
    setIsLoading(true);

    const [{ data: profiles, error: profileError }, { data: roles, error: roleError }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, full_name, email, phone")
          .order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
      ]);

    if (profileError || roleError) {
      setUsers([]);
      setIsLoading(false);
      return;
    }

    const roleMap = new Map<string, string[]>();
    ((roles || []) as RoleRow[]).forEach((row) => {
      const nextRoles = roleMap.get(row.user_id) || [];
      nextRoles.push(row.role);
      roleMap.set(row.user_id, nextRoles);
    });

    const nextUsers = ((profiles || []) as ProfileRow[]).map((profile) => {
      const rolesForUser = roleMap.get(profile.user_id) || ["customer"];
      return {
        ...profile,
        roles: rolesForUser,
        primaryRole: getHighestRole(rolesForUser),
      };
    });

    setUsers(nextUsers);
    setIsLoading(false);
  };

  useEffect(() => {
    void refreshUsers();
  }, []);

  const userMap = useMemo(
    () => new Map(users.map((user) => [user.user_id, user])),
    [users],
  );

  return { users, userMap, isLoading, refreshUsers };
};
