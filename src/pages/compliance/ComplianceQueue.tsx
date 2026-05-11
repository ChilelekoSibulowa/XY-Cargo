import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, Column } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Plus } from "lucide-react";

type ManualCustomsRecord = {
  id: string;
  awb_bl_number: string;
  service_type: string;
  status: "pending_customs" | "customs_cleared" | "flagged";
  compliance_notes: string | null;
  created_at: string;
};

const ComplianceQueue = () => {
  const [manualRecords, setManualRecords] = useState<ManualCustomsRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [formData, setFormData] = useState({
    awb_bl_number: "",
    service_type: "Air",
    compliance_notes: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);

    const { data, error } = await supabase
      .from("manual_customs_records")
      .select("id, awb_bl_number, service_type, status, compliance_notes, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load manual customs records.");
      setManualRecords([]);
    } else {
      setManualRecords((data || []) as ManualCustomsRecord[]);
    }

    if (showLoading) setIsLoading(false);
  };

  useEffect(() => {
    void fetchData();
    const customsChannel = supabase
      .channel("compliance-queue-customs")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "manual_customs_records" },
        () => void fetchData(false),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(customsChannel);
    };
  }, []);

  const updateManualRecordStatus = async (id: string, newStatus: "pending_customs" | "customs_cleared" | "flagged") => {
    setIsUpdating(id);
    const { error } = await supabase
      .from("manual_customs_records")
      .update({ status: newStatus })
      .eq("id", id);

    if (error) {
      toast.error("Failed to update customs record status.");
    } else {
      toast.success(`Record status updated to ${newStatus.replace(/_/g, " ")}.`);
      setManualRecords((prev) =>
        prev.map((row) => (row.id === id ? { ...row, status: newStatus } : row)),
      );
    }
    setIsUpdating(null);
  };

  const addManualRecord = async () => {
    if (!formData.awb_bl_number.trim()) {
      toast.error("AWB/BL number is required.");
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase.from("manual_customs_records").insert([
      {
        awb_bl_number: formData.awb_bl_number.trim().toUpperCase(),
        service_type: formData.service_type,
        status: "pending_customs",
        compliance_notes: formData.compliance_notes.trim() || null,
      },
    ]);

    if (error) {
      if (error.code === "23505") {
        toast.error("This AWB/BL number already exists.");
      } else {
        toast.error("Failed to add customs record.");
      }
    } else {
      toast.success("Customs record created successfully.");
      setFormData({ awb_bl_number: "", service_type: "Air", compliance_notes: "" });
      setShowAddDialog(false);
      await fetchData(false);
    }
    setIsSubmitting(false);
  };

  const manualColumns: Column<ManualCustomsRecord>[] = [
    {
      key: "awb_bl_number",
      label: "AWB / BL Number",
      render: (item) => (
        <span className="font-mono font-semibold text-xs whitespace-nowrap">
          ({item.awb_bl_number})
        </span>
      ),
    },
    {
      key: "service_type",
      label: "Service Type",
      render: (item) => (
        <Badge variant="outline" className="whitespace-nowrap text-xs">
          {item.service_type}
        </Badge>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (item) => {
        if (item.status === "flagged") {
          return <Badge variant="destructive" className="whitespace-nowrap text-xs">Flagged</Badge>;
        }
        return <Badge className="whitespace-nowrap text-xs">{item.status.replace(/_/g, " ")}</Badge>;
      },
    },
    {
      key: "compliance_notes",
      label: "Compliance Notes",
      render: (item) => (
        <span className="max-w-[200px] block truncate text-xs text-muted-foreground">
          {item.compliance_notes || "—"}
        </span>
      ),
    },
    {
      key: "action",
      label: "Actions",
      render: (item) => (
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 p-0"
            disabled={isUpdating === item.id || item.status === "customs_cleared"}
            onClick={() => updateManualRecordStatus(item.id, "customs_cleared")}
            title={item.status === "customs_cleared" ? "Already cleared" : "Mark as customs cleared"}
          >
            <CheckCircle2 className={`h-4 w-4 ${item.status === "customs_cleared" ? "text-muted-foreground" : "text-green-600"}`} />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 p-0"
            disabled={isUpdating === item.id}
            onClick={() =>
              updateManualRecordStatus(
                item.id,
                item.status === "flagged" ? "pending_customs" : "flagged",
              )
            }
            title={item.status === "flagged" ? "Remove flag" : "Flag for review"}
          >
            <AlertTriangle className={`h-4 w-4 ${item.status === "flagged" ? "text-destructive" : "text-orange-500"}`} />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Compliance Queue"
      />

      <div className="space-y-3">
        <div className="flex items-center justify-end">
          <Button onClick={() => setShowAddDialog(true)} size="icon" title="Add record">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <DataTable
          columns={manualColumns}
          data={manualRecords}
          isLoading={isLoading}
          searchPlaceholder="Search customs records..."
        />
      </div>

      {/* Add Manual Customs Record Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Manual Customs Record</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="awb-bl">AWB / BL Number *</Label>
              <Input
                id="awb-bl"
                placeholder="e.g., 001-234567890-8"
                value={formData.awb_bl_number}
                onChange={(e) => setFormData({ ...formData, awb_bl_number: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="service-type">Service Type</Label>
              <Select
                value={formData.service_type}
                onValueChange={(val) => setFormData({ ...formData, service_type: val })}
              >
                <SelectTrigger id="service-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Air">Air</SelectItem>
                  <SelectItem value="Sea">Sea</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="compliance-notes">Compliance Notes</Label>
              <Textarea
                id="compliance-notes"
                placeholder="Add any compliance observations or notes..."
                rows={3}
                value={formData.compliance_notes}
                onChange={(e) => setFormData({ ...formData, compliance_notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddDialog(false);
                setFormData({ awb_bl_number: "", service_type: "Air", compliance_notes: "" });
              }}
            >
              Cancel
            </Button>
            <Button onClick={addManualRecord} disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ComplianceQueue;