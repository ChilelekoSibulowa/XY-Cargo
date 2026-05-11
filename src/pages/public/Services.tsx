import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCmsPage } from "@/hooks/useCmsPage";
import { cmsDefaults, CmsServicesData } from "@/content/cmsDefaults";

const Services = () => {
  const { data: content } = useCmsPage<CmsServicesData>("services", cmsDefaults.services);
  const heroTitle = "Services";
  const heroBreadcrumb = content.hero.breadcrumb.replace(/support center/i, "Services");
  const getServiceLink = (title: string) => {
    const normalized = title.trim().toLowerCase();
    if (normalized === "air freight transport") return "/calculator";
    if (normalized === "sea freight") return "/calculator";
    if (normalized === "product sourcing") return "/services/product-sourcing";
    if (normalized === "supplier payment facilitation") return "/services/supplier-payment-facilitation";
    if (normalized === "custom clearance") return "/services/customs-clearance";
    if (normalized === "door to door delivery") return "/login";
    if (normalized === "export") return "/services/export";
    return null;
  };

  return (
    <div className="flex flex-col">
      <section className="relative h-[220px] w-full overflow-hidden md:h-[260px]">
        <img src={content.hero.image} alt={heroTitle} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-black/40" />
        <div className="absolute inset-0 flex items-center justify-center text-center text-white">
          <div>
            <h1 className="public-hero-title text-3xl font-semibold md:text-4xl">{heroTitle}</h1>
            <p className="mt-2 text-xs text-white">{heroBreadcrumb}</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12 text-center">
        <div className="mx-auto max-w-3xl space-y-4">
          <h2 className="text-2xl font-semibold">{content.intro.title}</h2>
          <p className="text-sm text-slate-600 whitespace-pre-line">{content.intro.body}</p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 pb-12">
        <div className="grid gap-6 md:grid-cols-3">
          {content.services.map((service, index) => (
            <Card
              key={service.title}
              className="border-slate-200/70 motion-safe:animate-fade-up"
              style={{ animationDelay: `${index * 70}ms` }}
            >
              <CardContent className="space-y-4 p-6">
                <img src={service.image} alt={service.title} className="h-44 w-full rounded-xl object-cover" />
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-[#d8000d] text-xs font-semibold text-white">
                  {service.tag}
                </div>
                <h3 className="text-lg font-semibold">{service.title}</h3>
                <p className="text-sm text-slate-600">{service.body}</p>
                <ul className="list-disc space-y-2 pl-5 text-xs text-slate-600">
                  {service.bullets.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                {getServiceLink(service.title) ? (
                  <Button asChild className="rounded-full bg-[#d8000d] px-6 text-xs font-semibold text-white">
                    <a href={getServiceLink(service.title) || "#"}>{service.buttonLabel || "Learn More"}</a>
                  </Button>
                ) : (
                  <Button className="rounded-full bg-[#d8000d] px-6 text-xs font-semibold text-white">
                    {service.buttonLabel || "Learn More"}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

    </div>
  );
};

export default Services;



