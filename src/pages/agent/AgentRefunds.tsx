import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useDefaultCurrency } from "@/hooks/useDefaultCurrency";
import { fetchAgentCustomers, getCurrentAgentId } from "@/lib/agentPortal";
import { formatRequestStatus, getRefundableShipmentAmount } from "@/lib/refunds";
import { resolveTrackingByStatus } from "@/lib/shipmentNotes";
import { toast } from "sonner";

type AgentCustomerOption = {
  id: string;
  code: string;
  full_name: string;
};

type PaidShipmentRow = {
  id: string;
  customer_id: string;
  code: string;
  status: string;
  custom_tracking_number: string | null;
  notes: string | null;
  description: string | null;
  total_cost: number | null;
  shipping_cost: number | null;
  payment_status: string | null;
  updated_at: string;
};

type SourcingRefundRow = {
  id: string;
  customer_id: string;
  product_name: string;
  quantity: number;
  budget: number | null;
  status: string;
  created_at: string;
};

type SupplierPaymentRefundRow = {
  id: string;
  customer_id: string;
  request_code: string;
  supplier_name: string;
  company_name: string;
  amount: number;
  currency: string;
  total_payable: number | null;
  status: string;
  created_at: string;
};

type RefundableItem = {
  value: string;
  label: string;
  description: string;
  amount: number;
  shipmentId: string | null;
  customerId: string;
  reference: string;
};

type RefundRequestRow = {
  id: string;
  shipment_code: string | null;
  description: string;
  requested_amount: number | null;
  status: string | null;
  finance_response_message: string | null;
  created_at: string;
  customer?: { full_name: string | null; code: string | null } | null;
  shipment?: {
    code: string;
    status: string;
    custom_tracking_number: string | null;
    notes: string | null;
    description: string | null;
  } | null;
};

const AgentRefunds = () => {
  const { formatAmount } = useDefaultCurrency();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [customers, setCustomers] = useState<AgentCustomerOption[]>([]);
  const [paidShipments, setPaidShipments] = useState<PaidShipmentRow[]>([]);
  const [paidSourcingRequests, setPaidSourcingRequests] = useState<SourcingRefundRow[]>([]);
  const [paidSupplierPayments, setPaidSupplierPayments] = useState<SupplierPaymentRefundRow[]>([]);
  const [requests, setRequests] = useState<RefundRequestRow[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedRefundItemId, setSelectedRefundItemId] = useState("");
  const [reason, setReason] = useState("");
  const [refundCategory, setRefundCategory] = useState("shipping");

  const loadData = async () => {
    setIsLoading(true);
    try {
      const agentId = await getCurrentAgentId();
      if (!agentId) {
        setCustomers([]);
        setPaidShipments([]);
        setPaidSourcingRequests([]);
        setPaidSupplierPayments([]);
        setRequests([]);
        setIsLoading(false);
        return;
      }

      const agentCustomers = await fetchAgentCustomers(agentId);
      const customerIds = agentCustomers.map((customer) => customer.id);
      setCustomers(
        agentCustomers.map((customer) => ({
          id: customer.id,
          code: customer.code,
          full_name: customer.full_name,
        })),
      );

      if (customerIds.length === 0) {
        setPaidShipments([]);
        setPaidSourcingRequests([]);
        setPaidSupplierPayments([]);
        setRequests([]);
        setIsLoading(false);
        return;
      }

      const [shipmentsRes, sourcingRes, supplierPaymentsRes, requestsRes] = await Promise.all([
        supabase
          .from("shipments")
          .select("id, customer_id, code, status, custom_tracking_number, notes, description, total_cost, shipping_cost, payment_status, updated_at")
          .in("customer_id", customerIds)
          .eq("payment_status", "completed")
          .order("updated_at", { ascending: false })
          .limit(100),
        supabase
          .from("sourcing_requests")
          .select("id, customer_id, product_name, quantity, budget, status, created_at")
          .in("customer_id", customerIds)
          .in("status", ["completed", "fulfilled", "closed", "approved"])
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("supplier_payment_requests")
          .select("id, customer_id, request_code, supplier_name, company_name, amount, currency, total_payable, status, created_at")
          .in("customer_id", customerIds)
          .eq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("customer_claims" as any)
          .select("id, shipment_code, description, requested_amount, status, finance_response_message, created_at, customer:customers(full_name, code), shipment:shipments(code, status, custom_tracking_number, notes, description)")
          .in("customer_id", customerIds)
          .eq("request_type", "refund")
          .order("created_at", { ascending: false }),
      ]);

      if (shipmentsRes.error || sourcingRes.error || supplierPaymentsRes.error || requestsRes.error) {
        throw shipmentsRes.error || sourcingRes.error || supplierPaymentsRes.error || requestsRes.error;
      }

      setPaidShipments((shipmentsRes.data || []) as PaidShipmentRow[]);
      setPaidSourcingRequests((sourcingRes.data || []) as SourcingRefundRow[]);
      setPaidSupplierPayments((supplierPaymentsRes.data || []) as SupplierPaymentRefundRow[]);
      setRequests((requestsRes.data || []) as unknown as RefundRequestRow[]);
    } catch (error: any) {
      toast.error(error?.message || "Failed to load refund data.");
      setCustomers([]);
      setPaidShipments([]);
      setPaidSourcingRequests([]);
      setPaidSupplierPayments([]);
      setRequests([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const refundItems = useMemo<RefundableItem[]>(() => {
    if (!selectedCustomerId) return [];

    if (refundCategory === "product_sourcing") {
      return paidSourcingRequests
        .filter((request) => request.customer_id === selectedCustomerId)
        .map((request) => ({
          value: `product_sourcing:${request.id}`,
          label: request.product_name,
          description: `Qty ${request.quantity} - ${format(new Date(request.created_at), "dd MMM yyyy")}`,
          amount: Number(request.budget || 0),
          shipmentId: null,
          customerId: request.customer_id,
          reference: request.product_name,
        }));
    }

    if (refundCategory === "supplier_payments") {
      return paidSupplierPayments
        .filter((request) => request.customer_id === selectedCustomerId)
        .map((request) => ({
          value: `supplier_payments:${request.id}`,
          label: `${request.request_code} - ${request.supplier_name}`,
          description: request.company_name || "Supplier payment facilitation",
          amount: Number(request.total_payable ?? request.amount ?? 0),
          shipmentId: null,
          customerId: request.customer_id,
          reference: request.request_code,
        }));
    }

    return paidShipments
      .filter((shipment) => shipment.customer_id === selectedCustomerId)
      .map((shipment) => ({
        value: `shipping:${shipment.id}`,
        label: `${resolveTrackingByStatus(shipment.status, shipment.notes, shipment.custom_tracking_number) || "Tracking pending"} - ${shipment.description || "Shipment"}`,
        description: shipment.description || "Shipment",
        amount: getRefundableShipmentAmount(shipment),
        shipmentId: shipment.id,
        customerId: shipment.customer_id,
        reference: shipment.custom_tracking_number || shipment.code,
      }));
  }, [refundCategory, paidShipments, paidSourcingRequests, paidSupplierPayments, selectedCustomerId]);

  const selectedRefundItem = useMemo(
    () => refundItems.find((item) => item.value === selectedRefundItemId) || null,
    [refundItems, selectedRefundItemId],
  );

  const itemSelectLabel =
    refundCategory === "product_sourcing"
      ? "Paid Product Sourcing"
      : refundCategory === "supplier_payments"
        ? "Paid Supplier Payment Facilitation"
        : "Paid Shipment";

  const handleSubmit = async () => {
    if (!selectedCustomerId) {
      toast.error("Select a client first.");
      return;
    }
    if (!selectedRefundItem) {
      toast.error(`Select a ${itemSelectLabel.toLowerCase()}.`);
      return;
    }
    if (!reason.trim()) {
      toast.error("Add the refund reason.");
      return;
    }

    setIsSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const categoryLabels: Record<string, string> = {
        shipping: "Shipping",
        product_sourcing: "Product Sourcing",
        supplier_payments: "Supplier Payments Facilitation",
      };
      const categoryLabel = categoryLabels[refundCategory] || "Shipping";

      const { error } = await supabase.from("customer_claims" as any).insert({
        customer_id: selectedCustomerId,
        shipment_id: selectedRefundItem.shipmentId,
        shipment_code: selectedRefundItem.reference,
        description: `[${categoryLabel}] ${selectedRefundItem.label}: ${reason.trim()}`,
        requested_amount: selectedRefundItem.amount,
        request_type: "refund",
        requested_by_role: "agent",
        requested_by_user_id: user?.id || null,
        status: "submitted",
      } as any);

      if (error) throw error;

      toast.success("Refund request submitted.");
      setReason("");
      setSelectedRefundItemId("");
      await loadData();
    } catch (error: any) {
      toast.error(error?.message || "Failed to submit refund request.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Refund Requests"
        
      />

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>New Refund Request</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium">Client</p>
              <Select
                value={selectedCustomerId}
                onValueChange={(value) => {
                  setSelectedCustomerId(value);
                  setSelectedRefundItemId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isLoading ? "Loading clients..." : "Select a client"} />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.full_name} ({customer.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Refund Category</p>
              <Select
                value={refundCategory}
                onValueChange={(value) => {
                  setRefundCategory(value);
                  setSelectedRefundItemId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="shipping">Shipping</SelectItem>
                  <SelectItem value="product_sourcing">Product Sourcing</SelectItem>
                  <SelectItem value="supplier_payments">Supplier Payments Facilitation</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">{itemSelectLabel}</p>
            <Select value={selectedRefundItemId} onValueChange={setSelectedRefundItemId} disabled={!selectedCustomerId}>
              <SelectTrigger>
                <SelectValue placeholder={!selectedCustomerId ? "Select a client first" : `Select ${itemSelectLabel.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {refundItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedRefundItem && (
            <div className="rounded-lg border border-border/70 bg-muted/20 p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{selectedRefundItem.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedRefundItem.description}
                  </p>
                </div>
                <Badge variant="outline">
                  Refund Amount: {formatAmount(selectedRefundItem.amount)}
                </Badge>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium">Reason</p>
            <Textarea
              placeholder="Explain the refund request for the client."
              className="min-h-[140px]"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>

          <Button onClick={handleSubmit} disabled={isSaving || !selectedRefundItem}>
            {isSaving ? "Submitting..." : "Submit Refund Request"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>Recent Refund Requests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {requests.length === 0 && <p className="text-muted-foreground">No refund requests submitted yet.</p>}
          {requests.map((request) => (
            <div key={request.id} className="rounded-lg border border-border/70 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="font-medium">
                    {resolveTrackingByStatus(request.shipment?.status, request.shipment?.notes || null, request.shipment?.custom_tracking_number) || request.shipment_code || "Tracking pending"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {request.customer?.full_name || "Client"} {request.customer?.code ? `(${request.customer.code})` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <Badge variant={request.status === "rejected" ? "destructive" : "secondary"}>
                    {formatRequestStatus(request.status)}
                  </Badge>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {format(new Date(request.created_at), "dd MMM yyyy")} · {formatAmount(Number(request.requested_amount || 0))}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{request.description}</p>
              {request.finance_response_message && (
                <div className="mt-3 rounded-md border border-border/70 bg-muted/20 p-3 text-sm">
                  <p className="text-xs font-medium text-foreground">Finance response</p>
                  <p className="mt-1 text-muted-foreground">{request.finance_response_message}</p>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default AgentRefunds;

