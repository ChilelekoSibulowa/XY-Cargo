import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cmsDefaults, CmsBlogData } from "@/content/cmsDefaults";
import { useCmsPage } from "@/hooks/useCmsPage";
import { formatCmsDate } from "@/lib/cmsContent";

const Blog = () => {
  const { data: content } = useCmsPage<CmsBlogData>("blog", cmsDefaults.blog);

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
          {content.posts.length > 0 ? (
            content.posts.map((post, index) => (
              <Card key={`${post.title}-${post.publishedAt}-${index}`} className="overflow-hidden border-slate-200/70">
                <div className="grid gap-0 lg:grid-cols-[320px_1fr]">
                  <div className="p-6 pb-0 lg:pb-6">
                    {post.featuredImage ? (
                      <img
                        src={post.featuredImage}
                        alt={post.title}
                        className="h-full max-h-[260px] w-full rounded-2xl object-cover"
                      />
                    ) : (
                      <div className="flex h-full min-h-[220px] items-center justify-center rounded-2xl bg-slate-100 text-sm text-slate-500">
                        No featured image
                      </div>
                    )}
                  </div>
                  <CardContent className="space-y-4 p-6">
                    {post.publishedAt ? (
                      <Badge variant="outline" className="w-fit">
                        {formatCmsDate(post.publishedAt)}
                      </Badge>
                    ) : null}
                    <h3 className="text-2xl font-semibold text-slate-900">{post.title || "Untitled Blog Post"}</h3>
                    <p className="text-sm whitespace-pre-line leading-7 text-slate-600">{post.body}</p>
                  </CardContent>
                </div>
              </Card>
            ))
          ) : (
            <Card className="border-dashed border-slate-300 bg-slate-50">
              <CardContent className="px-6 py-12 text-center">
                <h3 className="text-lg font-semibold text-slate-900">No blog posts yet</h3>
                <p className="mt-2 text-sm text-slate-600">
                  Fresh stories will appear here soon.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

    </div>
  );
};

export default Blog;
