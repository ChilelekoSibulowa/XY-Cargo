import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { differenceInHours, format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuthContext } from "@/components/auth/AuthContext";
import { toast } from "sonner";
import { AlertTriangle, BarChart3, Clock, MessageSquare, Package, Plus, Ticket, Users } from "lucide-react";

type TicketRow = {
  id: string;
  status: string;
  priority: string;
  category: string;
  subject: string;
  created_at: string;
  updated_at: string;
  assigned_to: string | null;
};

type ProfileRow = { user_id: string; full_name: string | null; email: string | null };
type NotificationRow = { id: string; title: string; message: string; created_at: string };

const SupportDashboard = () => {
  const { user } = useAuthContext();
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [messages, setMessages] = useState<NotificationRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const [ticketsRes, profilesRes, notificationsRes] = await Promise.all([
        supabase.from("support_tickets").select("id, status, priority, category, subject, created_at, updated_at, assigned_to").order("created_at", { ascending: false }),
        supabase.from("profiles").select("user_id, full_name, email"),
        supabase.from("notifications").select("id, title, message, created_at").order("created_at", { ascending: false }).limit(6),
      ]);

      if (ticketsRes.error || profilesRes.error || notificationsRes.error) {
        toast.error("Failed to load support dashboard data.");
      }
      setTickets((ticketsRes.data || []) as TicketRow[]);
      setProfiles((profilesRes.data || []) as ProfileRow[]);
      setMessages((notificationsRes.data || []) as NotificationRow[]);
      setIsLoading(false);
    };
    fetchData();
  }, []);

  const openTickets = tickets.filter((t) => ["open", "in_progress"].includes(t.status));
  const resolvedTickets = tickets.filter((t) => ["resolved", "closed"].includes(t.status));
  const escalations = tickets.filter((t) => ["high", "urgent"].includes(t.priority));
  const breachedSla = openTickets.filter((t) => differenceInHours(new Date(), new Date(t.created_at)) > 48);
  const dueToday = openTickets.filter((t) => {
    const hours = differenceInHours(new Date(), new Date(t.created_at));
    return hours >= 24 && hours <= 48;
  });

  const avgResponseHours = resolvedTickets.length
    ? resolvedTickets.reduce((sum, t) => sum + differenceInHours(new Date(t.updated_at), new Date(t.created_at)), 0) / resolvedTickets.length
    : 0;

  const avgResolutionHours = resolvedTickets.length
    ? resolvedTickets.reduce((sum, t) => sum + differenceInHours(new Date(t.updated_at), new Date(t.created_at)), 0) / resolvedTickets.length
    : 0;

  const ticketVolumeTrend = useMemo(() => {
    const days: { label: string; count: number }[] = [];
    for (let i = 6; i >= 0; i -= 1) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const label = format(date, "MMM d");
      const count = tickets.filter((t) => format(new Date(t.created_at), "yyyy-MM-dd") === format(date, "yyyy-MM-dd")).length;
      days.push({ label, count });
    }
    return days;
  }, [tickets]);

  const categorySummary = useMemo(() => {
    const map: Record<string, number> = {};
    tickets.forEach((t) => {
      const key = t.category || "other";
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [tickets]);

  const shipmentDelayCount = tickets.filter((t) =>
    t.category === "shipment_issue" || t.subject.toLowerCase().includes("delay")
  ).length;

  const profileMap = useMemo(() => {
    const map = new Map<string, ProfileRow>();
    profiles.forEach((p) => map.set(p.user_id, p));
    return map;
  }, [profiles]);

  const agentPerformance = useMemo(() => {
    const map: Record<string, number> = {};
    resolvedTickets.forEach((t) => {
      if (!t.assigned_to) return;
      map[t.assigned_to] = (map[t.assigned_to] || 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id, count]) => ({
        id,
        count,
        name: profileMap.get(id)?.full_name || profileMap.get(id)?.email || "Agent",
      }));
  }, [resolvedTickets, profileMap]);

  const workloadOverview = useMemo(() => {
    const map: Record<string, number> = {};
    openTickets.forEach((t) => {
      if (!t.assigned_to) return;
      map[t.assigned_to] = (map[t.assigned_to] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, count]) => ({
      id,
      count,
      name: profileMap.get(id)?.full_name || profileMap.get(id)?.email || "Agent",
    }));
  }, [openTickets, profileMap]);

  const myOpenTickets = user?.id ? openTickets.filter((t) => t.assigned_to === user.id).length : 0;
  const slaCountdown = openTickets.length
    ? Math.max(0, 48 - differenceInHours(new Date(), new Date(openTickets[0].created_at)))
    : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Support Dashboard" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Ticket Volume Trend</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {ticketVolumeTrend.map((row) => (
              <div key={row.label} className="flex items-center justify-between">
                <span className="text-muted-foreground">{row.label}</span>
                <span className="font-semibold">{isLoading ? "..." : row.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4" /> Avg Response Time</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{isLoading ? "..." : `${avgResponseHours.toFixed(1)}h`}</p></CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4" /> Resolution Time</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{isLoading ? "..." : `${avgResolutionHours.toFixed(1)}h`}</p></CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" /> Agent Performance</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {agentPerformance.length === 0 && <p className="text-muted-foreground">No resolved tickets yet.</p>}
            {agentPerformance.map((agent) => (
              <div key={agent.id} className="flex items-center justify-between">
                <span>{agent.name}</span>
                <Badge variant="secondary">{agent.count} resolved</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Top Issue Categories</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {categorySummary.map(([category, count]) => (
              <div key={category} className="flex items-center justify-between">
                <span className="capitalize">{category.replace("_", " ")}</span>
                <span className="font-semibold">{count}</span>
              </div>
            ))}
            {categorySummary.length === 0 && <p className="text-muted-foreground">No tickets yet.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Shipment Delay Patterns</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{isLoading ? "..." : shipmentDelayCount}</p>
            <p className="text-xs text-muted-foreground">Shipment delay related tickets</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">All Open Tickets</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{isLoading ? "..." : openTickets.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Escalations</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{isLoading ? "..." : escalations.length}</p></CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Breached SLA Cases</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-destructive">{isLoading ? "..." : breachedSla.length}</p>
            <p className="text-xs text-muted-foreground">Over 48 hours</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Agent Workload Overview</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {workloadOverview.length === 0 && <p className="text-muted-foreground">No assignments yet.</p>}
            {workloadOverview.map((agent) => (
              <div key={agent.id} className="flex items-center justify-between">
                <span>{agent.name}</span>
                <Badge variant="outline">{agent.count} open</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">My Open Tickets</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{isLoading ? "..." : myOpenTickets}</p>
            <p className="text-xs text-muted-foreground">Assigned to you</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Tickets Due Today</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{isLoading ? "..." : dueToday.length}</p>
            <p className="text-xs text-muted-foreground">24-48 hours open</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">SLA Countdown Time</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{isLoading ? "..." : `${slaCountdown}h`}</p>
            <p className="text-xs text-muted-foreground">Until nearest SLA breach</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Recent Customer Messages</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {messages.length === 0 && <p className="text-muted-foreground">No recent messages.</p>}
            {messages.map((msg) => (
              <div key={msg.id} className="border-b pb-2 last:border-b-0 last:pb-0">
                <p className="font-medium">{msg.title}</p>
                <p className="text-xs text-muted-foreground line-clamp-2">{msg.message}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Button asChild variant="outline"><Link to="/support/tickets"><Ticket className="mr-2 h-4 w-4" /> All Tickets</Link></Button>
        <Button asChild><Link to="/support/tickets/create"><Plus className="mr-2 h-4 w-4" /> Create Ticket</Link></Button>
        <Button asChild variant="outline"><Link to="/support/sourcing-requests"><Package className="mr-2 h-4 w-4" /> Sourcing Requests</Link></Button>
        <Button asChild variant="outline"><Link to="/support/escalated"><AlertTriangle className="mr-2 h-4 w-4" /> Escalated Tickets</Link></Button>
        <Button asChild variant="outline"><Link to="/support/knowledge-base"><BarChart3 className="mr-2 h-4 w-4" /> Knowledge Base</Link></Button>
      </div>
    </div>
  );
};

export default SupportDashboard;
