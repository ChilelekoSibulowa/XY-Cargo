import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DeleteDialog } from "@/components/shared/DeleteDialog";
import { useDefaultCurrency } from "@/hooks/useDefaultCurrency";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { TablePagination, paginate } from "@/components/shared/TablePagination";
import { toast } from "sonner";

interface PromotionRow {
  id: string;
  name: string;
  promotion_type: string;
  status: string;
  budget: number;
  revenue_attributed: number;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
}

const promotionTypes = ["sourcing", "air", "sea", "door_to_door", "seasonal"];

const emptyForm = {
  name: "",
  promotion_type: "sourcing",
  status: "active",
  budget: "0",
  revenue_attributed: "0",
  start_date: "",
  end_date: "",
  notes: "",
};

const MarketingPromotions = () => {
  const { formatAmount } = useDefaultCurrency();
  const sb = supabase as any;
  const [promotions, setPromotions] = useState<PromotionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PromotionRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteItem, setDeleteItem] = useState<PromotionRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [promoPage, setPromoPage] = useState(1);

  const fetchPromotions = async () => {
    setIsLoading(true);
    const { data, error } = await sb
      .from("marketing_promotions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(error.message || "Failed to load promotions");
    } else {
      setPromotions((data || []) as PromotionRow[]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchPromotions();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (promotion: PromotionRow) => {
    setEditing(promotion);
    setForm({
      name: promotion.name,
      promotion_type: promotion.promotion_type,
      status: promotion.status,
      budget: String(promotion.budget ?? 0),
      revenue_attributed: String(promotion.revenue_attributed ?? 0),
      start_date: promotion.start_date || "",
      end_date: promotion.end_date || "",
      notes: promotion.notes || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Please enter a promotion name");
      return;
    }

    setIsSaving(true);
    const payload = {
      name: form.name.trim(),
      promotion_type: form.promotion_type,
      status: form.status,
      budget: Number(form.budget) || 0,
      revenue_attributed: Number(form.revenue_attributed) || 0,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      notes: form.notes.trim() ? form.notes.trim() : null,
    };

    const { error } = editing
      ? await sb.from("marketing_promotions").update(payload).eq("id", editing.id)
      : await sb.from("marketing_promotions").insert(payload);

    if (error) {
      toast.error(error.message || "Failed to save promotion");
    } else {
      toast.success(editing ? "Promotion updated" : "Promotion created");
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
      fetchPromotions();
    }
    setIsSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    setIsDeleting(true);
    const { error } = await sb.from("marketing_promotions").delete().eq("id", deleteItem.id);
    if (error) {
      toast.error(error.message || "Failed to delete promotion");
    } else {
      toast.success("Promotion deleted");
      fetchPromotions();
    }
    setIsDeleting(false);
    setDeleteItem(null);
  };

  const summary = useMemo(() => {
    const totals: Record<string, { count: number; revenue: number }> = {};
    promotions.forEach((promotion) => {
      const key = promotion.promotion_type;
      if (!totals[key]) {
        totals[key] = { count: 0, revenue: 0 };
      }
      totals[key].count += 1;
      totals[key].revenue += promotion.revenue_attributed || 0;
    });
    return totals;
  }, [promotions]);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Service Promotions"
        
        actions={
          <Button size="sm" onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Add Promotion</Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        {promotionTypes.map((type) => (
          <Card key={type} className="border-l-4 border-l-blue-500">
            <CardHeader>
              <CardTitle>{type.replace("_", " ").replace(/\b\w/g, (m) => m.toUpperCase())}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{isLoading ? "..." : summary[type]?.count || 0} promotions</p>
              <p className="text-lg text-muted-foreground">{formatAmount(summary[type]?.revenue || 0, "USD")} revenue</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Promotion List</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3">Name</th>
                <th className="text-left p-3">Type</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Budget</th>
                <th className="text-left p-3">Revenue</th>
                <th className="text-left p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginate(promotions, promoPage).map((promotion) => (
                <tr key={promotion.id} className="border-b hover:bg-muted/30">
                  <td className="p-3 font-medium">{promotion.name}</td>
                  <td className="p-3">{promotion.promotion_type.replace("_", " ")}</td>
                  <td className="p-3">{promotion.status}</td>
                  <td className="p-3">{formatAmount(promotion.budget, "USD")}</td>
                  <td className="p-3">{formatAmount(promotion.revenue_attributed, "USD")}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 p-0" onClick={() => openEdit(promotion)}>
                        <Pencil className="h-4 w-4 text-blue-600" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 p-0" onClick={() => setDeleteItem(promotion)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {promotions.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground">No promotions added yet.</td>
                </tr>
              )}
            </tbody>
          </table>
          <TablePagination currentPage={promoPage} totalPages={Math.max(1, Math.ceil(promotions.length / 20))} onPageChange={setPromoPage} totalItems={promotions.length} pageSize={20} />
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Promotion" : "Add Promotion"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="name">Promotion Name *</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="promotion_type">Promotion Type</Label>
              <Select value={form.promotion_type} onValueChange={(value) => setForm({ ...form, promotion_type: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {promotionTypes.map((type) => (
                    <SelectItem key={type} value={type}>{type.replace("_", " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="budget">Budget</Label>
                <Input id="budget" type="number" min="0" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="revenue_attributed">Revenue Attributed</Label>
                <Input id="revenue_attributed" type="number" min="0" value={form.revenue_attributed} onChange={(e) => setForm({ ...form, revenue_attributed: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date</Label>
                <Input id="start_date" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">End Date</Label>
                <Input id="end_date" type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : editing ? "Update Promotion" : "Create Promotion"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <DeleteDialog
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        title="Delete Promotion"
        description="Are you sure you want to delete this promotion?"
      />
    </div>
  );
};

export default MarketingPromotions;

