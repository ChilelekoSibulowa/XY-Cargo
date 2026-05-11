import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DataTable, Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DeleteDialog } from "@/components/shared/DeleteDialog";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Pencil, Plus, Trash2 } from "lucide-react";

interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
  exchange_rate: number | null;
  is_default: boolean | null;
  is_active: boolean | null;
}

const Currencies = () => {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteItem, setDeleteItem] = useState<Currency | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Currency | null>(null);

  const emptyForm = { code: "", name: "", symbol: "", exchange_rate: "1", is_default: false, is_active: true };
  const [form, setForm] = useState(emptyForm);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (item: Currency) => {
    setEditing(item);
    setForm({
      code: item.code,
      name: item.name,
      symbol: item.symbol,
      exchange_rate: String(item.exchange_rate ?? 1),
      is_default: item.is_default ?? false,
      is_active: item.is_active ?? true,
    });
    setDialogOpen(true);
  };

  const fetchCurrencies = async () => {
    const { data, error } = await supabase
      .from("currencies")
      .select("*")
      .order("code", { ascending: true });

    if (error) {
      toast.error("Failed to fetch currencies");
    } else {
      setCurrencies(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchCurrencies();
  }, []);

  const handleDelete = async () => {
    if (!deleteItem) return;
    setIsDeleting(true);

    const { error } = await supabase.from("currencies").delete().eq("id", deleteItem.id);

    if (error) {
      toast.error("Failed to delete currency");
    } else {
      toast.success("Currency deleted");
      fetchCurrencies();
    }
    setIsDeleting(false);
    setDeleteItem(null);
  };

  const handleSave = async () => {
    if (!form.code || !form.name || !form.symbol) {
      toast.error("Please fill required fields");
      return;
    }

    const payload = {
      code: form.code.toUpperCase(),
      name: form.name,
      symbol: form.symbol,
      exchange_rate: parseFloat(form.exchange_rate) || 1,
      is_default: form.is_default,
      is_active: form.is_active,
    };

    const { error } = editing
      ? await supabase.from("currencies").update(payload).eq("id", editing.id)
      : await supabase.from("currencies").insert(payload);

    if (error) {
      toast.error(editing ? "Failed to update currency" : "Failed to create currency");
    } else {
      toast.success(editing ? "Currency updated" : "Currency created");
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
      fetchCurrencies();
    }
  };

  const columns: Column<Currency>[] = [
    { key: "code", label: "Code" },
    { key: "name", label: "Name" },
    { key: "symbol", label: "Symbol" },
    {
      key: "exchange_rate",
      label: "Exchange Rate",
      render: (item) => item.exchange_rate?.toFixed(4) || "1.0000",
    },
    {
      key: "is_default",
      label: "Default",
      render: (item) => (item.is_default ? <StatusBadge status="active" label="Yes" /> : "-"),
    },
    {
      key: "is_active",
      label: "Status",
      render: (item) => <StatusBadge status={item.is_active ? "active" : "inactive"} />,
    },
    {
      key: "actions",
      label: "",
      render: (item) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 p-0" onClick={() => openEdit(item)} title="Edit">
            <Pencil className="h-4 w-4 text-blue-600" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 p-0" onClick={() => setDeleteItem(item)} title="Delete">
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Currencies</h1>
          <p className="text-sm text-muted-foreground">Manage supported currencies and exchange rates.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Currency
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={currencies}
        isLoading={isLoading}
        searchPlaceholder="Search currencies..."
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Currency" : "Create Currency"}</DialogTitle>
          </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Code *</Label>
                  <Input
                    id="code"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="USD"
                    maxLength={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="symbol">Symbol *</Label>
                  <Input
                    id="symbol"
                    value={form.symbol}
                    onChange={(e) => setForm({ ...form, symbol: e.target.value })}
                    placeholder="$"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="US Dollar"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="exchange_rate">Exchange Rate</Label>
                <Input
                  id="exchange_rate"
                  type="number"
                  min="0"
                  step="0.0001"
                  value={form.exchange_rate}
                  onChange={(e) => setForm({ ...form, exchange_rate: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                  <Switch
                    id="is_default"
                    checked={form.is_default}
                    onCheckedChange={(checked) => setForm({ ...form, is_default: checked })}
                  />
                  <Label htmlFor="is_default">Default</Label>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    id="is_active"
                    checked={form.is_active}
                    onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
                  />
                  <Label htmlFor="is_active">Active</Label>
                </div>
              </div>
              <Button onClick={handleSave}>{editing ? "Update Currency" : "Create Currency"}</Button>
            </div>
          </DialogContent>
        </Dialog>

      <DeleteDialog
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        title="Delete Currency"
        description="Are you sure you want to delete this currency?"
      />
    </div>
  );
};

export default Currencies;
