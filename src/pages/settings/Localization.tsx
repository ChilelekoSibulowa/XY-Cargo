import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { FormCard } from "@/components/shared/FormCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const Localization = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    default_locale: "en",
    default_timezone: "Africa/Lusaka",
    date_format: "YYYY-MM-DD",
  });

  const fetchSettings = async () => {
    const { data } = await supabase
      .from("system_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["default_locale", "default_timezone", "date_format"]);

    if (data && data.length > 0) {
      const mapped = data.reduce<Record<string, string>>((acc, row) => {
        acc[row.setting_key] = row.setting_value || "";
        return acc;
      }, {});
      setFormData((prev) => ({
        ...prev,
        default_locale: mapped.default_locale || prev.default_locale,
        default_timezone: mapped.default_timezone || prev.default_timezone,
        date_format: mapped.date_format || prev.date_format,
      }));
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    const payload = [
      { setting_key: "default_locale", setting_value: formData.default_locale },
      { setting_key: "default_timezone", setting_value: formData.default_timezone },
      { setting_key: "date_format", setting_value: formData.date_format },
    ];

    const { error } = await supabase
      .from("system_settings")
      .upsert(payload, { onConflict: "setting_key" });

    if (error) {
      toast.error("Failed to save localization settings.");
    } else {
      toast.success("Localization settings saved.");
    }
    setIsSaving(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Localization"  />
      <FormCard title="Localization Settings">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium">Default locale</label>
            <Input
              value={formData.default_locale}
              onChange={(event) => setFormData({ ...formData, default_locale: event.target.value })}
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Default timezone</label>
            <Input
              value={formData.default_timezone}
              onChange={(event) => setFormData({ ...formData, default_timezone: event.target.value })}
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Date format</label>
            <Input
              value={formData.date_format}
              onChange={(event) => setFormData({ ...formData, date_format: event.target.value })}
              disabled={isLoading}
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={handleSave} disabled={isSaving || isLoading}>
            {isSaving ? "Saving..." : "Save Localization"}
          </Button>
        </div>
      </FormCard>
    </div>
  );
};

export default Localization;

