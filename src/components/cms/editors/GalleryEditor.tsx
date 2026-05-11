import { CmsGalleryData } from "@/content/cmsDefaults";
import { CmsSection } from "../CmsSection";
import { CmsTextField } from "../CmsTextField";
import { CmsImageUpload } from "../CmsImageUpload";
import { CmsArrayEditor } from "../CmsArrayEditor";
import { FileImage, Image as ImageIcon, Layout } from "lucide-react";

interface GalleryEditorProps {
  data: CmsGalleryData;
  onChange: (data: CmsGalleryData) => void;
}

export const GalleryEditor = ({ data, onChange }: GalleryEditorProps) => {
  const updateHeroField = (field: keyof CmsGalleryData["hero"], value: string) => {
    onChange({
      ...data,
      hero: { ...data.hero, [field]: value },
    });
  };

  const updateIntroField = (field: keyof CmsGalleryData["intro"], value: string) => {
    onChange({
      ...data,
      intro: { ...data.intro, [field]: value },
    });
  };

  return (
    <div className="space-y-6">
      <CmsSection title="Hero Banner" icon={<ImageIcon className="h-5 w-5 text-primary" />}>
        <CmsTextField
          label="Title"
          value={data.hero.title}
          onChange={(value) => updateHeroField("title", value)}
        />
        <CmsTextField
          label="Breadcrumb"
          value={data.hero.breadcrumb}
          onChange={(value) => updateHeroField("breadcrumb", value)}
        />
        <CmsImageUpload
          label="Hero Image"
          value={data.hero.image}
          onChange={(value) => updateHeroField("image", value)}
          aspectRatio="banner"
        />
      </CmsSection>

      <CmsSection title="Page Introduction" icon={<Layout className="h-5 w-5 text-primary" />} defaultOpen={false}>
        <CmsTextField
          label="Section Title"
          value={data.intro.title}
          onChange={(value) => updateIntroField("title", value)}
        />
        <CmsTextField
          label="Section Message"
          value={data.intro.body}
          onChange={(value) => updateIntroField("body", value)}
          multiline
        />
      </CmsSection>

      <CmsSection title="Gallery Images" icon={<FileImage className="h-5 w-5 text-primary" />}>
        <CmsArrayEditor
          items={data.items}
          onChange={(items) => onChange({ ...data, items })}
          defaultItem={{
            title: "",
            caption: "",
            image: "",
          }}
          addLabel="Add Gallery Image"
          renderFields={(item, _index, updateItem) => (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <CmsTextField
                  label="Image Title"
                  value={item.title}
                  onChange={(value) => updateItem("title", value)}
                  placeholder="Enter a gallery title"
                />
                <CmsTextField
                  label="Caption"
                  value={item.caption}
                  onChange={(value) => updateItem("caption", value)}
                  placeholder="Short caption or description"
                />
              </div>

              <CmsImageUpload
                label="Gallery Image"
                value={item.image}
                onChange={(value) => updateItem("image", value)}
                aspectRatio="square"
              />
            </div>
          )}
        />
      </CmsSection>
    </div>
  );
};
