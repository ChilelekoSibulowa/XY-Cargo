import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { FormCard } from "@/components/shared/FormCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface SettingRow {
  id: string;
  setting_key: string;
  setting_value: string | null;
}

const PaymentsSettings = () => {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchSettings = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("system_settings")
      .select("id, setting_key, setting_value")
      .in("setting_key", [
        "require_payment_before_delivery",
        "auto_generate_codes",
        "default_currency",
      ]);

    if (error) {
      toast.error("Failed to load payment settings.");
      setSettings({});
    } else {
      const mapped = (data || []).reduce<Record<string, string>>((acc, row) => {
        acc[row.setting_key] = row.setting_value || "";
        return acc;
      }, {});
      setSettings(mapped);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const updateSetting = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    const payload: SettingRow[] = [
      {
        id: "",
        setting_key: "require_payment_before_delivery",
        setting_value: settings.require_payment_before_delivery || "false",
      },
      {
        id: "",
        setting_key: "auto_generate_codes",
        setting_value: settings.auto_generate_codes || "true",
      },
      {
        id: "",
        setting_key: "default_currency",
        setting_value: settings.default_currency || "USD",
      },
    ];

    const { error } = await supabase
      .from("system_settings")
      .upsert(payload, { onConflict: "setting_key" });

    if (error) {
      toast.error("Failed to update settings.");
    } else {
      toast.success("Payment settings saved.");
      fetchSettings();
    }
    setIsSaving(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Payments Settings"
        
      />

      <FormCard title="Payment Controls">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Require payment before delivery</p>
              <p className="text-xs text-muted-foreground">
                Block delivery until payment is completed.
              </p>
            </div>
            <Switch
              checked={(settings.require_payment_before_delivery || "false") === "true"}
              onCheckedChange={(checked) =>
                updateSetting("require_payment_before_delivery", checked ? "true" : "false")
              }
              disabled={isLoading}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Auto-generate shipment codes</p>
              <p className="text-xs text-muted-foreground">
                Automatically generate shipment codes on creation.
              </p>
            </div>
            <Switch
              checked={(settings.auto_generate_codes || "true") === "true"}
              onCheckedChange={(checked) =>
                updateSetting("auto_generate_codes", checked ? "true" : "false")
              }
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Default currency</label>
            <Input
              value={settings.default_currency || "USD"}
              onChange={(event) => updateSetting("default_currency", event.target.value)}
              disabled={isLoading}
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={handleSave} disabled={isSaving || isLoading}>
            {isSaving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </FormCard>
    </div>
  );
};

export default PaymentsSettings;

