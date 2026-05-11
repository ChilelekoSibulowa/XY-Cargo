import { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerRecord } from "@/hooks/useCustomerRecord";
import { useDefaultCurrency } from "@/hooks/useDefaultCurrency";
import { toast } from "sonner";
import { Loader2, CreditCard, Smartphone, CheckCircle, Info, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const CustomerCustomPayment = () => {
  const { customer } = useCustomerRecord();
  const { code, formatAmount, convert, convertFromSelected } = useDefaultCurrency();
  const [serviceDescription, setServiceDescription] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [displayAmount, setDisplayAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"card" | "mobile_money">("mobile_money");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (customer?.phone && !phoneNumber) {
      setPhoneNumber(customer.phone);
    }
  }, [customer?.phone]);

  const toSelectedAmount = (value: number) => Number(convert(value).toFixed(2));
  const fromSelectedAmount = (value: string) => {
    if (!value.trim()) return 0;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Number(convertFromSelected(parsed).toFixed(2));
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalAmount = displayAmount ? parseFloat(displayAmount) : toSelectedAmount(amount);
    if (!customer || finalAmount <= 0 || !serviceDescription) {
      toast.error("Please fill in all required fields.");
      return;
    }

    if (paymentMethod === "mobile_money" && !phoneNumber) {
      toast.error("Please enter your phone number for mobile money.");
      return;
    }

    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("lipila-payment", {
        body: {
          amount: finalAmount,
          currency: "ZMW",
          amount_currency: code,
          customer_id: customer.id,
          payment_method: paymentMethod,
          phone_number: phoneNumber || undefined,
          description: serviceDescription,
          payment_type: "custom_payment",
          redirect_url: `${window.location.origin}/customer/payments`,
        },
      });

      if (error) throw error;

      if (data?.success) {
        if (data?.checkout_url) {
          window.location.assign(data.checkout_url);
          toast.success("Redirecting to secure payment page...");
        } else if (paymentMethod === "mobile_money") {
          toast.success(data.message || "A payment prompt has been sent to your phone.");
        } else {
          toast.success("Payment initiated successfully.");
        }

        setServiceDescription("");
        setAmount(0);
      } else {
        toast.error(data?.error || "Payment initiation failed.");
      }
    } catch (err: any) {
      toast.error(err.message || "Payment failed. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      <PageHeader
        title="Custom Payment"
        
      />

      <div className="grid gap-8 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-6">
          <Card className="border-border/70 shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/30 border-b border-border/50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-primary" />
                  Payment Details
                </CardTitle>
                <Badge variant="outline" className="bg-background text-[10px] uppercase">
                  Secure Checkout
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handlePayment} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="service" className="text-sm font-medium flex items-center gap-2">
                    Service Description
                    <Info className="h-3 w-3 opacity-50" />
                  </Label>
                  <Textarea
                    id="service"
                    value={serviceDescription}
                    onChange={(e) => setServiceDescription(e.target.value)}
                    placeholder="Enter details about what you are paying for (e.g., Shipping fee for Order #123)..."
                    required
                    className="min-h-[100px] resize-none text-sm"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="amount" className="text-sm font-medium">Amount ({code})</Label>
                    <div className="relative">
                      <Input
                        id="amount"
                        type="text"
                        inputMode="decimal"
                        className="h-10 pl-8 text-sm no-spinners"
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
                        placeholder="0.00"
                        required
                      />
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        {code === "ZMW" ? "K" : "$"}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Payment Method</Label>
                    <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as "card" | "mobile_money")}>
                      <SelectTrigger className="h-10 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mobile_money">
                          <div className="flex items-center gap-2">
                            <Smartphone className="h-4 w-4 text-primary" />
                            <span className="text-sm">Mobile Money</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="card">
                          <div className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4 text-primary" />
                            <span className="text-sm">Visa / Mastercard</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {paymentMethod === "mobile_money" && (
                  <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                    <Label htmlFor="phone" className="text-sm font-medium">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="e.g. 0977123456"
                      required
                      className="h-10 text-sm"
                    />
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isProcessing || amount <= 0 || !serviceDescription}
                  className="w-full h-10 text-sm font-semibold"
                >
                  {isProcessing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="mr-2 h-4 w-4" />
                  )}
                  {isProcessing ? "Processing..." : `Pay ${amount > 0 ? formatAmount(amount) : ""}`}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border/70 shadow-md">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-muted-foreground">Payment Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-dashed">
                <span className="text-sm text-muted-foreground">Payment for:</span>
                <span className="text-sm font-medium truncate max-w-[150px]">{serviceDescription || "Not specified"}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-dashed">
                <span className="text-sm text-muted-foreground">Method:</span>
                <Badge variant="secondary" className="capitalize text-xs">{paymentMethod.replace("_", " ")}</Badge>
              </div>
              <div className="flex justify-between items-center py-3 text-primary">
                <span className="text-sm font-semibold">Total Amount:</span>
                <span className="text-lg font-semibold">{formatAmount(amount)}</span>
              </div>

              <div className="bg-muted/20 rounded-xl p-4 space-y-3 border border-border/50">
                <div className="flex gap-3">
                  <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
                  <div className="space-y-1">
                    <p className="text-xs font-bold uppercase tracking-wider">Secure Payment</p>
                    <p className="text-[10px] text-muted-foreground font-medium">Your payment is encrypted and processed securely via Lipila Gateway.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-sm bg-muted/5">
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-primary">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-widest">Instant Processing</span>
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Payments made via Mobile Money are processed instantly. For card payments, ensure your card is enabled for online transactions.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CustomerCustomPayment;

