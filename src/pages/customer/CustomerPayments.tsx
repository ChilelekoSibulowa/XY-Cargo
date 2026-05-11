import { useState, useEffect, useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { escapeHtml } from "@/lib/financePortal";
import { CustomerProfileGate } from "@/components/customer/CustomerProfileGate";
import { useCustomerRecord } from "@/hooks/useCustomerRecord";
import { useDefaultCurrency } from "@/hooks/useDefaultCurrency";
import { fetchLogo } from "@/hooks/useLogo";
import {
  getInvoiceOutstandingBalance,
  getInvoicePaidAmount,
  getInvoicePaymentState,
  getPortalInvoiceReference,
  isFinanceInvoiceVisible,
  mapPortalInvoiceRow,
  type PortalInvoiceRow,
} from "@/lib/financePortal";
import { getWarehouseTrackingNumber, resolveTrackingByStatus } from "@/lib/shipmentNotes";
import { toast } from "sonner";
import { CreditCard, Loader2, CheckCircle, XCircle, Clock, ExternalLink, FileText, UserCheck, Smartphone, Eye, Check, Wallet, Plus } from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { generateInvoicePdf } from "@/lib/invoicePdfGenerator";

type Shipment = PortalInvoiceRow;

type Payment = {
  id: string;
  code: string;
  amount: number;
  currency?: string | null;
  status: string | null;
  payment_provider: string;
  created_at: string;
  shipment_id: string | null;
};

const toNumber = (value: unknown, fallback = 0) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  if (value === null || value === undefined) return fallback;
  try {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
};

const getInvoiceTotal = (shipment: Pick<Shipment, "amount">) =>
  toNumber(shipment.amount);

const getPaidAmount = (
  shipment: Pick<Shipment, "amount" | "shipment_paid_amount">,
) => getInvoicePaidAmount(shipment, { paid_amount: shipment.shipment_paid_amount });

const getBalanceDue = (
  shipment: Pick<Shipment, "amount" | "shipment_paid_amount">,
) => getInvoiceOutstandingBalance(shipment, { paid_amount: shipment.shipment_paid_amount });

const getPaymentProgress = (
  shipment: Pick<Shipment, "amount" | "shipment_paid_amount">,
) => getInvoicePaymentState(shipment, { paid_amount: shipment.shipment_paid_amount });

const isBillableShipment = (shipment: Pick<Shipment, "status" | "shipment_id">) =>
  Boolean(shipment.shipment_id) && isFinanceInvoiceVisible(shipment.status);

const hasUsablePhone = (value: string | null | undefined) => {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === "pending") return false;
  return trimmed.replace(/\D/g, "").length >= 9;
};

const getFunctionErrorMessage = async (error: any, fallback: string) => {
  if (error?.context) {
    try {
      const payload = await error.context.json();
      if (typeof payload?.error === "string" && payload.error.trim()) return payload.error;
      if (typeof payload?.details === "string" && payload.details.trim()) return payload.details;
      if (payload?.details?.error) return payload.details.error;
      if (payload?.details) return JSON.stringify(payload.details);
    } catch {
      // ignore json parsing issues and fall back to the default message
    }
  }

  return error?.message || fallback;
};

const CustomerPayments = () => {
  const { customer, isLoading: isCustomerLoading } = useCustomerRecord();
  const { code, defaultCode, convert, convertFromSelected, formatAmount } = useDefaultCurrency();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [selectedShipment, setSelectedShipment] = useState<string>("");
  const [amount, setAmount] = useState<number>(0);
  const [displayAmount, setDisplayAmount] = useState("");
  const [paymentPhone, setPaymentPhone] = useState("");
  const [walletBalance, setWalletBalance] = useState(0);
  const [walletTopUpAmount, setWalletTopUpAmount] = useState<number>(0);
  const [displayTopUpAmount, setDisplayTopUpAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isWalletLoading, setIsWalletLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [pendingPaymentCode, setPendingPaymentCode] = useState<string>("");
  const [activePayment, setActivePayment] = useState<Payment | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [paymentMethod, setPaymentMethod] = useState<"card" | "mobile_money">("mobile_money");
  const [payFrom, setPayFrom] = useState<"wallet" | "lipila">("lipila");

  const [showMomoDialog, setShowMomoDialog] = useState(false);
  const [outstandingPage, setOutstandingPage] = useState(1);
  const [paidPage, setPaidPage] = useState(1);
  const [transactionsPage, setTransactionsPage] = useState(1);
  const INVOICES_PAGE_SIZE = 10;
  const TRANSACTIONS_PAGE_SIZE = 5;
  const toSelectedAmount = (value: number) => Number(convert(value).toFixed(2));
  const fromSelectedAmount = (value: string) => {
    if (!value.trim()) return 0;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Number(convertFromSelected(parsed).toFixed(2));
  };

  const fetchLists = async (customerId: string) => {
    const [shipmentsRes, paymentsRes, customerRes] = await Promise.all([
      supabase
        .from("invoices")
        .select(
          "id, code, amount, status, due_date, notes, created_at, customer_id, shipment_id, customer:customers(full_name, code, phone), shipment:shipments(code, custom_tracking_number, notes, description, paid_amount, total_cost, shipping_cost, status)",
        )
        .eq("customer_id", customerId)
        .in("status", ["sent", "approved", "paid"])
        .order("created_at", { ascending: false }),
      supabase
        .from("payments")
        .select("id, code, amount, currency, status, payment_provider, created_at, shipment_id")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("customers")
        .select("wallet_balance")
        .eq("id", customerId)
        .maybeSingle(),
    ]);

    if (shipmentsRes.error) {
      throw shipmentsRes.error;
    }
    if (paymentsRes.error) {
      throw paymentsRes.error;
    }
    if (customerRes.error) {
      throw customerRes.error;
    }

    const rawPayments = (paymentsRes.data || []) as Payment[];
    const normalizedPayments = rawPayments.map((row) => ({
      ...row,
      amount: toNumber(row.amount),
    }));

    setShipments(((shipmentsRes.data || []) as any[]).map((row) => {
      const mapped = mapPortalInvoiceRow(row);
      const shipment = Array.isArray(row.shipment) ? row.shipment[0] : row.shipment;
      return {
        ...mapped,
        shipment_tracking_no: resolveTrackingByStatus(shipment?.status, shipment?.notes || null, shipment?.custom_tracking_number) || mapped.shipment_tracking_no,
      };
    }));
    setPayments(normalizedPayments);
    setWalletBalance(toNumber(customerRes.data?.wallet_balance));
  };

  useEffect(() => {
    if (isCustomerLoading) return;
    if (!customer?.id) {
      setShipments([]);
      setPayments([]);
      setWalletBalance(0);
      setIsFetching(false);
      return;
    }

    const fetchData = async () => {
      setIsFetching(true);
      try {
        await fetchLists(customer.id);
      } catch (error: any) {
        toast.error(error?.message || "Failed to load payments.");
      } finally {
        setIsFetching(false);
      }
    };

    fetchData();
  }, [customer?.id, isCustomerLoading]);

  useEffect(() => {
    const code = searchParams.get("payment_code") || "";
    if (code) {
      setPendingPaymentCode(code);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!pendingPaymentCode || !customer?.id) return;

    let isActive = true;
    setIsPolling(true);

    const pollPayment = async () => {
      const { data } = await supabase
        .from("payments")
        .select("id, code, amount, currency, status, payment_provider, created_at, shipment_id")
        .eq("code", pendingPaymentCode)
        .maybeSingle();

      if (!isActive) return;

      if (data) {
        setActivePayment(data);
        if (data.status === "completed" || data.status === "failed") {
          setIsPolling(false);
          await fetchLists(customer.id);
        }
      }
    };

    pollPayment();
    const interval = setInterval(pollPayment, 5000);
    const timeout = setTimeout(() => {
      if (isActive) setIsPolling(false);
    }, 120000);

    return () => {
      isActive = false;
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [pendingPaymentCode, customer?.id]);

  useEffect(() => {
    if (selectedShipment) {
      const shipment = shipments.find((s) => s.shipment_id === selectedShipment);
      if (shipment) {
        const balance = getBalanceDue(shipment);
        setAmount(balance);
        setDisplayAmount(toSelectedAmount(balance).toString());
      }
    }
  }, [selectedShipment, shipments]);

  useEffect(() => {
    if (!customer?.phone) return;
    if (!paymentPhone && hasUsablePhone(customer.phone)) {
      setPaymentPhone(customer.phone);
    }
  }, [customer?.phone, paymentPhone]);

  const outstandingShipments = useMemo(
    () => shipments.filter((s) => isBillableShipment(s) && getBalanceDue(s) > 0),
    [shipments]
  );
  const paidShipments = useMemo(
    () => shipments.filter((s) => isBillableShipment(s) && getBalanceDue(s) <= 0),
    [shipments]
  );

  const totalOutstanding = outstandingShipments.reduce(
    (sum, s) => sum + getBalanceDue(s),
    0
  );

  const totalPaid = paidShipments.reduce((sum, s) => sum + getPaidAmount(s), 0);

  const handlePayment = async () => {
    const shipment = shipments.find((item) => item.shipment_id === selectedShipment);
    if (!shipment || !shipment.shipment_id || amount <= 0) {
      toast.error("Select a shipment and enter a valid amount.");
      return;
    }

    if (!customer?.id) {
      toast.error("Customer profile not found.");
      return;
    }

    const checkoutPhone = hasUsablePhone(paymentPhone) ? paymentPhone : customer.phone;
    if (!hasUsablePhone(checkoutPhone)) {
      toast.error("Add a valid phone number in your profile before making a payment.");
      return;
    }

    const balanceDue = getBalanceDue(shipment);
    if (amount > balanceDue) {
      toast.error("The selected amount exceeds the balance due.");
      return;
    }

    setIsLoading(true);
    setCheckoutUrl(null);

    try {
      const { data, error } = await supabase.functions.invoke("lipila-payment", {
        body: {
          amount,
          amount_currency: defaultCode,
          shipment_id: shipment.shipment_id,
          customer_id: customer.id,
          phone_number: checkoutPhone,
          email: customer.email || undefined,
          currency: "ZMW",
          redirect_url: `${window.location.origin}/customer/payments`,
          description: `Invoice payment for ${shipment.code}`,
          payment_method: paymentMethod,
        },
      });

      if (error) throw error;

      if (data?.success) {
        const code = data.payment_code as string | undefined;
        if (code) {
          setPendingPaymentCode(code);
          const next = new URLSearchParams(searchParams);
          next.set("payment_code", code);
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
          return;
        }

        // Mobile money - show dialog with instructions
        if (paymentMethod === "mobile_money") {
          setShowMomoDialog(true);
          toast.success(data.message || "A payment prompt has been sent to your phone.");
        } else {
          toast.success("Payment initiated. Open the Lipila payment page to complete the payment.");
        }
        await fetchLists(customer.id);
      } else {
        toast.error(data?.error || "Payment initiation failed.");
      }
    } catch (err: any) {
      toast.error(await getFunctionErrorMessage(err, "Payment failed. Please try again."));
    } finally {
      setIsLoading(false);
    }
  };

  const handleWalletTopUp = async () => {
    if (!customer?.id) {
      toast.error("Customer profile not found.");
      return;
    }

    const checkoutPhone = hasUsablePhone(paymentPhone) ? paymentPhone : customer.phone;
    if (!hasUsablePhone(checkoutPhone)) {
      toast.error("Add a valid phone number in your profile before adding funds.");
      return;
    }

    const topUpValue = displayTopUpAmount ? parseFloat(displayTopUpAmount) : walletTopUpAmount;
    if (topUpValue <= 0) {
      toast.error("Enter a valid amount to add to your wallet.");
      return;
    }

    setIsWalletLoading(true);
    setCheckoutUrl(null);

    try {
      const { data, error } = await supabase.functions.invoke("lipila-payment", {
        body: {
          amount: topUpValue,
          amount_currency: defaultCode,
          customer_id: customer.id,
          phone_number: checkoutPhone,
          email: customer.email || undefined,
          currency: "ZMW",
          redirect_url: `${window.location.origin}/customer/payments`,
          description: "Wallet top-up",
          payment_method: paymentMethod,
        },
      });

      if (error) throw error;

      if (data?.success) {
        setWalletTopUpAmount(0);
        const code = data.payment_code as string | undefined;
        if (code) {
          setPendingPaymentCode(code);
          const next = new URLSearchParams(searchParams);
          next.set("payment_code", code);
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
          toast.success(data.message || "A payment prompt has been sent to your phone.");
        } else {
          toast.success("Wallet top-up started. Open the Lipila payment page to complete the deposit.");
        }
      } else {
        toast.error(data?.error || "Wallet top-up failed.");
      }
    } catch (err: any) {
      toast.error(await getFunctionErrorMessage(err, "Wallet top-up failed. Please try again."));
    } finally {
      setIsWalletLoading(false);
    }
  };

  const handleWalletPayment = async () => {
    if (!customer?.id || !selectedShipment) {
      toast.error("Select a shipment first.");
      return;
    }

    const shipment = shipments.find((item) => item.shipment_id === selectedShipment);
    if (!shipment || !shipment.shipment_id) {
      toast.error("Selected shipment was not found.");
      return;
    }

    const finalAmount = displayAmount ? parseFloat(displayAmount) : toSelectedAmount(amount);
    if (finalAmount <= 0) {
      toast.error("Enter a valid payment amount.");
      return;
    }

    const balanceDue = getBalanceDue(shipment);
    if (amount > balanceDue) {
      toast.error("The selected amount exceeds the balance due.");
      return;
    }

    if (amount > walletBalance) {
      toast.error("Your wallet balance is not enough for this payment.");
      return;
    }

    setIsWalletLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("wallet-payment", {
        body: {
          customer_id: customer.id,
          shipment_id: shipment.shipment_id,
          amount,
        },
      });

      if (error) throw error;

      if (!data?.success) {
        toast.error(data?.error || "Wallet payment failed.");
        return;
      }

      setWalletBalance(toNumber(data.wallet_balance));
      setAmount(toNumber(data.outstanding_balance));
      toast.success("Wallet payment completed.");
      await fetchLists(customer.id);
    } catch (err: any) {
      toast.error(await getFunctionErrorMessage(err, "Wallet payment failed. Please try again."));
    } finally {
      setIsWalletLoading(false);
    }
  };

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

  const handleDownloadInvoice = async (shipment: Shipment) => {
    if (!customer) return;
    
    try {
      const paidAmountNumber = getPaidAmount(shipment);
      const balance = getBalanceDue(shipment);
      const logoUrl = await fetchLogo();
      
      const trackingNumber = shipment.shipment_tracking_no || undefined;

      await generateInvoicePdf({
        logoUrl,
        companyName: "XY Cargo Logistics",
        invoiceTitle: "INVOICE",
        invoiceNumber: shipment.code,
        trackingNumber,
        billTo: customer.full_name,
        billToId: customer.code,
        date: format(new Date(shipment.created_at), "PPP"),
        description: shipment.notes || shipment.shipment_description || "Shipment",
        amount: formatAmount(getInvoiceTotal(shipment)),
        paid: formatAmount(paidAmountNumber),
        balance: formatAmount(balance),
        filename: `invoice-${shipment.code}.pdf`,
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
    <CustomerProfileGate>
      <div className="space-y-6 animate-fade-in">
        <PageHeader
          title="Payments & Invoices"

        />

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-border/70 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Outstanding Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-base font-bold">{formatAmount(totalOutstanding)}</p>
              <p className="text-xs text-muted-foreground mt-1">Total unpaid balance</p>
            </CardContent>
          </Card>
          <Card className="border-border/70 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Paid Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-base font-bold text-emerald-600">{formatAmount(totalPaid)}</p>
              <p className="text-xs text-muted-foreground mt-1">Total settled amount</p>
            </CardContent>
          </Card>
          <Card className="border-border/70 shadow-sm bg-primary/5 border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-primary uppercase tracking-wider">Wallet Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <p className="text-base font-bold text-primary">{formatAmount(walletBalance)}</p>
                <Wallet className="h-5 w-5 text-primary opacity-50" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Available for instant payments</p>
            </CardContent>
          </Card>
        </div>

        {(pendingPaymentCode || activePayment) && (
          <Card className="border-primary/20 bg-primary/5 shadow-sm overflow-hidden">
            <div className="h-1 bg-primary/20">
              <div className="h-full bg-primary animate-progress w-full" />
            </div>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Processing Payment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Reference</p>
                  <p className="font-mono text-sm font-semibold">{pendingPaymentCode || activePayment?.code}</p>
                </div>
                {activePayment?.amount ? (
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Amount</p>
                    <p className="font-semibold">{formatAmount(activePayment.amount)}</p>
                  </div>
                ) : null}
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Status</p>
                  <div>{activePayment?.status ? getStatusBadge(activePayment.status) : <Badge variant="outline">Pending</Badge>}</div>
                </div>
                {isPolling && (
                  <div className="flex items-center text-sm text-primary font-medium bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    Verifying...
                  </div>
                )}
              </div>

              {activePayment?.status === "completed" && (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-800 text-sm flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  {activePayment.shipment_id
                    ? "Payment successful! Your invoice has been updated."
                    : "Top-up successful! Your wallet balance has been updated."}
                </div>
              )}
              {activePayment?.status === "failed" && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-800 text-sm flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  Payment failed or was cancelled. Please try again.
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2 border-t border-primary/10">
                {checkoutUrl && activePayment?.status !== "completed" && (
                  <Button asChild size="sm" className="shadow-sm">
                    <a href={checkoutUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Complete in Lipila
                    </a>
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPendingPaymentCode("");
                    setActivePayment(null);
                    setCheckoutUrl(null);
                    const next = new URLSearchParams(searchParams);
                    next.delete("payment_code");
                    setSearchParams(next);
                  }}
                >
                  {activePayment?.status === "completed" ? "Dismiss" : "Cancel & Retry"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* TOP SECTION: Full Width Payment Controls */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Add Funds Section */}
          <Card className="border-border/70 shadow-sm overflow-hidden flex flex-col">
            <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                Add Funds to Wallet
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6 flex-1">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Deposit via Lipila</Label>
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
                            <span className="text-[10px] text-muted-foreground">Airtel, MTN, Zamtel</span>
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
                            <span className="text-[10px] text-muted-foreground">Debit or Credit Cards</span>
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
                        value={displayTopUpAmount}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "" || /^[0-9]*\.?[0-9]*$/.test(val)) {
                            setDisplayTopUpAmount(val);
                            const num = parseFloat(val);
                            if (!isNaN(num)) {
                              setWalletTopUpAmount(convertFromSelected(num));
                            } else {
                              setWalletTopUpAmount(0);
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
                      value={paymentPhone}
                      onChange={(e) => setPaymentPhone(e.target.value)}
                      placeholder="e.g. 097..."
                    />
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={handleWalletTopUp}
                  disabled={isWalletLoading || walletTopUpAmount <= 0}
                  className="w-full h-10 text-sm font-bold shadow-lg shadow-primary/20 mt-2 transition-all hover:scale-[1.01]"
                >
                  {isWalletLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Plus className="mr-2 h-5 w-5" />}
                  Deposit Funds Now
                </Button>
                
                <p className="text-center text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                  Securely processed by Lipila
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Make Payment Section */}
          <Card className="border-border/70 shadow-sm overflow-hidden flex flex-col">
            <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                Make Payment
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6 flex-1">
              <div className="space-y-6">
                <div className="space-y-3">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Choose Payment Source</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setPayFrom("lipila")}
                      className={cn(
                        "flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all gap-2 relative overflow-hidden group",
                        payFrom === "lipila" 
                          ? "border-primary bg-primary/5 text-primary shadow-md shadow-primary/10" 
                          : "border-border/60 bg-background text-muted-foreground hover:border-border hover:bg-muted/5"
                      )}
                    >
                      <div className={cn("p-2 rounded-xl transition-colors", payFrom === "lipila" ? "bg-primary/20" : "bg-muted")}>
                        <CreditCard className="h-6 w-6" />
                      </div>
                      <span className="text-sm font-bold">Lipila Pay</span>
                      {payFrom === "lipila" && <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPayFrom("wallet")}
                      className={cn(
                        "flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all gap-2 relative overflow-hidden group",
                        payFrom === "wallet" 
                          ? "border-primary bg-primary/5 text-primary shadow-md shadow-primary/10" 
                          : "border-border/60 bg-background text-muted-foreground hover:border-border hover:bg-muted/5"
                      )}
                    >
                      <div className={cn("p-2 rounded-xl transition-colors", payFrom === "wallet" ? "bg-primary/20" : "bg-muted")}>
                        <Wallet className="h-6 w-6" />
                      </div>
                      <span className="text-sm font-bold">Wallet Pay</span>
                      {payFrom === "wallet" && <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {payFrom === "lipila" && (
                    <div className="grid gap-4 sm:grid-cols-2 animate-in fade-in slide-in-from-top-4 duration-300">
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
                          value={paymentPhone}
                          onChange={(e) => setPaymentPhone(e.target.value)}
                          placeholder="097..."
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-muted-foreground">Select Invoice</Label>
                      <Select value={selectedShipment} onValueChange={setSelectedShipment}>
                        <SelectTrigger className="h-10 border-2">
                          <SelectValue placeholder="Which invoice are you paying?" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          {outstandingShipments.map((shipment) => (
                            <SelectItem key={shipment.id} value={shipment.shipment_id || shipment.id}>
                              <div className="flex flex-col text-left py-1">
                                <span className="font-bold text-sm">{shipment.code}</span>
                                <span className="text-[10px] text-muted-foreground">Balance: {formatAmount(getBalanceDue(shipment))}</span>
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
                      />
                    </div>
                  </div>

                  <Button
                    onClick={payFrom === "wallet" ? handleWalletPayment : handlePayment}
                    disabled={isLoading || isWalletLoading || !selectedShipment || amount <= 0}
                    className="w-full h-10 text-sm font-bold shadow-lg shadow-primary/20 transition-all hover:scale-[1.01]"
                  >
                    {isLoading || isWalletLoading ? (
                      <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                    ) : (
                      <CheckCircle className="mr-2 h-6 w-6" />
                    )}
                    Pay {amount > 0 ? formatAmount(amount) : "Now"}
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
                  Invoice Management
                </CardTitle>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/customer/pay-on-behalf" className="text-xs font-bold uppercase tracking-wider">
                    <UserCheck className="mr-2 h-3.5 w-3.5" />
                    Pay on Behalf
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
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2.5">
                            <span className="font-semibold text-sm">{shipment.code}</span>
                            <Badge variant="outline" className="font-bold border-2">{getPortalInvoiceReference(shipment)}</Badge>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1.5"><Clock className="h-3 w-3" /> {format(new Date(shipment.created_at), "dd MMM yyyy")}</span>
                            <span className="flex items-center gap-1.5"><Smartphone className="h-3 w-3" /> {getPaymentProgress(shipment)}</span>
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
                              setSelectedShipment(shipment.shipment_id || shipment.id);
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
                        <p className="font-bold text-sm">All Clear!</p>
                        <p className="text-sm text-muted-foreground max-w-[200px] mx-auto">You have no outstanding invoices at the moment.</p>
                      </div>
                    )}
                    
                    {outstandingShipments.length > INVOICES_PAGE_SIZE && (
                      <div className="flex items-center justify-between mt-6 pt-6 border-t">
                        <p className="text-xs font-medium text-muted-foreground tracking-wide">
                          Page {outstandingPage} of {Math.ceil(outstandingShipments.length / INVOICES_PAGE_SIZE)}
                        </p>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" className="font-bold h-9" onClick={() => setOutstandingPage(p => Math.max(1, p-1))} disabled={outstandingPage === 1}>Previous</Button>
                          <Button variant="outline" size="sm" className="font-bold h-9" onClick={() => setOutstandingPage(p => p + 1)} disabled={outstandingPage * INVOICES_PAGE_SIZE >= outstandingShipments.length}>Next</Button>
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="paid" className="mt-0 animate-in fade-in duration-300">
                  <div className="space-y-3">
                    {paidShipments.slice((paidPage-1)*INVOICES_PAGE_SIZE, paidPage*INVOICES_PAGE_SIZE).map((shipment) => (
                      <div key={shipment.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl border border-border/60 bg-muted/5 transition-all gap-4 overflow-hidden">
                        <div className="space-y-1">
                          <div className="flex items-center gap-3">
                            <span className="font-bold">{shipment.code}</span>
                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200">Paid</Badge>
                          </div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">{format(new Date(shipment.created_at), "dd MMM yyyy")}</p>
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
                {isFetching ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : payments.length === 0 ? (
                  <div className="text-center py-20 bg-muted/5 rounded-xl border border-dashed">
                    <Clock className="h-8 w-8 mx-auto mb-2 opacity-10" />
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">No Recent activity</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3">
                                        {payments.slice((transactionsPage - 1) * TRANSACTIONS_PAGE_SIZE, transactionsPage * TRANSACTIONS_PAGE_SIZE).map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between p-4 rounded-xl border-2 border-border/50 bg-background/50 hover:bg-muted/10 transition-colors gap-3 overflow-hidden">
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold font-mono tracking-tighter uppercase">{payment.code}</p>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[9px] h-4 px-1.5 font-semibold uppercase tracking-tighter bg-muted/50 border-0">{payment.payment_provider}</Badge>
                          <span className="text-[10px] text-muted-foreground font-bold">{format(new Date(payment.created_at), "MMM d, h:mm a")}</span>
                        </div>
                      </div>
                      <div className="text-right space-y-1.5 shrink-0">
                        <p className="text-sm font-semibold tracking-tight">{formatAmount(payment.amount)}</p>
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
                <p className="text-sm font-medium">Check your phone and enter your PIN to complete the payment.</p>
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
    </CustomerProfileGate>
  );
};

export default CustomerPayments;

