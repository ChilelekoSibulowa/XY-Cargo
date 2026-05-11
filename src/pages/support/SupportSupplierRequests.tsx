import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Eye, FileUp, Loader2, Trash2, CheckCircle2, ArrowRight, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useAuthContext } from "@/components/auth/AuthContext";
import { useDefaultCurrency } from "@/hooks/useDefaultCurrency";
import {
  SupplierPaymentRequest,
  deleteSupplierPaymentRequest,
  fetchAllSupplierPaymentRequests,
  getPaymentMethodLabel,
  getStatusLabel,
  PAYMENT_PURPOSES,
  updateSupplierPaymentRequestResponse,
  updateSupplierPaymentRequestStatus,
} from "@/lib/supplierPayments";
import { sendNotification } from "@/lib/notifications";
import { ContextChat } from "@/components/shared/ContextChat";
import { toast } from "sonner";

const SupportSupplierRequests = () => {
  const { user } = useAuthContext();
  const { formatAmount } = useDefaultCurrency();
  const [requests, setRequests] = useState<SupplierPaymentRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewRequest, setViewRequest] = useState<SupplierPaymentRequest | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [isSendingResponse, setIsSendingResponse] = useState(false);

  const loadRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchAllSupplierPaymentRequests();
      setRequests(data);
    } catch {
      toast.error("Failed to load supplier payment requests.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const pendingCount = requests.filter((r) => r.status === "pending_review").length;
  const processingCount = requests.filter((r) => r.status === "processing").length;
  const completedCount = requests.filter((r) => r.status === "completed").length;

  const formatDate = (value: string | null | undefined) => {
    if (!value) return "-";
    try {
      return format(new Date(value), "dd MMM yyyy");
    } catch {
      return value;
    }
  };

  const formatDateTime = (value: string | null | undefined) => {
    if (!value) return "-";
    try {
      return format(new Date(value), "dd MMM yyyy, HH:mm");
    } catch {
      return value;
    }
  };

  const formatCurrency = (amount: number | null | undefined, currency?: string) => {
    if (amount == null) return "-";
    const formatted = amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return currency ? `${currency} ${formatted}` : formatted;
  };

  const handleDelete = async (request: SupplierPaymentRequest) => {
    if (!confirm(`Delete payment request ${request.request_code}? This cannot be undone.`)) return;
    setDeletingId(request.id);
    try {
      await deleteSupplierPaymentRequest(request.id);
      toast.success("Payment request deleted.");
      loadRequests();
    } catch {
      toast.error("Failed to delete request.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleStatusChange = async (request: SupplierPaymentRequest, newStatus: string) => {
    setUpdatingStatusId(request.id);
    try {
      await updateSupplierPaymentRequestStatus(request.id, newStatus, user?.id);
      toast.success(`Status updated to ${getStatusLabel(newStatus)}.`);

      // Notify customer
      try {
        await sendNotification({
          customer_id: request.customer_id,
          event_type: "supplier_payment_status",
          title: "Supplier Payment Update",
          message: `Your supplier payment request (${request.request_code}) status has been updated to: ${getStatusLabel(newStatus)}.`,
          sms_message: `XY Cargo: Supplier payment ${request.request_code} is now ${getStatusLabel(newStatus)}.`,
          reference_id: request.id,
          notification_type: "payment",
        });
      } catch {
        // non-blocking
      }

      // Update local state
      setRequests((prev) =>
        prev.map((r) =>
          r.id === request.id ? { ...r, status: newStatus, updated_at: new Date().toISOString() } : r,
        ),
      );
      if (viewRequest?.id === request.id) {
        setViewRequest((prev) => (prev ? { ...prev, status: newStatus, updated_at: new Date().toISOString() } : prev));
      }
    } catch {
      toast.error("Failed to update status.");
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const openRequest = (request: SupplierPaymentRequest) => {
    setViewRequest(request);
  };


  const columns: Column<SupplierPaymentRequest>[] = [
    {
      key: "request_code",
      label: "Request ID",
      render: (row) => <span className="font-mono text-xs">{row.request_code}</span>,
    },
    {
      key: "customer",
      label: "Customer",
      render: (row) => (
        <div>
          <p className="font-medium">{row.customer?.full_name || "-"}</p>
          <p className="text-xs text-muted-foreground">{row.customer?.code || ""}</p>
        </div>
      ),
    },
    {
      key: "supplier_name",
      label: "Supplier",
      render: (row) => (
        <div>
          <p className="font-medium">{row.supplier_name}</p>
          <p className="text-xs text-muted-foreground">{row.company_name}</p>
        </div>
      ),
    },
    {
      key: "amount",
      label: "Amount",
      render: (row) => (
        <div>
          <p className="font-medium">{formatAmount ? formatAmount(row.amount, row.currency) : formatCurrency(row.amount, row.currency)}</p>
          {row.total_payable != null && (
            <p className="text-xs text-muted-foreground">
              {formatAmount ? `≈ ${formatAmount(row.total_payable, 'ZMW')}` : `≈ ZMW ${row.total_payable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "payment_method",
      label: "Method",
      render: (row) => <Badge variant="outline">{getPaymentMethodLabel(row.payment_method)}</Badge>,
    },
    {
      key: "status",
      label: "Status",
      render: (row) => <StatusBadge status={row.status} label={getStatusLabel(row.status)} />,
    },
    {
      key: "created_at",
      label: "Date",
      render: (row) => formatDate(row.created_at),
    },
    {
      key: "actions",
      label: "Actions",
      render: (row) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 p-0"
            onClick={() => openRequest(row)}
            title="View details"
          >
            <Eye className="h-4 w-4 text-blue-600" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 p-0"
            disabled={deletingId === row.id}
            onClick={() => handleDelete(row)}
            title="Delete request"
          >
            {deletingId === row.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4 text-destructive" />
            )}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Supplier Payment Requests"
        
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Card className="border-border/70">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Requests</p>
            <p className="mt-1 text-2xl font-semibold">{requests.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/70">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Pending Review</p>
            <p className="mt-1 text-2xl font-semibold text-amber-600">{pendingCount}</p>
          </CardContent>
        </Card>
        <Card className="border-border/70">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Processing</p>
            <p className="mt-1 text-2xl font-semibold text-blue-600">{processingCount}</p>
          </CardContent>
        </Card>
        <Card className="border-border/70">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Completed</p>
            <p className="mt-1 text-2xl font-semibold text-green-600">{completedCount}</p>
          </CardContent>
        </Card>
      </div>

      <DataTable
        columns={columns}
        data={requests}
        isLoading={isLoading}
        searchPlaceholder="Search by request ID, supplier, customer..."
      />

      {/* View Details Dialog */}
      <Dialog open={!!viewRequest} onOpenChange={(open) => !open && setViewRequest(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Supplier Payment Request</DialogTitle>
            
          </DialogHeader>

          {viewRequest && (
            <div className="space-y-6">
              {/* Customer */}
              {viewRequest.customer && (
                <div className="rounded-xl border border-border/70 p-4 space-y-1">
                  <h3 className="text-sm font-semibold">Customer</h3>
                  <p className="text-sm">{viewRequest.customer.full_name} ({viewRequest.customer.code})</p>
                  {viewRequest.customer.phone && (
                    <p className="text-xs text-muted-foreground">Phone: {viewRequest.customer.phone}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Submitted by: {viewRequest.submitted_by_role === "agent" ? "Agent" : "Customer"}
                  </p>
                </div>
              )}

              {/* Supplier Details */}
              <div className="rounded-xl border border-border/70 p-4 space-y-2">
                <h3 className="text-sm font-semibold">Supplier Information</h3>
                <div className="grid gap-2 sm:grid-cols-2 text-sm">
                  <p><span className="text-muted-foreground">Name:</span> {viewRequest.supplier_name}</p>
                  <p><span className="text-muted-foreground">Company:</span> {viewRequest.company_name}</p>
                  <p><span className="text-muted-foreground">Country:</span> {viewRequest.supplier_country}</p>
                  <p><span className="text-muted-foreground">WhatsApp/WeChat:</span> {viewRequest.whatsapp_wechat}</p>
                  {viewRequest.supplier_email && (
                    <p><span className="text-muted-foreground">Email:</span> {viewRequest.supplier_email}</p>
                  )}
                  {viewRequest.supplier_address && (
                    <p><span className="text-muted-foreground">Address:</span> {viewRequest.supplier_address}</p>
                  )}
                </div>
              </div>

              {/* Payment Details */}
              <div className="rounded-xl border border-border/70 p-4 space-y-2">
                <h3 className="text-sm font-semibold">Payment Details</h3>
                <div className="grid gap-2 sm:grid-cols-2 text-sm">
                  <p><span className="text-muted-foreground">Method:</span> {getPaymentMethodLabel(viewRequest.payment_method)}</p>
                  <p><span className="text-muted-foreground">Currency:</span> {viewRequest.currency}</p>
                  <p><span className="text-muted-foreground">Amount:</span> {formatAmount ? formatAmount(viewRequest.amount, viewRequest.currency) : formatCurrency(viewRequest.amount, viewRequest.currency)}</p>
                  <p><span className="text-muted-foreground">Purpose:</span> {PAYMENT_PURPOSES.find((p) => p.value === viewRequest.purpose)?.label || viewRequest.purpose}</p>
                  {viewRequest.description && (
                    <p className="sm:col-span-2"><span className="text-muted-foreground">Notes:</span> {viewRequest.description}</p>
                  )}
                </div>

                {viewRequest.payment_method === "bank_transfer" && (
                  <div className="mt-3 space-y-2 border-t border-border/50 pt-3">
                    <p className="text-xs font-medium text-muted-foreground">Bank Details</p>
                    <div className="grid gap-2 sm:grid-cols-2 text-sm">
                      <p><span className="text-muted-foreground">Bank:</span> {viewRequest.bank_name || "-"}</p>
                      <p><span className="text-muted-foreground">Country:</span> {viewRequest.bank_country || "-"}</p>
                      <p><span className="text-muted-foreground">Account Name:</span> {viewRequest.account_name || "-"}</p>
                      <p><span className="text-muted-foreground">SWIFT Code:</span> {viewRequest.swift_code || "-"}</p>
                      <p><span className="text-muted-foreground">Account / IBAN:</span> {viewRequest.account_number_iban || "-"}</p>
                      {viewRequest.branch && <p><span className="text-muted-foreground">Branch:</span> {viewRequest.branch}</p>}
                    </div>
                  </div>
                )}
              </div>

              {/* Charges */}
              <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4 space-y-1">
                <h3 className="text-sm font-semibold">Charges</h3>
                <div className="text-sm space-y-1">
                  <p><span className="text-muted-foreground">Exchange Rate:</span> 1 {viewRequest.currency} = {viewRequest.exchange_rate ?? "-"} ZMW</p>
                  <p>
                    <span className="text-muted-foreground">Total Payable:</span>{" "}
                    <span className="text-lg font-bold">
                      {formatAmount && viewRequest.total_payable ? formatAmount(viewRequest.total_payable, 'ZMW') : `ZMW ${viewRequest.total_payable?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "-"}`}
                    </span>
                  </p>
                </div>
              </div>

              {/* Documents */}
              {viewRequest.documents && viewRequest.documents.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Documents ({viewRequest.documents.length})</h3>
                  <div className="flex flex-wrap gap-2">
                    {viewRequest.documents.map((doc, i) => (
                      <a
                        key={`${doc.name}-${i}`}
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-border/70 px-2 py-1 text-xs hover:bg-muted transition-colors"
                      >
                        <FileUp className="h-3 w-3" /> {doc.name}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Declaration / Terms Acceptance */}
              <div className="rounded-xl border border-border/70 p-4 space-y-1">
                <h3 className="text-sm font-semibold">Declaration &amp; Terms</h3>
                <div className="flex items-center gap-2 text-sm">
                  {viewRequest.declaration_accepted ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="text-green-700 font-medium">Customer accepted terms and conditions</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 text-red-500" />
                      <span className="text-red-600 font-medium">Terms not accepted</span>
                    </>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  The customer confirmed that all information provided is accurate, authorized the payment, and agreed to the service charges and exchange rate.
                </p>
              </div>

              {/* Status Actions */}
              <div className="rounded-xl border border-border/70 p-4 space-y-3">
                <h3 className="text-sm font-semibold">Update Status</h3>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm text-muted-foreground">Current:</span>
                  <StatusBadge status={viewRequest.status} label={getStatusLabel(viewRequest.status)} />
                </div>

                {/* Primary action buttons based on current status */}
                <div className="flex flex-wrap gap-2">
                  {viewRequest.status === "pending_review" && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => handleStatusChange(viewRequest, "processing")}
                        disabled={updatingStatusId === viewRequest.id}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {updatingStatusId === viewRequest.id ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <ArrowRight className="h-4 w-4 mr-1" />
                        )}
                        Start Processing
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleStatusChange(viewRequest, "rejected")}
                        disabled={updatingStatusId === viewRequest.id}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                    </>
                  )}
                  {viewRequest.status === "processing" && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => handleStatusChange(viewRequest, "completed")}
                        disabled={updatingStatusId === viewRequest.id}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {updatingStatusId === viewRequest.id ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                        )}
                        Mark Completed
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleStatusChange(viewRequest, "rejected")}
                        disabled={updatingStatusId === viewRequest.id}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                    </>
                  )}
                  {viewRequest.status === "completed" && (
                    <p className="text-sm text-green-600 font-medium flex items-center gap-1">
                      <CheckCircle2 className="h-4 w-4" /> This request has been completed.
                    </p>
                  )}
                  {viewRequest.status === "rejected" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStatusChange(viewRequest, "pending_review")}
                      disabled={updatingStatusId === viewRequest.id}
                    >
                      {updatingStatusId === viewRequest.id ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <ArrowRight className="h-4 w-4 mr-1" />
                      )}
                      Re-open for Review
                    </Button>
                  )}
                  {viewRequest.status === "draft" && (
                    <Button
                      size="sm"
                      onClick={() => handleStatusChange(viewRequest, "pending_review")}
                      disabled={updatingStatusId === viewRequest.id}
                    >
                      {updatingStatusId === viewRequest.id ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <ArrowRight className="h-4 w-4 mr-1" />
                      )}
                      Move to Pending Review
                    </Button>
                  )}
                </div>
              </div>


              {/* Timestamps */}
              <div className="grid gap-2 sm:grid-cols-2 text-xs text-muted-foreground">
                <p>Submitted: {formatDateTime(viewRequest.created_at)}</p>
                <p>Updated: {formatDateTime(viewRequest.updated_at)}</p>
                {viewRequest.reviewed_at && <p>Reviewed: {formatDateTime(viewRequest.reviewed_at)}</p>}
              </div>
                <div className="pt-4 border-t">
                  <ContextChat
                    contextId={viewRequest.id}
                    contextType="supplier_payment"
                    customerId={viewRequest.customer_id}
                    subject={`Supplier Payment Chat: ${viewRequest.request_code}`}
                    description={`Chat regarding supplier payment request ${viewRequest.request_code} for ${viewRequest.supplier_name}`}
                  />
                </div>
              </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewRequest(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SupportSupplierRequests;

