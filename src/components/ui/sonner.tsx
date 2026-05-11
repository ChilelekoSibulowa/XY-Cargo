import { CheckCircle2, Info, Loader2, TriangleAlert, X, XCircle } from "lucide-react";
import { Toaster as Sonner, toast, type ToasterProps } from "sonner";

const baseIconClassName = "h-4 w-4";

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="system"
      position="top-right"
      expand
      closeButton
      visibleToasts={5}
      offset={16}
      mobileOffset={{ top: 12, bottom: 12, left: 12, right: 12 }}
      className="toaster group"
      icons={{
        success: <CheckCircle2 className={`${baseIconClassName} text-emerald-600`} />,
        error: <XCircle className={`${baseIconClassName} text-red-600`} />,
        warning: <TriangleAlert className={`${baseIconClassName} text-amber-600`} />,
        info: <Info className={`${baseIconClassName} text-blue-600`} />,
        loading: <Loader2 className={`${baseIconClassName} animate-spin text-primary`} />,
        close: <X className="h-3.5 w-3.5" />,
      }}
      toastOptions={{
        duration: 4200,
        classNames: {
          toast:
            "group toast group-[.toaster]:border-border/70 group-[.toaster]:bg-card/95 group-[.toaster]:text-card-foreground group-[.toaster]:shadow-[0_14px_40px_-22px_rgba(15,23,42,0.45)] group-[.toaster]:backdrop-blur-md group-[.toaster]:rounded-2xl group-[.toaster]:px-4 group-[.toaster]:py-3 group-[.toaster]:gap-3 relative overflow-hidden before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-primary/80",
          title: "text-sm font-semibold leading-5 tracking-tight",
          description: "text-xs leading-5 text-muted-foreground",
          content: "gap-1",
          icon: "rounded-full bg-muted/70 p-1.5",
          closeButton:
            "group-[.toast]:bg-background group-[.toast]:border-border group-[.toast]:text-muted-foreground group-[.toast]:hover:text-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-md group-[.toast]:text-xs group-[.toast]:h-8 group-[.toast]:px-3",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-md group-[.toast]:text-xs group-[.toast]:h-8 group-[.toast]:px-3",
          success: "before:bg-emerald-500",
          error: "before:bg-red-500",
          warning: "before:bg-amber-500",
          info: "before:bg-blue-500",
          loading: "before:bg-primary",
          default: "before:bg-brand",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
