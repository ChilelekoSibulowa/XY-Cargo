import { useEffect, useMemo, useState } from "react";
import { useDefaultCurrency } from "@/hooks/useDefaultCurrency";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, Column } from "@/components/shared/DataTable";
import { Card, CardContent } from "@/components/ui/card";
import { Pencil, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SearchableSelect, { type SearchableSelectOption } from "@/components/shared/SearchableSelect";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus } from "lucide-react";

type ChargeRow = {
  id: string;
  charge_type: string;
  amount: number;
  currency: string;
  note?: string | null;
  notes?: string | null;
  finance_expense_id?: string | null;
  created_at: string;
};

const normalizeChargeRows = (data: unknown[] | null | undefined): ChargeRow[] =>
  ((data || []) as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id || ""),
    charge_type: String(row.charge_type || ""),
    amount: Number(row.amount || 0),
    currency: String(row.currency || ""),
    note:
      typeof row.note === "string"
        ? row.note
        : typeof row.notes === "string"
          ? row.notes
          : null,
    notes:
      typeof row.notes === "string"
        ? row.notes
        : typeof row.note === "string"
          ? row.note
          : null,
    finance_expense_id:
      typeof row.finance_expense_id === "string" ? row.finance_expense_id : null,
    created_at: String(row.created_at || ""),
  }));

const ComplianceCharges = () => {
  const [rows, setRows] = useState<ChargeRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingCharge, setEditingCharge] = useState<ChargeRow | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { code: selectedCurrency, formatAmount } = useDefaultCurrency();
  const [form, setForm] = useState({ charge_type: "custom_duty", amount: "", note: "", queue_id: "" });
  const [queues, setQueues] = useState<{ id: string; awb_bl_number: string }[]>([]);

  useEffect(() => {
    const fetchQueues = async () => {
      const { data, error } = await supabase
        .from("manual_customs_records")
        .select("id, awb_bl_number")
        .order("created_at", { ascending: false });
      if (!error && data) setQueues(data);
    };
    if (showAddDialog) fetchQueues();
  }, [showAddDialog]);

  const queueSearchOptions = useMemo<SearchableSelectOption[]>(
    () =>
      queues.map((q) => ({
        value: q.id,
        label: q.awb_bl_number,
        keywords: q.awb_bl_number,
      })),
    [queues],
  );

  const fetchCharges = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);

    let data: unknown[] | null = null;
    let error: { message?: string; code?: string } | null = null;

    const notesRes = await supabase
      .from("compliance_charges")
      .select("id, charge_type, amount, currency, notes, finance_expense_id, created_at")
      .order("created_at", { ascending: false });

    if (!notesRes.error) {
      data = notesRes.data || [];
    } else if (notesRes.error.code === "42703") {
      const noteRes = await supabase
        .from("compliance_charges")
        .select("id, charge_type, amount, currency, note, finance_expense_id, created_at")
        .order("created_at", { ascending: false });

      if (!noteRes.error) {
        data = noteRes.data || [];
      } else if (noteRes.error.code === "42703") {
        const bareRes = await supabase
          .from("compliance_charges")
          .select("id, charge_type, amount, currency, created_at")
          .order("created_at", { ascending: false });

        data = bareRes.data || [];
        error = bareRes.error;
      } else {
        error = noteRes.error;
      }
    } else {
      error = notesRes.error;
    }

    if (error) {
      toast.error(`Failed to load duty and charges: ${error.message || "Unknown error"}`);
      setRows([]);
      if (showLoading) setIsLoading(false);
      return;
    }

    setRows(normalizeChargeRows(data));
    if (showLoading) setIsLoading(false);
  };

  useEffect(() => {
    fetchCharges(true);

    const chargeChannel = supabase
      .channel("compliance-charges-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "compliance_charges" },
        () => void fetchCharges(false),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(chargeChannel);
    };
  }, []);

  const addCharge = async () => {
    const authRes = await supabase.auth.getUser();
    const enteredById = authRes.data.user?.id || null;
    if (!enteredById) {
      toast.error("You must be signed in to add duty/charge entries.");
      return;
    }

    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid charge amount.");
      return;
    }
    if (!form.queue_id) {
      toast.error("Select a compliance queue.");
      return;
    }
    const normalizedCurrency = selectedCurrency;

    setIsSubmitting(true);
    // Fetch the selected queue details
    let queueDetails = null;
    try {
      const { data: queueData, error: queueError } = await supabase
        .from("manual_customs_records")
        .select("id, awb_bl_number, compliance_notes")
        .eq("id", form.queue_id)
        .single();
      if (!queueError && queueData) {
        queueDetails = queueData;
      }
    } catch (e) {
      // ignore, fallback to no details
    }

    // Compose the description/notes to include queue details
    let queueDescription = "";
    if (queueDetails) {
      queueDescription = `Queue: ${queueDetails.awb_bl_number || queueDetails.id}`;
      if (queueDetails.compliance_notes) {
        queueDescription += ` | Notes: ${queueDetails.compliance_notes}`;
      }
    }

    const normalizedNote = form.note.trim();
    // Final note/description: always include queue info, plus user note if any
    const finalNote = [queueDescription, normalizedNote].filter(Boolean).join("\n");

    let insertError: { code?: string; message?: string } | null = null;

    const chargeTypeCandidates =
      form.charge_type === "custom_duty"
        ? ["customs_duty", "custom_duty", "duty"]
        : [form.charge_type];

    for (const chargeType of chargeTypeCandidates) {
      const payloadBase = {
        charge_type: chargeType,
        amount,
        currency: normalizedCurrency,
        entered_by_id: enteredById,
        notes: finalNote || null,
      };

      const { error } = await supabase.from("compliance_charges").insert([payloadBase]);
      if (!error) {
        insertError = null;
        break;
      }
      insertError = error;
      if (error.code === "42703") {
        continue;
      }
      break;
    }

    if (insertError) {
      const isRlsDenied =
        insertError.code === "42501" ||
        (insertError.message || "").toLowerCase().includes("row-level security");

      const message = isRlsDenied
        ? "You do not have permission to save charges. Ask an admin to grant Compliance write access."
        : (insertError.message || "Failed to add charge.");

      toast.error(`Save failed: ${message}`);
      setIsSubmitting(false);
      return;
    }

    toast.success("Charge added successfully.");
    setForm({ charge_type: "custom_duty", amount: "", note: "", queue_id: "" });
    setShowAddDialog(false);
    await fetchCharges(false);
    setIsSubmitting(false);
  };

  const total = useMemo(() => {
    return rows
      .filter((item) => item.currency === selectedCurrency)
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  }, [rows, selectedCurrency]);

  const [editForm, setEditForm] = useState({ charge_type: "", amount: "", note: "" });

  const handleOpenEdit = (row: ChargeRow) => {
    setEditingCharge(row);
    setEditForm({
      charge_type: row.charge_type,
      amount: String(row.amount),
      note: row.notes || row.note || "",
    });
  };

  const handleSaveEdit = async () => {
    if (!editingCharge) return;
    const amount = Number(editForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid charge amount.");
      return;
    }

    setIsSubmitting(true);

    const { error } = await supabase
      .from("compliance_charges")
      .update({
        charge_type: editForm.charge_type,
        amount,
        notes: editForm.note.trim() || null,
      } as any)
      .eq("id", editingCharge.id);

    if (error) {
      toast.error(error.message || "Failed to update charge.");
      setIsSubmitting(false);
      return;
    }

    toast.success("Charge updated successfully.");
    setEditingCharge(null);
    await fetchCharges(false);
    setIsSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    const chargeToDelete = rows.find((r) => r.id === id);

    const { error } = await supabase.from("compliance_charges").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete charge.");
      return;
    }

    // Delete the linked finance_expenses record so it disappears from Finance too.
    if (chargeToDelete) {
      if (chargeToDelete.finance_expense_id) {
        await supabase.from("finance_expenses").delete().eq("id", chargeToDelete.finance_expense_id);
      }
      // Also try deterministic code pattern for older backfilled rows
      const cmpCode = "EXP-CMP-" + id.replace(/-/g, "").substring(0, 12);
      await supabase.from("finance_expenses").delete().eq("code", cmpCode);

      // Fallback: match by expense_type + amount + description
      const noteText = chargeToDelete.notes || chargeToDelete.note || null;
      const expenseTypes = ["Compliance Duty/Charge", "Custom Duty", "Miscellaneous"];
      for (const et of expenseTypes) {
        let q = supabase.from("finance_expenses").delete().eq("expense_type", et).eq("amount", chargeToDelete.amount);
        if (noteText) {
          q = q.eq("description", noteText);
        } else {
          q = q.is("description", null);
        }
        await q;
      }
    }

    toast.success("Charge deleted.");
    await fetchCharges(false);
  };

  const columns: Column<ChargeRow>[] = [
    { key: "charge_type", label: "Charge Type", render: (r) => r.charge_type.replace(/_/g, " ") },
    { key: "amount", label: "Amount", align: "center", render: (r) => formatAmount(Number(r.amount || 0), r.currency) },
    { key: "note", label: "Note", render: (r) => r.notes || r.note || "-" },
    { key: "created_at", label: "Recorded", render: (r) => new Date(r.created_at).toLocaleString() },
    { key: "actions", label: "", align: "center", render: (r) => (
      <div className="flex gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8 p-0" onClick={() => handleOpenEdit(r)} title="Edit">
          <Pencil className="h-4 w-4 text-blue-600" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 p-0" onClick={() => handleDelete(r.id)} title="Delete">
          <Trash className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    ) },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Duty & Charges"  />

      <div className="flex justify-end">
        <Button onClick={() => setShowAddDialog(true)} size="icon" title="Add custom duty">
          <Plus className="h-4 w-4" />
        </Button>
      </div>



      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        searchPlaceholder="Search charges..."
      />

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Duty / Charge</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Compliance Queue</Label>
              <SearchableSelect
                value={form.queue_id}
                onValueChange={(value) => setForm((prev) => ({ ...prev, queue_id: value }))}
                options={queueSearchOptions}
                placeholder="Select queue"
                searchPlaceholder="Search by AWB/BL number..."
                emptyMessage="No queues found."
              />
            </div>
            <div className="space-y-2">
              <Label>Charge Type</Label>
              <Select
                value={form.charge_type}
                onValueChange={(value) => setForm((prev) => ({ ...prev, charge_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom_duty">Custom Duty</SelectItem>
                  <SelectItem value="miscellaneous">Miscellaneous</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
                placeholder={`0.00 (${selectedCurrency})`}
              />
            </div>
            <div className="space-y-2">
              <Label>Note (optional)</Label>
              <Input
                value={form.note}
                onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
                placeholder="Enter note"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={addCharge} disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Charge"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingCharge} onOpenChange={(open) => !open && setEditingCharge(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Duty / Charge</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Charge Type</Label>
              <Select
                value={editForm.charge_type}
                onValueChange={(value) => setEditForm((prev) => ({ ...prev, charge_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom_duty">Custom Duty</SelectItem>
                  <SelectItem value="customs_duty">Customs Duty</SelectItem>
                  <SelectItem value="miscellaneous">Miscellaneous</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={editForm.amount}
                onChange={(event) => setEditForm((prev) => ({ ...prev, amount: event.target.value }))}
                placeholder={`0.00 (${selectedCurrency})`}
              />
            </div>
            <div className="space-y-2">
              <Label>Note (optional)</Label>
              <Input
                value={editForm.note}
                onChange={(event) => setEditForm((prev) => ({ ...prev, note: event.target.value }))}
                placeholder="Enter note"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCharge(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Update Charge"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ComplianceCharges;

