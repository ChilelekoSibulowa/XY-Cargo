import { useMemo } from "react";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useCmsPage } from "@/hooks/useCmsPage";
import { cmsDefaults, CmsSupportData } from "@/content/cmsDefaults";


const Support = () => {
  const { data: content } = useCmsPage<CmsSupportData>("support", cmsDefaults.support);
  const intro = { ...cmsDefaults.support.intro, ...(content.intro || {}) };
  const hero = { ...cmsDefaults.support.hero, ...(content.hero || {}) };

  return (
    <div className="flex flex-col">
      <section className="relative h-[220px] w-full overflow-hidden md:h-[260px]">
        <img src={hero.image} alt={hero.title} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-black/40" />
        <div className="absolute inset-0 flex items-center justify-center text-center text-white">
          <div>
            <h1 className="public-hero-title text-3xl font-semibold md:text-4xl">{hero.title}</h1>
            <p className="mt-2 text-xs text-white">{hero.breadcrumb}</p>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-6 py-12">
        <Card className="border-slate-200/70 bg-white">
          <CardContent className="grid gap-8 p-8 md:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold">{intro.title}</h2>
              <p className="text-sm text-slate-600">{intro.body}</p>
              <div className="space-y-3 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-[#d8000d]" />
                  {intro.email}
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-[#d8000d]" />
                  {intro.address}
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-[#d8000d]" />
                  {intro.phone}
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-[#d8000d]" />
                  <a
                    href={intro.whatsappUrl || "#"}
                    className="hover:text-[#d8000d]"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {intro.whatsapp}
                  </a>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MessageCircle className="h-4 w-4" />
                  <span>Live Chat (Coming Soon)</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">{content.form.title}</h3>
              <div className="grid gap-3 md:grid-cols-2">
                <Input placeholder="Your name" />
                <Input placeholder="Phone number" />
              </div>
              <Input placeholder="Your email" />
              <Textarea placeholder="Message" className="min-h-[120px]" />
              <Button className="rounded-full bg-[#d8000d] px-6 text-sm font-semibold text-white">
                {content.form.buttonLabel}
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

    </div>
  );
};

export default Support;
