import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type AppUserRole =
  | "admin"
  | "staff"
  | "branch_manager"
  | "agent"
  | "customer"
  | "driver";

type UserRoleRow = {
  id: string;
  user_id: string;
  role: AppUserRole;
};

export const appRoleOptions: Array<{ value: AppUserRole; label: string }> = [
  { value: "admin", label: "Admin" },
  { value: "staff", label: "Staff" },
  { value: "branch_manager", label: "Warehouse Manager" },
  { value: "agent", label: "Agent" },
  { value: "customer", label: "Customer" },
  { value: "driver", label: "Driver" },
];

const appRolePriority: AppUserRole[] = [
  "admin",
  "staff",
  "branch_manager",
  "agent",
  "driver",
  "customer",
];

export const getHighestRole = (roles: string[]) =>
  appRolePriority.find((role) => roles.includes(role)) || "customer";

export const formatRoleLabel = (role: string) =>
  role
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export const setSingleUserRole = async (
  supabase: SupabaseClient<Database>,
  userId: string,
  nextRole: AppUserRole,
) => {
  const { data: existingRows, error: fetchError } = await supabase
    .from("user_roles")
    .select("id, user_id, role")
    .eq("user_id", userId);

  if (fetchError) {
    return { error: fetchError.message };
  }

  const rows = ((existingRows || []) as UserRoleRow[]).sort(
    (left, right) =>
      appRolePriority.indexOf(left.role) - appRolePriority.indexOf(right.role),
  );

  const matchingRow = rows.find((row) => row.role === nextRole);

  if (matchingRow) {
    const rowsToDelete = rows.filter((row) => row.id !== matchingRow.id).map((row) => row.id);
    if (rowsToDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from("user_roles")
        .delete()
        .in("id", rowsToDelete);

      if (deleteError) {
        return { error: deleteError.message };
      }
    }

    return { error: null };
  }

  if (rows.length > 0) {
    const primaryRow = rows[0];
    const { error: updateError } = await supabase
      .from("user_roles")
      .update({ role: nextRole })
      .eq("id", primaryRow.id);

    if (updateError) {
      return { error: updateError.message };
    }

    const rowsToDelete = rows.filter((row) => row.id !== primaryRow.id).map((row) => row.id);
    if (rowsToDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from("user_roles")
        .delete()
        .in("id", rowsToDelete);

      if (deleteError) {
        return { error: deleteError.message };
      }
    }

    return { error: null };
  }

  const { error: insertError } = await supabase
    .from("user_roles")
    .insert({ user_id: userId, role: nextRole });

  if (insertError) {
    return { error: insertError.message };
  }

  return { error: null };
};
