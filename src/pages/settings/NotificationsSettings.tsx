import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { FormCard } from "@/components/shared/FormCard";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const NotificationsSettings = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState({
    notify_email: "true",
    notify_sms: "false",
    notify_in_app: "true",
  });

  const fetchSettings = async () => {
    const { data } = await supabase
      .from("system_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["notify_email", "notify_sms", "notify_in_app"]);

    if (data && data.length > 0) {
      const mapped = data.reduce<Record<string, string>>((acc, row) => {
        acc[row.setting_key] = row.setting_value || "";
        return acc;
      }, {});
      setSettings((prev) => ({
        ...prev,
        notify_email: mapped.notify_email || prev.notify_email,
        notify_sms: mapped.notify_sms || prev.notify_sms,
        notify_in_app: mapped.notify_in_app || prev.notify_in_app,
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
      { setting_key: "notify_email", setting_value: settings.notify_email },
      { setting_key: "notify_sms", setting_value: settings.notify_sms },
      { setting_key: "notify_in_app", setting_value: settings.notify_in_app },
    ];

    const { error } = await supabase
      .from("system_settings")
      .upsert(payload, { onConflict: "setting_key" });

    if (error) {
      toast.error("Failed to save notification settings.");
    } else {
      toast.success("Notification settings saved.");
    }
    setIsSaving(false);
  };

  const toggle = (key: keyof typeof settings, value: boolean) => {
    setSettings((prev) => ({ ...prev, [key]: value ? "true" : "false" }));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Notifications Settings"  />
      <FormCard title="Notification Channels">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Email notifications</p>
              <p className="text-xs text-muted-foreground">Order updates and alerts via email.</p>
            </div>
            <Switch
              checked={settings.notify_email === "true"}
              onCheckedChange={(checked) => toggle("notify_email", checked)}
              disabled={isLoading}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">SMS notifications</p>
              <p className="text-xs text-muted-foreground">Optional SMS delivery alerts.</p>
            </div>
            <Switch
              checked={settings.notify_sms === "true"}
              onCheckedChange={(checked) => toggle("notify_sms", checked)}
              disabled={isLoading}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">In-app notifications</p>
              <p className="text-xs text-muted-foreground">Notify users inside the portal.</p>
            </div>
            <Switch
              checked={settings.notify_in_app === "true"}
              onCheckedChange={(checked) => toggle("notify_in_app", checked)}
              disabled={isLoading}
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={handleSave} disabled={isSaving || isLoading}>
            {isSaving ? "Saving..." : "Save Notifications"}
          </Button>
        </div>
      </FormCard>
    </div>
  );
};

export default NotificationsSettings;

