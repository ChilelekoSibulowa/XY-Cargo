import { cn } from "@/lib/utils";
import { LogoImage } from "@/components/shared/LogoImage";

interface LogoProps {
  collapsed?: boolean;
  className?: string;
}

export const Logo = ({ collapsed = false, className = "" }: LogoProps) => {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <LogoImage size="lg" />
      {!collapsed && (
        <span className="font-bold text-lg text-sidebar-foreground">
          Xy Cargo
        </span>
      )}
    </div>
  );
};
