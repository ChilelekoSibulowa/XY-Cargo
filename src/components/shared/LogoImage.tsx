import { useState } from "react";
import { cn } from "@/lib/utils";
import { useLogo } from "@/hooks/useLogo";
import { Skeleton } from "@/components/ui/skeleton";
import logoImage from "@/assets/logo.png";

interface LogoImageProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  showFallbackIcon?: boolean;
}

const sizeClasses = {
  sm: "h-6 w-6",
  md: "h-8 w-8",
  lg: "h-10 w-10",
  xl: "h-14 w-14",
  "2xl": "h-16 w-16",
};

export const LogoImage = ({ className, size = "md", showFallbackIcon = true }: LogoImageProps) => {
  const { logoUrl, isLoading } = useLogo();
  const [imgLoading, setImgLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  
  // Use uploaded logo as primary, fall back to remote logo URL
  const primaryLogo = logoImage;

  const handleLoad = () => setImgLoading(false);
  const handleError = () => {
    setHasError(true);
    setImgLoading(false);
  };

  if (imgLoading) {
    return (
      <div className={cn("relative", sizeClasses[size], className)}>
        <Skeleton className="absolute inset-0 rounded-full" />
        <img
          src={primaryLogo}
          alt="Logo"
          onLoad={handleLoad}
          onError={handleError}
          className="h-full w-full object-contain opacity-0"
        />
      </div>
    );
  }

  if (hasError && showFallbackIcon) {
    return (
      <div className={cn("flex items-center justify-center rounded-full bg-primary text-primary-foreground", sizeClasses[size], className)}>
        <svg viewBox="0 0 100 100" className="h-3/4 w-3/4" fill="none">
          <path
            d="M25 85 L25 20 L55 20 Q75 20 75 40 Q75 60 55 60 L40 60 L40 85 Z M40 35 L40 50 L52 50 Q60 50 60 42.5 Q60 35 52 35 Z"
            fill="currentColor"
          />
          <path d="M30 55 Q50 80 85 25 L90 20 Q55 70 30 55 Z" fill="currentColor" />
        </svg>
      </div>
    );
  }

  return (
    <img
      src={hasError ? logoUrl : primaryLogo}
      alt="Company Logo"
      className={cn("object-contain transition-opacity duration-200", sizeClasses[size], className)}
    />
  );
};
