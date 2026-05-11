import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDefaultCurrency } from "@/hooks/useDefaultCurrency";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_AGENT_COMMISSION_RATE_KG,
  DEFAULT_AGENT_COMMISSION_RATE_CBM,
  calculateAgentCommission,
  fetchAgentShipments,
  getCurrentAgentId,
  getCurrentMonthKey,
  getShipmentCommissionBase,
  type AgentShipmentRow,
} from "@/lib/agentPortal";
import { toast } from "sonner";

type WithdrawalRequestRow = {
  amount: number;
  status: string;
};

const AgentCommissions = () => {
  const { formatAmount } = useDefaultCurrency();
  const [shipments, setShipments] = useState<AgentShipmentRow[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequestRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [agentProfile, setAgentProfile] = useState<{
    commission_rate_kg: number;
    commission_rate_cbm: number;
  } | null>(null);

  useEffect(() => {
    const loadShipments = async () => {
      try {
        const agentId = await getCurrentAgentId();
        if (!agentId) {
          setShipments([]);
          setIsLoading(false);
          return;
        }

        const [{ shipments: shipmentRows }, withdrawalsRes, profileRes] = await Promise.all([
          fetchAgentShipments(agentId, 500),
          (supabase as any)
            .from("agent_withdrawal_requests")
            .select("amount, status")
            .eq("agent_user_id", agentId),
          supabase.from("profiles").select("commission_rate_kg, commission_rate_cbm").eq("user_id", agentId).single(),
        ]);
        setShipments(shipmentRows);
        setAgentProfile({
          commission_rate_kg: profileRes.data?.commission_rate_kg ?? DEFAULT_AGENT_COMMISSION_RATE_KG,
          commission_rate_cbm: profileRes.data?.commission_rate_cbm ?? DEFAULT_AGENT_COMMISSION_RATE_CBM,
        });
        setWithdrawals(
          ((withdrawalsRes.data || []) as WithdrawalRequestRow[]).map((row) => ({
            ...row,
            amount: Number(row.amount || 0),
          })),
        );
      } catch (error: any) {
        toast.error(error?.message || "Failed to load commission data.");
      } finally {
        setIsLoading(false);
      }
    };

    loadShipments();
  }, []);

  const summary = useMemo(() => {
    const currentMonthKey = getCurrentMonthKey();
    const currentDate = new Date();
    const currentQuarter = Math.floor(currentDate.getMonth() / 3);
    const settledShipments = shipments.filter((shipment) => shipment.payment_status === "completed");
    const unsettledShipments = shipments.filter((shipment) => shipment.payment_status !== "completed");

    const isCurrentQuarterShipment = (createdAt: string) => {
      const shipmentDate = new Date(createdAt);
      return (
        shipmentDate.getFullYear() === currentDate.getFullYear() &&
        Math.floor(shipmentDate.getMonth() / 3) === currentQuarter
      );
    };

    const rateKg = agentProfile?.commission_rate_kg ?? DEFAULT_AGENT_COMMISSION_RATE_KG;
    const rateCbm = agentProfile?.commission_rate_cbm ?? DEFAULT_AGENT_COMMISSION_RATE_CBM;

    const totalCommission = settledShipments.reduce(
      (sum, shipment) => sum + calculateAgentCommission(shipment, rateKg, rateCbm),
      0,
    );
    const monthlyCommission = settledShipments
      .filter((shipment) => shipment.created_at.startsWith(currentMonthKey))
      .reduce((sum, shipment) => sum + calculateAgentCommission(shipment, rateKg, rateCbm), 0);
    const pendingCommission = unsettledShipments
      .reduce((sum, shipment) => sum + calculateAgentCommission(shipment, rateKg, rateCbm), 0);
    const quarterCommission = settledShipments
      .filter((shipment) => isCurrentQuarterShipment(shipment.created_at))
      .reduce((sum, shipment) => sum + calculateAgentCommission(shipment, rateKg, rateCbm), 0);
    const pendingWithdrawals = withdrawals
      .filter((request) => ["requested", "approved"].includes((request.status || "").toLowerCase()))
      .reduce((sum, request) => sum + request.amount, 0);
    const paidOut = withdrawals
      .filter((request) => (request.status || "").toLowerCase() === "paid")
      .reduce((sum, request) => sum + request.amount, 0);
    const availableCommission = Math.max(totalCommission - pendingWithdrawals - paidOut, 0);

    return {
      totalCommission,
      monthlyCommission,
      pendingCommission,
      quarterCommission,
      pendingWithdrawals,
      paidOut,
      availableCommission,
    };
  }, [shipments, withdrawals]);

  const columns: Column<AgentShipmentRow>[] = [
    { key: "code", label: "Shipment" },
    {
      key: "customer",
      label: "Client",
      render: (item) => {
        const name = item.customer?.full_name || "Client";
        const code = item.customer?.code || "-";
        return (
          <div>
            <div>{name}</div>
            <div className="font-mono text-xs text-muted-foreground">{code}</div>
          </div>
        );
      },
    },
    {
      key: "payment_status",
      label: "Settlement",
      render: (item) => (
        <Badge variant={item.payment_status === "completed" ? "default" : "secondary"}>
          {item.payment_status === "completed" ? "Settled" : "Pending"}
        </Badge>
      ),
    },
    {
      key: "commission_base",
      label: "Commission Base",
      render: (item) => formatAmount(getShipmentCommissionBase(item)),
    },
    {
      key: "commission",
      label: "Commission",
      render: (item) => {
        const rateKg = agentProfile?.commission_rate_kg ?? DEFAULT_AGENT_COMMISSION_RATE_KG;
        const rateCbm = agentProfile?.commission_rate_cbm ?? DEFAULT_AGENT_COMMISSION_RATE_CBM;
        return (
          <div className="flex flex-col">
            <span className="font-bold">{formatAmount(calculateAgentCommission(item, rateKg, rateCbm))}</span>
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
              {item.weight || 0}kg (${rateKg}) + {item.cbm || 0}cbm (${rateCbm})
            </span>
          </div>
        );
      },
    },
    {
      key: "created_at",
      label: "Month",
      render: (item) => format(new Date(item.created_at), "MMM yyyy"),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Commission & Earnings"
        
        actions={
          <Button asChild size="sm">
            <Link to="/agent/withdrawals">Withdraw Funds</Link>
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Commission Overview</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold">{isLoading ? "..." : formatAmount(summary.totalCommission)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Settled Shipments</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold">{isLoading ? "..." : shipments.filter((shipment) => shipment.payment_status === "completed").length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Pending Earnings</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold">{isLoading ? "..." : formatAmount(summary.pendingCommission)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Available to Withdraw</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold">{isLoading ? "..." : formatAmount(summary.availableCommission)}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Monthly / Quarterly Earnings Report</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-border/70 p-4">
            <p className="text-xs text-muted-foreground">Current Month</p>
            <p className="mt-2 text-2xl font-semibold">{isLoading ? "..." : formatAmount(summary.monthlyCommission)}</p>
          </div>
          <div className="rounded-xl border border-border/70 p-4">
            <p className="text-xs text-muted-foreground">Quarter to Date</p>
            <p className="mt-2 text-2xl font-semibold">{isLoading ? "..." : formatAmount(summary.quarterCommission)}</p>
          </div>
          <div className="rounded-xl border border-border/70 p-4">
            <p className="text-xs text-muted-foreground">Commission Rates</p>
            <p className="mt-2 text-sm font-semibold">{`$${agentProfile?.commission_rate_kg ?? DEFAULT_AGENT_COMMISSION_RATE_KG}/kg | $${agentProfile?.commission_rate_cbm ?? DEFAULT_AGENT_COMMISSION_RATE_CBM}/cbm`}</p>
          </div>
          <div className="rounded-xl border border-border/70 p-4">
            <p className="text-xs text-muted-foreground">Paid Out</p>
            <p className="mt-2 text-2xl font-semibold">{isLoading ? "..." : formatAmount(summary.paidOut)}</p>
          </div>
        </CardContent>
      </Card>

      <DataTable columns={columns} data={shipments} isLoading={isLoading} searchPlaceholder="Search commission records..." />
    </div>
  );
};

export default AgentCommissions;

