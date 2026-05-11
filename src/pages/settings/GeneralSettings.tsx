import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { LogoUpload } from "@/components/settings/LogoUpload";

interface Setting {
  id: string;
  setting_key: string;
  setting_value: string | null;
  setting_type: string | null;
  description: string | null;
  category: string | null;
}

const GeneralSettings = () => {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [logoUrl, setLogoUrl] = useState("");

  useEffect(() => {
    const fetchSettings = async () => {
      const { data, error } = await supabase
        .from("system_settings")
        .select("*")
        .order("category", { ascending: true });

      if (error) {
        toast.error("Failed to load settings");
      } else {
        setSettings(data || []);
        const vals: Record<string, string> = {};
        (data || []).forEach((s) => {
          vals[s.setting_key] = s.setting_value || "";
          if (s.setting_key === "company_logo_url") {
            setLogoUrl(s.setting_value || "");
          }
        });
        setValues(vals);
      }
      setIsLoading(false);
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    
    for (const setting of settings) {
      if (values[setting.setting_key] !== setting.setting_value) {
        await supabase
          .from("system_settings")
          .update({ setting_value: values[setting.setting_key] })
          .eq("id", setting.id);
      }
    }

    toast.success("Settings saved successfully");
    setIsSaving(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const groupedSettings = settings.reduce<Record<string, Setting[]>>((acc, s) => {
    const cat = s.category || "General";
    // Skip logo setting as it's handled separately
    if (s.setting_key === "company_logo_url") return acc;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">General Settings</h1>
          <p className="text-sm text-muted-foreground">
            Configure system-wide settings and preferences.
          </p>
        </div>
      </div>

      {/* Logo Upload Section */}
      <LogoUpload 
        currentLogoUrl={logoUrl} 
        onLogoChange={(url) => setLogoUrl(url)} 
      />

      {Object.entries(groupedSettings).map(([category, categorySettings]) => (
        <Card key={category} className="border-border/70 bg-card">
          <CardHeader>
            <CardTitle className="text-base">{category}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {categorySettings.map((setting) => (
              <div key={setting.id} className="grid gap-2">
                <Label htmlFor={setting.setting_key}>
                  {setting.setting_key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                </Label>
                {setting.setting_type === "boolean" ? (
                  <Switch
                    id={setting.setting_key}
                    checked={values[setting.setting_key] === "true"}
                    onCheckedChange={(checked) =>
                      setValues({ ...values, [setting.setting_key]: checked ? "true" : "false" })
                    }
                  />
                ) : (
                  <Input
                    id={setting.setting_key}
                    value={values[setting.setting_key] || ""}
                    onChange={(e) =>
                      setValues({ ...values, [setting.setting_key]: e.target.value })
                    }
                  />
                )}
                {setting.description && (
                  <p className="text-xs text-muted-foreground">{setting.description}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {settings.length === 0 && (
        <Card className="border-border/70 bg-card">
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">No settings configured yet.</p>
          </CardContent>
        </Card>
      )}

      <Button onClick={handleSave} disabled={isSaving}>
        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save Settings
      </Button>
    </div>
  );
};

export default GeneralSettings;
