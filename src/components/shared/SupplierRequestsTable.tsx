import { useState } from "react";
import { format } from "date-fns";
import { Eye, FileUp, Loader2, Trash2, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable, Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ContextChat } from "@/components/shared/ContextChat";
import {
  SupplierPaymentRequest,
  deleteSupplierPaymentRequest,
  getPaymentMethodLabel,
  getStatusLabel,
  PAYMENT_PURPOSES,
} from "@/lib/supplierPayments";
import { toast } from "sonner";

interface SupplierRequestsTableProps {
  requests: SupplierPaymentRequest[];
  isLoading: boolean;
  onRefresh: () => void;
  showCustomer?: boolean;
  canDelete?: boolean;
  formatAmount?: (amount: number, fromCode?: string) => string;
}

const SupplierRequestsTable = ({
  requests,
  isLoading,
  onRefresh,
  showCustomer = false,
  canDelete = true,
  formatAmount,
}: SupplierRequestsTableProps) => {
  const [viewRequest, setViewRequest] = useState<SupplierPaymentRequest | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
      onRefresh();
    } catch {
      toast.error("Failed to delete request.");
    } finally {
      setDeletingId(null);
    }
  };

  const columns: Column<SupplierPaymentRequest>[] = [
    {
      key: "request_code",
      label: "Request ID",
      render: (row) => <span className="font-mono text-xs">{row.request_code}</span>,
    },
    ...(showCustomer
      ? [
          {
            key: "customer" as keyof SupplierPaymentRequest,
            label: "Customer",
            render: (row: SupplierPaymentRequest) =>
              row.customer?.full_name || "-",
          },
        ]
      : []),
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
          {row.total_payable != null && formatAmount && (
            <p className="text-xs text-muted-foreground">
              ≈ {formatAmount(row.total_payable, 'ZMW')}
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
            size="icon"
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={() => setViewRequest(row)}
            title="View details"
          >
            <Eye className="h-4 w-4 text-blue-600" />
          </Button>
          {canDelete && (row.status === "pending_review" || row.status === "draft") && (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 p-0"
              disabled={deletingId === row.id}
              onClick={() => handleDelete(row)}
              title="Delete request"
            >
              {deletingId === row.id ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <Trash2 className="h-4 w-4 text-destructive" />
              )}
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={requests}
        isLoading={isLoading}
        searchPlaceholder="Search supplier payment requests..."
      />

      {/* View Details Dialog */}
      <Dialog open={!!viewRequest} onOpenChange={(open) => !open && setViewRequest(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Supplier Payment Request</DialogTitle>
          </DialogHeader>

          {viewRequest && (
            <div className="space-y-6">
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
                      <span className="text-green-700 font-medium">Terms and conditions accepted</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 text-red-500" />
                      <span className="text-red-600 font-medium">Terms not accepted</span>
                    </>
                  )}
                </div>
              </div>


              {/* Timestamps */}
              <div className="grid gap-2 sm:grid-cols-2 text-xs text-muted-foreground">
                <p>Submitted: {formatDateTime(viewRequest.created_at)}</p>
                <p>Updated: {formatDateTime(viewRequest.updated_at)}</p>
                {viewRequest.reviewed_at && <p>Reviewed: {formatDateTime(viewRequest.reviewed_at)}</p>}
              </div>

              {showCustomer && viewRequest.customer && (
                <div className="text-xs text-muted-foreground">
                  Customer: {viewRequest.customer.full_name || "Unknown customer"} ({viewRequest.customer.code || "N/A"})
                </div>
              )}
                <div className="pt-4 border-t">
                  <ContextChat
                    contextId={viewRequest.id}
                    contextType="supplier_payment"
                    customerId={viewRequest.customer_id}
                    subject={`Supplier Payment Chat: ${viewRequest.request_code}`}
                    description={`Chat regarding supplier payment request ${viewRequest.request_code} for ${viewRequest.supplier_name}`}
                  />
                </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setViewRequest(null)} className="w-full sm:w-auto">
                  Close
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SupplierRequestsTable;
