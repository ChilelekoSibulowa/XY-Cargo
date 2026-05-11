import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { FormCard } from "@/components/shared/FormCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { RefreshCw, Save, TrendingUp, DollarSign } from "lucide-react";

type CurrencyRow = {
  id: string;
  code: string;
  name: string;
  symbol: string;
  exchange_rate: number | null;
  is_active: boolean | null;
  is_default: boolean | null;
};

const CurrencyManagement = () => {
  const [currencies, setCurrencies] = useState<CurrencyRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchCurrencies = async () => {
    const { data, error } = await supabase
      .from("currencies")
      .select("*")
      .in("code", ["USD", "ZMW", "CNY"])
      .order("code");

    if (error) {
      toast.error("Failed to load currencies.");
      return;
    }

    // Ensure all 3 currencies exist
    const existingCodes = (data || []).map((c) => c.code);
    const missingCurrencies: CurrencyRow[] = [];

    if (!existingCodes.includes("USD")) {
      missingCurrencies.push({
        id: crypto.randomUUID(),
        code: "USD",
        name: "US Dollar",
        symbol: "$",
        exchange_rate: 1,
        is_active: true,
        is_default: true,
      });
    }
    if (!existingCodes.includes("ZMW")) {
      missingCurrencies.push({
        id: crypto.randomUUID(),
        code: "ZMW",
        name: "Zambian Kwacha",
        symbol: "K",
        exchange_rate: 23,
        is_active: true,
        is_default: false,
      });
    }
    if (!existingCodes.includes("CNY")) {
      missingCurrencies.push({
        id: crypto.randomUUID(),
        code: "CNY",
        name: "Chinese Yuan",
        symbol: "¥",
        exchange_rate: 7.2,
        is_active: true,
        is_default: false,
      });
    }

    setCurrencies([...(data || []), ...missingCurrencies]);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchCurrencies();
  }, []);

  const handleRateChange = (code: string, value: string) => {
    setCurrencies((prev) =>
      prev.map((c) =>
        c.code === code ? { ...c, exchange_rate: parseFloat(value) || 0 } : c
      )
    );
  };

  const handleActiveChange = (code: string, checked: boolean) => {
    setCurrencies((prev) =>
      prev.map((c) => (c.code === code ? { ...c, is_active: checked } : c))
    );
  };

  const handleDefaultChange = (code: string) => {
    setCurrencies((prev) =>
      prev.map((c) => ({
        ...c,
        is_default: c.code === code,
      }))
    );
  };

  const handleSave = async () => {
    setIsSaving(true);

    const payload = currencies.map((c) => ({
      code: c.code,
      name: c.name,
      symbol: c.symbol,
      exchange_rate: c.exchange_rate,
      is_active: c.is_active,
      is_default: c.is_default,
    }));

    const { error } = await supabase
      .from("currencies")
      .upsert(payload, { onConflict: "code" });

    if (error) {
      toast.error("Failed to save currency settings.");
    } else {
      toast.success("Currency settings saved successfully.");
    }

    setIsSaving(false);
  };

  const handleRefreshRates = async () => {
    toast.info("Triggering exchange rate update...");

    try {
      const response = await supabase.functions.invoke("update-exchange-rates");
      if (response.error) {
        toast.error("Failed to update exchange rates.");
      } else {
        toast.success("Exchange rates updated from live data.");
        fetchCurrencies();
      }
    } catch {
      toast.error("Could not connect to exchange rate service.");
    }
  };

  const getCurrencyIcon = (code: string) => {
    switch (code) {
      case "USD":
        return "$";
      case "ZMW":
        return "K";
      case "CNY":
        return "¥";
      default:
        return code;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Currency Management"
        
      />

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={handleRefreshRates} disabled={isLoading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh from Live Rates
        </Button>
        <Button onClick={handleSave} disabled={isSaving || isLoading}>
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {currencies.map((currency) => (
          <Card key={currency.code} className={currency.is_default ? "ring-2 ring-primary" : ""}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary">
                  {getCurrencyIcon(currency.code)}
                </span>
                <div>
                  <div className="text-lg">{currency.name}</div>
                  <div className="text-sm font-normal text-muted-foreground">{currency.code}</div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Exchange Rate (vs USD)</label>
                <div className="flex items-center gap-2 mt-1">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    step="0.0001"
                    value={currency.exchange_rate || ""}
                    onChange={(e) => handleRateChange(currency.code, e.target.value)}
                    disabled={currency.code === "USD"}
                    className="flex-1"
                  />
                </div>
                {currency.code === "USD" && (
                  <p className="text-xs text-muted-foreground mt-1">Base currency (rate = 1)</p>
                )}
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Active</label>
                <Switch
                  checked={currency.is_active || false}
                  onCheckedChange={(checked) => handleActiveChange(currency.code, checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Default Currency</label>
                <Switch
                  checked={currency.is_default || false}
                  onCheckedChange={() => handleDefaultChange(currency.code)}
                />
              </div>

              {currency.is_default && (
                <div className="rounded-md bg-primary/5 p-2 text-center text-xs text-primary">
                  <DollarSign className="inline-block h-3 w-3 mr-1" />
                  Default system currency
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <FormCard title="Exchange Rate Information">
        <div className="text-sm text-muted-foreground space-y-2">
          <p>
            Exchange rates are used to convert amounts when users switch between currencies.
            All amounts are stored in the default currency (typically USD) and converted for display.
          </p>
          <p>
            <strong>Example:</strong> If 1 USD = 23 ZMW, then $100 will display as K2,300 when viewing in Zambian Kwacha.
          </p>
          <p>
            Use "Refresh from Live Rates" to automatically update exchange rates from OpenExchangeRates.org
            (requires API key configuration in backend secrets).
          </p>
        </div>
      </FormCard>
    </div>
  );
};

export default CurrencyManagement;

