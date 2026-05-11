import { useEffect, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatSupportLabel } from "@/lib/supportTickets";

type Row = {
  id: string;
  ticket_code: string;
  subject: string;
  priority: string;
  status: string;
  created_at: string;
  escalated_to_department: string | null;
  customer_name?: string;
};

const SupportEscalated = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("support_tickets")
      .select("id, ticket_code, subject, priority, status, created_at, escalated_to_department, customers(full_name)")
      .or("priority.in.(high,urgent),escalated_to_department.not.is.null")
      .order("updated_at", { ascending: false })
      .then(({ data }) => {
        setRows(
          ((data || []) as any[]).map((row) => ({
            ...row,
            customer_name: row.customers?.full_name || "-",
          })),
        );
        setIsLoading(false);
      });
  }, []);

  const columns: Column<Row>[] = [
    {
      key: "ticket_code",
      label: "Ticket",
      render: (row) => <span className="font-mono text-xs">{row.ticket_code}</span>,
    },
    { key: "customer_name", label: "Customer" },
    { key: "subject", label: "Subject" },
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
      key: "escalated_to_department",
      label: "Queue",
      render: (row) => formatSupportLabel(row.escalated_to_department || "support"),
    },
    {
      key: "created_at",
      label: "Created",
      render: (row) => format(new Date(row.created_at), "PP p"),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Escalated Tickets"
        
      />
      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        searchPlaceholder="Search escalated tickets..."
        viewLink={(row) => `/support/tickets/${row.id}`}
      />
    </div>
  );
};

export default SupportEscalated;

