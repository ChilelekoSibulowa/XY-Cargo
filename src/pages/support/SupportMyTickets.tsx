import { useEffect, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useAuthContext } from "@/components/auth/AuthContext";
import { formatSupportLabel } from "@/lib/supportTickets";

type Row = {
  id: string;
  ticket_code: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  updated_at: string;
};

const SupportMyTickets = () => {
  const { user } = useAuthContext();
  const [rows, setRows] = useState<Row[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRows([]);
      setIsLoading(false);
      return;
    }

    supabase
      .from("support_tickets")
      .select("id, ticket_code, subject, category, priority, status, updated_at")
      .eq("assigned_to", user.id)
      .order("updated_at", { ascending: false })
      .then(({ data }) => {
        setRows((data as Row[] | null) || []);
        setIsLoading(false);
      });
  }, [user]);

  const columns: Column<Row>[] = [
    {
      key: "ticket_code",
      label: "Ticket",
      render: (row) => <span className="font-mono text-xs">{row.ticket_code}</span>,
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
      key: "updated_at",
      label: "Updated",
      render: (row) => format(new Date(row.updated_at), "PP p"),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="My Tickets"
        
      />
      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        searchPlaceholder="Search my tickets..."
        viewLink={(row) => `/support/tickets/${row.id}`}
      />
    </div>
  );
};

export default SupportMyTickets;

