import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, FileUp, Loader2, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import SearchableSelect, { SearchableSelectOption } from "@/components/shared/SearchableSelect";
import { supabase } from "@/integrations/supabase/client";
import { sendNotification } from "@/lib/notifications";
import { useDefaultCurrency } from "@/hooks/useDefaultCurrency";
import { useCurrency } from "@/hooks/useCurrencyContext";
import {
  ACCEPTED_FILE_TYPES,
  MAX_FILE_SIZE,
  PAYMENT_CURRENCIES,
  PAYMENT_METHODS,
  PAYMENT_PURPOSES,
  SUPPLIER_COUNTRIES,
  SupplierDocument,
  SupplierPaymentFormData,
  createSupplierPaymentRequest,
  emptyFormData,
  generateRequestCode,
  getPaymentMethodLabel,
  uploadSupplierDocument,
} from "@/lib/supplierPayments";
import { toast } from "sonner";

interface SupplierPaymentFormProps {
  /** The customer record ID (customers.id) — the customer this request is for */
  customerId: string;
  /** The auth user ID (auth.uid()) of the person submitting */
  submittedByUserId?: string;
  submittedByRole: "customer" | "agent";
  dashboardPath: string;
  /** Optional: for agents submitting on behalf of a customer */
  agentCustomerId?: string;
}

type TabKey = "supplier" | "payment" | "documents" | "review";

const TAB_ORDER: TabKey[] = ["supplier", "payment", "documents", "review"];

const SupplierPaymentForm = ({
  customerId,
  submittedByUserId,
  submittedByRole,
  dashboardPath,
  agentCustomerId,
}: SupplierPaymentFormProps) => {
  const navigate = useNavigate();
  const { convert, defaultCode, formatAmount } = useDefaultCurrency();
  const { currencies, convert: convertToSelected, selectedCurrency } = useCurrency();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("supplier");
  const [form, setForm] = useState<SupplierPaymentFormData>(emptyFormData());
  const [documents, setDocuments] = useState<SupplierDocument[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeclared, setIsDeclared] = useState(false);
  const [submitted, setSubmitted] = useState<{ requestCode: string; id: string } | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const effectiveCustomerId = agentCustomerId || customerId;

  const updateField = useCallback(
    <K extends keyof SupplierPaymentFormData>(key: K, value: SupplierPaymentFormData[K]) =>
      setForm((prev) => ({ ...prev, [key]: value })),
    [],
  );

  // Set default currency to selected currency
  useEffect(() => {
    if (selectedCurrency?.code && !form.currency) {
      updateField('currency', selectedCurrency.code);
    }
  }, [selectedCurrency?.code, form.currency, updateField]);

  const countryOptions: SearchableSelectOption[] = SUPPLIER_COUNTRIES.map((c) => ({
    value: c.value,
    label: c.label,
  }));

  const paymentMethodOptions: SearchableSelectOption[] = PAYMENT_METHODS.map((m) => ({
    value: m.value,
    label: m.label,
  }));

  const currencyOptions: SearchableSelectOption[] = PAYMENT_CURRENCIES.map((c) => ({
    value: c.value,
    label: c.label,
  }));

  const purposeOptions: SearchableSelectOption[] = PAYMENT_PURPOSES.map((p) => ({
    value: p.value,
    label: p.label,
  }));

  const showBankDetails = form.payment_method === "bank_transfer";
  const showPayCode = form.payment_method === "alipay" || form.payment_method === "wechat";

  // ---- Exchange rate calculation using system rates ----
  const exchangeRate = useMemo(() => {
    if (!form.currency) return 1;
    // Convert 1 unit of form currency to ZMW
    const zmwCurrency = currencies.find(c => c.code === 'ZMW');
    if (!zmwCurrency) return 1;
    // Since convertBetween converts from form.currency to ZMW
    // But convertBetween(amount, from, to) = amount / fromRate * toRate
    // For exchange rate, it's toRate / fromRate
    const fromCurrency = currencies.find(c => c.code === form.currency);
    if (!fromCurrency) return 1;
    return zmwCurrency.exchange_rate / fromCurrency.exchange_rate;
  }, [form.currency, currencies]);

  const parsedAmount = Number(form.amount) || 0;
  const totalPayable = parsedAmount * exchangeRate;

  // ---- Validation per tab ----
  const supplierValid =
    form.supplier_name.trim() !== "" &&
    form.company_name.trim() !== "" &&
    form.supplier_country !== "" &&
    form.whatsapp_wechat.trim() !== "";

  const paymentValid = (() => {
    if (!form.payment_method || !form.currency || parsedAmount <= 0) return false;
    if (showBankDetails) {
      return (
        form.bank_name.trim() !== "" &&
        form.bank_country.trim() !== "" &&
        form.account_name.trim() !== "" &&
        form.swift_code.trim() !== "" &&
        form.account_number_iban.trim() !== ""
      );
    }
    return true;
  })();

  const documentsValid = documents.length > 0;

  const allValid = supplierValid && paymentValid && documentsValid && isDeclared;

  // ---- Tab navigation ----
  const goNext = () => {
    const idx = TAB_ORDER.indexOf(activeTab);
    if (idx < TAB_ORDER.length - 1) setActiveTab(TAB_ORDER[idx + 1]);
  };

  const goPrev = () => {
    const idx = TAB_ORDER.indexOf(activeTab);
    if (idx > 0) setActiveTab(TAB_ORDER[idx - 1]);
  };

  // ---- File handling ----
  const handleFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const invalidType = fileArray.find((f) => !ACCEPTED_FILE_TYPES.includes(f.type));
    if (invalidType) {
      toast.error("Only PDF, JPG, and PNG files are accepted.");
      return;
    }
    const invalidSize = fileArray.find((f) => f.size > MAX_FILE_SIZE);
    if (invalidSize) {
      toast.error("Each file must be under 5MB.");
      return;
    }

    setIsUploading(true);
    const tempId = crypto.randomUUID();
    try {
      const uploaded = await Promise.all(fileArray.map((f) => uploadSupplierDocument(tempId, f)));
      setDocuments((prev) => [...prev, ...uploaded]);
      toast.success(`${uploaded.length} file(s) uploaded.`);
    } catch {
      toast.error("Failed to upload file(s).");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  };

  const removeDocument = (index: number) =>
    setDocuments((prev) => prev.filter((_, i) => i !== index));

  // ---- Submit ----
  const handleSubmit = async () => {
    if (!allValid) {
      toast.error("Please complete all required fields and accept the declaration.");
      return;
    }

    setIsSubmitting(true);
    try {
      const requestCode = generateRequestCode();

      const payload: Record<string, unknown> = {
        request_code: requestCode,
        customer_id: effectiveCustomerId,
        submitted_by: submittedByUserId || customerId,
        submitted_by_role: submittedByRole,
        status: "pending_review",
        supplier_name: form.supplier_name.trim(),
        company_name: form.company_name.trim(),
        supplier_country: form.supplier_country,
        whatsapp_wechat: form.whatsapp_wechat.trim(),
        supplier_email: form.supplier_email.trim() || null,
        supplier_address: form.supplier_address.trim() || null,
        payment_method: form.payment_method,
        currency: form.currency,
        amount: parsedAmount,
        purpose: form.purpose,
        description: form.description.trim() || null,
        documents,
        exchange_rate: exchangeRate,
        total_payable: totalPayable,
        payable_currency: "ZMW",
        declaration_accepted: true,
      };

      if (showBankDetails) {
        payload.bank_name = form.bank_name.trim();
        payload.bank_country = form.bank_country.trim();
        payload.account_name = form.account_name.trim();
        payload.swift_code = form.swift_code.trim();
        payload.account_number_iban = form.account_number_iban.trim();
        payload.branch = form.branch.trim() || null;
      }

      const result = await createSupplierPaymentRequest(payload);

      // Send notification
      try {
        await sendNotification({
          customer_id: effectiveCustomerId,
          event_type: "supplier_payment_submitted",
          title: "Supplier Payment Request Submitted",
          message: `Your supplier payment request (${requestCode}) for ${form.currency} ${parsedAmount.toLocaleString()} to ${form.supplier_name} has been submitted and is pending review.`,
          sms_message: `XY Cargo: Supplier payment request ${requestCode} submitted. Amount: ${form.currency} ${parsedAmount.toLocaleString()}. Status: Pending Review.`,
          reference_id: result.id,
          notification_type: "payment",
        });
      } catch {
        // Notification failure should not block submission
      }

      setSubmitted({ requestCode, id: result.id });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to submit request.";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---- Success Screen ----
  if (submitted) {
    return (
      <Card className="mx-auto max-w-lg text-center">
        <CardContent className="space-y-6 py-12">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Payment Request Submitted!</h2>
            <p className="mt-2 text-muted-foreground">
              Request ID: <span className="font-mono font-semibold">{submitted.requestCode}</span>
            </p>
            <p className="text-sm text-muted-foreground">Status: Pending Review</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button onClick={() => navigate(dashboardPath)}>Go to Dashboard</Button>
            <Button variant="outline" onClick={() => { setSubmitted(null); setForm(emptyFormData()); setDocuments([]); setIsDeclared(false); setActiveTab("supplier"); }}>
              New Request
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)} className="space-y-6">
      <TabsList className="h-auto w-full flex-wrap justify-start gap-2 rounded-2xl bg-transparent p-0">
        {(
          [
            { key: "supplier", label: "1. Supplier Info" },
            { key: "payment", label: "2. Payment Details" },
            { key: "documents", label: "3. Documents" },
            { key: "review", label: "4. Review & Submit" },
          ] as { key: TabKey; label: string }[]
        ).map((tab) => (
          <TabsTrigger
            key={tab.key}
            value={tab.key}
            className="rounded-full border border-border/70 bg-background px-4 data-[state=active]:border-primary/40 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {/* ---- TAB 1: Supplier Information ---- */}
      <TabsContent value="supplier">
        <Card>
          <CardHeader>
            <CardTitle>Supplier Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Supplier Name *</Label>
                <Input
                  value={form.supplier_name}
                  onChange={(e) => updateField("supplier_name", e.target.value)}
                  placeholder="e.g. ABC Mining Ltd"
                />
              </div>
              <div className="space-y-2">
                <Label>Country *</Label>
                <SearchableSelect
                  value={form.supplier_country}
                  onValueChange={(v) => updateField("supplier_country", v)}
                  options={countryOptions}
                  placeholder="Select country"
                />
              </div>
              <div className="space-y-2">
                <Label>Company Name *</Label>
                <Input
                  value={form.company_name}
                  onChange={(e) => updateField("company_name", e.target.value)}
                  placeholder="Registered company name"
                />
              </div>
              <div className="space-y-2">
                <Label>WhatsApp / WeChat *</Label>
                <Input
                  value={form.whatsapp_wechat}
                  onChange={(e) => updateField("whatsapp_wechat", e.target.value)}
                  placeholder="+86 123 4567 8901"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.supplier_email}
                  onChange={(e) => updateField("supplier_email", e.target.value)}
                  placeholder="supplier@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input
                  value={form.supplier_address}
                  onChange={(e) => updateField("supplier_address", e.target.value)}
                  placeholder="Supplier address"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={goNext} disabled={!supplierValid}>
                Next: Payment Details
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* ---- TAB 2: Payment Method & Details ---- */}
      <TabsContent value="payment">
        <Card>
          <CardHeader>
            <CardTitle>Payment Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Payment Method *</Label>
                <SearchableSelect
                  value={form.payment_method}
                  onValueChange={(v) => updateField("payment_method", v)}
                  options={paymentMethodOptions}
                  placeholder="Select payment method"
                />
              </div>
              <div className="space-y-2">
                <Label>Currency *</Label>
                <SearchableSelect
                  value={form.currency}
                  onValueChange={(v) => updateField("currency", v)}
                  options={currencyOptions}
                  placeholder="Select currency"
                />
              </div>
              <div className="space-y-2">
                <Label>Amount *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => updateField("amount", e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Purpose of Payment *</Label>
                <SearchableSelect
                  value={form.purpose}
                  onValueChange={(v) => updateField("purpose", v)}
                  options={purposeOptions}
                  placeholder="Select purpose"
                />
              </div>
            </div>

            {/* Bank Details — only if Bank Transfer */}
            {showBankDetails && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">Bank Details</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Bank Name *</Label>
                    <Input
                      value={form.bank_name}
                      onChange={(e) => updateField("bank_name", e.target.value)}
                      placeholder="Bank name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Bank Country *</Label>
                    <Input
                      value={form.bank_country}
                      onChange={(e) => updateField("bank_country", e.target.value)}
                      placeholder="e.g. China"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Account Name *</Label>
                    <Input
                      value={form.account_name}
                      onChange={(e) => updateField("account_name", e.target.value)}
                      placeholder="Account holder name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>SWIFT Code *</Label>
                    <Input
                      value={form.swift_code}
                      onChange={(e) => updateField("swift_code", e.target.value)}
                      placeholder="e.g. ABCNCNBJ"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Account Number / IBAN *</Label>
                    <Input
                      value={form.account_number_iban}
                      onChange={(e) => updateField("account_number_iban", e.target.value)}
                      placeholder="Account number or IBAN"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Branch (Optional)</Label>
                    <Input
                      value={form.branch}
                      onChange={(e) => updateField("branch", e.target.value)}
                      placeholder="Branch name"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Description / Notes (Optional)</Label>
              <Textarea
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
                placeholder="Any additional notes about this payment..."
                rows={3}
              />
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={goPrev}>
                Back
              </Button>
              <Button onClick={goNext} disabled={!paymentValid}>
                Next: Documents
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* ---- TAB 3: Documents Upload ---- */}
      <TabsContent value="documents">
        <Card>
          <CardHeader>
            <CardTitle>Documents Upload</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div
              className={`relative flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-colors ${dragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">Drag & Drop Files Here</p>
              <p className="text-xs text-muted-foreground">or click to browse</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Accepted: PDF, JPG, PNG &middot; Max Size: 5MB per file
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) handleFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              {isUploading && (
                <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/80">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              )}
            </div>

            {documents.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Uploaded Files ({documents.length})</p>
                {documents.map((doc, index) => (
                  <div
                    key={`${doc.name}-${index}`}
                    className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate text-sm">{doc.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        ({(doc.size / 1024).toFixed(0)} KB)
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => removeDocument(index)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={goPrev}>
                Back
              </Button>
              <Button onClick={goNext} disabled={!documentsValid}>
                Next: Review
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* ---- TAB 4: Review & Submit ---- */}
      <TabsContent value="review">
        <div className="space-y-6">
          {/* Summary Card */}
          <Card>
              <CardHeader>
                <CardTitle>Ready to Submit?</CardTitle>
              </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                {/* Supplier Summary */}
                <div className="rounded-xl border border-border/70 p-4 space-y-3">
                  <h3 className="text-sm font-semibold">Supplier Summary</h3>
                  <div className="space-y-1 text-sm">
                    <p><span className="text-muted-foreground">Supplier:</span> {form.supplier_name || "-"}</p>
                    <p><span className="text-muted-foreground">Company:</span> {form.company_name || "-"}</p>
                    <p><span className="text-muted-foreground">Country:</span> {form.supplier_country || "-"}</p>
                    <p><span className="text-muted-foreground">WhatsApp/WeChat:</span> {form.whatsapp_wechat || "-"}</p>
                    {form.supplier_email && <p><span className="text-muted-foreground">Email:</span> {form.supplier_email}</p>}
                    {form.supplier_address && <p><span className="text-muted-foreground">Address:</span> {form.supplier_address}</p>}
                  </div>
                </div>

                {/* Payment Summary */}
                <div className="rounded-xl border border-border/70 p-4 space-y-3">
                  <h3 className="text-sm font-semibold">Payment Summary</h3>
                  <div className="space-y-1 text-sm">
                    <p><span className="text-muted-foreground">Method:</span> {getPaymentMethodLabel(form.payment_method)}</p>
                    <p><span className="text-muted-foreground">Amount:</span> {form.currency} {parsedAmount.toLocaleString()}</p>
                    <p><span className="text-muted-foreground">Purpose:</span> {PAYMENT_PURPOSES.find((p) => p.value === form.purpose)?.label || form.purpose}</p>
                    {form.description && <p><span className="text-muted-foreground">Notes:</span> {form.description}</p>}
                  </div>

                  {showBankDetails && (
                    <div className="mt-2 space-y-1 text-sm border-t border-border/50 pt-2">
                      <p className="font-medium text-xs text-muted-foreground">Bank Details</p>
                      <p><span className="text-muted-foreground">Bank:</span> {form.bank_name}</p>
                      <p><span className="text-muted-foreground">Country:</span> {form.bank_country}</p>
                      <p><span className="text-muted-foreground">Account Name:</span> {form.account_name}</p>
                      <p><span className="text-muted-foreground">SWIFT:</span> {form.swift_code}</p>
                      <p><span className="text-muted-foreground">Account / IBAN:</span> {form.account_number_iban}</p>
                      {form.branch && <p><span className="text-muted-foreground">Branch:</span> {form.branch}</p>}
                    </div>
                  )}
                </div>
              </div>

              {/* Charges Box */}
              <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4 space-y-2">
                <h3 className="text-sm font-semibold">Charges</h3>
                <div className="grid gap-1 text-sm sm:grid-cols-3">
                  <p><span className="text-muted-foreground">Exchange Rate:</span> 1 {form.currency || "—"} = {exchangeRate} ZMW</p>
                  <p className="sm:col-span-2">
                    <span className="text-muted-foreground">Total Payable:</span>{" "}
                    <span className="text-lg font-bold">ZMW {totalPayable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </p>
                </div>
              </div>

              {/* Documents summary */}
              <div>
                <h3 className="text-sm font-semibold mb-2">Uploaded Documents ({documents.length})</h3>
                <div className="flex flex-wrap gap-2">
                  {documents.map((doc, i) => (
                    <span key={`${doc.name}-${i}`} className="inline-flex items-center gap-1 rounded-lg border border-border/70 px-2 py-1 text-xs">
                      <FileUp className="h-3 w-3" /> {doc.name}
                    </span>
                  ))}
                </div>
              </div>

              {/* Declaration */}
              <div className="rounded-xl border border-border/70 p-4 space-y-3">
                <h3 className="text-sm font-semibold">Declaration</h3>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="declaration"
                    checked={isDeclared}
                    onCheckedChange={(checked) => setIsDeclared(checked === true)}
                    className="mt-0.5"
                  />
                  <label htmlFor="declaration" className="text-sm leading-relaxed cursor-pointer">
                    I confirm that all information provided is accurate, the payment is for legitimate business purposes,
                    I authorize XY Cargo Logistics to facilitate this payment, and I accept applicable terms & conditions.
                  </label>
                </div>
              </div>

              {/* Notes */}
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                <p className="font-semibold mb-1">Important Notes</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>Ensure all supplier details are correct to avoid delays</li>
                  <li>Incomplete requests may be rejected or delayed</li>
                  <li>Payment is processed within 24-72 hours</li>
                </ul>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-3">
                <Button onClick={handleSubmit} disabled={!allValid || isSubmitting} className="gap-2">
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Submit Request
                </Button>
                <Button variant="outline" onClick={goPrev}>
                  Back
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setForm(emptyFormData());
                    setDocuments([]);
                    setIsDeclared(false);
                    setActiveTab("supplier");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>
    </Tabs>
  );
};

export default SupplierPaymentForm;
