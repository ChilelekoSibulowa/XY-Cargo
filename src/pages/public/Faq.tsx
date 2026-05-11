import { useState } from "react";
import { Plus, Minus } from "lucide-react";
import { useCmsPage } from "@/hooks/useCmsPage";
import { cmsDefaults, CmsFaqData } from "@/content/cmsDefaults";

const Faq = () => {
  const { data: content } = useCmsPage<CmsFaqData>("faq", cmsDefaults.faq);
  const [openIndex, setOpenIndex] = useState(0);

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

      <section className="mx-auto flex max-w-4xl flex-col gap-4 px-6 py-12">
        {content.faqs.map((faq, index) => {
          const isOpen = openIndex === index;
          return (
            <div key={faq.question} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? -1 : index)}
                className={`flex w-full items-center justify-between px-5 py-4 text-left text-sm font-semibold ${
                  isOpen ? "bg-[#d8000d] text-white" : "text-slate-900"
                }`}
              >
                <span>{faq.question}</span>
                <span className={`flex h-8 w-8 items-center justify-center rounded ${isOpen ? "bg-white text-[#d8000d]" : "bg-[#d8000d] text-white"}`}>
                  {isOpen ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                </span>
              </button>
              {isOpen && (
                <div className="px-5 py-4 text-xs text-slate-600">{faq.answer}</div>
              )}
            </div>
          );
        })}
      </section>

    </div>
  );
};

export default Faq;



