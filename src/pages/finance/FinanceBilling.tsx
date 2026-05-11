import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, Column } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDefaultCurrency } from "@/hooks/useDefaultCurrency";
import { format } from "date-fns";
import { toast } from "sonner";
import { Pencil, Plus } from "lucide-react";

 type RateRow = { id: string; name: string; service_type: string; rate_per_kg: number | null; rate_per_cbm: number | null; minimum_charge: number | null; is_active: boolean | null };

const FinanceBilling = () => {
  const { formatAmount } = useDefaultCurrency();
  const sb = supabase as any;
  const [rates, setRates] = useState<RateRow[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreateRateOpen, setIsCreateRateOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<RateRow | null>(null);

  const [rateForm, setRateForm] = useState({
    name: "",
    service_type: "air",
    rate_per_kg: "",
    rate_per_cbm: "",
    minimum_charge: "",
    is_active: true,
  });


  const initialRateForm = {
    name: "",
    service_type: "air",
    rate_per_kg: "",
    rate_per_cbm: "",
    minimum_charge: "",
    is_active: true,
  };

  const fetchData = async () => {
    const [ratesRes] = await Promise.all([
      supabase.from("shipping_rates").select("id, name, service_type, rate_per_kg, rate_per_cbm, minimum_charge, is_active").order("name"),
    ]);

    setRates((ratesRes.data as RateRow[] | null) || []);
    setIsLoading(false);
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const openRateDialog = (rate: RateRow) => {
    setEditingRate(rate);
    setRateForm({
      name: rate.name,
      service_type: rate.service_type,
      rate_per_kg: rate.rate_per_kg?.toString() || "",
      rate_per_cbm: rate.rate_per_cbm?.toString() || "",
      minimum_charge: rate.minimum_charge?.toString() || "",
      is_active: Boolean(rate.is_active),
    });
  };

  const openCreateRateDialog = () => {
    setRateForm(initialRateForm);
    setEditingRate(null);
    setIsCreateRateOpen(true);
  };



  const handleSaveRate = async () => {
    if (!editingRate) return;
    setIsSaving(true);

    const { error } = await supabase
      .from("shipping_rates")
      .update({
        name: rateForm.name,
        service_type: rateForm.service_type as "air" | "sea",
        rate_per_kg: rateForm.rate_per_kg ? Number(rateForm.rate_per_kg) : null,
        rate_per_cbm: rateForm.rate_per_cbm ? Number(rateForm.rate_per_cbm) : null,
        minimum_charge: rateForm.minimum_charge ? Number(rateForm.minimum_charge) : null,
        is_active: rateForm.is_active,
      })
      .eq("id", editingRate.id);

    if (error) {
      toast.error(error.message || "Failed to update shipping rate.");
      setIsSaving(false);
      return;
    }

    toast.success("Shipping rate updated.");
    setEditingRate(null);
    await fetchData();
    setIsSaving(false);
  };

  const handleCreateRate = async () => {
    if (!rateForm.name.trim()) {
      toast.error("Rate name is required.");
      return;
    }

    setIsSaving(true);

    const { error } = await supabase
      .from("shipping_rates")
      .insert({
        name: rateForm.name.trim(),
        service_type: rateForm.service_type as "air" | "sea",
        rate_per_kg: rateForm.rate_per_kg ? Number(rateForm.rate_per_kg) : null,
        rate_per_cbm: rateForm.rate_per_cbm ? Number(rateForm.rate_per_cbm) : null,
        minimum_charge: rateForm.minimum_charge ? Number(rateForm.minimum_charge) : null,
        is_active: rateForm.is_active,
      });

    if (error) {
      toast.error(error.message || "Failed to add shipping rate.");
      setIsSaving(false);
      return;
    }

    toast.success("Shipping rate added.");
    setIsCreateRateOpen(false);
    setRateForm(initialRateForm);
    await fetchData();
    setIsSaving(false);
  };



  const rateColumns: Column<RateRow>[] = [
    { key: "name", label: "Rate Name" },
    { key: "service_type", label: "Service", render: (r) => <Badge variant="outline">{r.service_type === "air" ? "Air Freight" : "Sea Freight"}</Badge> },
    { key: "rate_per_kg", label: "Per KG", render: (r) => r.rate_per_kg ? formatAmount(r.rate_per_kg) : "-" },
    { key: "rate_per_cbm", label: "Per CBM", render: (r) => r.rate_per_cbm ? formatAmount(r.rate_per_cbm) : "-" },
    { key: "minimum_charge", label: "Min Charge", render: (r) => r.minimum_charge ? formatAmount(r.minimum_charge) : "-" },
    { key: "is_active", label: "Status", render: (r) => <Badge variant={r.is_active ? "default" : "secondary"}>{r.is_active ? "Active" : "Inactive"}</Badge> },
    {
      key: "action",
      label: "Action",
      render: (r) => (
        <Button size="icon" variant="outline" onClick={() => openRateDialog(r)} title="Edit rate">
          <Pencil className="h-4 w-4" />
        </Button>
      ),
    },
  ];



  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Billing & Pricing"  />

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Service Pricing Setup</CardTitle>
          <Button onClick={openCreateRateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Add Price
          </Button>
        </CardHeader>
        <CardContent>
          <DataTable columns={rateColumns} data={rates} isLoading={isLoading} searchPlaceholder="Search rates..." />
        </CardContent>
      </Card>

      <Dialog open={Boolean(editingRate)} onOpenChange={(open) => !open && setEditingRate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Service Pricing</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Rate Name</Label>
              <Input value={rateForm.name} onChange={(e) => setRateForm((prev) => ({ ...prev, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Service Type</Label>
              <Select value={rateForm.service_type} onValueChange={(value) => setRateForm((prev) => ({ ...prev, service_type: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="air">Air</SelectItem>
                  <SelectItem value="sea">Sea</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Rate per KG</Label>
                <Input type="number" step="0.01" value={rateForm.rate_per_kg} onChange={(e) => setRateForm((prev) => ({ ...prev, rate_per_kg: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Rate per CBM</Label>
                <Input type="number" step="0.01" value={rateForm.rate_per_cbm} onChange={(e) => setRateForm((prev) => ({ ...prev, rate_per_cbm: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Minimum Charge</Label>
              <Input type="number" step="0.01" value={rateForm.minimum_charge} onChange={(e) => setRateForm((prev) => ({ ...prev, minimum_charge: e.target.value }))} />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={rateForm.is_active} onCheckedChange={(checked) => setRateForm((prev) => ({ ...prev, is_active: checked }))} />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRate(null)}>Cancel</Button>
            <Button onClick={handleSaveRate} disabled={isSaving}>{isSaving ? "Saving..." : "Save Changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateRateOpen} onOpenChange={setIsCreateRateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Service Pricing</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Rate Name</Label>
              <Input value={rateForm.name} onChange={(e) => setRateForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="China to Lusaka" />
            </div>
            <div className="space-y-2">
              <Label>Service Type</Label>
              <Select value={rateForm.service_type} onValueChange={(value) => setRateForm((prev) => ({ ...prev, service_type: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="air">Air</SelectItem>
                  <SelectItem value="sea">Sea</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Rate per KG</Label>
                <Input type="number" step="0.01" value={rateForm.rate_per_kg} onChange={(e) => setRateForm((prev) => ({ ...prev, rate_per_kg: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Rate per CBM</Label>
                <Input type="number" step="0.01" value={rateForm.rate_per_cbm} onChange={(e) => setRateForm((prev) => ({ ...prev, rate_per_cbm: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Minimum Charge</Label>
              <Input type="number" step="0.01" value={rateForm.minimum_charge} onChange={(e) => setRateForm((prev) => ({ ...prev, minimum_charge: e.target.value }))} />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={rateForm.is_active} onCheckedChange={(checked) => setRateForm((prev) => ({ ...prev, is_active: checked }))} />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateRateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateRate} disabled={isSaving}>{isSaving ? "Saving..." : "Add Rate"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


    </div>
  );
};

export default FinanceBilling;

