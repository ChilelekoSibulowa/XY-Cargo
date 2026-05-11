import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ImportShipmentsProps {
  onImportComplete: () => void;
}

interface ParsedRow {
  customer_code: string;
  receiver_name: string;
  receiver_phone: string;
  receiver_address: string;
  receiver_city: string;
  weight: number;
  description: string;
  service_type: string;
  notes: string;
  isValid: boolean;
  error?: string;
}

export const ImportShipments = ({ onImportComplete }: ImportShipmentsProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importResults, setImportResults] = useState<{ success: number; failed: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseCSV = (text: string): ParsedRow[] => {
    const lines = text.split("\n").filter((line) => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));
    
    return lines.slice(1).map((line) => {
      const values = line.split(",").map((v) => v.trim().replace(/"/g, ""));
      const row: Record<string, string> = {};
      headers.forEach((h, i) => {
        row[h] = values[i] || "";
      });

      const parsedRow: ParsedRow = {
        customer_code: row["customer_code"] || row["customer"] || "",
        receiver_name: row["receiver_name"] || row["receiver"] || "",
        receiver_phone: row["receiver_phone"] || row["phone"] || "",
        receiver_address: row["receiver_address"] || row["address"] || "",
        receiver_city: row["receiver_city"] || row["city"] || "",
        weight: parseFloat(row["weight"]) || 0,
        description: row["description"] || "",
        service_type: (row["service_type"] || "air").toLowerCase(),
        notes: row["notes"] || "",
        isValid: true,
      };

      // Validation
      if (!parsedRow.customer_code) {
        parsedRow.isValid = false;
        parsedRow.error = "Missing customer code";
      } else if (!parsedRow.receiver_name || !parsedRow.receiver_phone) {
        parsedRow.isValid = false;
        parsedRow.error = "Missing receiver details";
      } else if (parsedRow.weight <= 0) {
        parsedRow.isValid = false;
        parsedRow.error = "Invalid weight";
      }

      return parsedRow;
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsed = parseCSV(text);
      setParsedData(parsed);
      setImportResults(null);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    const validRows = parsedData.filter((r) => r.isValid);
    if (validRows.length === 0) {
      toast.error("No valid rows to import");
      return;
    }

    setIsImporting(true);
    let success = 0;
    let failed = 0;

    try {
      // Get first branch as default
      const { data: branches } = await supabase
        .from("branches")
        .select("id")
        .eq("is_active", true)
        .eq("country", "China")
        .limit(1);

      const defaultBranchId = branches?.[0]?.id;

      if (!defaultBranchId) {
        toast.error("No active warehouse found. Please create a warehouse first.");
        setIsImporting(false);
        return;
      }

      for (const row of validRows) {
        try {
          // Find customer by code
          const { data: customer } = await supabase
            .from("customers")
            .select("id")
            .eq("code", row.customer_code)
            .maybeSingle();

          if (!customer) {
            failed++;
            continue;
          }

          // Create or find receiver
          const { data: existingReceiver } = await supabase
            .from("receivers")
            .select("id")
            .eq("customer_id", customer.id)
            .eq("phone", row.receiver_phone)
            .maybeSingle();

          let receiverId = existingReceiver?.id;

          if (!receiverId) {
            const { data: funcData } = await supabase.rpc("generate_code", { prefix: "RCV" });
            const { data: newReceiver, error: recError } = await supabase
              .from("receivers")
              .insert({
                code: funcData || `RCV-${Date.now()}`,
                customer_id: customer.id,
                full_name: row.receiver_name,
                phone: row.receiver_phone,
                address: row.receiver_address,
                city: row.receiver_city,
              })
              .select("id")
              .single();

            if (recError) {
              failed++;
              continue;
            }
            receiverId = newReceiver.id;
          }

          // Generate shipment code
          const { data: shipmentCode } = await supabase.rpc("generate_code", { prefix: "SHP" });

          // Create shipment
          const { error: shipError } = await supabase.from("shipments").insert({
            code: shipmentCode || `SHP-${Date.now()}`,
            customer_id: customer.id,
            receiver_id: receiverId,
            branch_id: defaultBranchId,
            weight: row.weight,
            description: row.description,
            service_type: row.service_type as "air" | "sea",
            notes: row.notes,
            status: "created" as any,
          });

          if (shipError) {
            failed++;
          } else {
            success++;
          }
        } catch {
          failed++;
        }
      }

      setImportResults({ success, failed });
      if (success > 0) {
        toast.success(`Imported ${success} shipments`);
        onImportComplete();
      }
      if (failed > 0) {
        toast.error(`Failed to import ${failed} shipments`);
      }
    } catch (error: any) {
      toast.error(error.message || "Import failed");
    } finally {
      setIsImporting(false);
    }
  };

  const downloadTemplate = () => {
    const template = `customer_code,receiver_name,receiver_phone,receiver_address,receiver_city,weight,description,service_type,notes
CUS-EXAMPLE1,John Doe,+260971234567,123 Main St,Lusaka,2.5,Electronics,air,Fragile
CUS-EXAMPLE2,Jane Smith,+260972345678,456 Oak Ave,Kitwe,5.0,Documents,sea,Handle with care`;
    
    const blob = new Blob([template], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "shipments_import_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="h-4 w-4 mr-2" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import Shipments from CSV
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center gap-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              Select CSV File
            </Button>
            <Button variant="ghost" size="sm" onClick={downloadTemplate}>
              Download Template
            </Button>
          </div>

          {parsedData.length > 0 && (
            <>
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  {parsedData.filter((r) => r.isValid).length} valid
                </span>
                <span className="flex items-center gap-1 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {parsedData.filter((r) => !r.isValid).length} invalid
                </span>
              </div>

              <ScrollArea className="h-[300px] border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Customer Code</TableHead>
                      <TableHead>Receiver</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead>Weight</TableHead>
                      <TableHead>Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.map((row, idx) => (
                      <TableRow key={idx} className={!row.isValid ? "bg-destructive/10" : ""}>
                        <TableCell>
                          {row.isValid ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <span className="text-xs text-destructive">{row.error}</span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{row.customer_code}</TableCell>
                        <TableCell>{row.receiver_name}</TableCell>
                        <TableCell>{row.receiver_phone}</TableCell>
                        <TableCell>{row.receiver_city}</TableCell>
                        <TableCell>{row.weight} kg</TableCell>
                        <TableCell className="uppercase">{row.service_type}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              {importResults && (
                <div className="p-3 bg-muted rounded-md text-sm">
                  Import complete: {importResults.success} succeeded, {importResults.failed} failed
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={isImporting || parsedData.filter((r) => r.isValid).length === 0}
          >
            {isImporting ? "Importing..." : `Import ${parsedData.filter((r) => r.isValid).length} Shipments`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
