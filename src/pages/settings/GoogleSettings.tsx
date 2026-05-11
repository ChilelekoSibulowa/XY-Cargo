import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { FormCard } from "@/components/shared/FormCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const GoogleSettings = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    google_maps_api_key: "",
    google_analytics_id: "",
  });

  const fetchSettings = async () => {
    const { data } = await supabase
      .from("system_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["google_maps_api_key", "google_analytics_id"]);

    if (data && data.length > 0) {
      const mapped = data.reduce<Record<string, string>>((acc, row) => {
        acc[row.setting_key] = row.setting_value || "";
        return acc;
      }, {});
      setFormData({
        google_maps_api_key: mapped.google_maps_api_key || "",
        google_analytics_id: mapped.google_analytics_id || "",
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
      { setting_key: "google_maps_api_key", setting_value: formData.google_maps_api_key },
      { setting_key: "google_analytics_id", setting_value: formData.google_analytics_id },
    ];

    const { error } = await supabase
      .from("system_settings")
      .upsert(payload, { onConflict: "setting_key" });

    if (error) {
      toast.error("Failed to save Google settings.");
    } else {
      toast.success("Google settings saved.");
    }
    setIsSaving(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Google Settings"  />
      <FormCard title="Google Integrations">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="text-sm font-medium">Google Maps API key</label>
            <Input
              value={formData.google_maps_api_key}
              onChange={(event) => setFormData({ ...formData, google_maps_api_key: event.target.value })}
              disabled={isLoading}
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm font-medium">Google Analytics ID</label>
            <Input
              value={formData.google_analytics_id}
              onChange={(event) => setFormData({ ...formData, google_analytics_id: event.target.value })}
              disabled={isLoading}
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={handleSave} disabled={isSaving || isLoading}>
            {isSaving ? "Saving..." : "Save Google Settings"}
          </Button>
        </div>
      </FormCard>
    </div>
  );
};

export default GoogleSettings;

