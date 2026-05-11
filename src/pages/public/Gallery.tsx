import { Card, CardContent } from "@/components/ui/card";
import { cmsDefaults, CmsGalleryData } from "@/content/cmsDefaults";
import { useCmsPage } from "@/hooks/useCmsPage";

const Gallery = () => {
  const { data: content } = useCmsPage<CmsGalleryData>("gallery", cmsDefaults.gallery);

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
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {content.items.length > 0 ? (
            content.items.map((item, index) => (
              <Card key={`${item.title}-${index}`} className="overflow-hidden border-slate-200/70">
                {item.image ? (
                  <img src={item.image} alt={item.title || "Gallery image"} className="aspect-square w-full object-cover" />
                ) : (
                  <div className="flex aspect-square items-center justify-center bg-slate-100 text-sm text-slate-500">
                    No image uploaded
                  </div>
                )}
                <CardContent className="space-y-2 p-5">
                  <h3 className="text-lg font-semibold text-slate-900">{item.title || "Untitled Image"}</h3>
                  <p className="text-sm text-slate-600">{item.caption}</p>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="border-dashed border-slate-300 bg-slate-50 md:col-span-2 xl:col-span-3">
              <CardContent className="px-6 py-12 text-center">
                <h3 className="text-lg font-semibold text-slate-900">No gallery images yet</h3>
                <p className="mt-2 text-sm text-slate-600">
                  New gallery highlights will appear here soon.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

    </div>
  );
};

export default Gallery;
