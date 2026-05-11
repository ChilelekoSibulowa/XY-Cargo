import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  DRIVER_INCIDENT_CATEGORIES,
  formatSupportLabel,
  isDriverIncidentCategory,
  type SupportTicketRow,
} from "@/lib/supportTickets";
import { getWarehouseTrackingNumber, resolveTrackingByStatus } from "@/lib/shipmentNotes";

const ticketSelect =
  "id, ticket_code, customer_id, shipment_id, subject, description, category, priority, status, assigned_to, resolution_notes, created_by, escalated_to_department, escalated_at, created_at, updated_at, customer:customers(full_name, code), shipment:shipments(id, code, custom_tracking_number, notes, status)";

const DriverIncidentReports = () => {
  const [rows, setRows] = useState<SupportTicketRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadRows = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("support_tickets")
        .select(ticketSelect)
        .in("category", [...DRIVER_INCIDENT_CATEGORIES])
        .order("updated_at", { ascending: false });

      if (error) throw error;

      const actorIds = Array.from(
        new Set(
          ((data || []) as SupportTicketRow[])
            .flatMap((row) => [row.created_by, row.assigned_to])
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

      const normalizedRows = ((data || []) as SupportTicketRow[])
        .map((row) => ({
          ...row,
          requester_name: row.created_by ? profileMap.get(row.created_by) || "Driver" : "Driver",
          requester_role: row.created_by ? roleMap.get(row.created_by) || "driver" : "driver",
          assigned_name: row.assigned_to ? profileMap.get(row.assigned_to) || null : null,
        }))
        .filter((row) => row.requester_role === "driver" || isDriverIncidentCategory(row.category));

      setRows(normalizedRows);
    } catch (error: any) {
      toast.error(error?.message || "Failed to load incident reports.");
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
  }, []);

  const metrics = useMemo(
    () => ({
      open: rows.filter((row) => ["open", "in_progress"].includes(row.status)).length,
      urgent: rows.filter((row) => ["high", "urgent"].includes(row.priority)).length,
      unresolved: rows.filter((row) => !["resolved", "closed"].includes(row.status)).length,
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
      key: "requester_name",
      label: "Driver",
      render: (row) => row.requester_name || "Driver",
    },
    {
      key: "subject",
      label: "Subject",
    },
    {
      key: "category",
      label: "Incident Type",
      render: (row) => <Badge variant="outline">{formatSupportLabel(row.category)}</Badge>,
    },
    {
      key: "shipment",
      label: "Linked Delivery",
      render: (row) => {
        const shipment = (Array.isArray(row.shipment) ? row.shipment[0] : row.shipment) as any;
        if (!shipment) return "Unlinked";
        const warehouseTracking = getWarehouseTrackingNumber(shipment.notes) || resolveTrackingByStatus(shipment.status, shipment.notes, shipment.custom_tracking_number);
        return warehouseTracking || shipment.code || "Unlinked";
      },
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
      key: "updated_at",
      label: "Updated",
      render: (row) => format(new Date(row.updated_at), "PP p"),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Incident Reports"
        
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Open Incidents</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{isLoading ? "..." : metrics.open}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Urgent</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{isLoading ? "..." : metrics.urgent}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Unresolved</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{isLoading ? "..." : metrics.unresolved}</CardContent>
        </Card>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        searchPlaceholder="Search incident reports..."
        viewLink={(row) => `/support/tickets/${row.id}`}
      />
    </div>
  );
};

export default DriverIncidentReports;

