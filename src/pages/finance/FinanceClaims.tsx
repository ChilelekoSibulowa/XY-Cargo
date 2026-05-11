import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { DateRangeFilter } from "@/components/shared/DateRangeFilter";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDefaultCurrency } from "@/hooks/useDefaultCurrency";
import { type FinanceDateFilter, getFinanceDateRange, isWithinFinanceDateRange } from "@/lib/financePortal";
import { formatRequestStatus } from "@/lib/refunds";
import { getWarehouseTrackingNumber, resolveTrackingByStatus } from "@/lib/shipmentNotes";
import { toast } from "sonner";
import { Check, CircleDollarSign, X } from "lucide-react";

type RefundRequestRow = {
  id: string;
  shipment_code: string | null;
  description: string;
  requested_amount: number | null;
  status: string | null;
  finance_response_message: string | null;
  created_at: string;
  requested_by_role: string | null;
  customer: { full_name: string | null; code: string | null } | null;
  shipment?: {
    code: string;
    custom_tracking_number: string | null;
    notes: string | null;
    description: string | null;
    status: string | null;
  } | null;
};

const FinanceClaims = () => {
  const { formatAmount } = useDefaultCurrency();
  const [requests, setRequests] = useState<RefundRequestRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [reviewStatus, setReviewStatus] = useState<"approved" | "rejected" | "refunded" | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<RefundRequestRow | null>(null);
  const [financeMessage, setFinanceMessage] = useState("");
  const [dateFilter, setDateFilter] = useState<FinanceDateFilter>("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  const loadRequests = async () => {
    setIsLoading(true);
    const { data, error } = await (supabase as any)
      .from("customer_claims")
      .select("id, shipment_code, description, requested_amount, status, finance_response_message, created_at, requested_by_role, customer:customers(full_name, code), shipment:shipments(code, custom_tracking_number, notes, description, status)")
      .eq("request_type", "refund")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load refund requests.");
      setRequests([]);
    } else {
      setRequests(((data || []) as RefundRequestRow[]).map((row) => ({
        ...row,
        requested_amount: Number(row.requested_amount || 0),
      })));
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const dateRange = useMemo(
    () => getFinanceDateRange(dateFilter, { startDate: customStartDate, endDate: customEndDate }),
    [customEndDate, customStartDate, dateFilter],
  );

  const dateFilteredRequests = useMemo(
    () => requests.filter((request) => isWithinFinanceDateRange(request.created_at, dateRange)),
    [dateRange, requests],
  );

  const totals = useMemo(() => {
    const submitted = dateFilteredRequests.filter((request) => request.status === "submitted").length;
    const approved = dateFilteredRequests.filter((request) => request.status === "approved").length;
    const refundedAmount = dateFilteredRequests
      .filter((request) => request.status === "refunded")
      .reduce((sum, request) => sum + Number(request.requested_amount || 0), 0);

    return { submitted, approved, refundedAmount };
  }, [dateFilteredRequests]);

  const openReviewDialog = (request: RefundRequestRow, status: "approved" | "rejected" | "refunded") => {
    setSelectedRequest(request);
    setReviewStatus(status);
    setFinanceMessage(request.finance_response_message || "");
  };

  const closeDialog = () => {
    setSelectedRequest(null);
    setReviewStatus(null);
    setFinanceMessage("");
  };

  const handleSubmitReview = async () => {
    if (!selectedRequest || !reviewStatus) return;
    if (reviewStatus === "rejected" && !financeMessage.trim()) {
      toast.error("Add the rejection reason.");
      return;
    }

    setIsUpdating(selectedRequest.id);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error } = await (supabase as any)
        .from("customer_claims")
        .update({
          status: reviewStatus,
          finance_response_message: financeMessage.trim() || null,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id || null,
        })
        .eq("id", selectedRequest.id);

      if (error) throw error;

      toast.success(`Refund request marked as ${reviewStatus}.`);
      closeDialog();
      await loadRequests();
    } catch (error: any) {
      toast.error(error?.message || "Failed to update refund request.");
    } finally {
      setIsUpdating(null);
    }
  };

  const columns: Column<RefundRequestRow>[] = [
    {
      key: "customer",
      label: "Customer",
      render: (item) =>
        `${item.customer?.full_name || "Customer"}${item.customer?.code ? ` (${item.customer.code})` : ""}`,
    },
    {
      key: "shipment_code",
      label: "Shipment",
      render: (item) =>
        resolveTrackingByStatus(item.shipment?.status || null, item.shipment?.notes || null, item.shipment?.custom_tracking_number || null) || item.shipment_code || "Tracking pending",
    },
    {
      key: "requested_by_role",
      label: "Requested By",
      render: (item) => formatRequestStatus(item.requested_by_role || "customer"),
    },
    {
      key: "requested_amount",
      label: "Amount",
      align: "center",
      render: (item) => formatAmount(Number(item.requested_amount || 0)),
    },
    {
      key: "status",
      label: "Status",
      render: (item) => (
        <StatusBadge status={item.status || "submitted"} label={formatRequestStatus(item.status)} />
      ),
    },
    {
      key: "created_at",
      label: "Submitted",
      render: (item) => format(new Date(item.created_at), "dd MMM yyyy"),
    },
    {
      key: "actions",
      label: "Actions",
      render: (item) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 p-0" onClick={() => openReviewDialog(item, "approved")} title="Approve">
            <Check className="h-4 w-4 text-green-600" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 p-0" onClick={() => openReviewDialog(item, "refunded")} title="Mark refunded">
            <CircleDollarSign className="h-4 w-4 text-blue-600" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 p-0" onClick={() => openReviewDialog(item, "rejected")} title="Reject">
            <X className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Refund Management"
        
      />
      <DateRangeFilter
        value={dateFilter}
        onValueChange={setDateFilter}
        startDate={customStartDate}
        endDate={customEndDate}
        onStartDateChange={setCustomStartDate}
        onEndDateChange={setCustomEndDate}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Submitted Requests</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{isLoading ? "..." : totals.submitted}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Approved Requests</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{isLoading ? "..." : totals.approved}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Refunded Amount</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{isLoading ? "..." : formatAmount(totals.refundedAmount)}</p></CardContent>
        </Card>
      </div>

      <DataTable
        columns={columns}
        data={dateFilteredRequests}
        isLoading={isLoading}
        searchPlaceholder="Search refund requests..."
      />

      <Dialog open={!!selectedRequest && !!reviewStatus} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewStatus === "approved"
                ? "Approve Refund"
                : reviewStatus === "refunded"
                  ? "Mark Refunded"
                  : "Reject Refund"}
            </DialogTitle>
            
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
              <p className="font-medium">{formatAmount(Number(selectedRequest?.requested_amount || 0))}</p>
              <p className="mt-1 text-muted-foreground">{selectedRequest?.description}</p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">
                {reviewStatus === "rejected" ? "Reason" : "Finance message"}
              </p>
              <Textarea
                className="min-h-[120px]"
                value={financeMessage}
                onChange={(event) => setFinanceMessage(event.target.value)}
                placeholder={
                  reviewStatus === "rejected"
                    ? "Explain why the refund was rejected."
                    : "Optional note for the requester."
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button
              variant={reviewStatus === "rejected" ? "destructive" : "default"}
              onClick={handleSubmitReview}
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

export default FinanceClaims;

