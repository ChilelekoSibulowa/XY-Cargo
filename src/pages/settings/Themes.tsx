import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { FormCard } from "@/components/shared/FormCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const Themes = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [theme, setTheme] = useState("light");

  const fetchSettings = async () => {
    const { data } = await supabase
      .from("system_settings")
      .select("setting_value")
      .eq("setting_key", "ui_theme")
      .maybeSingle();

    if (data?.setting_value) {
      setTheme(data.setting_value);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    const { error } = await supabase
      .from("system_settings")
      .upsert({ setting_key: "ui_theme", setting_value: theme }, { onConflict: "setting_key" });

    if (error) {
      toast.error("Failed to save theme.");
    } else {
      toast.success("Theme saved.");
    }
    setIsSaving(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Themes"  />
      <FormCard title="Theme Selector">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Theme</label>
            <Select value={theme} onValueChange={setTheme} disabled={isLoading}>
              <SelectTrigger>
                <SelectValue placeholder="Select theme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
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

export default Themes;

