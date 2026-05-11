import { CmsHomeData } from "@/content/cmsDefaults";
import { CmsSection } from "../CmsSection";
import { CmsTextField } from "../CmsTextField";
import { CmsImageUpload } from "../CmsImageUpload";
import { CmsArrayEditor } from "../CmsArrayEditor";
import { Image, Layout, Video, Calculator, Info } from "lucide-react";

interface HomeEditorProps {
  data: CmsHomeData;
  onChange: (data: CmsHomeData) => void;
}

export const HomeEditor = ({ data, onChange }: HomeEditorProps) => {
  const updateField = <K extends keyof CmsHomeData>(
    key: K,
    value: CmsHomeData[K]
  ) => {
    onChange({ ...data, [key]: value });
  };

  const updateNestedField = <K extends keyof CmsHomeData>(
    key: K,
    field: keyof CmsHomeData[K],
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
          label="Subtitle"
          value={data.hero.subtitle}
          onChange={(v) => updateNestedField("hero", "subtitle", v)}
        />
        <CmsTextField
          label="Description"
          value={data.hero.description || ""}
          onChange={(v) => updateNestedField("hero", "description", v)}
          multiline
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <CmsTextField
            label="Primary Button"
            value={data.hero.buttonPrimary}
            onChange={(v) => updateNestedField("hero", "buttonPrimary", v)}
          />
          <CmsTextField
            label="Secondary Button"
            value={data.hero.buttonSecondary}
            onChange={(v) => updateNestedField("hero", "buttonSecondary", v)}
          />
        </div>
        <CmsImageUpload
          label="Hero Background Image"
          value={data.hero.image}
          onChange={(v) => updateNestedField("hero", "image", v)}
          aspectRatio="banner"
        />
      </CmsSection>

      {/* Hero Slides */}
      <CmsSection title="Hero Slides (Carousel)" icon={<Layout className="h-5 w-5 text-primary" />} defaultOpen={false}>
        <CmsArrayEditor
          items={data.heroSlides || []}
          onChange={(items) => updateField("heroSlides", items)}
          defaultItem={{
            title: "New Slide",
            subtitle: "Subtitle here",
            description: "Description text",
            image: "",
          }}
          addLabel="Add Slide"
          renderFields={(item, _, updateItem) => (
            <div className="space-y-3">
              <CmsTextField
                label="Title"
                value={item.title}
                onChange={(v) => updateItem("title", v)}
              />
              <CmsTextField
                label="Subtitle"
                value={item.subtitle}
                onChange={(v) => updateItem("subtitle", v)}
              />
              <CmsTextField
                label="Description"
                value={item.description || ""}
                onChange={(v) => updateItem("description", v)}
                multiline
              />
              <CmsImageUpload
                label="Slide Image"
                value={item.image}
                onChange={(v) => updateItem("image", v)}
                aspectRatio="banner"
              />
            </div>
          )}
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
      <CmsSection title="Steps" icon={<Layout className="h-5 w-5 text-primary" />} defaultOpen={false}>
        <CmsArrayEditor
          items={data.steps}
          onChange={(items) => updateField("steps", items)}
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
                label="Step Icon/Image"
                value={item.image}
                onChange={(v) => updateItem("image", v)}
                aspectRatio="square"
              />
            </div>
          )}
        />
      </CmsSection>

      {/* About Section */}
      <CmsSection title="About Section" icon={<Info className="h-5 w-5 text-primary" />} defaultOpen={false}>
        <CmsTextField
          label="Title"
          value={data.about.title}
          onChange={(v) => updateNestedField("about", "title", v)}
        />
        <CmsTextField
          label="Body"
          value={data.about.body}
          onChange={(v) => updateNestedField("about", "body", v)}
          multiline
        />
        <CmsImageUpload
          label="About Image"
          value={data.about.image}
          onChange={(v) => updateNestedField("about", "image", v)}
        />
        <div className="mt-4">
          <p className="mb-2 text-sm font-medium">Accordions</p>
          <CmsArrayEditor
            items={data.about.accordions}
            onChange={(items) =>
              onChange({ ...data, about: { ...data.about, accordions: items } })
            }
            defaultItem={{ title: "New Accordion", body: "Content here" }}
            addLabel="Add Accordion"
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
        </div>
      </CmsSection>

      {/* Video Section */}
      <CmsSection title="Video Section" icon={<Video className="h-5 w-5 text-primary" />} defaultOpen={false}>
        <CmsTextField
          label="Title"
          value={data.video.title}
          onChange={(v) => updateNestedField("video", "title", v)}
        />
        <CmsTextField
          label="Video URL or Path"
          value={data.video.image}
          onChange={(v) => updateNestedField("video", "image", v)}
          placeholder="/videos/home.mp4"
        />
      </CmsSection>

      {/* Calculator Section */}
      <CmsSection title="Calculator Section" icon={<Calculator className="h-5 w-5 text-primary" />} defaultOpen={false}>
        <CmsTextField
          label="Title"
          value={data.calculator.title}
          onChange={(v) => updateNestedField("calculator", "title", v)}
        />
        <CmsTextField
          label="Subtitle"
          value={data.calculator.subtitle}
          onChange={(v) => updateNestedField("calculator", "subtitle", v)}
        />
      </CmsSection>

      {/* Stats */}
      <CmsSection title="Statistics" icon={<Info className="h-5 w-5 text-primary" />} defaultOpen={false}>
        <CmsArrayEditor
          items={data.stats}
          onChange={(items) => updateField("stats", items)}
          defaultItem={{ label: "New Stat", value: "0" }}
          addLabel="Add Stat"
          renderFields={(item, _, updateItem) => (
            <div className="grid gap-3 sm:grid-cols-2">
              <CmsTextField
                label="Label"
                value={item.label}
                onChange={(v) => updateItem("label", v)}
              />
              <CmsTextField
                label="Value"
                value={item.value}
                onChange={(v) => updateItem("value", v)}
              />
            </div>
          )}
        />
      </CmsSection>
    </div>
  );
};
