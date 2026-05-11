import { useState, useEffect } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DeleteDialog } from "@/components/shared/DeleteDialog";
import { toast } from "sonner";

interface UserWithRole {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: string;
  created_at: string;
  account_code: string | null;
  detail_summary: string;
}

const UserList = () => {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteItem, setDeleteItem] = useState<UserWithRole | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchUsers = async () => {
    setIsLoading(true);

    const [profilesRes, rolesRes, customersRes, driversRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("*"),
      supabase
        .from("customers")
        .select("user_id, code, city, country, company_name, company_phone, agent_id"),
      supabase
        .from("drivers")
        .select("user_id, code, vehicle_type, vehicle_plate, license_number"),
    ]);

    if (profilesRes.error) {
      toast.error("Failed to fetch users");
      setIsLoading(false);
      return;
    }

    if (rolesRes.error) {
      toast.error("Failed to fetch roles");
      setIsLoading(false);
      return;
    }

    if (customersRes.error) {
      toast.error("Failed to fetch customer accounts");
      setIsLoading(false);
      return;
    }

    if (driversRes.error) {
      toast.error("Failed to fetch driver accounts");
      setIsLoading(false);
      return;
    }

    const roleMap = new Map(rolesRes.data?.map((role) => [role.user_id, role.role]) || []);
    const customerAccountMap = new Map(
      (customersRes.data || []).map((customer) => [customer.user_id || "", customer]),
    );
    const driverAccountMap = new Map(
      (driversRes.data || []).map((driver) => [driver.user_id || "", driver]),
    );
    const agentPortfolioCount = new Map<string, number>();

    (customersRes.data || []).forEach((customer) => {
      if (!customer.agent_id) return;
      agentPortfolioCount.set(
        customer.agent_id,
        (agentPortfolioCount.get(customer.agent_id) || 0) + 1,
      );
    });

    const usersWithRoles: UserWithRole[] = (profilesRes.data || []).map((profile) => {
      const role = roleMap.get(profile.user_id) || "customer";
      const customerAccount = customerAccountMap.get(profile.user_id);
      const driverAccount = driverAccountMap.get(profile.user_id);

      let accountCode: string | null = null;
      let detailSummary = "System account";

      if (role === "customer") {
        accountCode = customerAccount?.code || null;
        const location = [customerAccount?.city, customerAccount?.country].filter(Boolean).join(", ");
        detailSummary =
          customerAccount?.company_name ||
          location ||
          customerAccount?.company_phone ||
          "Customer profile";
      } else if (role === "driver") {
        accountCode = driverAccount?.code || null;
        detailSummary =
          [driverAccount?.vehicle_type, driverAccount?.vehicle_plate].filter(Boolean).join(" - ") ||
          driverAccount?.license_number ||
          "Driver profile";
      } else if (role === "agent") {
        const managedClients = agentPortfolioCount.get(profile.user_id) || 0;
        detailSummary = `${managedClients} managed client${managedClients === 1 ? "" : "s"}`;
      } else if (role === "staff" || role === "branch_manager") {
        detailSummary = "Operational staff account";
      } else if (role === "admin") {
        detailSummary = "Administrative account";
      }

      return {
        id: profile.id,
        user_id: profile.user_id,
        full_name: profile.full_name,
        email: profile.email,
        phone: profile.phone,
        role,
        created_at: profile.created_at,
        account_code: accountCode,
        detail_summary: detailSummary,
      };
    });

    setUsers(usersWithRoles);
    setIsLoading(false);
  };

  useEffect(() => {
    void fetchUsers();
  }, []);

  const handleDelete = async () => {
    if (!deleteItem) return;
    setIsDeleting(true);

    const { error } = await supabase.functions.invoke("admin-delete-user", {
      body: { user_id: deleteItem.user_id },
    });

    if (error) {
      toast.error("Failed to delete user account");
    } else {
      toast.success("User account deleted");
      await fetchUsers();
    }
    setIsDeleting(false);
    setDeleteItem(null);
  };

  const columns: Column<UserWithRole>[] = [
    { key: "full_name", label: "Name" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    {
      key: "role",
      label: "Role",
      render: (item) => (
        <StatusBadge
          status={
            item.role === "admin"
              ? "active"
              : item.role === "staff" || item.role === "branch_manager"
              ? "pending"
              : "inactive"
          }
          label={item.role.replace("_", " ")}
        />
      ),
    },
    {
      key: "account_code",
      label: "Account Code",
      render: (item) => item.account_code || "-",
    },
    {
      key: "detail_summary",
      label: "Account Details",
      render: (item) => (
        <span className="text-sm text-muted-foreground">{item.detail_summary}</span>
      ),
    },
    {
      key: "created_at",
      label: "Created",
      render: (item) => format(new Date(item.created_at), "dd MMM yyyy"),
    },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="User Management"
        
        createLink="/users/create"
        createLabel="Create New User"
      />
      <DataTable
        columns={columns}
        data={users}
        isLoading={isLoading}
        searchPlaceholder="Search users..."
        editLink={(item) => `/users/${item.id}/edit`}
        onDelete={(item) => setDeleteItem(item)}
      />
      <DeleteDialog
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        title="Delete User"
        description="Are you sure you want to delete this user? This action cannot be undone."
      />
    </div>
  );
};

export default UserList;

