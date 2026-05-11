import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import TwoFactorAuthCard from "@/components/settings/TwoFactorAuthCard";
import { updateCurrentUserMfaMetadata } from "@/lib/authMfa";

type CurrencyRow = {
  id: string;
  code: string;
  name: string;
  symbol: string;
  exchange_rate: number | null;
  is_default: boolean | null;
  is_active: boolean | null;
};

const paymentMethods = [
  { key: "cash", label: "Cash" },
  { key: "wallet", label: "Wallet" },
  { key: "bank_transfer", label: "Bank Transfer" },
  { key: "mobile_money", label: "Mobile Money" },
  { key: "lipila", label: "Lipila" },
];

const FinanceSettings = () => {
  const [currencies, setCurrencies] = useState<CurrencyRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const { data, error } = await supabase
        .from("currencies")
        .select("id, code, name, symbol, exchange_rate, is_default, is_active")
        .order("code");

      if (error) {
        toast.error("Failed to load currency settings.");
        setCurrencies([]);
      } else {
        setCurrencies((data as CurrencyRow[] | null) || []);
      }
      setIsLoading(false);
    };
    fetch();
  }, []);

  const updateCurrency = (id: string, patch: Partial<CurrencyRow>) => {
    setCurrencies((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const setDefaultCurrency = (id: string) => {
    setCurrencies((prev) => prev.map((row) => ({ ...row, is_default: row.id === id })));
  };

  const handleSave = async () => {
    setIsSaving(true);
    const updates = currencies.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      symbol: row.symbol,
      exchange_rate: row.exchange_rate,
      is_default: row.is_default,
    }));

    const { error } = await supabase
      .from("currencies")
      .upsert(updates, { onConflict: "id" });

    if (error) {
      toast.error("Failed to update finance settings.");
    } else {
      toast.success("Finance settings updated.");
    }
    setIsSaving(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Finance Settings"
        
      />

      <Card>
        <CardHeader>
          <CardTitle>Currency Settings (ZMW / USD / RMB)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading currencies...</p>
          ) : currencies.length === 0 ? (
            <p className="text-sm text-muted-foreground">No currencies configured.</p>
          ) : (
            <div className="space-y-3">
              {currencies.map((currency) => (
                <div key={currency.id} className="flex flex-wrap items-center gap-3 rounded-md border p-3">
                  <div className="flex-1 min-w-[180px]">
                    <p className="text-sm font-medium">{currency.name} ({currency.code})</p>
                    <p className="text-xs text-muted-foreground">Symbol: {currency.symbol}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-muted-foreground">Exchange rate</label>
                    <Input
                      type="number"
                      step="0.0001"
                      className="w-28 h-8"
                      value={currency.exchange_rate ?? ""}
                      onChange={(event) =>
                        updateCurrency(currency.id, { exchange_rate: Number(event.target.value) })
                      }
                    />
                  </div>
                  <Button
                    size="sm"
                    variant={currency.is_default ? "default" : "outline"}
                    onClick={() => setDefaultCurrency(currency.id)}
                  >
                    {currency.is_default ? "Default" : "Set Default"}
                  </Button>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isSaving || isLoading}>
              {isSaving ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <TwoFactorAuthCard
        portalLabel="Finance Portal"
        onEnabledChange={(enabled) =>
          updateCurrentUserMfaMetadata({
            mfa_enabled: enabled,
            finance_mfa_enabled: enabled,
          })
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Payment Methods</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            {paymentMethods.map((method) => (
              <Badge key={method.key} variant="outline">
                {method.label}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Payment methods are controlled by system configuration and gateway integrations.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bank Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No bank accounts configured yet. Add bank account details in system settings.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default FinanceSettings;

