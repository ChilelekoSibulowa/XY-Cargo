import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useDefaultCurrency } from "@/hooks/useDefaultCurrency";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_AGENT_COMMISSION_RATE_KG,
  DEFAULT_AGENT_COMMISSION_RATE_CBM,
  calculateAgentCommission,
  fetchAgentShipments,
  getCurrentAgentId,
  getShipmentCommissionBase,
} from "@/lib/agentPortal";
import { PAYOUT_METHOD_OPTIONS, formatRequestStatus } from "@/lib/refunds";
import { toast } from "sonner";

type WithdrawalRequestRow = {
  id: string;
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
};

const AgentWithdrawals = () => {
  const { formatAmount } = useDefaultCurrency();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [availableAmount, setAvailableAmount] = useState(0);
  const [totalCommission, setTotalCommission] = useState(0);
  const [reservedAmount, setReservedAmount] = useState(0);
  const [paidOutAmount, setPaidOutAmount] = useState(0);
  const [requests, setRequests] = useState<WithdrawalRequestRow[]>([]);
  const [form, setForm] = useState({
    amount: "",
    payout_method: "bank_transfer",
    payout_destination: "",
    request_notes: "",
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const agentId = await getCurrentAgentId();
      if (!agentId) {
        setRequests([]);
        setIsLoading(false);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { shipments } = await fetchAgentShipments(agentId, 500);
      const { data: requestData, error: requestError } = await (supabase as any)
        .from("agent_withdrawal_requests")
        .select("id, amount, status, payout_method, payout_destination, request_notes, finance_message, payout_reference, created_at, approved_at, paid_at")
        .eq("agent_user_id", agentId)
        .order("created_at", { ascending: false });

      if (requestError) throw requestError;

      const { data: profileRes } = await supabase.from("profiles").select("commission_rate_kg, commission_rate_cbm").eq("user_id", agentId).single();
      const rateKg = profileRes?.commission_rate_kg ?? DEFAULT_AGENT_COMMISSION_RATE_KG;
      const rateCbm = profileRes?.commission_rate_cbm ?? DEFAULT_AGENT_COMMISSION_RATE_CBM;

      const settledShipments = shipments.filter((shipment) => shipment.payment_status === "completed");
      const earned = settledShipments.reduce(
        (sum, shipment) => sum + calculateAgentCommission(shipment, rateKg, rateCbm),
        0,
      );
      const withdrawalRows = ((requestData || []) as WithdrawalRequestRow[]).map((row) => ({
        ...row,
        amount: Number(row.amount || 0),
      }));
      const reserved = withdrawalRows
        .filter((row) => ["requested", "approved"].includes((row.status || "").toLowerCase()))
        .reduce((sum, row) => sum + row.amount, 0);
      const paid = withdrawalRows
        .filter((row) => (row.status || "").toLowerCase() === "paid")
        .reduce((sum, row) => sum + row.amount, 0);

      setRequests(withdrawalRows);
      setTotalCommission(earned);
      setReservedAmount(reserved);
      setPaidOutAmount(paid);
      setAvailableAmount(Math.max(earned - reserved - paid, 0));

      if (!form.payout_destination.trim() && user) {
        const bankName = user.user_metadata?.bank_name;
        const accountName = user.user_metadata?.account_name;
        const accountNumber = user.user_metadata?.account_number;
        const phone = user.user_metadata?.phone || user.phone || "";
        const defaultDestination =
          bankName && accountNumber
            ? `${bankName}${accountName ? ` / ${accountName}` : ""} / ${accountNumber}`
            : phone || "";

        if (defaultDestination) {
          setForm((prev) => ({ ...prev, payout_destination: defaultDestination }));
        }
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to load withdrawal data.");
      setRequests([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const requestedAmount = useMemo(() => Number(form.amount || 0), [form.amount]);

  const handleSubmit = async () => {
    const agentId = await getCurrentAgentId();
    if (!agentId) return;

    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
      toast.error("Enter a valid withdrawal amount.");
      return;
    }
    if (requestedAmount > availableAmount) {
      toast.error("The withdrawal amount exceeds the available commission.");
      return;
    }
    if (!form.payout_destination.trim()) {
      toast.error("Add the payout destination details.");
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await (supabase as any).from("agent_withdrawal_requests").insert({
        agent_user_id: agentId,
        amount: requestedAmount,
        payout_method: form.payout_method,
        payout_destination: form.payout_destination.trim(),
        request_notes: form.request_notes.trim() || null,
        status: "requested",
      });

      if (error) throw error;

      toast.success("Withdrawal request submitted.");
      setForm((prev) => ({ ...prev, amount: "", request_notes: "" }));
      await loadData();
    } catch (error: any) {
      toast.error(error?.message || "Failed to submit withdrawal request.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Withdrawals"
        
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Total Earned</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{isLoading ? "..." : formatAmount(totalCommission)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Available to Withdraw</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{isLoading ? "..." : formatAmount(availableAmount)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Pending / Approved</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{isLoading ? "..." : formatAmount(reservedAmount)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Paid Out</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{isLoading ? "..." : formatAmount(paidOutAmount)}</p></CardContent>
        </Card>
      </div>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>New Withdrawal Request</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium">Amount</p>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Payout Method</p>
              <Select
                value={form.payout_method}
                onValueChange={(value) => setForm((prev) => ({ ...prev, payout_method: value }))}
              >
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
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Destination / Account Details</p>
            <Input
              value={form.payout_destination}
              onChange={(event) => setForm((prev) => ({ ...prev, payout_destination: event.target.value }))}
              placeholder="Bank account, phone number, or payout destination"
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Notes</p>
            <Textarea
              className="min-h-[120px]"
              value={form.request_notes}
              onChange={(event) => setForm((prev) => ({ ...prev, request_notes: event.target.value }))}
              placeholder="Optional payout instructions for finance."
            />
          </div>

          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? "Submitting..." : "Request Withdrawal"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>Withdrawal History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {requests.length === 0 && <p className="text-muted-foreground">No withdrawal requests yet.</p>}
          {requests.map((request) => (
            <div key={request.id} className="rounded-lg border border-border/70 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="font-medium">{formatAmount(request.amount)}</p>
                  <p className="text-xs text-muted-foreground">
                    {request.payout_method
                      ? PAYOUT_METHOD_OPTIONS.find((option) => option.value === request.payout_method)?.label || request.payout_method
                      : "Payout method pending"}
                  </p>
                </div>
                <Badge variant={request.status === "rejected" ? "destructive" : "secondary"}>
                  {formatRequestStatus(request.status)}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Requested {format(new Date(request.created_at), "dd MMM yyyy")}
                {request.paid_at ? ` · Paid ${format(new Date(request.paid_at), "dd MMM yyyy")}` : ""}
              </p>
              {request.payout_destination && (
                <p className="mt-3 text-sm text-muted-foreground">Destination: {request.payout_destination}</p>
              )}
              {request.request_notes && (
                <p className="mt-2 text-sm text-muted-foreground">Notes: {request.request_notes}</p>
              )}
              {request.finance_message && (
                <div className="mt-3 rounded-md border border-border/70 bg-muted/20 p-3 text-sm">
                  <p className="text-xs font-medium text-foreground">Finance message</p>
                  <p className="mt-1 text-muted-foreground">{request.finance_message}</p>
                </div>
              )}
              {request.payout_reference && (
                <p className="mt-2 text-xs text-muted-foreground">Reference: {request.payout_reference}</p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default AgentWithdrawals;

