import { CmsHowWeWorkData } from "@/content/cmsDefaults";
import { CmsSection } from "../CmsSection";
import { CmsTextField } from "../CmsTextField";
import { CmsImageUpload } from "../CmsImageUpload";
import { CmsArrayEditor } from "../CmsArrayEditor";
import { Image, Layout, ListOrdered } from "lucide-react";

interface HowWeWorkEditorProps {
  data: CmsHowWeWorkData;
  onChange: (data: CmsHowWeWorkData) => void;
}

export const HowWeWorkEditor = ({ data, onChange }: HowWeWorkEditorProps) => {
  const updateNestedField = <K extends keyof CmsHowWeWorkData>(
    key: K,
    field: keyof CmsHowWeWorkData[K],
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
          label="Subtitle"
          value={data.intro.subtitle}
          onChange={(v) => updateNestedField("intro", "subtitle", v)}
        />
      </CmsSection>

      {/* Process Section */}
      <CmsSection title="Process Section" icon={<Layout className="h-5 w-5 text-primary" />} defaultOpen={false}>
        <CmsTextField
          label="Title"
          value={data.process.title}
          onChange={(v) => updateNestedField("process", "title", v)}
        />
        <CmsTextField
          label="Body"
          value={data.process.body}
          onChange={(v) => updateNestedField("process", "body", v)}
          multiline
        />
        <CmsTextField
          label="Button Label"
          value={data.process.buttonLabel}
          onChange={(v) => updateNestedField("process", "buttonLabel", v)}
        />
        <CmsImageUpload
          label="Process Image"
          value={data.process.image}
          onChange={(v) => updateNestedField("process", "image", v)}
        />
      </CmsSection>

      {/* Steps */}
      <CmsSection title="Steps" icon={<ListOrdered className="h-5 w-5 text-primary" />}>
        <CmsArrayEditor
          items={data.steps}
          onChange={(items) => onChange({ ...data, steps: items })}
          defaultItem={{ title: "New Step", body: "Description", image: "" }}
          addLabel="Add Step"
          renderFields={(item, _, updateItem) => (
            <div className="space-y-3">
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
                label="Step Image"
                value={item.image}
                onChange={(v) => updateItem("image", v)}
                aspectRatio="square"
              />
            </div>
          )}
        />
      </CmsSection>

      {/* Secondary CTA */}
      <CmsSection title="Secondary CTA" icon={<Layout className="h-5 w-5 text-primary" />} defaultOpen={false}>
        <CmsTextField
          label="Button Label"
          value={data.secondaryCta.buttonLabel}
          onChange={(v) => updateNestedField("secondaryCta", "buttonLabel", v)}
        />
      </CmsSection>
    </div>
  );
};
