import { CmsPodcastData } from "@/content/cmsDefaults";
import { CmsSection } from "../CmsSection";
import { CmsTextField } from "../CmsTextField";
import { CmsImageUpload } from "../CmsImageUpload";
import { CmsArrayEditor } from "../CmsArrayEditor";
import { getYouTubeEmbedUrl } from "@/lib/cmsContent";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mic, Image as ImageIcon, FileText } from "lucide-react";

interface PodcastEditorProps {
  data: CmsPodcastData;
  onChange: (data: CmsPodcastData) => void;
}

export const PodcastEditor = ({ data, onChange }: PodcastEditorProps) => {
  const updateHeroField = (field: keyof CmsPodcastData["hero"], value: string) => {
    onChange({
      ...data,
      hero: { ...data.hero, [field]: value },
    });
  };

  const updateIntroField = (field: keyof CmsPodcastData["intro"], value: string) => {
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

      <CmsSection title="Podcast Episodes" icon={<Mic className="h-5 w-5 text-primary" />}>
        <CmsArrayEditor
          items={data.episodes}
          onChange={(episodes) => onChange({ ...data, episodes })}
          defaultItem={{
            title: "",
            description: "",
            youtubeUrl: "",
            publishedAt: "",
          }}
          addLabel="Add Podcast Episode"
          renderFields={(item, _index, updateItem) => {
            const embedUrl = getYouTubeEmbedUrl(item.youtubeUrl);

            return (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-[1fr_220px]">
                  <CmsTextField
                    label="Episode Title"
                    value={item.title}
                    onChange={(value) => updateItem("title", value)}
                    placeholder="Enter the podcast title"
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

                <CmsTextField
                  label="YouTube URL"
                  value={item.youtubeUrl}
                  onChange={(value) => updateItem("youtubeUrl", value)}
                  placeholder="Paste a YouTube watch, share, or embed URL"
                />

                <p className="text-xs text-muted-foreground">
                  The live site will embed the YouTube video from this link.
                </p>

                {embedUrl ? (
                  <div className="overflow-hidden rounded-xl border border-border bg-muted/30">
                    <iframe
                      src={embedUrl}
                      title={item.title || "Podcast preview"}
                      className="aspect-video w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
                    Add a valid YouTube URL to preview the embedded podcast here.
                  </div>
                )}

                <CmsTextField
                  label="Episode Description"
                  value={item.description}
                  onChange={(value) => updateItem("description", value)}
                  multiline
                  placeholder="Write the episode summary or talking points"
                />
              </div>
            );
          }}
        />
      </CmsSection>
    </div>
  );
};
