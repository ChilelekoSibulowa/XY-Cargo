import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  SUPPORT_TICKET_DEPARTMENTS,
  SUPPORT_TICKET_STATUSES,
  formatSupportLabel,
  type SupportTicketRow,
} from "@/lib/supportTickets";

const selectQuery =
  "id, ticket_code, customer_id, shipment_id, subject, description, category, priority, status, assigned_to, resolution_notes, created_by, escalated_to_department, escalated_at, created_at, updated_at, customer:customers(full_name, code)";

const SupportTickets = () => {
  const [tickets, setTickets] = useState<SupportTicketRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");

  const fetchTickets = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from("support_tickets")
        .select(selectQuery)
        .order("updated_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      if (departmentFilter !== "all") {
        if (departmentFilter === "support") {
          query = query.or("escalated_to_department.is.null,escalated_to_department.eq.support");
        } else {
          query = query.eq("escalated_to_department", departmentFilter);
        }
      }

      const { data, error } = await query;
      if (error) throw error;

      const actorIds = Array.from(
        new Set(
          ((data || []) as SupportTicketRow[])
            .flatMap((item) => [item.created_by, item.assigned_to])
            .filter((value): value is string => Boolean(value)),
        ),
      );

      const [profilesRes, rolesRes] = actorIds.length
        ? await Promise.all([
            supabase.from("profiles").select("user_id, full_name").in("user_id", actorIds),
            supabase.from("user_roles").select("user_id, role").in("user_id", actorIds),
          ])
        : [
            { data: [], error: null },
            { data: [], error: null },
          ];

      const profileMap = new Map(
        ((profilesRes.data || []) as { user_id: string; full_name: string | null }[]).map((row) => [
          row.user_id,
          row.full_name,
        ]),
      );
      const roleMap = new Map(
        ((rolesRes.data || []) as { user_id: string; role: string }[]).map((row) => [
          row.user_id,
          row.role,
        ]),
      );

      setTickets(
        ((data || []) as SupportTicketRow[]).map((item) => {
          const customer = Array.isArray(item.customer) ? item.customer[0] : item.customer;
          return {
            ...item,
            requester_name:
              (item.created_by ? profileMap.get(item.created_by) : null) ||
              customer?.full_name ||
              "Unknown requester",
            requester_role:
              (item.created_by ? roleMap.get(item.created_by) : null) ||
              (customer ? "customer" : "system"),
            assigned_name: item.assigned_to ? profileMap.get(item.assigned_to) || null : null,
          };
        }),
      );
    } catch (error: any) {
      toast.error(error?.message || "Failed to load tickets.");
      setTickets([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchTickets();
  }, [statusFilter, departmentFilter]);

  const metrics = useMemo(
    () => ({
      open: tickets.filter((ticket) => ["open", "in_progress"].includes(ticket.status)).length,
      unassigned: tickets.filter((ticket) => !ticket.assigned_to).length,
      urgent: tickets.filter((ticket) => ["high", "urgent"].includes(ticket.priority)).length,
    }),
    [tickets],
  );

  const columns: Column<SupportTicketRow>[] = [
    {
      key: "ticket_code",
      label: "Ticket",
      render: (item) => <span className="font-mono text-xs">{item.ticket_code}</span>,
    },
    {
      key: "requester_name",
      label: "Requester",
      render: (item) => (
        <div className="space-y-1">
          <p className="font-medium">{item.requester_name}</p>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {formatSupportLabel(item.requester_role)}
          </p>
        </div>
      ),
    },
    { key: "subject", label: "Subject" },
    {
      key: "category",
      label: "Category",
      render: (item) => <Badge variant="outline">{formatSupportLabel(item.category)}</Badge>,
    },
    {
      key: "priority",
      label: "Priority",
      render: (item) => <Badge variant="outline">{formatSupportLabel(item.priority)}</Badge>,
    },
    {
      key: "status",
      label: "Status",
      render: (item) => <StatusBadge status={item.status} label={formatSupportLabel(item.status)} />,
    },
    {
      key: "department",
      label: "Queue",
      render: (item) => formatSupportLabel(item.escalated_to_department || "support"),
    },
    {
      key: "assigned_name",
      label: "Assigned To",
      render: (item) => item.assigned_name || "Unassigned",
    },
    {
      key: "updated_at",
      label: "Updated",
      render: (item) => format(new Date(item.updated_at), "PP p"),
    },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="All Tickets"
        
        createLink="/support/tickets/create"
        createLabel="Create Ticket"
        actions={
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {SUPPORT_TICKET_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {formatSupportLabel(status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by queue" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All queues</SelectItem>
                {SUPPORT_TICKET_DEPARTMENTS.map((department) => (
                  <SelectItem key={department} value={department}>
                    {formatSupportLabel(department)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Open Tickets</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{isLoading ? "..." : metrics.open}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Unassigned</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{isLoading ? "..." : metrics.unassigned}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">High Priority</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{isLoading ? "..." : metrics.urgent}</CardContent>
        </Card>
      </div>

      <DataTable
        columns={columns}
        data={tickets}
        isLoading={isLoading}
        searchPlaceholder="Search tickets..."
        viewLink={(item) => `/support/tickets/${item.id}`}
      />
    </div>
  );
};

export default SupportTickets;

