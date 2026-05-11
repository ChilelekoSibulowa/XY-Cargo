import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, Column } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { differenceInHours, format } from "date-fns";

type Row = { id: string; ticket_code: string; subject: string; priority: string; status: string; created_at: string; updated_at: string; hours_open?: number };

const SupportSlaMonitoring = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.from("support_tickets").select("id, ticket_code, subject, priority, status, created_at, updated_at").in("status", ["open", "in_progress"]).order("created_at", { ascending: true }).then(({ data }) => {
      setRows((data || []).map((d: any) => ({ ...d, hours_open: differenceInHours(new Date(), new Date(d.created_at)) })));
      setIsLoading(false);
    });
  }, []);

  const breached = useMemo(() => rows.filter((r) => (r.hours_open || 0) > 48).length, [rows]);
  const atRisk = useMemo(() => rows.filter((r) => (r.hours_open || 0) > 24 && (r.hours_open || 0) <= 48).length, [rows]);

  const columns: Column<Row>[] = [
    { key: "ticket_code", label: "Code", render: (r) => <span className="font-mono text-xs">{r.ticket_code}</span> },
    { key: "subject", label: "Subject" },
    { key: "priority", label: "Priority", render: (r) => <Badge variant={r.priority === "high" || r.priority === "urgent" ? "destructive" : "secondary"}>{r.priority}</Badge> },
    { key: "hours_open", label: "Hours Open", render: (r) => {
      const h = r.hours_open || 0;
      return <span className={h > 48 ? "text-destructive font-bold" : h > 24 ? "text-yellow-600 font-semibold" : ""}>{h}h</span>;
    }},
    { key: "status", label: "Status", render: (r) => <Badge variant="outline">{r.status}</Badge> },
    { key: "created_at", label: "Opened", render: (r) => format(new Date(r.created_at), "PP p") },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="SLA Monitoring"  />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Open Tickets</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{rows.length}</p></CardContent></Card>
        <Card className="border-l-4 border-l-red-500"><CardHeader className="pb-2"><CardTitle className="text-sm">SLA Breached (&gt;48h)</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-destructive">{breached}</p></CardContent></Card>
        <Card className="border-l-4 border-l-yellow-500"><CardHeader className="pb-2"><CardTitle className="text-sm">At Risk (24-48h)</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{atRisk}</p></CardContent></Card>
        <Card className="border-l-4 border-l-green-500"><CardHeader className="pb-2"><CardTitle className="text-sm">On Track (&lt;24h)</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{rows.length - breached - atRisk}</p></CardContent></Card>
      </div>
      <DataTable columns={columns} data={rows} isLoading={isLoading} searchPlaceholder="Search tickets..." />
    </div>
  );
};

export default SupportSlaMonitoring;

