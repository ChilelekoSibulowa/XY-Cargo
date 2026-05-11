import { CmsSiteData } from "@/content/cmsDefaults";
import { CmsSection } from "../CmsSection";
import { CmsTextField } from "../CmsTextField";
import { CmsArrayEditor } from "../CmsArrayEditor";
import { Settings, Layout, Megaphone, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";

interface SiteSettingsEditorProps {
  data: CmsSiteData;
  onChange: (data: CmsSiteData) => void;
}

export const SiteSettingsEditor = ({ data, onChange }: SiteSettingsEditorProps) => {
  const updateNestedField = <K extends keyof CmsSiteData>(
    key: K,
    field: keyof CmsSiteData[K],
    value: unknown
  ) => {
    onChange({
      ...data,
      [key]: { ...data[key], [field]: value },
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <CmsSection title="Top Bar" icon={<Settings className="h-5 w-5 text-primary" />}>
        <div className="grid gap-4 sm:grid-cols-2">
          <CmsTextField
            label="Business Hours"
            value={data.topBar.hours}
            onChange={(v) => updateNestedField("topBar", "hours", v)}
          />
          <CmsTextField
            label="Email"
            value={data.topBar.email}
            onChange={(v) => updateNestedField("topBar", "email", v)}
          />
          <CmsTextField
            label="Phone"
            value={data.topBar.phone}
            onChange={(v) => updateNestedField("topBar", "phone", v)}
          />
          <CmsTextField
            label="Address"
            value={data.topBar.address}
            onChange={(v) => updateNestedField("topBar", "address", v)}
          />
          <CmsTextField
            label="Facebook URL"
            value={data.topBar.facebookUrl}
            onChange={(v) => updateNestedField("topBar", "facebookUrl", v)}
          />
          <CmsTextField
            label="Instagram URL"
            value={data.topBar.instagramUrl}
            onChange={(v) => updateNestedField("topBar", "instagramUrl", v)}
          />
          <CmsTextField
            label="LinkedIn URL"
            value={data.topBar.linkedinUrl}
            onChange={(v) => updateNestedField("topBar", "linkedinUrl", v)}
          />
          <CmsTextField
            label="YouTube URL"
            value={data.topBar.youtubeUrl}
            onChange={(v) => updateNestedField("topBar", "youtubeUrl", v)}
          />
          <CmsTextField
            label="TikTok URL"
            value={data.topBar.tiktokUrl}
            onChange={(v) => updateNestedField("topBar", "tiktokUrl", v)}
          />
        </div>
      </CmsSection>

      {/* Navigation */}
      <CmsSection title="Navigation" icon={<Layout className="h-5 w-5 text-primary" />} defaultOpen={false}>
        <CmsTextField
          label="CTA Button Label"
          value={data.nav.ctaLabel}
          onChange={(v) => updateNestedField("nav", "ctaLabel", v)}
        />
      </CmsSection>

      {/* CTA Section */}
      <CmsSection title="Support CTA Banner" icon={<Megaphone className="h-5 w-5 text-primary" />} defaultOpen={false}>
        <CmsTextField
          label="Title"
          value={data.cta.title}
          onChange={(v) => updateNestedField("cta", "title", v)}
        />
        <CmsTextField
          label="Subtitle"
          value={data.cta.subtitle}
          onChange={(v) => updateNestedField("cta", "subtitle", v)}
          multiline
        />
        <CmsTextField
          label="Button Label"
          value={data.cta.buttonLabel}
          onChange={(v) => updateNestedField("cta", "buttonLabel", v)}
        />
      </CmsSection>

      {/* Footer */}
      <CmsSection title="Footer" icon={<FileText className="h-5 w-5 text-primary" />} defaultOpen={false}>
        <CmsTextField
          label="About Text"
          value={data.footer.about}
          onChange={(v) => updateNestedField("footer", "about", v)}
          multiline
        />
        
        <div className="space-y-4 mt-4">
          <Label className="text-sm font-medium">Footer Columns</Label>
          {data.footer.columns.map((column, colIndex) => (
            <div key={colIndex} className="rounded-lg border border-border p-4 space-y-3">
              <CmsTextField
                label="Column Title"
                value={column.title}
                onChange={(v) => {
                  const newColumns = [...data.footer.columns];
                  newColumns[colIndex] = { ...column, title: v };
                  onChange({
                    ...data,
                    footer: { ...data.footer, columns: newColumns },
                  });
                }}
              />
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Items</Label>
                {column.items.map((item, itemIndex) => (
                  <div key={itemIndex} className="flex gap-2">
                    <Input
                      value={item}
                      onChange={(e) => {
                        const newItems = [...column.items];
                        newItems[itemIndex] = e.target.value;
                        const newColumns = [...data.footer.columns];
                        newColumns[colIndex] = { ...column, items: newItems };
                        onChange({
                          ...data,
                          footer: { ...data.footer, columns: newColumns },
                        });
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const newItems = column.items.filter((_, i) => i !== itemIndex);
                        const newColumns = [...data.footer.columns];
                        newColumns[colIndex] = { ...column, items: newItems };
                        onChange({
                          ...data,
                          footer: { ...data.footer, columns: newColumns },
                        });
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newColumns = [...data.footer.columns];
                    newColumns[colIndex] = {
                      ...column,
                      items: [...column.items, "New Item"],
                    };
                    onChange({
                      ...data,
                      footer: { ...data.footer, columns: newColumns },
                    });
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-2 mt-4">
          <Label className="text-sm font-medium">Support Contact Items</Label>
          {data.footer.supportItems.map((item, index) => (
            <div key={index} className="flex gap-2">
              <Input
                value={item}
                onChange={(e) => {
                  const newItems = [...data.footer.supportItems];
                  newItems[index] = e.target.value;
                  onChange({
                    ...data,
                    footer: { ...data.footer, supportItems: newItems },
                  });
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  onChange({
                    ...data,
                    footer: {
                      ...data.footer,
                      supportItems: data.footer.supportItems.filter((_, i) => i !== index),
                    },
                  });
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              onChange({
                ...data,
                footer: {
                  ...data.footer,
                  supportItems: [...data.footer.supportItems, "New Contact Info"],
                },
              });
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Contact Item
          </Button>
        </div>

        <CmsTextField
          label="Bottom Left Text"
          value={data.footer.bottomLeft}
          onChange={(v) => updateNestedField("footer", "bottomLeft", v)}
        />
        <CmsTextField
          label="Bottom Right Text"
          value={data.footer.bottomRight}
          onChange={(v) => updateNestedField("footer", "bottomRight", v)}
        />
      </CmsSection>
    </div>
  );
};
