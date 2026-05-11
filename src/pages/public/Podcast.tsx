import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cmsDefaults, CmsPodcastData } from "@/content/cmsDefaults";
import { useCmsPage } from "@/hooks/useCmsPage";
import { formatCmsDate, getYouTubeEmbedUrl } from "@/lib/cmsContent";
import { ExternalLink } from "lucide-react";

const Podcast = () => {
  const { data: content } = useCmsPage<CmsPodcastData>("podcast", cmsDefaults.podcast);

  return (
    <div className="flex flex-col">
      <section className="relative h-[220px] w-full overflow-hidden md:h-[260px]">
        <img src={content.hero.image} alt={content.hero.title} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-black/40" />
        <div className="absolute inset-0 flex items-center justify-center text-center text-white">
          <div>
            <h1 className="public-hero-title text-3xl font-semibold md:text-4xl">{content.hero.title}</h1>
            <p className="mt-2 text-xs text-white">{content.hero.breadcrumb}</p>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-12">
        <div className="grid gap-8">
          {content.episodes.length > 0 ? (
            content.episodes.map((episode, index) => {
              const embedUrl = getYouTubeEmbedUrl(episode.youtubeUrl);

              return (
                <Card
                  key={`${episode.title}-${episode.publishedAt}-${index}`}
                  className="overflow-hidden border-slate-200/70"
                >
                  <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
                    <div className="bg-slate-950">
                      {embedUrl ? (
                        <iframe
                          src={embedUrl}
                          title={episode.title || "Podcast episode"}
                          className="aspect-video w-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      ) : (
                        <div className="flex aspect-video items-center justify-center px-6 text-center text-sm text-white/70">
                          This episode will be available soon.
                        </div>
                      )}
                    </div>
                    <CardContent className="space-y-4 p-6">
                      {episode.publishedAt ? (
                        <Badge variant="outline" className="w-fit">
                          {formatCmsDate(episode.publishedAt)}
                        </Badge>
                      ) : null}
                      <h3 className="text-2xl font-semibold text-slate-900">
                        {episode.title || "Untitled Podcast Episode"}
                      </h3>
                      <p className="text-sm whitespace-pre-line leading-7 text-slate-600">{episode.description}</p>
                      {episode.youtubeUrl ? (
                        <Button asChild variant="outline" className="rounded-full">
                          <a href={episode.youtubeUrl} target="_blank" rel="noreferrer">
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Open on YouTube
                          </a>
                        </Button>
                      ) : null}
                    </CardContent>
                  </div>
                </Card>
              );
            })
          ) : (
            <Card className="border-dashed border-slate-300 bg-slate-50">
              <CardContent className="px-6 py-12 text-center">
                <h3 className="text-lg font-semibold text-slate-900">No podcast episodes yet</h3>
                <p className="mt-2 text-sm text-slate-600">
                  New episodes will appear here soon.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

    </div>
  );
};

export default Podcast;
