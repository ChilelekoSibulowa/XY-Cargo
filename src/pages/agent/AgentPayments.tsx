import { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CheckCircle, Clock, CreditCard, ExternalLink, Eye, FileText, Loader2, Smartphone, Wallet, XCircle, Plus, UserCheck, PlusCircle, ShieldCheck, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { escapeHtml } from "@/lib/financePortal";
import { useDefaultCurrency } from "@/hooks/useDefaultCurrency";
import {
  fetchAgentPayments,
  fetchAgentShipments,
  fetchAgentWalletBalance,
  getCurrentAgentId,
  isAgentBillableShipment,
  getShipmentInvoiceTotal,
  getShipmentOutstandingBalance,
  type AgentCustomerRow,
  type AgentPaymentRow,
  type AgentShipmentRow,
} from "@/lib/agentPortal";
import {
  getInvoiceOutstandingBalance,
  getInvoicePaidAmount,
  getPortalInvoiceReference,
  mapPortalInvoiceRow,
  type PortalInvoiceRow,
} from "@/lib/financePortal";
import { getWarehouseTrackingNumber, resolveTrackingByStatus } from "@/lib/shipmentNotes";
import { fetchLogo } from "@/hooks/useLogo";
import { toast } from "sonner";
import { generateInvoicePdf } from "@/lib/invoicePdfGenerator";

const getFunctionErrorMessage = async (error: any, fallback: string) => {
  if (error?.context) {
    try {
      const payload = await error.context.json();
      if (typeof payload?.error === "string" && payload.error.trim()) return payload.error;
      if (typeof payload?.details === "string" && payload.details.trim()) return payload.details;
      if (payload?.details?.error) return payload.details.error;
    } catch {
      // ignore body parsing and use fallback
    }
  }

  return error?.message || fallback;
};

const hasUsablePhone = (value: string | null | undefined) => {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === "pending") return false;
  return trimmed.replace(/\D/g, "").length >= 9;
};

type PendingPaymentType = "shipment_payment" | "agent_wallet_topup";

const AgentPayments = () => {
  const { code, defaultCode, convert, convertFromSelected, formatAmount } = useDefaultCurrency();
  const [searchParams, setSearchParams] = useSearchParams();
  const [customers, setCustomers] = useState<AgentCustomerRow[]>([]);
  const [shipments, setShipments] = useState<AgentShipmentRow[]>([]);
  const [invoices, setInvoices] = useState<PortalInvoiceRow[]>([]);
  const [payments, setPayments] = useState<AgentPaymentRow[]>([]);
  const [selectedShipmentId, setSelectedShipmentId] = useState("");
  const [amount, setAmount] = useState(0);
  const [displayAmount, setDisplayAmount] = useState("");
  const [clientPaymentPhone, setClientPaymentPhone] = useState("");
  const [agentTopUpPhone, setAgentTopUpPhone] = useState("");
  const [agentUserId, setAgentUserId] = useState("");
  const [agentWalletBalance, setAgentWalletBalance] = useState(0);
  const [agentWalletTopUpAmount, setAgentWalletTopUpAmount] = useState(0);
  const [displayAgentWalletTopUpAmount, setDisplayAgentWalletTopUpAmount] = useState("");
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "mobile_money">("mobile_money");
  const [payFrom, setPayFrom] = useState<"wallet_agent" | "lipila">("lipila");
  const [pendingPaymentCode, setPendingPaymentCode] = useState("");
  const [pendingPaymentType, setPendingPaymentType] = useState<PendingPaymentType | null>(null);
  const [pendingPaymentAmount, setPendingPaymentAmount] = useState(0);
  const [pendingAgentWalletBaseline, setPendingAgentWalletBaseline] = useState(0);
  const [activePayment, setActivePayment] = useState<AgentPaymentRow | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [showMomoDialog, setShowMomoDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isWalletSubmitting, setIsWalletSubmitting] = useState(false);
  const [isTopUpSubmitting, setIsTopUpSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [transactionsPage, setTransactionsPage] = useState(1);
  const [outstandingPage, setOutstandingPage] = useState(1);
  const [paidPage, setPaidPage] = useState(1);
  const TRANSACTIONS_PAGE_SIZE = 5;
  const INVOICES_PAGE_SIZE = 5;

  const toSelectedAmount = (value: number) => Number(convert(value).toFixed(2));
  const fromSelectedAmount = (value: string) => {
    if (!value.trim()) return 0;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Number(convertFromSelected(parsed).toFixed(2));
  };

  const refreshData = async (agentId: string) => {
    const [{ customers: customerRows, customerIds, shipments: shipmentRows }, walletBalance] = await Promise.all([
      fetchAgentShipments(agentId, 400),
      fetchAgentWalletBalance(agentId),
    ]);
    const [paymentRows, invoicesRes] = await Promise.all([
      fetchAgentPayments(customerIds, 200),
      customerIds.length > 0
        ? supabase
            .from("invoices")
            .select(
              "id, code, amount, status, due_date, notes, created_at, customer_id, shipment_id, customer:customers(full_name, code, phone), shipment:shipments(code, custom_tracking_number, notes, description, paid_amount, total_cost, shipping_cost, status)",
            )
            .in("customer_id", customerIds)
            .in("status", ["sent", "approved", "paid"])
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (invoicesRes.error) {
      throw invoicesRes.error;
    }

    setAgentUserId(agentId);
    setAgentWalletBalance(Number(walletBalance || 0));
    setCustomers(customerRows);
    setShipments(shipmentRows);
    setInvoices(
      ((invoicesRes.data || []) as any[]).map((row) => {
        const mapped = mapPortalInvoiceRow(row);
        const shipment = Array.isArray(row.shipment) ? row.shipment[0] : row.shipment;
        return {
          ...mapped,
          shipment_tracking_no: resolveTrackingByStatus(shipment?.status, shipment?.notes || null, shipment?.custom_tracking_number) || mapped.shipment_tracking_no,
        };
      }),
    );
    setPayments(paymentRows);
  };

  useEffect(() => {
    const loadPayments = async () => {
      try {
        const agentId = await getCurrentAgentId();
        if (!agentId) {
          setAgentUserId("");
          setAgentWalletBalance(0);
          setCustomers([]);
          setShipments([]);
          setInvoices([]);
          setPayments([]);
          setIsLoading(false);
          return;
        }

        await refreshData(agentId);
      } catch (error: any) {
        toast.error(error?.message || "Failed to load agent payments.");
      } finally {
        setIsLoading(false);
      }
    };

    loadPayments();
  }, []);

  useEffect(() => {
    const code = searchParams.get("payment_code") || "";
    const type = searchParams.get("payment_type");

    if (code) {
      setPendingPaymentCode(code);
    }

    if (type === "shipment_payment" || type === "agent_wallet_topup") {
      setPendingPaymentType(type);
    }
  }, [searchParams]);

  const outstandingShipments = useMemo(
    () =>
      invoices.filter(
        (shipment) => Boolean(shipment.shipment_id) && getInvoiceOutstandingBalance(shipment, { paid_amount: shipment.shipment_paid_amount }) > 0,
      ),
    [invoices],
  );

  const paidShipments = useMemo(
    () =>
      invoices.filter(
        (shipment) => Boolean(shipment.shipment_id) && getInvoiceOutstandingBalance(shipment, { paid_amount: shipment.shipment_paid_amount }) <= 0,
      ),
    [invoices],
  );

  const totals = useMemo(
    () => ({
      outstanding: outstandingShipments.reduce(
        (sum, shipment) => sum + getInvoiceOutstandingBalance(shipment, { paid_amount: shipment.shipment_paid_amount }),
        0,
      ),
      paid: paidShipments.reduce(
        (sum, shipment) => sum + getInvoicePaidAmount(shipment, { paid_amount: shipment.shipment_paid_amount }),
        0,
      ),
    }),
    [outstandingShipments, paidShipments],
  );

  useEffect(() => {
    if (!selectedShipmentId) return;
    const shipment = outstandingShipments.find((item) => item.shipment_id === selectedShipmentId);
    if (!shipment) return;
    const balance = getInvoiceOutstandingBalance(shipment, { paid_amount: shipment.shipment_paid_amount });
    setAmount(balance);
    setDisplayAmount(toSelectedAmount(balance).toString());
  }, [selectedShipmentId, outstandingShipments]);

  const selectedShipment = useMemo(
    () => shipments.find((item) => item.id === selectedShipmentId) || null,
    [selectedShipmentId, shipments],
  );

  const selectedInvoice = useMemo(
    () => outstandingShipments.find((item) => item.shipment_id === selectedShipmentId) || null,
    [outstandingShipments, selectedShipmentId],
  );

  const selectedCustomer = useMemo(
    () => customers.find((item) => item.id === selectedShipment?.customer_id) || null,
    [customers, selectedShipment?.customer_id],
  );

  useEffect(() => {
    if (!selectedCustomer?.phone) return;
    if (!clientPaymentPhone && hasUsablePhone(selectedCustomer.phone)) {
      setClientPaymentPhone(selectedCustomer.phone);
    }
  }, [selectedCustomer?.phone, clientPaymentPhone]);

  useEffect(() => {
    if (!pendingPaymentCode || !pendingPaymentType || !agentUserId) return;

    let isActive = true;
    setIsPolling(true);

    const pollPayment = async () => {
      if (pendingPaymentType === "agent_wallet_topup") {
        const nextBalance = Number((await fetchAgentWalletBalance(agentUserId)) || 0);
        if (!isActive) return;

        if (nextBalance > pendingAgentWalletBaseline) {
          setAgentWalletBalance(nextBalance);
          setActivePayment({
            id: `agent-wallet-${pendingPaymentCode}`,
            code: pendingPaymentCode,
            amount: pendingPaymentAmount,
            status: "completed",
            payment_provider: "lipila",
            created_at: new Date().toISOString(),
            customer_id: null,
            shipment_id: null,
          });
          setIsPolling(false);
          await refreshData(agentUserId);
        }
        return;
      }

      const { data } = await supabase
        .from("payments")
        .select("id, code, amount, status, payment_provider, created_at, customer_id, shipment_id")
        .eq("code", pendingPaymentCode)
        .maybeSingle();

      if (!isActive || !data) return;

      const nextPayment = {
        ...data,
        amount: Number(data.amount || 0),
      } as AgentPaymentRow;

      setActivePayment(nextPayment);

      if (data.status === "completed" || data.status === "failed") {
        setIsPolling(false);
        await refreshData(agentUserId);
      }
    };

    pollPayment();
    const interval = setInterval(pollPayment, 5000);
    const timeout = setTimeout(() => {
      if (isActive) {
        setIsPolling(false);
      }
    }, 120000);

    return () => {
      isActive = false;
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [
    agentUserId,
    pendingAgentWalletBaseline,
    pendingPaymentAmount,
    pendingPaymentCode,
    pendingPaymentType,
  ]);

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="default">
            <CheckCircle className="mr-1 h-3 w-3" /> Completed
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive">
            <XCircle className="mr-1 h-3 w-3" /> Failed
          </Badge>
        );
      case "processing":
        return (
          <Badge variant="secondary">
            <Clock className="mr-1 h-3 w-3" /> Processing
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <Clock className="mr-1 h-3 w-3" /> Pending
          </Badge>
        );
    }
  };

  const handleAgentWalletTopUp = async () => {
    if (!agentUserId) {
      toast.error("Agent profile not found.");
      return;
    }

    const finalAmount = displayAgentWalletTopUpAmount ? parseFloat(displayAgentWalletTopUpAmount) : toSelectedAmount(agentWalletTopUpAmount);
    if (finalAmount <= 0 || !agentTopUpPhone) {
      toast.error("Enter a valid top-up amount and phone number.");
      return;
    }

    setIsTopUpSubmitting(true);
    setCheckoutUrl(null);
    setActivePayment(null);

    try {
      const { data: authData } = await supabase.auth.getUser();
      const email = authData.user?.email || undefined;

      const { data, error } = await supabase.functions.invoke("lipila-payment", {
        body: {
          amount: finalAmount,
          amount_currency: code,
          phone_number: agentTopUpPhone || undefined,
          email,
          currency: "ZMW",
          redirect_url: `${window.location.origin}/agent/payments`,
          description: "Agent wallet top-up",
          wallet_owner_type: "agent",
          wallet_user_id: agentUserId,
          payment_method: paymentMethod,
        },
      });

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.error || "Agent wallet top-up failed.");
      }

      const paymentCode = data.payment_code as string | undefined;
      if (paymentCode) {
        setPendingPaymentCode(paymentCode);
        setPendingPaymentType("agent_wallet_topup");
        setPendingPaymentAmount(agentWalletTopUpAmount);
        setPendingAgentWalletBaseline(agentWalletBalance);
        const next = new URLSearchParams(searchParams);
        next.set("payment_code", paymentCode);
        next.set("payment_type", "agent_wallet_topup");
        setSearchParams(next);
      }

      setAgentWalletTopUpAmount(0);
      setDisplayAgentWalletTopUpAmount("");

      if (data?.checkout_url) {
        setCheckoutUrl(data.checkout_url);
        const popup = window.open(
          data.checkout_url,
          "lipila-checkout",
          "popup=yes,width=520,height=760,noopener,noreferrer",
        );

        if (!popup) {
          window.location.assign(data.checkout_url);
        }
      } else if (paymentMethod === "mobile_money") {
        setShowMomoDialog(true);
      }

      toast.success("Agent wallet top-up started. Complete the payment on the Lipila page.");
    } catch (error: any) {
      toast.error(await getFunctionErrorMessage(error, "Failed to start the agent wallet top-up."));
    } finally {
      setIsTopUpSubmitting(false);
    }
  };

  const handlePay = async () => {
    const shipment: any = selectedShipment;
    const finalAmount = displayAmount ? parseFloat(displayAmount) : toSelectedAmount(amount);
    if (!shipment || !shipment.customer_id || finalAmount <= 0) {
      toast.error("Select a shipment and confirm the amount.");
      return;
    }

    const outstandingBalance = selectedInvoice
      ? getInvoiceOutstandingBalance(selectedInvoice, { paid_amount: selectedInvoice.shipment_paid_amount })
      : getShipmentOutstandingBalance(shipment);
    
    // Convert current typed amount back to USD for balance check
    const typedAmountInUsd = convertFromSelected(finalAmount);
    if (typedAmountInUsd > outstandingBalance + 0.01) { // 1 cent buffer for rounding
      toast.error("The selected amount exceeds the outstanding balance.");
      return;
    }

    const checkoutPhone = hasUsablePhone(clientPaymentPhone) ? clientPaymentPhone : selectedCustomer?.phone;
    if (!hasUsablePhone(checkoutPhone)) {
      toast.error("The selected client must have a valid phone number before payment can start.");
      return;
    }

    setIsSubmitting(true);
    setCheckoutUrl(null);
    setActivePayment(null);

    try {
      const { data, error } = await supabase.functions.invoke("lipila-payment", {
        body: {
          amount: finalAmount,
          amount_currency: code,
          shipment_id: shipment.id,
          customer_id: shipment.customer_id,
          phone_number: checkoutPhone,
          currency: "ZMW",
          redirect_url: `${window.location.origin}/agent/payments`,
          description: `Agent payment for ${shipment.code}`,
          payment_method: paymentMethod,
        },
      });

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.error || "Payment request failed.");
      }

      const paymentCode = data.payment_code as string | undefined;
      if (paymentCode) {
        setPendingPaymentCode(paymentCode);
        setPendingPaymentType("shipment_payment");
        setPendingPaymentAmount(amount);
        const next = new URLSearchParams(searchParams);
        next.set("payment_code", paymentCode);
        next.set("payment_type", "shipment_payment");
        setSearchParams(next);
      }

      if (data?.checkout_url) {
        setCheckoutUrl(data.checkout_url);
        const popup = window.open(
          data.checkout_url,
          "lipila-checkout",
          "popup=yes,width=520,height=760,noopener,noreferrer",
        );

        if (!popup) {
          window.location.assign(data.checkout_url);
        }
      } else if (paymentMethod === "mobile_money") {
        setShowMomoDialog(true);
      }

      toast.success("Payment request sent. Complete the payment on the Lipila page.");
    } catch (error: any) {
      toast.error(await getFunctionErrorMessage(error, "Failed to start payment."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAgentWalletPay = async () => {
    const shipment: any = selectedShipment;
    const finalAmount = displayAmount ? parseFloat(displayAmount) : toSelectedAmount(amount);
    if (!shipment || !shipment.customer_id || finalAmount <= 0) {
      toast.error("Select a shipment and confirm the amount.");
      return;
    }

    const outstandingBalance = selectedInvoice
      ? getInvoiceOutstandingBalance(selectedInvoice, { paid_amount: selectedInvoice.shipment_paid_amount })
      : getShipmentOutstandingBalance(shipment);
    
    const typedAmountInUsd = convertFromSelected(finalAmount);
    if (typedAmountInUsd > agentWalletBalance + 0.01) {
      toast.error("The agent wallet balance is not enough for this payment.");
      return;
    }

    setIsWalletSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("wallet-payment", {
        body: {
          customer_id: shipment.customer_id,
          shipment_id: shipment.id,
          amount: typedAmountInUsd,
          payer_type: "agent",
        },
      });

      if (error) throw error;
      if (!data?.success) {
        toast.error(data?.error || "Agent wallet payment failed.");
        return;
      }

      setAgentWalletBalance(Number(data.wallet_balance || 0));
      toast.success("Agent wallet payment completed.");

      if (agentUserId) {
        await refreshData(agentUserId);
      }
    } catch (error: any) {
      toast.error(await getFunctionErrorMessage(error, "Agent wallet payment failed."));
    } finally {
      setIsWalletSubmitting(false);
    }
  };

  const invoiceColumns: Column<PortalInvoiceRow>[] = [
    { key: "code", label: "Invoice" },
    {
      key: "customer_name",
      label: "Client",
      render: (item) =>
        item.customer_name
          ? `${item.customer_name}${item.customer_code ? ` (${item.customer_code})` : ""}`
          : "Client",
    },
    {
      key: "shipment_tracking_no",
      label: "Shipment ID",
      render: (item) => getPortalInvoiceReference(item),
    },
    {
      key: "status",
      label: "Payment Status",
      render: (item) => (
        <Badge
          variant={
            getInvoiceOutstandingBalance(item, { paid_amount: item.shipment_paid_amount }) <= 0
              ? "default"
              : "secondary"
          }
        >
          {getInvoiceOutstandingBalance(item, { paid_amount: item.shipment_paid_amount }) <= 0
            ? "Paid"
            : "Outstanding"}
        </Badge>
      ),
    },
    {
      key: "invoice_total",
      label: "Invoice Total",
      render: (item) => formatAmount(item.amount),
    },
    {
      key: "outstanding",
      label: "Balance",
      align: "center",
      
      render: (item) =>
        formatAmount(getInvoiceOutstandingBalance(item, { paid_amount: item.shipment_paid_amount })),
    },
    {
      key: "created_at",
      label: "Created",
      render: (item) => format(new Date(item.created_at), "dd MMM yyyy"),
    },
    {
      key: "invoice_action",
      label: "Invoice",
      render: (item) => (
        <Button size="icon" variant="ghost" className="h-8 w-8 p-0" onClick={() => downloadInvoice(item)} title="Download invoice">
          <Eye className="h-4 w-4 text-blue-600" />
        </Button>
      ),
    },
  ];

  const paymentColumns: Column<AgentPaymentRow>[] = [
    { key: "code", label: "Payment Ref" },
    {
      key: "amount",
      label: "Amount",
      align: "center",
      
      render: (item) => formatAmount(Number(item.amount || 0)),
    },
    {
      key: "status",
      label: "Status",
      render: (item) => <Badge variant={item.status === "completed" ? "default" : "secondary"}>{item.status || "pending"}</Badge>,
    },
    { key: "payment_provider", label: "Provider" },
    {
      key: "created_at",
      label: "Date",
      render: (item) => format(new Date(item.created_at), "dd MMM yyyy p"),
    },
  ];

  const getBalanceDue = (s: PortalInvoiceRow) =>
    getInvoiceOutstandingBalance(s, { paid_amount: s.shipment_paid_amount });
  const getPaidAmount = (s: PortalInvoiceRow) =>
    getInvoicePaidAmount(s, { paid_amount: s.shipment_paid_amount });
  const handleDownloadInvoice = (s: PortalInvoiceRow) => downloadInvoice(s);

  const downloadInvoice = async (shipment: PortalInvoiceRow) => {
    try {
      const logoUrl = await fetchLogo();
      const paidAmount = getInvoicePaidAmount(shipment, { paid_amount: shipment.shipment_paid_amount });
      const outstandingBalance = getInvoiceOutstandingBalance(shipment, { paid_amount: shipment.shipment_paid_amount });

      const trackingNumber = shipment.shipment_tracking_no || undefined;

      await generateInvoicePdf({
        logoUrl,
        companyName: "XY Cargo Logistics",
        invoiceTitle: "AGENT INVOICE",
        invoiceNumber: shipment.code,
        trackingNumber,
        billTo: shipment.customer_name || "Client",
        date: format(new Date(shipment.created_at), "PPP"),
        description: shipment.notes || shipment.shipment_description || "Shipment",
        amount: formatAmount(shipment.amount),
        paid: formatAmount(paidAmount),
        balance: formatAmount(outstandingBalance),
        filename: `agent-invoice-${shipment.code}.pdf`,
        bankInstitution: "Access Bank Zambia",
        bankName: "MIQLAT ENTERPRISES COMPANY LIMITED",
        bankAccount: "0020110000181",
        bankBranch: "Longacres",
      });

      toast.success("Invoice downloaded successfully.");
    } catch (error) {
      console.error("Error generating invoice PDF:", error);
      toast.error("Failed to generate invoice PDF.");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Payments & Invoices"
      />

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Outstanding Invoices</CardTitle></CardHeader>
          <CardContent><div className="text-base font-semibold text-destructive tracking-tighter">{isLoading ? "..." : formatAmount(totals.outstanding)}</div></CardContent>
        </Card>
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Paid Invoices</CardTitle></CardHeader>
          <CardContent><div className="text-base font-semibold text-emerald-600 tracking-tighter">{isLoading ? "..." : formatAmount(totals.paid)}</div></CardContent>
        </Card>
        <Card className="border-border/70 shadow-sm border-r-4 border-r-primary">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Agent Wallet Balance</CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-base font-semibold tracking-tighter">{isLoading ? "..." : formatAmount(agentWalletBalance)}</div>
            <p className="text-[10px] text-muted-foreground font-bold mt-1 uppercase tracking-widest">Available for client payments</p>
          </CardContent>
        </Card>
      </div>

      {(pendingPaymentCode || activePayment) && (
        <Card className="border-border/70 shadow-lg border-l-4 border-l-primary animate-in slide-in-from-top-4 duration-500 overflow-hidden">
          <CardHeader className="bg-primary/5 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold uppercase tracking-widest flex items-center gap-2">
                <Loader2 className={cn("h-5 w-5 text-primary", isPolling && "animate-spin")} />
                Payment Verification in Progress
              </CardTitle>
              <Badge variant="outline" className="bg-background border-2 font-mono text-[10px] tracking-tighter">REF: {pendingPaymentCode || activePayment?.code}</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-widest">Status</p>
                <div className="flex items-center gap-2">
                  {activePayment?.status ? getStatusBadge(activePayment.status) : <Badge variant="secondary" className="animate-pulse">Checking...</Badge>}
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-widest">Amount Due</p>
                <p className="text-sm font-semibold tracking-tighter">
                  {formatAmount(activePayment?.amount ?? pendingPaymentAmount)}
                </p>
              </div>
              <div className="sm:col-span-2 md:col-span-1 space-y-3">
                {checkoutUrl && activePayment?.status !== "completed" && (
                  <Button asChild className="w-full font-semibold uppercase tracking-tighter shadow-md" size="lg">
                    <a href={checkoutUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-2 h-5 w-5" />
                      Complete Checkout
                    </a>
                  </Button>
                )}
                {activePayment?.status === "completed" && (
                  <Button 
                    className="w-full font-semibold uppercase tracking-tighter bg-emerald-600 hover:bg-emerald-700" 
                    size="lg"
                    onClick={() => {
                      setPendingPaymentCode("");
                      setActivePayment(null);
                      const next = new URLSearchParams(searchParams);
                      next.delete("payment_code");
                      setSearchParams(next);
                    }}
                  >
                    <CheckCircle className="mr-2 h-5 w-5" />
                    Dismiss Notice
                  </Button>
                )}
              </div>
            </div>

            {activePayment?.status === "failed" && (
              <div className="bg-destructive/10 text-destructive p-4 rounded-xl border border-destructive/20 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold uppercase tracking-tight">Payment Unsuccessful</p>
                  <p className="text-xs font-bold opacity-80">The transaction was cancelled or failed. Please try again or contact support if funds were deducted.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Add Funds Section */}
        <Card className="border-border/70 shadow-sm overflow-hidden flex flex-col">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <PlusCircle className="h-5 w-5 text-primary" />
              Agent Wallet Top-Up
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-6 flex-1">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Deposit Method</Label>
                <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as "card" | "mobile_money")}>
                  <SelectTrigger className="h-10 border-2 focus:ring-primary/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mobile_money">
                      <span className="flex items-center gap-3 py-1">
                        <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
                          <Smartphone className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex flex-col text-left">
                          <span className="font-bold text-sm">Mobile Money</span>
                          <span className="text-[10px] text-muted-foreground">Prompt sent to phone</span>
                        </div>
                      </span>
                    </SelectItem>
                    <SelectItem value="card">
                      <span className="flex items-center gap-3 py-1">
                        <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
                          <CreditCard className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex flex-col text-left">
                          <span className="font-bold text-sm">Visa / Mastercard</span>
                          <span className="text-[10px] text-muted-foreground">Online Checkout</span>
                        </div>
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Amount ({code})</Label>
                  <div className="relative">
                    <Input
                      type="text"
                      inputMode="decimal"
                      className="h-10 pl-10 border-2 font-bold text-sm no-spinners"
                      value={displayAgentWalletTopUpAmount}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "" || /^[0-9]*\.?[0-9]*$/.test(val)) {
                          setDisplayAgentWalletTopUpAmount(val);
                          const num = parseFloat(val);
                          if (!isNaN(num)) {
                            setAgentWalletTopUpAmount(convertFromSelected(num));
                          } else {
                            setAgentWalletTopUpAmount(0);
                          }
                        }
                      }}
                      placeholder="0.00"
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">
                      {code === "ZMW" ? "K" : "$"}
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Phone Number</Label>
                  <Input
                    type="tel"
                    className="h-10 border-2 font-medium"
                    value={agentTopUpPhone}
                    onChange={(e) => setAgentTopUpPhone(e.target.value)}
                    placeholder="e.g. 097..."
                  />
                </div>
              </div>

              <Button
                type="button"
                onClick={handleAgentWalletTopUp}
                disabled={isTopUpSubmitting || agentWalletTopUpAmount <= 0}
                className="w-full h-10 text-sm font-bold shadow-lg shadow-primary/20 mt-2 transition-all hover:scale-[1.01]"
              >
                {isTopUpSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Plus className="mr-2 h-5 w-5" />}
                Deposit to My Wallet
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Make Payment Section */}
        <Card className="border-border/70 shadow-sm overflow-hidden flex flex-col">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary" />
              Process Client Payment
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-6 flex-1">
            <div className="space-y-6">
              <div className="space-y-3">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Payment Source</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPayFrom("lipila")}
                    className={cn(
                      "flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all gap-1.5 relative overflow-hidden group",
                      payFrom === "lipila" 
                        ? "border-primary bg-primary/5 text-primary shadow-md shadow-primary/10" 
                        : "border-border/60 bg-background text-muted-foreground hover:border-border hover:bg-muted/5"
                    )}
                  >
                    <CreditCard className="h-5 w-5" />
                    <span className="text-[10px] font-semibold uppercase tracking-tighter">Lipila</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayFrom("wallet_agent")}
                    className={cn(
                      "flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all gap-1.5 relative overflow-hidden group",
                      payFrom === "wallet_agent" 
                        ? "border-primary bg-primary/5 text-primary shadow-md shadow-primary/10" 
                        : "border-border/60 bg-background text-muted-foreground hover:border-border hover:bg-muted/5"
                    )}
                  >
                    <ShieldCheck className="h-5 w-5" />
                    <span className="text-[10px] font-semibold uppercase tracking-tighter text-center">My Wallet</span>
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {payFrom === "lipila" && (
                  <div className="grid gap-3 sm:grid-cols-2 animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-muted-foreground">Method</Label>
                      <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as "card" | "mobile_money")}>
                        <SelectTrigger className="h-11 border-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mobile_money">Mobile Money</SelectItem>
                          <SelectItem value="card">Visa / Mastercard</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-muted-foreground">Phone</Label>
                      <Input
                        type="tel"
                        className="h-11 border-2"
                        value={clientPaymentPhone}
                        onChange={(e) => setClientPaymentPhone(e.target.value)}
                        placeholder="097..."
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Target Invoice</Label>
                    <Select value={selectedShipmentId} onValueChange={setSelectedShipmentId}>
                      <SelectTrigger className="h-10 border-2">
                        <SelectValue placeholder="Which invoice are you paying?" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        {outstandingShipments.map((shipment) => (
                          <SelectItem key={shipment.id} value={shipment.shipment_id || shipment.id}>
                            <div className="flex flex-col text-left py-1">
                              <span className="font-bold text-sm">{shipment.code} - {shipment.customer_name}</span>
                              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Balance: {formatAmount(getBalanceDue(shipment))}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Payment Amount ({code})</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      className="h-10 border-2 font-bold text-sm no-spinners"
                      value={displayAmount}
                      onChange={(e) => {
                        const val = e.target.value;
                        // Only allow numbers and decimal point
                        if (val === "" || /^[0-9]*\.?[0-9]*$/.test(val)) {
                          setDisplayAmount(val);
                          const num = parseFloat(val);
                          if (!isNaN(num)) {
                            setAmount(convertFromSelected(num));
                          } else {
                            setAmount(0);
                          }
                        }
                      }}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {payFrom === "wallet_agent" && (
                   <div className="bg-primary/5 rounded-xl p-4 border border-primary/20 flex items-center justify-between">
                     <div className="space-y-0.5">
                       <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Your Balance</p>
                       <p className={cn("text-sm font-semibold tracking-tighter", amount > agentWalletBalance ? "text-destructive" : "text-primary")}>
                         {formatAmount(agentWalletBalance)}
                       </p>
                     </div>
                     <Badge className="font-bold bg-primary/20 text-primary hover:bg-primary/20 border-0">My Agent Wallet</Badge>
                   </div>
                )}

                <Button
                  onClick={payFrom === "wallet_agent" ? handleAgentWalletPay : handlePay}
                  disabled={isSubmitting || isTopUpSubmitting || isWalletSubmitting || !selectedShipment || amount <= 0}
                  className="w-full h-10 text-sm font-bold shadow-lg shadow-primary/20 transition-all hover:scale-[1.01]"
                >
                  {isSubmitting || isWalletSubmitting ? (
                    <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                  ) : (
                    <ShieldCheck className="mr-2 h-6 w-6" />
                  )}
                  Execute Payment {amount > 0 ? formatAmount(amount) : ""}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* BOTTOM SECTION: Side-by-Side Lists */}
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card className="border-border/70 shadow-sm flex flex-col">
          <CardHeader className="bg-muted/20 border-b border-border/50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Client Invoices
              </CardTitle>
              <Button variant="outline" size="sm" asChild>
                <Link to="/agent/customers" className="text-xs font-bold uppercase tracking-wider">
                  <UserCheck className="mr-2 h-3.5 w-3.5" />
                  Manage Clients
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <Tabs defaultValue="outstanding" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6 p-1 bg-muted rounded-xl h-10">
                <TabsTrigger value="outstanding" className="rounded-lg data-[state=active]:shadow-sm">Outstanding ({outstandingShipments.length})</TabsTrigger>
                <TabsTrigger value="paid" className="rounded-lg data-[state=active]:shadow-sm">Paid History ({paidShipments.length})</TabsTrigger>
              </TabsList>
              
              <TabsContent value="outstanding" className="mt-0 animate-in fade-in duration-300">
                <div className="space-y-4">
                    {outstandingShipments.slice((outstandingPage-1)*INVOICES_PAGE_SIZE, outstandingPage*INVOICES_PAGE_SIZE).map((shipment) => (
                      <div key={shipment.id} className="group flex flex-col md:flex-row md:items-center justify-between p-5 rounded-2xl border-2 border-border/50 bg-background hover:border-primary/30 hover:bg-primary/[0.02] transition-all gap-4 overflow-hidden">
                        <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2.5">
                          <span className="font-semibold text-sm">{shipment.code}</span>
                          <Badge variant="outline" className="font-bold border-2">{getPortalInvoiceReference(shipment)}</Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="font-semibold uppercase tracking-tighter text-[10px] bg-muted px-1.5 py-0.5 rounded">{shipment.customer_name}</span>
                          <span className="flex items-center gap-1.5"><Clock className="h-3 w-3" /> {format(new Date(shipment.created_at), "dd MMM yyyy")}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 justify-between md:justify-end shrink-0">
                        <div className="text-right">
                          <p className="text-sm font-semibold text-destructive leading-none">{formatAmount(getBalanceDue(shipment))}</p>
                          <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold mt-1">Balance Due</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="icon" variant="ghost" className="h-10 w-10 rounded-full hover:bg-blue-50 hover:text-blue-600 transition-colors" onClick={() => handleDownloadInvoice(shipment)} title="Download Invoice">
                            <FileText className="h-5 w-5" />
                          </Button>
                          <Button size="sm" className="rounded-lg px-5 font-bold shadow-sm" onClick={() => {
                            setSelectedShipmentId(shipment.shipment_id || shipment.id);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}>
                            Pay Now
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {outstandingShipments.length === 0 && (
                    <div className="text-center py-20 border-2 border-dashed rounded-3xl">
                      <div className="h-16 w-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle className="h-8 w-8 text-emerald-600" />
                      </div>
                      <p className="font-bold text-sm">No Unpaid Invoices</p>
                      <p className="text-sm text-muted-foreground max-w-[200px] mx-auto">Great! Your clients have cleared all their outstanding shipment invoices.</p>
                    </div>
                  )}
                  
                  {outstandingShipments.length > INVOICES_PAGE_SIZE && (
                    <div className="flex items-center justify-between mt-6 pt-6 border-t">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        Page {outstandingPage} of {Math.ceil(outstandingShipments.length / INVOICES_PAGE_SIZE)}
                      </p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="font-bold h-9 border-2 uppercase text-[10px] tracking-widest" onClick={() => setOutstandingPage(p => Math.max(1, p-1))} disabled={outstandingPage === 1}>Prev</Button>
                        <Button variant="outline" size="sm" className="font-bold h-9 border-2 uppercase text-[10px] tracking-widest" onClick={() => setOutstandingPage(p => p + 1)} disabled={outstandingPage * INVOICES_PAGE_SIZE >= outstandingShipments.length}>Next</Button>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="paid" className="mt-0 animate-in fade-in duration-300">
                <div className="space-y-3">
                  {paidShipments.slice((paidPage-1)*INVOICES_PAGE_SIZE, paidPage*INVOICES_PAGE_SIZE).map((shipment) => (
                    <div key={shipment.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl border border-border/60 bg-muted/5 transition-all gap-4 overflow-hidden">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <span className="font-bold">{shipment.code}</span>
                          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200">Paid</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                           <span className="text-[10px] font-semibold uppercase text-muted-foreground tracking-tight">{shipment.customer_name}</span>
                           <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">| {format(new Date(shipment.created_at), "dd MMM yyyy")}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 justify-between md:justify-end shrink-0">
                        <div className="text-right">
                          <p className="text-sm font-bold text-emerald-600 leading-none">{formatAmount(getPaidAmount(shipment))}</p>
                          <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mt-1">Total Paid</p>
                        </div>
                        <Button size="icon" variant="ghost" className="h-9 w-9 rounded-full hover:bg-blue-50 text-blue-600" onClick={() => handleDownloadInvoice(shipment)} title="Download Invoice">
                          <FileText className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {paidShipments.length === 0 && (
                    <div className="text-center py-20 bg-muted/10 rounded-2xl border border-dashed">
                      <FileText className="h-10 w-10 mx-auto mb-3 opacity-20" />
                      <p className="text-sm font-medium text-muted-foreground">No payment history found.</p>
                    </div>
                  )}

                  {paidShipments.length > INVOICES_PAGE_SIZE && (
                    <div className="flex items-center justify-between mt-6 pt-6 border-t">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        Page {paidPage} of {Math.ceil(paidShipments.length / INVOICES_PAGE_SIZE)}
                      </p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="font-bold h-9 border-2 uppercase text-[10px] tracking-widest" onClick={() => setPaidPage(p => Math.max(1, p-1))} disabled={paidPage === 1}>Prev</Button>
                        <Button variant="outline" size="sm" className="font-bold h-9 border-2 uppercase text-[10px] tracking-widest" onClick={() => setPaidPage(p => p + 1)} disabled={paidPage * INVOICES_PAGE_SIZE >= paidShipments.length}>Next</Button>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm flex flex-col h-fit">
          <CardHeader className="bg-muted/20 border-b border-border/50">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Transaction Log
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-3">
              {payments.length === 0 ? (
                <div className="text-center py-20 bg-muted/5 rounded-xl border border-dashed">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-10" />
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">No Recent activity</p>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {payments.slice((transactionsPage - 1) * TRANSACTIONS_PAGE_SIZE, transactionsPage * TRANSACTIONS_PAGE_SIZE).map((payment) => (
                      <div key={payment.id} className="flex items-center justify-between p-4 rounded-xl border-2 border-border/50 bg-background/50 hover:bg-muted/10 transition-colors gap-3 overflow-hidden">
                        <div className="space-y-1.5 min-w-0">
                          <p className="text-xs font-semibold font-mono tracking-tighter uppercase">{payment.code}</p>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[9px] h-4 px-1.5 font-semibold uppercase tracking-tighter bg-muted/50 border-0">{payment.payment_provider}</Badge>
                            <span className="text-[10px] text-muted-foreground font-bold">{format(new Date(payment.created_at), "MMM d, h:mm a")}</span>
                          </div>
                        </div>
                        <div className="text-right space-y-1.5 shrink-0">
                          <p className="text-sm font-semibold tracking-tight">{formatAmount(Number(payment.amount || 0))}</p>
                          <div className="scale-75 origin-right">{getStatusBadge(payment.status)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {payments.length > TRANSACTIONS_PAGE_SIZE && (
                    <div className="flex items-center justify-between mt-6 pt-6 border-t border-border/50">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        Page {transactionsPage} of {Math.ceil(payments.length / TRANSACTIONS_PAGE_SIZE)}
                      </p>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 px-3 text-[10px] font-bold uppercase tracking-widest border-2" 
                          onClick={() => setTransactionsPage(p => Math.max(1, p - 1))} 
                          disabled={transactionsPage === 1}
                        >
                          Prev
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 px-3 text-[10px] font-bold uppercase tracking-widest border-2" 
                          onClick={() => setTransactionsPage(p => p + 1)} 
                          disabled={transactionsPage * TRANSACTIONS_PAGE_SIZE >= payments.length}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showMomoDialog} onOpenChange={setShowMomoDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Processing Mobile Money Payment
            </DialogTitle>
            
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-6 space-y-4">
            <div className="relative">
              <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
                <Smartphone className="h-10 w-10 text-primary" />
              </div>
              <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-background border-2 border-primary flex items-center justify-center">
                <Loader2 className="h-3 w-3 text-primary animate-spin" />
              </div>
            </div>
            <div className="text-center space-y-4 w-full">
              <p className="text-sm font-bold">Waiting for confirmation...</p>
              
              <div className="rounded-lg border border-border bg-muted/30 p-4 text-left space-y-2">
                <p className="text-sm font-medium">Please ask the client to check their phone and enter their PIN.</p>
                {pendingPaymentCode && (
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                    Ref: {pendingPaymentCode}
                  </p>
                )}
              </div>

              <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground text-left">
                <p className="font-bold mb-1 uppercase tracking-tighter">MTN users:</p>
                <p>If the prompt doesn&apos;t appear, dial <strong className="text-primary font-semibold">*115#</strong> to check pending requests.</p>
              </div>
            </div>
          </div>
          <Button variant="outline" className="w-full font-bold h-10" onClick={() => setShowMomoDialog(false)}>
            Close & Check Status Manually
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AgentPayments;

