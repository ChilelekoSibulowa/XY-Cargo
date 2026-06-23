import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  createLink?: string;
  createLabel?: string;
  backLink?: string;
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeader = ({
  title,
  subtitle,
  createLink,
  createLabel = "Create New",
  backLink,
  actions,
  className,
}: PageHeaderProps) => {
  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-center justify-between mb-8 pb-4 border-b border-border/40 gap-4", className)}>
      <div className="flex items-center gap-3">
        {backLink && (
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full border hover:bg-muted/50 transition-all" asChild>
            <Link to={backLink}>
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
        )}
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-foreground tracking-tight whitespace-nowrap">
            {title}
          </h1>
        </div>
      </div>

      <div className="flex items-center flex-wrap gap-2">
        {actions}
        {createLink && (
          <Button size="sm" className="h-9 px-4 font-medium shadow-sm transition-all hover:scale-[1.01]" asChild>
            <Link to={createLink}>
              <Plus className="w-4 h-4 mr-1.5" />
              {createLabel}
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
};
