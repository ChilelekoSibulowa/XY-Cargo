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
import { Send, Upload, Users, Search, MessageSquare, History, RefreshCcw, Eye, X, Activity } from "lucide-react";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
  const [history, setHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [diagnosticResult, setDiagnosticResult] = useState<any | null>(null);
  const [isRunningDiagnostic, setIsRunningDiagnostic] = useState(false);

  const runDiagnostic = async () => {
    setIsRunningDiagnostic(true);
    try {
      const { data, error } = await supabase.functions.invoke("sms-diagnostic");
      if (error) throw error;
      setDiagnosticResult(data);
      toast.success("Diagnostic completed.");
    } catch (err: any) {
      toast.error(err.message || "Diagnostic failed.");
    } finally {
      setIsRunningDiagnostic(false);
    }
  };
    setIsLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from("sms_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      setHistory(data || []);
    } catch (err) {
      console.error("Failed to load SMS history:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

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
      
      // Refresh history after send
      await loadHistory();
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

      {/* SMS History Section */}
      <div className="mt-8">
        <Card className="border-border/40 shadow-sm overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between bg-muted/20 pb-4 border-b">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <History className="h-5 w-5 text-primary" />
              Delivery History
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={runDiagnostic} disabled={isRunningDiagnostic} className="h-8">
                <Activity className={`h-3.5 w-3.5 mr-2 ${isRunningDiagnostic ? "animate-spin" : ""}`} />
                API Diagnostic
              </Button>
              <Button variant="outline" size="sm" onClick={loadHistory} disabled={isLoadingHistory} className="h-8">
                <RefreshCcw className={`h-3.5 w-3.5 mr-2 ${isLoadingHistory ? "animate-spin" : ""}`} />
                Refresh Status
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="w-[100px] py-3 pl-6">Date</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Message Preview</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right pr-6">Logs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingHistory ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic">
                        Fetching latest delivery logs...
                      </TableCell>
                    </TableRow>
                  ) : history.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                        No recent SMS activity found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    history.map((log) => (
                      <TableRow key={log.id} className="hover:bg-muted/10 transition-colors">
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground pl-6">
                          {format(new Date(log.created_at), "MMM d, HH:mm")}
                        </TableCell>
                        <TableCell className="font-medium">{log.recipient_phone}</TableCell>
                        <TableCell className="max-w-[240px] truncate text-xs text-muted-foreground">
                          {log.message}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            log.status === "sent" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          }`}>
                            {log.status === "sent" ? "Accepted" : "Rejected"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => setSelectedLog(log)}
                            className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Response Detail Dialog Overlay */}
      {selectedLog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border-primary/20 ring-1 ring-primary/10">
            <CardHeader className="border-b bg-muted/40 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-bold">API Diagnostic Logs</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">Transaction ID: {selectedLog.id}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setSelectedLog(null)} className="rounded-full">
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-y-auto">
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-6 bg-muted/20 p-4 rounded-xl border border-border/50">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1 tracking-widest">Recipient Mobile</p>
                    <p className="font-mono text-lg font-semibold">{selectedLog.recipient_phone}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1 tracking-widest">Gateway Status</p>
                    <p className={`text-lg font-bold ${selectedLog.status === "sent" ? "text-green-500" : "text-red-500"}`}>
                      {selectedLog.status?.toUpperCase() || "UNKNOWN"}
                    </p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Transmitted Message</p>
                  <div className="bg-muted/30 p-4 rounded-xl text-sm border border-border/40 italic leading-relaxed shadow-inner">
                    "{selectedLog.message}"
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Raw Provider Payload</p>
                  <pre className="bg-slate-950 text-emerald-400 p-5 rounded-xl text-[11px] overflow-x-auto border border-white/10 shadow-2xl font-mono leading-tight">
                    {JSON.stringify(selectedLog.provider_response, null, 2)}
                  </pre>
                </div>
              </div>
            </CardContent>
            <div className="border-t p-4 bg-muted/20 flex justify-end gap-3 px-6">
              <Button variant="outline" onClick={() => setSelectedLog(null)}>Dismiss</Button>
            </div>
          </Card>
        </div>
      )}

      {/* Diagnostic Result Dialog */}
      {diagnosticResult && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl border-blue-500/30">
            <CardHeader className="bg-blue-500/10 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-blue-600">
                  <Activity className="h-5 w-5" />
                  Zamtel API Diagnostic Result
                </CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setDiagnosticResult(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6 overflow-y-auto">
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-muted p-3 rounded-lg">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Configured Sender ID</p>
                    <p className="font-mono text-sm">{diagnosticResult.senderIdConfigured || "Not set"}</p>
                  </div>
                  <div className="bg-muted p-3 rounded-lg">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">API Key Status</p>
                    <p className="font-mono text-sm">{diagnosticResult.apiKeyLen ? `Active (${diagnosticResult.apiKeyLen} chars)` : "Missing"}</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-bold text-muted-foreground uppercase">Approved Sender IDs on Account</p>
                  <pre className="bg-slate-900 text-slate-100 p-3 rounded-md text-xs overflow-x-auto">
                    {typeof diagnosticResult.senderIds === 'string' ? diagnosticResult.senderIds : JSON.stringify(diagnosticResult.senderIds, null, 2)}
                  </pre>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-bold text-muted-foreground uppercase">Account Balance</p>
                  <pre className="bg-slate-900 text-slate-100 p-3 rounded-md text-xs overflow-x-auto">
                    {typeof diagnosticResult.balance === 'string' ? diagnosticResult.balance : JSON.stringify(diagnosticResult.balance, null, 2)}
                  </pre>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-bold text-muted-foreground uppercase">Account Info</p>
                  <pre className="bg-slate-900 text-slate-100 p-3 rounded-md text-xs overflow-x-auto">
                    {typeof diagnosticResult.account === 'string' ? diagnosticResult.account : JSON.stringify(diagnosticResult.account, null, 2)}
                  </pre>
                </div>
              </div>
            </CardContent>
            <div className="border-t p-4 bg-muted/20 flex justify-end">
              <Button onClick={() => setDiagnosticResult(null)}>Close</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default SupportBulkSms;

