import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type TicketRow = {
  id: string;
  status: string;
  priority: string;
  category: string;
  created_at: string;
  updated_at: string;
  assigned_to: string | null;
};

const SupportReports = () => {
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTickets = async () => {
      const { data } = await supabase
        .from("support_tickets")
        .select("id, status, priority, category, created_at, updated_at, assigned_to");

      setTickets((data || []) as TicketRow[]);
      setIsLoading(false);
    };
    fetchTickets();
  }, []);

  const totals = useMemo(() => {
    const total = tickets.length;
    const open = tickets.filter((t) => ["open", "in_progress"].includes(t.status)).length;
    const resolved = tickets.filter((t) => ["resolved", "closed"].includes(t.status)).length;
    const escalated = tickets.filter((t) => ["high", "urgent"].includes(t.priority)).length;

    const resolvedTickets = tickets.filter((t) => ["resolved", "closed"].includes(t.status));
    const avgResolutionHours = resolvedTickets.length
      ? resolvedTickets.reduce((sum, t) => sum + (new Date(t.updated_at).getTime() - new Date(t.created_at).getTime()) / 36e5, 0) / resolvedTickets.length
      : 0;

    const recent30 = new Date();
    recent30.setDate(recent30.getDate() - 30);
    const last30Days = tickets.filter((t) => new Date(t.created_at) >= recent30).length;

    return { total, open, resolved, escalated, avgResolutionHours, last30Days };
  }, [tickets]);

  const categorySummary = useMemo(() => {
    const map: Record<string, number> = {};
    tickets.forEach((t) => {
      const key = t.category || "uncategorized";
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [tickets]);

  const prioritySummary = useMemo(() => {
    const map: Record<string, number> = {};
    tickets.forEach((t) => {
      const key = t.priority || "normal";
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [tickets]);

  const statusSummary = useMemo(() => {
    const map: Record<string, number> = {};
    tickets.forEach((t) => {
      const key = t.status || "open";
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [tickets]);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Reports (Limited)"  />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Total Tickets</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{isLoading ? "..." : totals.total}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Open Tickets</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{isLoading ? "..." : totals.open}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Resolved Tickets</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{isLoading ? "..." : totals.resolved}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Escalations</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{isLoading ? "..." : totals.escalated}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Avg Resolution (hrs)</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{isLoading ? "..." : totals.avgResolutionHours.toFixed(1)}</p></CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Ticket Categories</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {categorySummary.map(([category, count]) => (
              <div key={category} className="flex items-center justify-between">
                <span className="capitalize">{category.replace("_", " ")}</span>
                <span className="font-semibold">{count}</span>
              </div>
            ))}
            {categorySummary.length === 0 && <p className="text-muted-foreground">No ticket data.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Priority Breakdown</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {prioritySummary.map(([priority, count]) => (
              <div key={priority} className="flex items-center justify-between">
                <span className="capitalize">{priority}</span>
                <Badge variant={["high", "urgent"].includes(priority) ? "destructive" : "secondary"}>{count}</Badge>
              </div>
            ))}
            {prioritySummary.length === 0 && <p className="text-muted-foreground">No ticket data.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Status Summary</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {statusSummary.map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <span className="capitalize">{status.replace("_", " ")}</span>
                <span className="font-semibold">{count}</span>
              </div>
            ))}
            {statusSummary.length === 0 && <p className="text-muted-foreground">No ticket data.</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Last 30 Days</CardTitle></CardHeader>
        <CardContent>
          <p className="text-lg font-semibold">{isLoading ? "..." : totals.last30Days} tickets created</p>
          <p className="text-sm text-muted-foreground">Limited report view (snapshot only).</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default SupportReports;

