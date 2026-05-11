import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { FormCard } from "@/components/shared/FormCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const ThemeSettings = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    primary_color: "#0F172A",
    accent_color: "#DC2626",
  });

  const fetchSettings = async () => {
    const { data } = await supabase
      .from("system_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["primary_color", "accent_color"]);

    if (data && data.length > 0) {
      const mapped = data.reduce<Record<string, string>>((acc, row) => {
        acc[row.setting_key] = row.setting_value || "";
        return acc;
      }, {});
      setFormData({
        primary_color: mapped.primary_color || formData.primary_color,
        accent_color: mapped.accent_color || formData.accent_color,
      });
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    const payload = [
      { setting_key: "primary_color", setting_value: formData.primary_color },
      { setting_key: "accent_color", setting_value: formData.accent_color },
    ];

    const { error } = await supabase
      .from("system_settings")
      .upsert(payload, { onConflict: "setting_key" });

    if (error) {
      toast.error("Failed to save theme settings.");
    } else {
      toast.success("Theme settings saved.");
    }
    setIsSaving(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Theme Settings"  />
      <FormCard title="Brand Colors">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium">Primary color</label>
            <Input
              type="color"
              value={formData.primary_color}
              onChange={(event) => setFormData({ ...formData, primary_color: event.target.value })}
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Accent color</label>
            <Input
              type="color"
              value={formData.accent_color}
              onChange={(event) => setFormData({ ...formData, accent_color: event.target.value })}
              disabled={isLoading}
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={handleSave} disabled={isSaving || isLoading}>
            {isSaving ? "Saving..." : "Save Theme"}
          </Button>
        </div>
      </FormCard>
    </div>
  );
};

export default ThemeSettings;

