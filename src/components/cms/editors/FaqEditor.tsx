import { CmsFaqData } from "@/content/cmsDefaults";
import { CmsSection } from "../CmsSection";
import { CmsTextField } from "../CmsTextField";
import { CmsImageUpload } from "../CmsImageUpload";
import { CmsArrayEditor } from "../CmsArrayEditor";
import { Image, HelpCircle } from "lucide-react";

interface FaqEditorProps {
  data: CmsFaqData;
  onChange: (data: CmsFaqData) => void;
}

export const FaqEditor = ({ data, onChange }: FaqEditorProps) => {
  const updateNestedField = <K extends keyof CmsFaqData>(
    key: K,
    field: keyof CmsFaqData[K],
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

      {/* FAQs */}
      <CmsSection title="FAQ Items" icon={<HelpCircle className="h-5 w-5 text-primary" />}>
        <CmsArrayEditor
          items={data.faqs}
          onChange={(items) => onChange({ ...data, faqs: items })}
          defaultItem={{ question: "New Question?", answer: "Answer here" }}
          addLabel="Add FAQ"
          renderFields={(item, _, updateItem) => (
            <div className="space-y-3">
              <CmsTextField
                label="Question"
                value={item.question}
                onChange={(v) => updateItem("question", v)}
              />
              <CmsTextField
                label="Answer"
                value={item.answer}
                onChange={(v) => updateItem("answer", v)}
                multiline
              />
            </div>
          )}
        />
      </CmsSection>
    </div>
  );
};
