import { useEffect, useMemo, useState } from "react";
import { format, isValid, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDefaultCurrency } from "@/hooks/useDefaultCurrency";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_AGENT_COMMISSION_RATE_KG,
  DEFAULT_AGENT_COMMISSION_RATE_CBM,
  calculateAgentCommission,
  getShipmentCommissionBase,
  getShipmentInvoiceTotal,
  type AgentShipmentRow,
} from "@/lib/agentPortal";
import { getWarehouseTrackingNumber } from "@/lib/shipmentNotes";
import { toast } from "sonner";

interface AgentProfile {
  user_id: string;
  full_name: string;
  email: string;
  commission_rate_kg: number | null;
  commission_rate_cbm: number | null;
}

interface CommissionRow {
  agentId: string;
  agentName: string;
  trackingNumber: string;
  customerName: string;
  invoiceTotal: number;
  commissionBase: number;
  commission: number;
  weight: number;
  cbm: number;
  rateKg: number;
  rateCbm: number;
  paymentStatus: string;
  createdAt: string;
}

const AdminAgentCommissions = () => {
  const { formatAmount } = useDefaultCurrency();
  const [commissions, setCommissions] = useState<CommissionRow[]>([]);
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState(() => format(startOfMonth(subMonths(new Date(), 5)), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(() => format(endOfMonth(new Date()), "yyyy-MM-dd"));

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        // Get all agent user IDs
        const { data: agentRoles, error: rolesError } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "agent");
        if (rolesError) throw rolesError;

        const agentUserIds = (agentRoles || []).map((r) => r.user_id);
        if (agentUserIds.length === 0) {
          setAgents([]);
          setCommissions([]);
          setIsLoading(false);
          return;
        }

        // Get agent profiles
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, email, commission_rate_kg, commission_rate_cbm")
          .in("user_id", agentUserIds);
        const agentProfiles = (profiles || []) as AgentProfile[];
        setAgents(agentProfiles);
        const agentMap = new Map(agentProfiles.map((a) => [a.user_id, a]));

        // Get all customers with agent_id
        const { data: customers } = await supabase
          .from("customers")
          .select("id, agent_id")
          .in("agent_id", agentUserIds);
        const customerAgentMap = new Map((customers || []).map((c) => [c.id, c.agent_id]));
        const customerIds = (customers || []).map((c) => c.id);

        if (customerIds.length === 0) {
          setCommissions([]);
          setIsLoading(false);
          return;
        }

        // Fetch shipments for these customers within date range
        let query = supabase
          .from("shipments")
          .select(
            "id, code, customer_id, status, payment_status, paid_amount, total_cost, shipping_cost, service_type, description, notes, custom_tracking_number, weight, cbm, created_at, updated_at, estimated_delivery_date, actual_delivery_date, customer:customers(code, full_name)"
          )
          .in("customer_id", customerIds)
          .order("created_at", { ascending: false })
          .limit(2000);

        if (dateFrom) query = query.gte("created_at", dateFrom);
        if (dateTo) query = query.lte("created_at", dateTo + "T23:59:59");

        const { data: shipments, error: shipmentsError } = await query;
        if (shipmentsError) throw shipmentsError;

        const rows: CommissionRow[] = ((shipments || []) as AgentShipmentRow[]).map((s) => {
          const agentId = customerAgentMap.get(s.customer_id) || "";
          const agent = agentMap.get(agentId);
          const rateKg = agent?.commission_rate_kg ?? DEFAULT_AGENT_COMMISSION_RATE_KG;
          const rateCbm = agent?.commission_rate_cbm ?? DEFAULT_AGENT_COMMISSION_RATE_CBM;
          const commissionBase = getShipmentCommissionBase(s);
          const warehouseTracking = getWarehouseTrackingNumber(s.notes) || s.custom_tracking_number || s.code;
          return {
            agentId,
            agentName: agent?.full_name || "Unknown Agent",
            trackingNumber: warehouseTracking,
            customerName: s.customer?.full_name || "Client",
            invoiceTotal: getShipmentInvoiceTotal(s),
            commissionBase,
            commission: calculateAgentCommission(s, rateKg, rateCbm),
            weight: Number(s.weight || 0),
            cbm: Number(s.cbm || 0),
            rateKg,
            rateCbm,
            paymentStatus: s.payment_status || "pending",
            createdAt: s.created_at,
          };
        });

        setCommissions(rows);
      } catch (error: any) {
        toast.error(error?.message || "Failed to load agent commissions.");
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [dateFrom, dateTo]);

  const filtered = useMemo(() => {
    if (selectedAgent === "all") return commissions;
    return commissions.filter((r) => r.agentId === selectedAgent);
  }, [commissions, selectedAgent]);

  const totals = useMemo(() => {
    const total = filtered.reduce((s, r) => s + r.commission, 0);
    const settled = filtered.filter((r) => r.paymentStatus === "completed").reduce((s, r) => s + r.commission, 0);
    const pending = total - settled;
    return { total, settled, pending, shipments: filtered.length };
  }, [filtered]);

  const agentSummary = useMemo(() => {
    const map = new Map<string, { name: string; shipments: number; commission: number; settled: number }>();
    commissions.forEach((r) => {
      const cur = map.get(r.agentId) || { name: r.agentName, shipments: 0, commission: 0, settled: 0 };
      cur.shipments += 1;
      cur.commission += r.commission;
      if (r.paymentStatus === "completed") cur.settled += r.commission;
      map.set(r.agentId, cur);
    });
    return Array.from(map.entries())
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.commission - a.commission);
  }, [commissions]);

  const columns: Column<CommissionRow>[] = [
    { key: "agentName", label: "Agent" },
    { key: "trackingNumber", label: "Tracking Number" },
    { key: "customerName", label: "Customer" },
    {
      key: "invoiceTotal",
      label: "Invoice Total",
      render: (item) => formatAmount(item.invoiceTotal),
    },
    {
      key: "commission",
      label: "Commission",
      render: (item) => (
        <div className="flex flex-col">
          <span className="font-bold">{formatAmount(item.commission)}</span>
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
            {item.weight}kg (${item.rateKg}/kg) + {item.cbm}cbm (${item.rateCbm}/cbm)
          </span>
        </div>
      ),
    },
    {
      key: "paymentStatus",
      label: "Payment Status",
      render: (item) => (
        <Badge variant={item.paymentStatus === "completed" ? "default" : "secondary"}>
          {item.paymentStatus === "completed" ? "Settled" : "Pending"}
        </Badge>
      ),
    },
    {
      key: "createdAt",
      label: "Date",
      render: (item) => {
        const d = new Date(item.createdAt);
        return isValid(d) ? format(d, "dd MMM yyyy") : "-";
      },
    },
  ];

  const summaryColumns: Column<{ id: string; name: string; shipments: number; commission: number; settled: number }>[] = [
    { key: "name", label: "Agent" },
    { key: "shipments", label: "Shipments" },
    {
      key: "commission",
      label: "Total Commission",
      render: (item) => formatAmount(item.commission),
    },
    {
      key: "settled",
      label: "Settled",
      render: (item) => formatAmount(item.settled),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Agent Commissions"
        
      />

      <div className="flex flex-wrap items-end gap-4">
        <div>
          <Label className="text-xs">Agent</Label>
          <Select value={selectedAgent} onValueChange={setSelectedAgent}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Agents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Agents</SelectItem>
              {agents.map((a) => (
                <SelectItem key={a.user_id} value={a.user_id}>
                  {a.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">From</Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[160px]" />
        </div>
        <div>
          <Label className="text-xs">To</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[160px]" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Total Shipments</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{isLoading ? "..." : totals.shipments}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Total Commission</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{isLoading ? "..." : formatAmount(totals.total)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Settled</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-green-600">{isLoading ? "..." : formatAmount(totals.settled)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Pending</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-orange-600">{isLoading ? "..." : formatAmount(totals.pending)}</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Commission by Agent</CardTitle></CardHeader>
        <CardContent>
          <DataTable columns={summaryColumns} data={agentSummary} isLoading={isLoading} searchPlaceholder="Search agents..." />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>All Commission Details</CardTitle></CardHeader>
        <CardContent>
          <DataTable columns={columns} data={filtered} isLoading={isLoading} searchPlaceholder="Search shipments..." />
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminAgentCommissions;

