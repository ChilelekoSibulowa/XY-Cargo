import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Boxes, ExternalLink, Eye, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useDefaultCurrency } from "@/hooks/useDefaultCurrency";
import { sendNotification } from "@/lib/notifications";
import {
  formatSourcingStatus,
  type SourcingPhotoRow,
  type SourcingQuoteRow,
  type SourcingRequestRow,
} from "@/lib/sourcing";
import { ContextChat } from "@/components/shared/ContextChat";


type SupportSourcingRow = SourcingRequestRow & {
  customer: {
    code: string | null;
    full_name: string | null;
  } | null;
};

const SupportSourcingRequests = () => {
  const { formatAmount } = useDefaultCurrency();
  const [rows, setRows] = useState<SupportSourcingRow[]>([]);
  const [photoMap, setPhotoMap] = useState<Record<string, SourcingPhotoRow[]>>({});
  const [quoteMap, setQuoteMap] = useState<Record<string, SourcingQuoteRow[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<SupportSourcingRow | null>(null);
  const [isSending, setIsSending] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("sourcing_requests")
        .select(
          "id, customer_id, product_name, description, quantity, budget, status, created_at, updated_at, support_response_message, support_response_at, support_responded_by, customer:customers(code, full_name)",
        )
        .order("created_at", { ascending: false });

      if (error) throw error;

      const requestRows = ((data || []) as SupportSourcingRow[]).map((row) => ({
        ...row,
        budget: row.budget === null ? null : Number(row.budget || 0),
      }));
      setRows(requestRows);

      const requestIds = requestRows.map((row) => row.id);
      if (requestIds.length === 0) {
        setPhotoMap({});
        setQuoteMap({});
        return;
      }

      const [photosRes, quotesRes] = await Promise.all([
        supabase
          .from("sourcing_request_photos")
          .select("id, request_id, photo_url, created_at")
          .in("request_id", requestIds),
        supabase
          .from("sourcing_quotes")
          .select("id, request_id, supplier_name, quote_amount, status, notes, created_at")
          .in("request_id", requestIds),
      ]);

      if (photosRes.error) throw photosRes.error;
      if (quotesRes.error) throw quotesRes.error;

      setPhotoMap(
        ((photosRes.data || []) as SourcingPhotoRow[]).reduce<Record<string, SourcingPhotoRow[]>>((acc, photo) => {
          acc[photo.request_id] = [...(acc[photo.request_id] || []), photo];
          return acc;
        }, {}),
      );

      setQuoteMap(
        ((quotesRes.data || []) as SourcingQuoteRow[]).reduce<Record<string, SourcingQuoteRow[]>>((acc, quote) => {
          acc[quote.request_id] = [...(acc[quote.request_id] || []), { ...quote, quote_amount: Number(quote.quote_amount || 0) }];
          return acc;
        }, {}),
      );
    } catch (error: any) {
      toast.error(error?.message || "Failed to load sourcing requests.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);


  const summary = useMemo(
    () => ({
      total: rows.length,
    }),
    [rows],
  );


  const columns: Column<SupportSourcingRow>[] = [
    {
      key: "customer",
      label: "Customer",
      render: (item) => item.customer?.full_name || item.customer?.code || "Customer",
    },
    { key: "product_name", label: "Product Name" },
    { key: "quantity", label: "Quantity" },
    {
      key: "budget",
      label: "Budget",
      render: (item) => (item.budget === null ? "-" : formatAmount(item.budget)),
    },
    {
      key: "status",
      label: "Status",
      render: (item) => <Badge variant="outline">{formatSourcingStatus(item.status)}</Badge>,
    },
    {
      key: "photos",
      label: "Images",
      render: (item) => {
        const count = (photoMap[item.id] || []).length;
        return count === 0 ? "No images" : `${count} image(s)`;
      },
    },
    {
      key: "created_at",
      label: "Created",
      render: (item) => format(new Date(item.created_at), "dd MMM yyyy"),
    },
    {
      key: "action",
      label: "Action",
      render: (item) => (
        <Button size="icon" variant="ghost" className="h-8 w-8 p-0" onClick={() => setSelectedRequest(item)} title="View request">
          <Eye className="h-4 w-4 text-blue-600" />
        </Button>
      ),
    },
  ];

  const selectedPhotos = selectedRequest ? photoMap[selectedRequest.id] || [] : [];
  const selectedQuotes = selectedRequest ? quoteMap[selectedRequest.id] || [] : [];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Sourcing Requests"
        
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Total Requests</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold">{isLoading ? "..." : summary.total}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Boxes className="h-4 w-4" />
            Sourcing Queue
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={rows}
            isLoading={isLoading}
            searchPlaceholder="Search sourcing requests..."
          />
        </CardContent>
      </Card>

      <Dialog open={!!selectedRequest} onOpenChange={(open) => !open && setSelectedRequest(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sourcing Request Details</DialogTitle>
            
          </DialogHeader>

          {selectedRequest ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Customer</p>
                  <p className="font-medium">{selectedRequest.customer?.full_name || selectedRequest.customer?.code || "Customer"}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Product Name</p>
                  <p className="font-medium">{selectedRequest.product_name}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Quantity</p>
                  <p className="font-medium">{selectedRequest.quantity}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Budget</p>
                  <p className="font-medium">{selectedRequest.budget === null ? "-" : formatAmount(selectedRequest.budget)}</p>
                </div>
              </div>

              <div className="rounded-lg border p-3 text-sm">
                <p className="text-xs text-muted-foreground">Description</p>
                <p className="mt-1 whitespace-pre-wrap">{selectedRequest.description || "No description provided."}</p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Product Images</p>
                {selectedPhotos.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    No images uploaded for this request.
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {selectedPhotos.map((photo) => (
                      <div key={photo.id} className="rounded-lg border p-3 space-y-2">
                        <img
                          src={photo.photo_url}
                          alt={selectedRequest.product_name}
                          className="h-40 w-full rounded-md object-cover"
                        />
                        <Button asChild size="sm" variant="outline" className="w-full">
                          <a href={photo.photo_url} target="_blank" rel="noreferrer">
                            <ExternalLink className="mr-2 h-4 w-4" />
                            View Image
                          </a>
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Supplier Quotes</p>
                {selectedQuotes.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    No supplier quotes have been added yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedQuotes.map((quote) => (
                      <div key={quote.id} className="rounded-lg border p-3 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium">{quote.supplier_name}</p>
                          <Badge variant="outline">{formatSourcingStatus(quote.status)}</Badge>
                        </div>
                        <p className="mt-1 text-muted-foreground">{formatAmount(Number(quote.quote_amount || 0))}</p>
                        {quote.notes ? <p className="mt-1 text-muted-foreground">{quote.notes}</p> : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>

                <div className="pt-4 border-t">
                  <ContextChat
                    contextId={selectedRequest.id}
                    contextType="sourcing"
                    customerId={selectedRequest.customer_id}
                    subject={`Sourcing Chat: ${selectedRequest.product_name}`}
                    description={`Chat regarding sourcing request for ${selectedRequest.product_name} (Qty: ${selectedRequest.quantity})`}
                  />
                </div>
              </div>
            ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedRequest(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SupportSourcingRequests;

