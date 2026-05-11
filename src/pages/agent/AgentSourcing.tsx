import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ExternalLink, Eye } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDefaultCurrency } from "@/hooks/useDefaultCurrency";
import { supabase } from "@/integrations/supabase/client";
import { fetchAgentCustomers, getCurrentAgentId, type AgentCustomerRow } from "@/lib/agentPortal";
import {
  formatSourcingStatus,
  uploadSourcingPhoto,
  type SourcingPhotoRow,
  type SourcingQuoteRow,
} from "@/lib/sourcing";
import { sendNotification } from "@/lib/notifications";
import { ContextChat } from "@/components/shared/ContextChat";


type AgentSourcingRequest = {
  id: string;
  customer_id: string;
  product_name: string;
  description: string | null;
  quantity: number;
  budget: number | null;
  status: string;
  created_at: string;
  support_response_message?: string | null;
  support_response_at?: string | null;
  support_responded_by?: string | null;
  customer: {
    code: string | null;
    full_name: string | null;
  } | null;
};

const statusBadge = (status: string) => {
  const tone = status === "completed" || status === "approved" ? "default" : status === "pending" ? "outline" : "secondary";
  return <Badge variant={tone}>{formatSourcingStatus(status)}</Badge>;
};

const AgentSourcing = () => {
  const { formatAmount } = useDefaultCurrency();
  const [customers, setCustomers] = useState<AgentCustomerRow[]>([]);
  const [requests, setRequests] = useState<AgentSourcingRequest[]>([]);
  const [photos, setPhotos] = useState<SourcingPhotoRow[]>([]);
  const [quotes, setQuotes] = useState<SourcingQuoteRow[]>([]);
  const [activeTab, setActiveTab] = useState("create");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<AgentSourcingRequest | null>(null);
  const [form, setForm] = useState({
    customer_id: "",
    product_name: "",
    quantity: 1,
    budget: "",
    description: "",
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const agentId = await getCurrentAgentId();
      if (!agentId) {
        setCustomers([]);
        setRequests([]);
        setPhotos([]);
        setQuotes([]);
        return;
      }

      const customerRows = await fetchAgentCustomers(agentId);
      const customerIds = customerRows.map((customer) => customer.id);

      setCustomers(customerRows);

      if (customerIds.length === 0) {
        setRequests([]);
        setPhotos([]);
        setQuotes([]);
        return;
      }

      const { data, error } = await supabase
        .from("sourcing_requests")
        .select(
          "id, customer_id, product_name, description, quantity, budget, status, created_at, support_response_message, support_response_at, support_responded_by, customer:customers(code, full_name)",
        )
        .in("customer_id", customerIds)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const requestRows = ((data || []) as AgentSourcingRequest[]).map((row) => ({
        ...row,
        budget: row.budget === null ? null : Number(row.budget || 0),
      }));
      setRequests(requestRows);

      const requestIds = requestRows.map((request) => request.id);
      if (requestIds.length === 0) {
        setPhotos([]);
        setQuotes([]);
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

      setPhotos((photosRes.data || []) as SourcingPhotoRow[]);
      setQuotes(
        ((quotesRes.data || []) as SourcingQuoteRow[]).map((quote) => ({
          ...quote,
          quote_amount: Number(quote.quote_amount || 0),
        })),
      );
    } catch (error: any) {
      toast.error(error?.message || "Failed to load sourcing data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const groupedPhotos = useMemo(
    () =>
      photos.reduce<Record<string, SourcingPhotoRow[]>>((acc, photo) => {
        acc[photo.request_id] = [...(acc[photo.request_id] || []), photo];
        return acc;
      }, {}),
    [photos],
  );

  const groupedQuotes = useMemo(
    () =>
      quotes.reduce<Record<string, SourcingQuoteRow[]>>((acc, quote) => {
        acc[quote.request_id] = [...(acc[quote.request_id] || []), quote];
        return acc;
      }, {}),
    [quotes],
  );

  const metrics = useMemo(
    () => ({
      openOrders: requests.filter((request) => request.status !== "completed").length,
      supplierQuotes: quotes.length,
      productPhotos: photos.length,
    }),
    [photos.length, quotes.length, requests],
  );

  const handleFileSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFiles = Array.from(event.target.files || []);
    if (nextFiles.length === 0) return;
    setSelectedFiles((prev) => [...prev, ...nextFiles]);
    event.target.value = "";
  };

  const handleRemovePhoto = (fileName: string) => {
    setSelectedFiles((prev) => prev.filter((item) => item.name !== fileName));
  };

  const handleSubmit = async () => {
    if (!form.customer_id || !form.product_name.trim() || form.quantity <= 0) {
      toast.error("Select a client, product name, and a valid quantity.");
      return;
    }

    setIsSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from("sourcing_requests")
        .insert({
          customer_id: form.customer_id,
          product_name: form.product_name.trim(),
          quantity: form.quantity,
          budget: form.budget ? Number(form.budget) : null,
          description: form.description.trim() || null,
        })
        .select("id")
        .single();

      if (error) throw error;

      if (data?.id && selectedFiles.length > 0 && user?.id) {
        const uploads = await Promise.all(
          selectedFiles.map((file) => uploadSourcingPhoto(data.id, user.id, file)),
        );
        const inserts = uploads.map((upload) => ({ request_id: data.id, photo_url: upload.photo_url }));
        const { error: photoError } = await supabase.from("sourcing_request_photos").insert(inserts);
        if (photoError) throw photoError;
      }

      toast.success("Sourcing request created.");

      sendNotification({
        customer_id: form.customer_id,
        event_type: "sourcing_request_created",
        title: "Sourcing Request Submitted",
        message: `A sourcing request for "${form.product_name}" (qty: ${form.quantity}) has been submitted on your behalf. Our team will review it shortly.`,
        reference_id: data?.id,
      });

      setForm({ customer_id: "", product_name: "", quantity: 1, budget: "", description: "" });
      setSelectedFiles([]);
      setActiveTab("orders");
      await loadData();
    } catch (error: any) {
      toast.error(error?.message || "Failed to create sourcing request.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Sourcing Requests"
        
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">My Sourcing Orders</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold">{isLoading ? "..." : metrics.openOrders}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Supplier Quotes</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold">{isLoading ? "..." : metrics.supplierQuotes}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Product Photos</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold">{isLoading ? "..." : metrics.productPhotos}</div></CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-2 bg-transparent p-0">
          <TabsTrigger 
            value="create" 
            className="rounded-full border border-border/70 bg-background px-6 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Create New Request
          </TabsTrigger>
          <TabsTrigger 
            value="orders" 
            className="rounded-full border border-border/70 bg-background px-6 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            My Sourcing Orders
          </TabsTrigger>
          <div className="w-full" />
          <TabsTrigger 
            value="quotes" 
            className="rounded-full border border-border/70 bg-background px-6 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Supplier Codes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create">
          <Card>
            <CardHeader><CardTitle>Create New Sourcing Request</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label>Client *</Label>
                  <Select value={form.customer_id} onValueChange={(value) => setForm((prev) => ({ ...prev, customer_id: value }))}>
                    <SelectTrigger><SelectValue placeholder="Select a client" /></SelectTrigger>
                    <SelectContent>
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Product Name *</Label>
                  <Input value={form.product_name} onChange={(event) => setForm((prev) => ({ ...prev, product_name: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Quantity *</Label>
                  <Input type="number" min="1" value={form.quantity} onChange={(event) => setForm((prev) => ({ ...prev, quantity: Number(event.target.value) }))} />
                </div>
                <div className="space-y-2">
                  <Label>Budget</Label>
                  <Input type="number" min="0" value={form.budget} onChange={(event) => setForm((prev) => ({ ...prev, budget: event.target.value }))} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Description</Label>
                  <Textarea value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} placeholder="Add sourcing notes or specifications" rows={4} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Add Photo</Label>
                <Input type="file" accept="image/*" multiple onChange={handleFileSelection} />
                {selectedFiles.length > 0 ? (
                  <div className="flex items-center gap-2">
                    {selectedFiles.map((file) => (
                      <Badge key={`${file.name}-${file.size}`} variant="secondary" className="flex items-center gap-2">
                        {file.name}
                        <button type="button" onClick={() => handleRemovePhoto(file.name)} className="text-xs">x</button>
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>

              <Button onClick={handleSubmit} disabled={isSaving || isLoading} className="w-full">
                {isSaving ? "Saving..." : "Create Request"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders">
          <Card>
            <CardHeader><CardTitle>My Sourcing Orders</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading sourcing orders...</p>
              ) : requests.length === 0 ? (
                <p className="text-sm text-muted-foreground">No sourcing requests yet.</p>
              ) : (
                requests.map((request) => (
                  <div key={request.id} className="rounded-lg border p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{request.product_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {request.customer?.full_name || "Client"} • Qty: {request.quantity} • Created {format(new Date(request.created_at), "PP")}
                        </p>
                      </div>
                      {statusBadge(request.status)}
                    </div>
                    <p className="text-sm text-muted-foreground">{request.description || "No description provided."}</p>
                    {request.budget !== null ? (
                      <p className="text-sm text-muted-foreground">Budget: {formatAmount(request.budget)}</p>
                    ) : null}
                    <div className="flex items-center gap-2">
                      <Button size="icon" variant="ghost" className="h-8 w-8 p-0" onClick={() => setSelectedRequest(request)} title="View details">
                        <Eye className="h-4 w-4 text-blue-600" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quotes">
          <Card>
            <CardHeader><CardTitle>Supplier Quotes</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading supplier quotes...</p>
              ) : requests.length === 0 ? (
                <p className="text-sm text-muted-foreground">No sourcing requests yet.</p>
              ) : (
                requests.map((request) => (
                  <div key={request.id} className="rounded-lg border p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{request.product_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {request.customer?.full_name || "Client"} • Request ID: {request.id}
                        </p>
                      </div>
                      {statusBadge(request.status)}
                    </div>
                    {(groupedQuotes[request.id] || []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">No supplier quotes for this request yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {(groupedQuotes[request.id] || []).map((quote) => (
                          <div key={quote.id} className="rounded-md border p-3 text-sm">
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
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedRequest} onOpenChange={(open) => !open && setSelectedRequest(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sourcing Order Details</DialogTitle>
            
          </DialogHeader>
          {selectedRequest ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Client</p>
                  <p className="font-medium">{selectedRequest.customer?.full_name || "Client"}</p>
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
                <p className="text-sm font-medium">Uploaded Photos</p>
                {(groupedPhotos[selectedRequest.id] || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No photos uploaded.</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {(groupedPhotos[selectedRequest.id] || []).map((photo) => (
                      <div key={photo.id} className="rounded-lg border p-3 space-y-2">
                        <img src={photo.photo_url} alt={selectedRequest.product_name} className="h-40 w-full rounded-md object-cover" />
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
                {(groupedQuotes[selectedRequest.id] || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No supplier quotes yet.</p>
                ) : (
                  <div className="space-y-2">
                    {(groupedQuotes[selectedRequest.id] || []).map((quote) => (
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

export default AgentSourcing;

