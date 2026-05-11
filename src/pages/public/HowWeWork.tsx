import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useCmsPage } from "@/hooks/useCmsPage";
import { cmsDefaults, CmsHowWeWorkData } from "@/content/cmsDefaults";

const HowWeWork = () => {
  const { data: content } = useCmsPage<CmsHowWeWorkData>("how-we-work", cmsDefaults["how-we-work"]);

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

      <section className="mx-auto max-w-5xl px-6 py-12 text-center">
        <h2 className="text-2xl font-semibold md:text-3xl">{content.intro.title}</h2>
        <p className="mt-3 text-sm text-slate-600">{content.intro.subtitle}</p>
      </section>

      <section className="mx-auto grid max-w-5xl gap-8 px-6 pb-12 md:grid-cols-[1.1fr_0.9fr] md:items-center">
        <div className="space-y-4">
          <h3 className="text-xl font-semibold">{content.process.title}</h3>
          <p className="text-sm text-slate-600 whitespace-pre-line">{content.process.body}</p>
          <Button asChild className="rounded-full bg-[#d8000d] px-6 text-sm font-semibold text-white">
            <Link to="/tracking">{content.process.buttonLabel}</Link>
          </Button>
        </div>
        <div className="space-y-4">
          <img src={content.process.image} alt="Shipping process" className="rounded-2xl object-cover" />
        </div>
      </section>

      <section className="bg-slate-50 py-12">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-6 px-6 md:grid-cols-4">
          {content.steps.map((step, index) => (
            <div key={step.title} className="text-center">
              <div className="relative mx-auto h-24 w-24 overflow-hidden rounded-full">
                <img src={step.image} alt={step.title} className="h-full w-full object-cover" />
                <span className="absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full bg-[#d8000d] text-xs font-semibold text-white">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </div>
              <h4 className="mt-4 text-sm font-semibold">{step.title}</h4>
              <p className="mt-2 text-xs text-slate-600">{step.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 flex justify-center">
          <Button asChild className="rounded-full bg-[#d8000d] px-6 text-sm font-semibold text-white">
            <Link to="/register">{content.secondaryCta.buttonLabel}</Link>
          </Button>
        </div>
      </section>

    </div>
  );
};

export default HowWeWork;



