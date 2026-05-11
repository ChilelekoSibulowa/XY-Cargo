import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCmsPage } from "@/hooks/useCmsPage";
import { cmsDefaults, CmsAboutData } from "@/content/cmsDefaults";

const About = () => {
  const { data: content } = useCmsPage<CmsAboutData>("about", cmsDefaults.about);

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

      <section className="mx-auto grid max-w-5xl gap-8 px-6 py-12 md:grid-cols-[0.9fr_1.1fr] md:items-center">
        <img src={content.intro.image} alt="About XY Cargo Zambia" className="rounded-2xl object-cover" />
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">{content.intro.title}</h2>
          <p className="text-sm text-slate-600 whitespace-pre-line">{content.intro.body}</p>
          <Button asChild className="rounded-full bg-[#d8000d] px-6 text-sm font-semibold text-white">
            <Link to="/tracking">{content.intro.buttonLabel}</Link>
          </Button>
        </div>
      </section>

      <section className="bg-slate-50 py-10">
        <div className="mx-auto grid max-w-5xl gap-6 px-6 md:grid-cols-2">
          {content.visionMission.map((item) => (
            <Card key={item.title} className="border-slate-200/70">
              <CardContent className="space-y-3 p-6 text-center">
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="text-xs text-slate-600">{item.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <h2 className="text-center text-2xl font-semibold">Core Values</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {content.coreValues.map((item) => (
            <Card key={item.title} className="border-slate-200/70">
              <CardContent className="space-y-2 p-6 text-center">
                <h3 className="text-sm font-semibold">{item.title}</h3>
                <p className="text-xs text-slate-600">{item.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

    </div>
  );
};

export default About;



import { Link } from "react-router-dom";
