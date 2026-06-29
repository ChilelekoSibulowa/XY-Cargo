import { Sparkles } from "lucide-react";
import { useCmsPage } from "@/hooks/useCmsPage";
import { cmsDefaults, CmsSupportData } from "@/content/cmsDefaults";

export const SupportFloatingActions = () => {
  const { data: content } = useCmsPage<CmsSupportData>("support", cmsDefaults.support);
  const intro = { ...cmsDefaults.support.intro, ...(content.intro || {}) };

  const whatsappUrl = intro.whatsappUrl || "https://wa.me/260967379139";

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noreferrer"
        className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-[#d8000d] via-[#ff3b30] to-[#ff6b6b] text-white shadow-lg shadow-red-500/40 border border-white/10 transition-all duration-300 hover:scale-110"
        aria-label="Chat on WhatsApp"
      >
        {/* Pulsing Outer Glow */}
        <span className="absolute -inset-1 rounded-full bg-[#d8000d]/30 opacity-70 blur-md group-hover:opacity-100 transition-all duration-300 animate-pulse" />

        {/* Inner Circle Content */}
        <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-slate-950/80 backdrop-blur-sm border border-white/10 group-hover:bg-slate-900 transition-colors">
          <Sparkles className="h-5 w-5 text-white animate-pulse" />
        </span>

        {/* Floating Tooltip */}
        <span className="absolute right-16 top-1/2 -translate-y-1/2 scale-75 opacity-0 origin-right transition-all duration-300 group-hover:scale-100 group-hover:opacity-100 bg-slate-950/90 text-white text-[10px] font-bold tracking-wider uppercase py-1.5 px-3 rounded-full border border-white/10 whitespace-nowrap shadow-xl">
          AI Assistant
        </span>
      </a>
    </div>
  );
};
