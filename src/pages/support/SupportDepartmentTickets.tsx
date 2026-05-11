import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { format } from "date-fns";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  formatSupportLabel,
  getDepartmentRouteLabel,
  type SupportTicketRow,
} from "@/lib/supportTickets";

const ticketSelect =
  "id, ticket_code, customer_id, shipment_id, subject, description, category, priority, status, assigned_to, resolution_notes, created_by, escalated_to_department, escalated_at, created_at, updated_at, customer:customers(full_name, code)";

const SupportDepartmentTickets = () => {
  const { department = "support" } = useParams<{ department: string }>();
  const [rows, setRows] = useState<SupportTicketRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadRows = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from("support_tickets")
        .select(ticketSelect)
        .order("updated_at", { ascending: false });

      if (department === "support") {
        query = query.or("escalated_to_department.is.null,escalated_to_department.eq.support");
      } else {
        query = query.eq("escalated_to_department", department);
      }

      const { data, error } = await query;
      if (error) throw error;

      const actorIds = Array.from(
        new Set(
          ((data || []) as SupportTicketRow[])
            .map((row) => row.assigned_to)
            .filter((value): value is string => Boolean(value)),
        ),
      );

      const profileMap = new Map<string, string>();
      if (actorIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", actorIds);

        (profiles || []).forEach((profile) => {
          profileMap.set(profile.user_id, profile.full_name);
        });
      }

      setRows(
        ((data || []) as SupportTicketRow[]).map((row) => ({
          ...row,
          assigned_name: row.assigned_to ? profileMap.get(row.assigned_to) || null : null,
        })),
      );
    } catch (error: any) {
      toast.error(error?.message || "Failed to load department tickets.");
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
  }, [department]);

  const metrics = useMemo(
    () => ({
      open: rows.filter((row) => ["open", "in_progress"].includes(row.status)).length,
      unassigned: rows.filter((row) => !row.assigned_to).length,
      urgent: rows.filter((row) => ["high", "urgent"].includes(row.priority)).length,
    }),
    [rows],
  );

  const columns: Column<SupportTicketRow>[] = [
    {
      key: "ticket_code",
      label: "Ticket",
      render: (row) => <span className="font-mono text-xs">{row.ticket_code}</span>,
    },
    {
      key: "customer",
      label: "Customer",
      render: (row) => {
        const customer = Array.isArray(row.customer) ? row.customer[0] : row.customer;
        return customer?.full_name || customer?.code || "Unlinked";
      },
    },
    { key: "subject", label: "Subject" },
    {
      key: "category",
      label: "Category",
      render: (row) => <Badge variant="outline">{formatSupportLabel(row.category)}</Badge>,
    },
    {
      key: "priority",
      label: "Priority",
      render: (row) => <Badge variant="outline">{formatSupportLabel(row.priority)}</Badge>,
    },
    {
      key: "status",
      label: "Status",
      render: (row) => <StatusBadge status={row.status} label={formatSupportLabel(row.status)} />,
    },
    {
      key: "assigned_name",
      label: "Assigned To",
      render: (row) => row.assigned_name || "Unassigned",
    },
    {
      key: "updated_at",
      label: "Updated",
      render: (row) => format(new Date(row.updated_at), "PP p"),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={getDepartmentRouteLabel(department)}
        
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
        data={rows}
        isLoading={isLoading}
        searchPlaceholder={`Search ${department} tickets...`}
        viewLink={(row) => `/support/tickets/${row.id}`}
      />
    </div>
  );
};

export default SupportDepartmentTickets;

