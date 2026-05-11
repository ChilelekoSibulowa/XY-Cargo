import { CmsBlogData } from "@/content/cmsDefaults";
import { CmsSection } from "../CmsSection";
import { CmsTextField } from "../CmsTextField";
import { CmsImageUpload } from "../CmsImageUpload";
import { CmsArrayEditor } from "../CmsArrayEditor";
import { BookOpen, FileText, Image as ImageIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface BlogEditorProps {
  data: CmsBlogData;
  onChange: (data: CmsBlogData) => void;
}

export const BlogEditor = ({ data, onChange }: BlogEditorProps) => {
  const updateHeroField = (field: keyof CmsBlogData["hero"], value: string) => {
    onChange({
      ...data,
      hero: { ...data.hero, [field]: value },
    });
  };

  const updateIntroField = (field: keyof CmsBlogData["intro"], value: string) => {
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

      <CmsSection title="Page Introduction" icon={<FileText className="h-5 w-5 text-primary" />} defaultOpen={false}>
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

      <CmsSection title="Blog Posts" icon={<BookOpen className="h-5 w-5 text-primary" />}>
        <CmsArrayEditor
          items={data.posts}
          onChange={(posts) => onChange({ ...data, posts })}
          defaultItem={{
            title: "",
            body: "",
            featuredImage: "",
            publishedAt: "",
          }}
          addLabel="Add Blog Post"
          renderFields={(item, _index, updateItem) => (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-[1fr_220px]">
                <CmsTextField
                  label="Blog Title"
                  value={item.title}
                  onChange={(value) => updateItem("title", value)}
                  placeholder="Enter the blog title"
                />
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Publish Date</Label>
                  <Input
                    type="date"
                    value={item.publishedAt}
                    onChange={(event) => updateItem("publishedAt", event.target.value)}
                  />
                </div>
              </div>

              <CmsImageUpload
                label="Featured Image"
                value={item.featuredImage}
                onChange={(value) => updateItem("featuredImage", value)}
              />

              <CmsTextField
                label="Story Body"
                value={item.body}
                onChange={(value) => updateItem("body", value)}
                multiline
                placeholder="Write the full blog story here"
              />
            </div>
          )}
        />
      </CmsSection>
    </div>
  );
};
