import { CmsServicesData } from "@/content/cmsDefaults";
import { CmsSection } from "../CmsSection";
import { CmsTextField } from "../CmsTextField";
import { CmsImageUpload } from "../CmsImageUpload";
import { CmsArrayEditor } from "../CmsArrayEditor";
import { Image, Layout, Megaphone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";

interface ServicesEditorProps {
  data: CmsServicesData;
  onChange: (data: CmsServicesData) => void;
}

export const ServicesEditor = ({ data, onChange }: ServicesEditorProps) => {
  const updateNestedField = <K extends keyof CmsServicesData>(
    key: K,
    field: keyof CmsServicesData[K],
    value: unknown
  ) => {
    onChange({
      ...data,
      [key]: { ...data[key], [field]: value },
    });
  };

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <CmsSection title="Hero Banner" icon={<Image className="h-5 w-5 text-primary" />}>
        <CmsTextField
          label="Title"
          value={data.hero.title}
          onChange={(v) => updateNestedField("hero", "title", v)}
        />
        <CmsTextField
          label="Breadcrumb"
          value={data.hero.breadcrumb}
          onChange={(v) => updateNestedField("hero", "breadcrumb", v)}
        />
        <CmsImageUpload
          label="Hero Image"
          value={data.hero.image}
          onChange={(v) => updateNestedField("hero", "image", v)}
          aspectRatio="banner"
        />
      </CmsSection>

      {/* Intro Section */}
      <CmsSection title="Introduction" icon={<Layout className="h-5 w-5 text-primary" />} defaultOpen={false}>
        <CmsTextField
          label="Title"
          value={data.intro.title}
          onChange={(v) => updateNestedField("intro", "title", v)}
        />
        <CmsTextField
          label="Body"
          value={data.intro.body}
          onChange={(v) => updateNestedField("intro", "body", v)}
          multiline
        />
      </CmsSection>

      {/* Services List */}
      <CmsSection title="Services" icon={<Layout className="h-5 w-5 text-primary" />}>
        <CmsArrayEditor
          items={data.services}
          onChange={(items) => onChange({ ...data, services: items })}
          defaultItem={{
            tag: "01",
            title: "New Service",
            body: "Service description",
            bullets: [],
            buttonLabel: "Learn More",
            image: "",
          }}
          addLabel="Add Service"
          renderFields={(item, index, updateItem) => (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <CmsTextField
                  label="Tag Number"
                  value={item.tag}
                  onChange={(v) => updateItem("tag", v)}
                />
                <CmsTextField
                  label="Button Label"
                  value={item.buttonLabel || "Learn More"}
                  onChange={(v) => updateItem("buttonLabel", v)}
                />
              </div>
              <CmsTextField
                label="Title"
                value={item.title}
                onChange={(v) => updateItem("title", v)}
              />
              <CmsTextField
                label="Body"
                value={item.body}
                onChange={(v) => updateItem("body", v)}
                multiline
              />
              <CmsImageUpload
                label="Service Image"
                value={item.image}
                onChange={(v) => updateItem("image", v)}
              />
              <div className="space-y-2">
                <Label className="text-sm font-medium">Bullet Points</Label>
                {item.bullets.map((bullet, bIndex) => (
                  <div key={bIndex} className="flex gap-2">
                    <Input
                      value={bullet}
                      onChange={(e) => {
                        const newBullets = [...item.bullets];
                        newBullets[bIndex] = e.target.value;
                        updateItem("bullets", newBullets);
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        updateItem(
                          "bullets",
                          item.bullets.filter((_, i) => i !== bIndex)
                        );
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
                  onClick={() =>
                    updateItem("bullets", [...item.bullets, "New bullet point"])
                  }
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Bullet
                </Button>
              </div>
            </div>
          )}
        />
      </CmsSection>

      {/* CTA Section */}
      <CmsSection title="Call to Action" icon={<Megaphone className="h-5 w-5 text-primary" />} defaultOpen={false}>
        <CmsTextField
          label="Title"
          value={data.cta.title}
          onChange={(v) => updateNestedField("cta", "title", v)}
        />
        <CmsTextField
          label="Body"
          value={data.cta.body}
          onChange={(v) => updateNestedField("cta", "body", v)}
          multiline
        />
        <CmsTextField
          label="Button Label"
          value={data.cta.buttonLabel}
          onChange={(v) => updateNestedField("cta", "buttonLabel", v)}
        />
      </CmsSection>
    </div>
  );
};
