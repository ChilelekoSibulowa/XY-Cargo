import { CmsAboutData } from "@/content/cmsDefaults";
import { CmsSection } from "../CmsSection";
import { CmsTextField } from "../CmsTextField";
import { CmsImageUpload } from "../CmsImageUpload";
import { CmsArrayEditor } from "../CmsArrayEditor";
import { Image, Layout, Target, Heart } from "lucide-react";

interface AboutEditorProps {
  data: CmsAboutData;
  onChange: (data: CmsAboutData) => void;
}

export const AboutEditor = ({ data, onChange }: AboutEditorProps) => {
  const updateNestedField = <K extends keyof CmsAboutData>(
    key: K,
    field: keyof CmsAboutData[K],
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
        <CmsTextField
          label="Button Label"
          value={data.intro.buttonLabel}
          onChange={(v) => updateNestedField("intro", "buttonLabel", v)}
        />
        <CmsImageUpload
          label="Intro Image"
          value={data.intro.image}
          onChange={(v) => updateNestedField("intro", "image", v)}
        />
      </CmsSection>

      {/* Vision & Mission */}
      <CmsSection title="Vision & Mission" icon={<Target className="h-5 w-5 text-primary" />} defaultOpen={false}>
        <CmsArrayEditor
          items={data.visionMission}
          onChange={(items) => onChange({ ...data, visionMission: items })}
          defaultItem={{ title: "New Section", body: "Description here" }}
          addLabel="Add Section"
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
            </div>
          )}
        />
      </CmsSection>

      {/* Core Values */}
      <CmsSection title="Core Values" icon={<Heart className="h-5 w-5 text-primary" />} defaultOpen={false}>
        <CmsArrayEditor
          items={data.coreValues}
          onChange={(items) => onChange({ ...data, coreValues: items })}
          defaultItem={{ title: "New Value", body: "Description here" }}
          addLabel="Add Core Value"
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
            </div>
          )}
        />
      </CmsSection>
    </div>
  );
};
