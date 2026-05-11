import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import SearchableSelect from "@/components/shared/SearchableSelect";
import SupplierPaymentForm from "@/components/shared/SupplierPaymentForm";
import SupplierRequestsTable from "@/components/shared/SupplierRequestsTable";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthContext } from "@/components/auth/AuthContext";
import { useDefaultCurrency } from "@/hooks/useDefaultCurrency";
import { fetchAgentCustomers, getCurrentAgentId, type AgentCustomerRow } from "@/lib/agentPortal";
import {
  SupplierPaymentRequest,
  fetchSupplierPaymentRequests,
} from "@/lib/supplierPayments";
import { toast } from "sonner";

const AgentSupplierRequests = () => {
  const { user } = useAuthContext();
  const { formatAmount } = useDefaultCurrency();
  const [activeTab, setActiveTab] = useState("new");
  const [customers, setCustomers] = useState<AgentCustomerRow[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [requests, setRequests] = useState<SupplierPaymentRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);

  useEffect(() => {
    const load = async () => {
      setIsLoadingCustomers(true);
      try {
        const agentId = await getCurrentAgentId();
        if (!agentId) return;
        const rows = await fetchAgentCustomers(agentId);
        setCustomers(rows);
      } catch {
        toast.error("Failed to load customers.");
      } finally {
        setIsLoadingCustomers(false);
      }
    };
    load();
  }, []);

  const loadRequests = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const data = await fetchSupplierPaymentRequests({ submitted_by: user.id });
      setRequests(data);
    } catch {
      toast.error("Failed to load supplier payment requests.");
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const pendingCount = requests.filter((r) => r.status === "pending_review").length;
  const processingCount = requests.filter((r) => r.status === "processing").length;
  const completedCount = requests.filter((r) => r.status === "completed").length;

  const customerOptions = customers.map((c) => ({
    value: c.id,
    label: c.full_name || c.code || c.id,
    description: c.code,
    keywords: c.phone || "",
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Supplier Requests"
        
      />

      {/* Summary Cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card className="border-border/70">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Requests</p>
            <p className="mt-1 text-2xl font-semibold">{requests.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/70">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Pending Review</p>
            <p className="mt-1 text-2xl font-semibold">{pendingCount}</p>
          </CardContent>
        </Card>
        <Card className="border-border/70">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Processing</p>
            <p className="mt-1 text-2xl font-semibold">{processingCount}</p>
          </CardContent>
        </Card>
        <Card className="border-border/70">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Completed</p>
            <p className="mt-1 text-2xl font-semibold">{completedCount}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-auto w-full flex-wrap justify-start gap-2 rounded-2xl bg-transparent p-0">
          <TabsTrigger
            value="new"
            className="rounded-full border border-border/70 bg-background px-4 data-[state=active]:border-primary/40 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            New Request
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="rounded-full border border-border/70 bg-background px-4 data-[state=active]:border-primary/40 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Submitted Requests ({requests.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="new" className="mt-4">
          <div className="space-y-4">
            <Card className="border-border/70">
              <CardContent className="p-4">
                <div className="max-w-sm space-y-2">
                  <Label>Select Client *</Label>
                  <SearchableSelect
                    value={selectedCustomerId}
                    onValueChange={setSelectedCustomerId}
                    options={customerOptions}
                    placeholder={isLoadingCustomers ? "Loading clients..." : "Select a client"}
                    disabled={isLoadingCustomers}
                  />
                </div>
              </CardContent>
            </Card>

            {selectedCustomerId && user?.id && (
              <SupplierPaymentForm
                customerId={selectedCustomerId}
                submittedByUserId={user.id}
                submittedByRole="agent"
                dashboardPath="/agent/dashboard"
              />
            )}

            {!selectedCustomerId && (
              <Card className="border-border/70">
                <CardContent className="flex items-center justify-center p-12 text-muted-foreground">
                  Please select a client above to begin a supplier payment request.
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <SupplierRequestsTable
            requests={requests}
            isLoading={isLoading}
            onRefresh={loadRequests}
            showCustomer
            canDelete
            formatAmount={formatAmount}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AgentSupplierRequests;

