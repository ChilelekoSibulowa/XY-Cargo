import { MessageCircle } from "lucide-react";
import { useCmsPage } from "@/hooks/useCmsPage";
import { cmsDefaults, CmsSupportData } from "@/content/cmsDefaults";

export const SupportFloatingActions = () => {
  const { data: content } = useCmsPage<CmsSupportData>("support", cmsDefaults.support);
  const intro = { ...cmsDefaults.support.intro, ...(content.intro || {}) };

  const liveChatUrl = intro.liveChatUrl || "/support";
  const whatsappUrl = intro.whatsappUrl || "https://wa.me/260967379139";

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noreferrer"
        className="group flex items-center gap-2 rounded-full bg-[#d8000d] p-2 sm:px-4 sm:py-2 text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
        aria-label="Chat on WhatsApp"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20">
          <MessageCircle className="h-4 w-4" />
        </span>
        <span className="hidden text-xs font-bold sm:inline">Hi, how can I help you?</span>
      </a>
    </div>
  );
};
