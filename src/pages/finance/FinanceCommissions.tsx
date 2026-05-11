import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { DateRangeFilter } from "@/components/shared/DateRangeFilter";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { useDefaultCurrency } from "@/hooks/useDefaultCurrency";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type FinanceDateFilter, getFinanceDateRange, isWithinFinanceDateRange } from "@/lib/financePortal";
import {
  DEFAULT_AGENT_COMMISSION_RATE_KG,
  DEFAULT_AGENT_COMMISSION_RATE_CBM,
  calculateAgentCommission,
  getShipmentInvoiceTotal,
} from "@/lib/agentPortal";
import { PAYOUT_METHOD_OPTIONS, formatRequestStatus } from "@/lib/refunds";
import { toast } from "sonner";
import { Check, CircleDollarSign, X } from "lucide-react";

type CustomerRow = {
  id: string;
  full_name: string;
  code: string;
  agent_id?: string | null;
};

type ProfileRow = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  commission_rate_kg: number | null;
  commission_rate_cbm: number | null;
};

type ShipmentRow = {
  customer_id: string;
  total_cost: number | null;
  shipping_cost: number | null;
  payment_status: string | null;
  weight: number | null;
  cbm: number | null;
  created_at: string;
};

type CommissionRow = {
  agent_id: string;
  agent_name: string;
  agent_email: string;
  shipments: number;
  revenue: number;
  commission: number;
  pending_payouts: number;
  paid_out: number;
  available: number;
};

type WithdrawalRequestRow = {
  id: string;
  agent_user_id: string;
  amount: number;
  status: string;
  payout_method: string | null;
  payout_destination: string | null;
  request_notes: string | null;
  finance_message: string | null;
  payout_reference: string | null;
  created_at: string;
  approved_at: string | null;
  paid_at: string | null;
  agent_name?: string;
  agent_email?: string;
};

const FinanceCommissions = () => {
  const { formatAmount } = useDefaultCurrency();
  const sb = supabase as any;
  const [rows, setRows] = useState<CommissionRow[]>([]);
  const [requests, setRequests] = useState<WithdrawalRequestRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<WithdrawalRequestRow | null>(null);
  const [nextStatus, setNextStatus] = useState<"approved" | "rejected" | "paid" | null>(null);
  const [financeMessage, setFinanceMessage] = useState("");
  const [payoutMethod, setPayoutMethod] = useState("bank_transfer");
  const [payoutReference, setPayoutReference] = useState("");
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<FinanceDateFilter>("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  const dateRange = useMemo(
    () => getFinanceDateRange(dateFilter, { startDate: customStartDate, endDate: customEndDate }),
    [customEndDate, customStartDate, dateFilter],
  );

  const loadData = async () => {
    setIsLoading(true);
    setStatusMessage(null);

    const [shipmentsRes, customersResRaw, profilesRes, requestsRes] = await Promise.all([
      supabase.from("shipments").select("customer_id, total_cost, shipping_cost, payment_status, weight, cbm, created_at"),
      sb.from("customers").select("id, full_name, code, agent_id"),
      supabase.from("profiles").select("user_id, full_name, email, commission_rate_kg, commission_rate_cbm"),
      sb
        .from("agent_withdrawal_requests")
        .select("id, agent_user_id, amount, status, payout_method, payout_destination, request_notes, finance_message, payout_reference, created_at, approved_at, paid_at")
        .order("created_at", { ascending: false }),
    ]);

    if (shipmentsRes.error || profilesRes.error || requestsRes.error) {
      toast.error("Failed to load commission data.");
      setRows([]);
      setRequests([]);
      setIsLoading(false);
      return;
    }

    let customersRes = customersResRaw;
    let agentDataAvailable = true;
    if (customersResRaw.error) {
      const fallback = await supabase.from("customers").select("id, full_name, code");
      if (!fallback.error) {
        customersRes = fallback;
        agentDataAvailable = false;
        setStatusMessage("Agent assignments are not configured yet, so commissions cannot be calculated.");
      } else {
        customersRes = { data: [], error: customersResRaw.error };
        agentDataAvailable = false;
        setStatusMessage("Customer access is restricted. Unable to compute commissions.");
      }
    }

    const customers = (customersRes.data || []) as CustomerRow[];
    const shipments = ((shipmentsRes.data || []) as ShipmentRow[])
      .filter((shipment) => isWithinFinanceDateRange(shipment.created_at, dateRange))
      .map((shipment) => ({
        ...shipment,
        total_cost: Number(shipment.total_cost || 0),
        shipping_cost: shipment.shipping_cost === null ? null : Number(shipment.shipping_cost || 0),
      }));
    const profiles = ((profilesRes.data || []) as ProfileRow[]) || [];
    const profileMap = new Map(profiles.map((profile) => [profile.user_id, profile]));
    const requestRows = ((requestsRes.data || []) as WithdrawalRequestRow[])
      .filter((request) => isWithinFinanceDateRange(request.created_at, dateRange))
      .map((request) => ({
        ...request,
        amount: Number(request.amount || 0),
        agent_name: profileMap.get(request.agent_user_id)?.full_name || `Agent ${request.agent_user_id.slice(0, 6)}`,
        agent_email: profileMap.get(request.agent_user_id)?.email || "-",
      }));

    setRequests(requestRows);

    if (!agentDataAvailable) {
      setRows([]);
      setIsLoading(false);
      return;
    }

    const shipmentsByCustomer = new Map<string, ShipmentRow[]>();
    shipments.forEach((shipment) => {
      if (!shipmentsByCustomer.has(shipment.customer_id)) {
        shipmentsByCustomer.set(shipment.customer_id, []);
      }
      shipmentsByCustomer.get(shipment.customer_id)?.push(shipment);
    });

    const requestTotalsByAgent = new Map<
      string,
      { pending: number; paid: number }
    >();
    requestRows.forEach((request) => {
      const current = requestTotalsByAgent.get(request.agent_user_id) || { pending: 0, paid: 0 };
      if (["requested", "approved"].includes((request.status || "").toLowerCase())) {
        current.pending += request.amount;
      } else if ((request.status || "").toLowerCase() === "paid") {
        current.paid += request.amount;
      }
      requestTotalsByAgent.set(request.agent_user_id, current);
    });

    const commissionMap = new Map<string, CommissionRow>();
    customers.forEach((customer) => {
      if (!customer.agent_id) return;
      const agentId = customer.agent_id;
      const profile = profileMap.get(agentId);
      const agentName = profile?.full_name || `Agent ${agentId.slice(0, 6)}`;
      const agentEmail = profile?.email || "-";
      const rateKg = profile?.commission_rate_kg ?? DEFAULT_AGENT_COMMISSION_RATE_KG;
      const rateCbm = profile?.commission_rate_cbm ?? DEFAULT_AGENT_COMMISSION_RATE_CBM;

      const customerShipments = shipmentsByCustomer.get(customer.id) || [];
      const paidShipments = customerShipments.filter((shipment) => shipment.payment_status === "completed");
      const revenue = paidShipments.reduce((sum, shipment) => sum + getShipmentInvoiceTotal(shipment), 0);
      const commission = paidShipments.reduce((sum, shipment) => sum + calculateAgentCommission(shipment, rateKg, rateCbm), 0);
      const shipmentCount = paidShipments.length;

      if (!commissionMap.has(agentId)) {
        const totals = requestTotalsByAgent.get(agentId) || { pending: 0, paid: 0 };
        commissionMap.set(agentId, {
          agent_id: agentId,
          agent_name: agentName,
          agent_email: agentEmail,
          shipments: shipmentCount,
          revenue,
          commission: commission,
          pending_payouts: totals.pending,
          paid_out: totals.paid,
          available: Math.max(commission - totals.pending - totals.paid, 0),
        });
      } else {
        const existing = commissionMap.get(agentId)!;
        existing.shipments += shipmentCount;
        existing.revenue += revenue;
        existing.commission += commission;
        existing.available = Math.max(existing.commission - existing.pending_payouts - existing.paid_out, 0);
      }
    });

    setRows(Array.from(commissionMap.values()).sort((a, b) => b.commission - a.commission));
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [dateRange]);

  const totals = useMemo(
    () => ({
      commission: rows.reduce((sum, row) => sum + row.commission, 0),
      pending: rows.reduce((sum, row) => sum + row.pending_payouts, 0),
      paid: rows.reduce((sum, row) => sum + row.paid_out, 0),
      available: rows.reduce((sum, row) => sum + row.available, 0),
    }),
    [rows],
  );

  const openRequestDialog = (request: WithdrawalRequestRow, status: "approved" | "rejected" | "paid") => {
    setSelectedRequest(request);
    setNextStatus(status);
    setFinanceMessage(request.finance_message || "");
    setPayoutMethod(request.payout_method || "bank_transfer");
    setPayoutReference(request.payout_reference || "");
  };

  const closeDialog = () => {
    setSelectedRequest(null);
    setNextStatus(null);
    setFinanceMessage("");
    setPayoutMethod("bank_transfer");
    setPayoutReference("");
  };

  const handleUpdateRequest = async () => {
    if (!selectedRequest || !nextStatus) return;
    if (nextStatus === "rejected" && !financeMessage.trim()) {
      toast.error("Add the rejection reason.");
      return;
    }
    if (nextStatus === "paid" && !payoutMethod) {
      toast.error("Select a payout method.");
      return;
    }

    setIsUpdating(selectedRequest.id);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const patch: Record<string, any> = {
        status: nextStatus,
        finance_message: financeMessage.trim() || null,
      };

      if (nextStatus === "approved" || nextStatus === "paid") {
        patch.payout_method = payoutMethod;
      }
      if (nextStatus === "approved") {
        patch.approved_at = new Date().toISOString();
        patch.approved_by = user?.id || null;
      }
      if (nextStatus === "paid") {
        patch.approved_at = selectedRequest.approved_at || new Date().toISOString();
        patch.approved_by = user?.id || null;
        patch.paid_at = new Date().toISOString();
        patch.paid_by = user?.id || null;
        patch.payout_reference = payoutReference.trim() || null;
      }

      const { error } = await sb
        .from("agent_withdrawal_requests")
        .update(patch)
        .eq("id", selectedRequest.id);

      if (error) throw error;

      toast.success(`Request marked as ${nextStatus}.`);
      closeDialog();
      await loadData();
    } catch (error: any) {
      toast.error(error?.message || "Failed to update withdrawal request.");
    } finally {
      setIsUpdating(null);
    }
  };

  const commissionColumns: Column<CommissionRow>[] = [
    { key: "agent_name", label: "Agent" },
    { key: "agent_email", label: "Email" },
    { key: "shipments", label: "Paid Shipments" },
    { key: "revenue", label: "Revenue", render: (item) => formatAmount(item.revenue) },
    { key: "commission", label: "Commission", render: (item) => formatAmount(item.commission) },
    { key: "pending_payouts", label: "Pending", align: "center", render: (item) => formatAmount(item.pending_payouts) },
    { key: "paid_out", label: "Paid Out", align: "center", render: (item) => formatAmount(item.paid_out) },
    { key: "available", label: "Available", align: "center", render: (item) => formatAmount(item.available) },
  ];

  const requestColumns: Column<WithdrawalRequestRow>[] = [
    { key: "agent_name", label: "Agent", render: (item) => item.agent_name || "Agent" },
    { key: "amount", label: "Amount", align: "center", render: (item) => formatAmount(item.amount) },
    {
      key: "payout_method",
      label: "Method",
      render: (item) =>
        item.payout_method
          ? PAYOUT_METHOD_OPTIONS.find((option) => option.value === item.payout_method)?.label || item.payout_method
          : "-",
    },
    {
      key: "status",
      label: "Status",
      render: (item) => (
        <Badge variant={item.status === "rejected" ? "destructive" : item.status === "paid" ? "default" : "secondary"}>
          {formatRequestStatus(item.status)}
        </Badge>
      ),
    },
    { key: "created_at", label: "Requested", render: (item) => new Date(item.created_at).toLocaleDateString() },
    {
      key: "actions",
      label: "Actions",
      render: (item) => (
        <div className="flex items-center gap-2">
          <Button size="icon" onClick={() => openRequestDialog(item, "approved")} title="Approve">
            <Check className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="outline" onClick={() => openRequestDialog(item, "paid")} title="Pay out">
            <CircleDollarSign className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="destructive" onClick={() => openRequestDialog(item, "rejected")} title="Reject">
            <X className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
  <PageHeader
    title="Commissions"
    
  />
      <DateRangeFilter
        value={dateFilter}
        onValueChange={setDateFilter}
        startDate={customStartDate}
        endDate={customEndDate}
        onStartDateChange={setCustomStartDate}
        onEndDateChange={setCustomEndDate}
      />

      {statusMessage && (
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          {statusMessage}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Total Commission</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{isLoading ? "..." : formatAmount(totals.commission)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Pending Payouts</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{isLoading ? "..." : formatAmount(totals.pending)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Paid Out</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{isLoading ? "..." : formatAmount(totals.paid)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Still Available</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{isLoading ? "..." : formatAmount(totals.available)}</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Commission Summary by Agent</CardTitle></CardHeader>
        <CardContent>
          <DataTable
            columns={commissionColumns}
            data={rows}
            isLoading={isLoading}
            searchPlaceholder="Search agents..."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Payout Requests</CardTitle></CardHeader>
        <CardContent>
          <DataTable
            columns={requestColumns}
            data={requests}
            isLoading={isLoading}
            searchPlaceholder="Search payout requests..."
          />
        </CardContent>
      </Card>

      <Dialog open={!!selectedRequest && !!nextStatus} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {nextStatus === "approved" ? "Approve Payout" : nextStatus === "paid" ? "Pay Out Commission" : "Reject Payout"}
            </DialogTitle>
            
          </DialogHeader>

          <div className="space-y-4">
            {selectedRequest?.payout_destination && (
              <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-sm">
                <p className="text-xs font-medium text-foreground">Requested destination</p>
                <p className="mt-1 text-muted-foreground">{selectedRequest.payout_destination}</p>
              </div>
            )}

            {(nextStatus === "approved" || nextStatus === "paid") && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Payout Method</p>
                <Select value={payoutMethod} onValueChange={setPayoutMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYOUT_METHOD_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {nextStatus === "paid" && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Payout Reference</p>
                <Input
                  value={payoutReference}
                  onChange={(event) => setPayoutReference(event.target.value)}
                  placeholder="Transaction or transfer reference"
                />
              </div>
            )}

            <div className="space-y-2">
              <p className="text-sm font-medium">
                {nextStatus === "rejected" ? "Reason" : "Finance message"}
              </p>
              <Textarea
                className="min-h-[120px]"
                value={financeMessage}
                onChange={(event) => setFinanceMessage(event.target.value)}
                placeholder={
                  nextStatus === "rejected"
                    ? "Explain why this payout request was rejected."
                    : "Optional note for the agent."
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button
              variant={nextStatus === "rejected" ? "destructive" : "default"}
              onClick={handleUpdateRequest}
              disabled={isUpdating === selectedRequest?.id}
            >
              {isUpdating === selectedRequest?.id ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FinanceCommissions;

