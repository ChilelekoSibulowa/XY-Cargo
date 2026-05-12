import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Send, Upload, Users, Search, MessageSquare } from "lucide-react";

type CustomerRow = {
  id: string;
  full_name: string;
  phone: string;
  code: string;
  email: string | null;
};

const sanitizeBranding = (value: string | null) =>
  value?.replace(/zamtel/gi, "XY Cargo") ?? null;

const getFunctionErrorMessage = async (error: unknown) => {
  const context = typeof error === "object" && error !== null && "context" in error
    ? (error as { context?: Response }).context
    : null;

  if (context) {
    try {
      const payload = await context.clone().json();
      const details =
        typeof payload?.details?.message === "string"
          ? payload.details.message
          : typeof payload?.details?.errors?.responseText === "string"
            ? payload.details.errors.responseText
            : typeof payload?.details?.raw_text === "string"
              ? payload.details.raw_text
              : null;

      return sanitizeBranding(
        (typeof payload?.error === "string" && payload.error) ||
        details ||
        (typeof payload?.message === "string" && payload.message) ||
        null,
      );
    } catch {
      try {
        const text = await context.clone().text();
        if (text.trim()) return sanitizeBranding(text);
      } catch { /* ignore */ }
    }
  }

  return sanitizeBranding(
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message?: string }).message || "")
      : "",
  );
};

const SupportBulkSms = () => {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [csvNumbers, setCsvNumbers] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCustomers = async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, full_name, phone, code, email")
        .eq("is_active", true)
        .order("full_name");

      if (!error && data) setCustomers(data as CustomerRow[]);
      setIsLoading(false);
    };
    fetchCustomers();
  }, []);

  const filteredCustomers = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.toLowerCase();
    return customers.filter(
      (c) =>
        c.full_name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.code.toLowerCase().includes(q)
    );
  }, [customers, search]);

  const toggleCustomer = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === filteredCustomers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredCustomers.map((c) => c.id)));
    }
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split(/[\r\n]+/).filter(Boolean);
      const numbers: string[] = [];

      lines.forEach((line) => {
        const parts = line.split(",");
        parts.forEach((part) => {
          const cleaned = part.replace(/[^0-9+]/g, "").trim();
          if (cleaned.length >= 9) numbers.push(cleaned);
        });
      });

      setCsvNumbers(numbers);
      toast.success(`Imported ${numbers.length} phone number(s) from CSV.`);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error("Please enter a message.");
      return;
    }

    const selectedPhones = customers
      .filter((c) => selectedIds.has(c.id))
      .map((c) => c.phone);

    const allPhones = [...new Set([...selectedPhones, ...csvNumbers])];

    if (allPhones.length === 0) {
      toast.error("Select at least one recipient or import a CSV.");
      return;
    }

    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-sms", {
        body: {
          phone_numbers: allPhones,
          message: message.trim(),
          reference_type: "bulk_sms",
        },
      });

      if (error) {
        const providerError = await getFunctionErrorMessage(error);
        throw new Error(providerError || "Failed to send SMS.");
      }

      const results = data?.results || [];
      const totalSent = results.reduce((acc: number, r: any) => acc + (r.ok ? r.recipients.length : 0), 0);
      const totalFailed = allPhones.length - totalSent;

      if (data?.success) {
        toast.success(`SMS successfully accepted for all ${allPhones.length} recipient(s).`);
        setMessage("");
        setSelectedIds(new Set());
        setCsvNumbers([]);
      } else if (totalSent > 0) {
        toast.warning(`Partial delivery: ${totalSent} sent, ${totalFailed} failed. Check API keys or credits.`);
      } else {
        const errorMsg = sanitizeBranding(data?.error) || "Delivery failed. Please check your SMS credits and API configuration.";
        toast.error(errorMsg);
      }
    } catch (err) {
      const msg = await getFunctionErrorMessage(err);
      toast.error(msg || "Failed to send SMS.");
    } finally {
      setIsSending(false);
    }
  };

  const totalRecipients = new Set([
    ...customers.filter((c) => selectedIds.has(c.id)).map((c) => c.phone),
    ...csvNumbers,
  ]).size;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Bulk SMS"
        
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Compose Message
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Message</Label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type your message here..."
                  rows={5}
                  maxLength={640}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {message.length}/640 characters
                </p>
              </div>

              <div className="space-y-2">
                <Label>Import CSV (optional)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleCsvUpload}
                    className="flex-1"
                  />
                  <Upload className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
                {csvNumbers.length > 0 && (
                  <Badge variant="secondary">
                    {csvNumbers.length} number(s) from CSV
                  </Badge>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <p className="text-sm text-muted-foreground">
                  <Users className="inline h-4 w-4 mr-1" />
                  {totalRecipients} recipient(s)
                </p>
                <Button
                  onClick={handleSend}
                  disabled={isSending || totalRecipients === 0 || !message.trim()}
                >
                  {isSending ? "Sending..." : (
                    <>
                      <Send className="mr-2 h-4 w-4" /> Send SMS
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" /> Select Recipients
              </CardTitle>
              <Button variant="outline" size="sm" onClick={selectAll}>
                {selectedIds.size === filteredCustomers.length && filteredCustomers.length > 0
                  ? "Deselect All"
                  : "Select All"}
              </Button>
            </div>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, phone, or code..."
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent className="max-h-[480px] overflow-y-auto space-y-1">
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-10 rounded bg-muted animate-pulse" />
                ))}
              </div>
            ) : filteredCustomers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No customers found.
              </p>
            ) : (
              filteredCustomers.map((customer) => (
                <label
                  key={customer.id}
                  className="flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition hover:bg-muted/50"
                >
                  <Checkbox
                    checked={selectedIds.has(customer.id)}
                    onCheckedChange={() => toggleCustomer(customer.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{customer.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {customer.phone} · {customer.code}
                    </p>
                  </div>
                </label>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SupportBulkSms;

