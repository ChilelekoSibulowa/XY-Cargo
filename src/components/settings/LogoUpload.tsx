import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Upload, Trash2 } from "lucide-react";

interface LogoUploadProps {
  currentLogoUrl: string;
  onLogoChange: (url: string) => void;
}

export const LogoUpload = ({ currentLogoUrl, onLogoChange }: LogoUploadProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(currentLogoUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const acceptedTypes = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml"];
  const maxFileSize = 2 * 1024 * 1024; // 2MB

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!acceptedTypes.includes(file.type)) {
      toast.error("Please upload a PNG, JPG, or SVG file");
      return;
    }

    // Validate file size
    if (file.size > maxFileSize) {
      toast.error("File size must be less than 2MB");
      return;
    }

    setIsUploading(true);

    try {
      // Generate unique filename
      const fileExt = file.name.split(".").pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;
      const filePath = `logo/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("system-assets")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("system-assets")
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;

      // Update system settings
      const { data: existingSetting } = await supabase
        .from("system_settings")
        .select("id")
        .eq("setting_key", "company_logo_url")
        .maybeSingle();

      if (existingSetting) {
        await supabase
          .from("system_settings")
          .update({ setting_value: publicUrl })
          .eq("id", existingSetting.id);
      } else {
        await supabase.from("system_settings").insert({
          setting_key: "company_logo_url",
          setting_value: publicUrl,
          setting_type: "string",
          category: "Branding",
          description: "Company logo URL",
        });
      }

      setPreviewUrl(publicUrl);
      onLogoChange(publicUrl);
      toast.success("Logo uploaded successfully");
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Failed to upload logo");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveLogo = async () => {
    setIsUploading(true);
    try {
      await supabase
        .from("system_settings")
        .update({ setting_value: "" })
        .eq("setting_key", "company_logo_url");

      setPreviewUrl("");
      onLogoChange("");
      toast.success("Logo removed");
    } catch (error: any) {
      toast.error("Failed to remove logo");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className="border-border/70 bg-card">
      <CardHeader>
        <CardTitle className="text-base">Company Logo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-6">
          <div className="w-24 h-24 border border-border rounded-lg flex items-center justify-center bg-muted/50 overflow-hidden">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Company logo"
                className="w-full h-full object-contain"
              />
            ) : (
              <span className="text-xs text-muted-foreground text-center px-2">
                No logo uploaded
              </span>
            )}
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="logo-upload">Upload Logo</Label>
              <p className="text-xs text-muted-foreground">
                Accepted formats: PNG, JPG, SVG. Max size: 2MB
              </p>
            </div>

            <div className="flex gap-2">
              <Input
                ref={fileInputRef}
                id="logo-upload"
                type="file"
                accept=".png,.jpg,.jpeg,.svg"
                onChange={handleFileSelect}
                disabled={isUploading}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                {isUploading ? "Uploading..." : "Choose File"}
              </Button>

              {previewUrl && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleRemoveLogo}
                  disabled={isUploading}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
