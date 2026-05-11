import { CmsSimplePage } from "@/content/cmsDefaults";
import { CmsSection } from "../CmsSection";
import { CmsTextField } from "../CmsTextField";
import { CmsImageUpload } from "../CmsImageUpload";
import { Image, FileText } from "lucide-react";

interface SimplePageEditorProps {
  data: CmsSimplePage;
  onChange: (data: CmsSimplePage) => void;
  pageTitle: string;
}

export const SimplePageEditor = ({ data, onChange, pageTitle }: SimplePageEditorProps) => {
  const updateHeroField = (field: keyof CmsSimplePage["hero"], value: string) => {
    onChange({
      ...data,
      hero: { ...data.hero, [field]: value },
    });
  };

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <CmsSection title={`${pageTitle} Hero`} icon={<Image className="h-5 w-5 text-primary" />}>
        <CmsTextField
          label="Title"
          value={data.hero.title}
          onChange={(v) => updateHeroField("title", v)}
        />
        <CmsTextField
          label="Breadcrumb"
          value={data.hero.breadcrumb}
          onChange={(v) => updateHeroField("breadcrumb", v)}
        />
        <CmsImageUpload
          label="Hero Background Image"
          value={data.hero.image}
          onChange={(v) => updateHeroField("image", v)}
          aspectRatio="banner"
        />
      </CmsSection>

      {/* Body Content */}
      <CmsSection title="Page Content" icon={<FileText className="h-5 w-5 text-primary" />}>
        <CmsTextField
          label="Body Text"
          value={data.body}
          onChange={(v) => onChange({ ...data, body: v })}
          multiline
          placeholder="Enter the main content for this page..."
        />
      </CmsSection>
    </div>
  );
};
