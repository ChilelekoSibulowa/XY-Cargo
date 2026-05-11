import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import SupplierPaymentForm from "@/components/shared/SupplierPaymentForm";
import SupplierRequestsTable from "@/components/shared/SupplierRequestsTable";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthContext } from "@/components/auth/AuthContext";
import { useCustomerRecord } from "@/hooks/useCustomerRecord";
import { useDefaultCurrency } from "@/hooks/useDefaultCurrency";
import {
  SupplierPaymentRequest,
  fetchSupplierPaymentRequests,
} from "@/lib/supplierPayments";
import { toast } from "sonner";

const CustomerSupplierRequests = () => {
  const { user } = useAuthContext();
  const { customer } = useCustomerRecord();
  const { formatAmount } = useDefaultCurrency();
  const [activeTab, setActiveTab] = useState("new");
  const [requests, setRequests] = useState<SupplierPaymentRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadRequests = useCallback(async () => {
    if (!customer?.id) return;
    setIsLoading(true);
    try {
      const data = await fetchSupplierPaymentRequests({ customer_id: customer.id });
      setRequests(data);
    } catch {
      toast.error("Failed to load supplier payment requests.");
    } finally {
      setIsLoading(false);
    }
  }, [customer?.id]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const pendingCount = requests.filter((r) => r.status === "pending_review").length;
  const processingCount = requests.filter((r) => r.status === "processing").length;
  const completedCount = requests.filter((r) => r.status === "completed").length;

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
            My Requests ({requests.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="new" className="mt-4">
          {customer?.id && user?.id && (
            <SupplierPaymentForm
              customerId={customer.id}
              submittedByUserId={user.id}
              submittedByRole="customer"
              dashboardPath="/customer/dashboard"
            />
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <SupplierRequestsTable
            requests={requests}
            isLoading={isLoading}
            onRefresh={loadRequests}
            canDelete
            formatAmount={formatAmount}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CustomerSupplierRequests;

