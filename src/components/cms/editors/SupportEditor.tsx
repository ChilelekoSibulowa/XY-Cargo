import { CmsSupportData } from "@/content/cmsDefaults";
import { CmsSection } from "../CmsSection";
import { CmsTextField } from "../CmsTextField";
import { CmsImageUpload } from "../CmsImageUpload";
import { Image, Phone, FileText } from "lucide-react";

interface SupportEditorProps {
  data: CmsSupportData;
  onChange: (data: CmsSupportData) => void;
}

export const SupportEditor = ({ data, onChange }: SupportEditorProps) => {
  const updateNestedField = <K extends keyof CmsSupportData>(
    key: K,
    field: keyof CmsSupportData[K],
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

      {/* Contact Info */}
      <CmsSection title="Contact Information" icon={<Phone className="h-5 w-5 text-primary" />}>
        <CmsTextField
          label="Section Title"
          value={data.intro.title}
          onChange={(v) => updateNestedField("intro", "title", v)}
        />
        <CmsTextField
          label="Body Text"
          value={data.intro.body}
          onChange={(v) => updateNestedField("intro", "body", v)}
          multiline
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <CmsTextField
            label="Email"
            value={data.intro.email}
            onChange={(v) => updateNestedField("intro", "email", v)}
          />
          <CmsTextField
            label="Phone"
            value={data.intro.phone}
            onChange={(v) => updateNestedField("intro", "phone", v)}
          />
          <CmsTextField
            label="Address"
            value={data.intro.address}
            onChange={(v) => updateNestedField("intro", "address", v)}
          />
          <CmsTextField
            label="WhatsApp Number"
            value={data.intro.whatsapp}
            onChange={(v) => updateNestedField("intro", "whatsapp", v)}
          />
          <CmsTextField
            label="WhatsApp URL"
            value={data.intro.whatsappUrl || ""}
            onChange={(v) => updateNestedField("intro", "whatsappUrl", v)}
          />
          <CmsTextField
            label="Live Chat Label"
            value={data.intro.liveChat || ""}
            onChange={(v) => updateNestedField("intro", "liveChat", v)}
          />
          <CmsTextField
            label="Live Chat URL"
            value={data.intro.liveChatUrl || ""}
            onChange={(v) => updateNestedField("intro", "liveChatUrl", v)}
          />
        </div>
      </CmsSection>

      {/* Form Section */}
      <CmsSection title="Contact Form" icon={<FileText className="h-5 w-5 text-primary" />} defaultOpen={false}>
        <CmsTextField
          label="Form Title"
          value={data.form.title}
          onChange={(v) => updateNestedField("form", "title", v)}
        />
        <CmsTextField
          label="Submit Button Label"
          value={data.form.buttonLabel}
          onChange={(v) => updateNestedField("form", "buttonLabel", v)}
        />
      </CmsSection>
    </div>
  );
};
