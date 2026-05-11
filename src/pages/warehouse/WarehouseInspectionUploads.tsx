import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DataTable, Column } from "@/components/shared/DataTable";
import { Upload, Loader2, FileImage, Trash2, Eye, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ShipmentResult = {
  id: string;
  code: string;
  description: string | null;
  status: string;
  customer: { full_name: string } | null;
};

type InspectionUpload = {
  id: string;
  file_url: string;
  file_name: string;
  file_type: string | null;
  notes: string | null;
  inspection_type: string;
  created_at: string;
  shipment: { code: string; customer: { full_name: string } | null } | null;
};

const WarehouseInspectionUploads = () => {
  const [scanCode, setScanCode] = useState("");
  const [shipment, setShipment] = useState<ShipmentResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [inspectionType, setInspectionType] = useState("condition");
  const [notes, setNotes] = useState("");
  const [uploads, setUploads] = useState<InspectionUpload[]>([]);
  const [isLoadingUploads, setIsLoadingUploads] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch all inspection uploads
  const fetchUploads = async () => {
    const { data, error } = await supabase
      .from("inspection_uploads")
      .select(`
        id, file_url, file_name, file_type, notes, inspection_type, created_at,
        shipment:shipments(code, customer:customers(full_name))
      `)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      toast.error("Failed to load inspection uploads");
    } else {
      setUploads((data || []) as InspectionUpload[]);
    }
    setIsLoadingUploads(false);
  };

  useEffect(() => {
    fetchUploads();
  }, []);

  // Lookup shipment by code
  const handleLookupShipment = async () => {
    if (!scanCode.trim()) {
      toast.error("Please enter a shipment code");
      return;
    }

    setIsSearching(true);
    setShipment(null);

    const { data, error } = await supabase
      .from("shipments")
      .select("id, code, description, status, customer:customers(full_name)")
      .or(`code.ilike.%${scanCode.trim()}%,custom_tracking_number.ilike.%${scanCode.trim()}%`)
      .limit(1)
      .single();

    if (error || !data) {
      toast.error("Shipment not found");
    } else {
      setShipment(data as ShipmentResult);
    }

    setIsSearching(false);
  };

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !shipment) return;

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Please upload an image (JPG, PNG, WebP) or PDF");
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }

    setIsUploading(true);

    try {
      // Upload to storage
      const fileExt = file.name.split(".").pop();
      const fileName = `inspections/${shipment.code}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("system-assets")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("system-assets")
        .getPublicUrl(fileName);

      // Save to database
      const { error: dbError } = await supabase
        .from("inspection_uploads")
        .insert({
          shipment_id: shipment.id,
          file_url: urlData.publicUrl,
          file_name: file.name,
          file_type: file.type,
          notes: notes || null,
          inspection_type: inspectionType,
        });

      if (dbError) throw dbError;

      toast.success("Inspection uploaded successfully");
      setNotes("");
      fetchUploads();

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload inspection");
    } finally {
      setIsUploading(false);
    }
  };

  // Delete upload
  const handleDelete = async (upload: InspectionUpload) => {
    const { error } = await supabase
      .from("inspection_uploads")
      .delete()
      .eq("id", upload.id);

    if (error) {
      toast.error("Failed to delete upload");
    } else {
      toast.success("Upload deleted");
      fetchUploads();
    }
  };

  const getInspectionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      condition: "Condition Report",
      damage: "Damage Documentation",
      customs: "Customs Inspection",
      contents: "Contents Verification",
      other: "Other",
    };
    return labels[type] || type;
  };

  const uploadColumns: Column<InspectionUpload>[] = [
    {
      key: "file_name",
      label: "File",
      render: (row) => (
        <div className="flex items-center gap-2">
          <FileImage className="h-4 w-4 text-muted-foreground" />
          <span className="truncate max-w-[150px]">{row.file_name}</span>
        </div>
      ),
    },
    {
      key: "shipment",
      label: "Shipment",
      render: (row) => row.shipment?.code || "-",
    },
    {
      key: "inspection_type",
      label: "Type",
      render: (row) => getInspectionTypeLabel(row.inspection_type),
    },
    {
      key: "notes",
      label: "Notes",
      render: (row) => (
        <span className="truncate max-w-[200px] block">
          {row.notes || "-"}
        </span>
      ),
    },
    {
      key: "created_at",
      label: "Uploaded",
      render: (row) => format(new Date(row.created_at), "PP p"),
    },
    {
      key: "actions",
      label: "Actions",
      render: (row) => (
        <div className="flex gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={() => setPreviewUrl(row.file_url)}
            title="Preview"
          >
            <Eye className="h-4 w-4 text-blue-600" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={() => handleDelete(row)}
            title="Delete"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Inspection Uploads"
        
      />

      {/* Shipment Lookup */}
      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>Scan / Enter Shipment Code</CardTitle>
          
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="scan_code">Shipment Code</Label>
              <Input
                id="scan_code"
                value={scanCode}
                onChange={(event) => setScanCode(event.target.value)}
                placeholder="e.g., SHP-8F2A1B"
              />
            </div>
            <Button type="button" onClick={handleLookupShipment} disabled={isSearching}>
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {isSearching ? "Searching..." : "Lookup Shipment"}
            </Button>
          </div>

          {/* Shipment found - show upload form */}
          {shipment && (
            <div className="mt-6 space-y-4 border-t pt-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{shipment.code}</p>
                    <p className="text-sm text-muted-foreground">
                      {shipment.customer?.full_name || "Unknown Customer"} - {shipment.description || "No description"}
                    </p>
                  </div>
                  <span className="text-sm px-2 py-1 bg-background rounded border">
                    {shipment.status}
                  </span>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="inspection_type">Inspection Type</Label>
                  <Select value={inspectionType} onValueChange={setInspectionType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="condition">Condition Report</SelectItem>
                      <SelectItem value="damage">Damage Documentation</SelectItem>
                      <SelectItem value="customs">Customs Inspection</SelectItem>
                      <SelectItem value="contents">Contents Verification</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Input
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add notes about this inspection..."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Upload Photo or Document</Label>
                <div
                  className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {isUploading ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Uploading...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="h-8 w-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Click to upload image or PDF (max 10MB)
                      </p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Uploads */}
      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>Recent Inspection Uploads</CardTitle>
          
        </CardHeader>
        <CardContent>
          <DataTable
            columns={uploadColumns}
            data={uploads}
            isLoading={isLoadingUploads}
            searchPlaceholder="Search uploads..."
          />
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Inspection Document Preview</DialogTitle>
          </DialogHeader>
          <div className="relative">
            {previewUrl?.endsWith(".pdf") ? (
              <iframe
                src={previewUrl}
                className="w-full h-[70vh] border rounded"
                title="PDF Preview"
              />
            ) : (
              <img
                src={previewUrl || ""}
                alt="Inspection"
                className="w-full max-h-[70vh] object-contain rounded"
              />
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => window.open(previewUrl || "", "_blank")}
            >
              Open in New Tab
            </Button>
            <Button variant="outline" onClick={() => setPreviewUrl(null)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WarehouseInspectionUploads;


