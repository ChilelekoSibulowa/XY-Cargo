import { useCmsPage } from "@/hooks/useCmsPage";
import { cmsDefaults, CmsSiteData } from "@/content/cmsDefaults";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export const SupportCta = () => {
  const { data: site } = useCmsPage<CmsSiteData>("site", cmsDefaults.site);

  return (
    <section className="bg-[#d8000d] text-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 py-12 text-center">
        <h2 className="support-cta-title text-2xl font-semibold md:text-3xl">{site.cta.title}</h2>
        <p className="max-w-2xl text-sm text-white/80">{site.cta.subtitle}</p>
        <Button asChild className="rounded-full bg-white px-6 py-2 text-sm font-semibold text-black">
          <Link to="/support">{site.cta.buttonLabel}</Link>
        </Button>
      </div>
    </section>
  );
};
