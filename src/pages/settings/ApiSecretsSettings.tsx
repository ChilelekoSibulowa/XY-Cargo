import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { FormCard } from "@/components/shared/FormCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Eye, EyeOff, Key } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface ApiSecret {
  id: string;
  secret_key: string;
  secret_value: string;
  description: string | null;
  category: string | null;
  is_active: boolean | null;
  created_at: string;
}

const CATEGORIES = [
  { value: "payment", label: "Payment Gateway" },
  { value: "sms", label: "SMS Provider" },
  { value: "email", label: "Email Service" },
  { value: "tracking", label: "Tracking / Maps" },
  { value: "social", label: "Social Media" },
  { value: "storage", label: "Storage" },
  { value: "general", label: "General" },
];

const PRESET_SECRETS = [
  { key: "LIPILA_API_KEY", category: "payment", description: "Lipila Payment Gateway API Key" },
  { key: "LIPILA_CALLBACK_SECRET", category: "payment", description: "Lipila webhook callback verification secret" },
  { key: "ZAMTEL_SMS_API_KEY", category: "sms", description: "Bulk SMS API key for XY Cargo messages" },
  { key: "ZAMTEL_SMS_SENDER_ID", category: "sms", description: "Sender ID shown to recipients as XY Cargo" },
  { key: "SHIPSGO_AUTH_CODE", category: "tracking", description: "ShipsGo auth code for live ocean and air tracking API calls" },
  { key: "SHIPSGO_EMBED_TOKEN", category: "tracking", description: "ShipsGo embed token used for the iframe map on shipment tracking pages" },
  { key: "META_PAGE_ID", category: "social", description: "Facebook Page ID for Meta Graph API integration" },
  { key: "META_APP_ID", category: "social", description: "Meta App ID from Facebook Developer dashboard" },
  { key: "META_PAGE_ACCESS_TOKEN", category: "social", description: "Facebook Page Access Token for posting and reading insights" },
  { key: "META_INSTAGRAM_ACCOUNT_ID", category: "social", description: "Instagram Business Account ID linked to the Facebook Page" },
];

const ApiSecretsSettings = () => {
  const [secrets, setSecrets] = useState<ApiSecret[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [visibleSecrets, setVisibleSecrets] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    secret_key: "",
    secret_value: "",
    description: "",
    category: "general",
    is_active: true,
  });
  const [isSaving, setIsSaving] = useState(false);

  const fetchSecrets = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("api_secrets")
      .select("*")
      .order("category", { ascending: true });

    if (error) {
      toast.error("Failed to load API secrets");
    } else {
      setSecrets(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchSecrets();
  }, []);

  const handleSave = async () => {
    if (!formData.secret_key || !formData.secret_value) {
      toast.error("Secret key and value are required");
      return;
    }

    setIsSaving(true);
    const { error } = await supabase.from("api_secrets").upsert(
      {
        secret_key: formData.secret_key,
        secret_value: formData.secret_value,
        description: formData.description || null,
        category: formData.category,
        is_active: formData.is_active,
      },
      { onConflict: "secret_key" }
    );

    if (error) {
      toast.error("Failed to save secret: " + error.message);
    } else {
      toast.success("Secret saved successfully");
      setShowDialog(false);
      setFormData({
        secret_key: "",
        secret_value: "",
        description: "",
        category: "general",
        is_active: true,
      });
      fetchSecrets();
    }
    setIsSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("api_secrets").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete secret");
    } else {
      toast.success("Secret deleted");
      fetchSecrets();
    }
  };

  const toggleVisibility = (id: string) => {
    setVisibleSecrets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleActive = async (id: string, currentValue: boolean) => {
    const { error } = await supabase
      .from("api_secrets")
      .update({ is_active: !currentValue })
      .eq("id", id);

    if (error) {
      toast.error("Failed to update secret");
    } else {
      fetchSecrets();
    }
  };

  const openPresetDialog = (preset: typeof PRESET_SECRETS[0]) => {
    setFormData({
      secret_key: preset.key,
      secret_value: "",
      description: preset.description,
      category: preset.category,
      is_active: true,
    });
    setShowDialog(true);
  };

  const maskValue = (value: string) => {
    if (value.length <= 8) return "********";
    return value.substring(0, 4) + "********" + value.substring(value.length - 4);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const existingKeys = new Set(secrets.map((s) => s.secret_key));
  const missingPresets = PRESET_SECRETS.filter((p) => !existingKeys.has(p.key));

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="API Secrets"
        
      />

      {missingPresets.length > 0 && (
        <FormCard title="Quick Setup">
          <p className="text-sm text-muted-foreground mb-4">
            Configure these required integration secrets:
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {missingPresets.map((preset) => (
              <Button
                key={preset.key}
                variant="outline"
                className="justify-start h-auto py-3"
                onClick={() => openPresetDialog(preset)}
              >
                <Key className="h-4 w-4 mr-2 text-primary" />
                <div className="text-left">
                  <div className="font-medium">{preset.key}</div>
                  <div className="text-xs text-muted-foreground">{preset.description}</div>
                </div>
              </Button>
            ))}
          </div>
        </FormCard>
      )}

      <FormCard title="ShipsGo Setup">
        <p className="text-sm text-muted-foreground">
          ShipsGo iframe embeds work only after the exact production website URL is registered in your ShipsGo account.
          If ShipsGo shows "website URL is not registered", the domain must be approved on the ShipsGo side.
          For email live-position redirects, configure the Live Position URL in your ShipsGo dashboard to point back to this site.
        </p>
      </FormCard>

      <FormCard title="Configured Secrets">
        <p className="text-sm text-muted-foreground mb-4">
          These secrets are securely stored and available to backend functions.
        </p>
        <div className="flex justify-end mb-4">
          <Button onClick={() => setShowDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Secret
          </Button>
        </div>

        {secrets.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No secrets configured yet. Add your first secret to get started.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {secrets.map((secret) => (
                <TableRow key={secret.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium font-mono text-sm">{secret.secret_key}</div>
                      {secret.description && (
                        <div className="text-xs text-muted-foreground">{secret.description}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {visibleSecrets.has(secret.id)
                          ? secret.secret_value
                          : maskValue(secret.secret_value)}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => toggleVisibility(secret.id)}
                      >
                        {visibleSecrets.has(secret.id) ? (
                          <EyeOff className="h-3 w-3" />
                        ) : (
                          <Eye className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {CATEGORIES.find((c) => c.value === secret.category)?.label || secret.category}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={secret.is_active ?? true}
                      onCheckedChange={() => toggleActive(secret.id, secret.is_active ?? true)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(secret.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </FormCard>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add API Secret</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="secret_key">Secret Key</Label>
              <Input
                id="secret_key"
                placeholder="e.g., LIPILA_API_KEY"
                value={formData.secret_key}
                onChange={(e) => setFormData({ ...formData, secret_key: e.target.value.toUpperCase().replace(/\s/g, "_") })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="secret_value">Secret Value</Label>
              <Input
                id="secret_value"
                type="password"
                placeholder="Enter the secret value"
                value={formData.secret_value}
                onChange={(e) => setFormData({ ...formData, secret_value: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                placeholder="What is this secret used for?"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Secret
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ApiSecretsSettings;


