import { useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  fallbackSrc?: string;
  aspectRatio?: "video" | "square" | "auto" | "portrait" | "banner";
  showSkeleton?: boolean;
  containerClassName?: string;
  priority?: boolean; // Load immediately without lazy loading
}

export const OptimizedImage = ({
  src,
  alt,
  fallbackSrc = "/placeholder.svg",
  aspectRatio = "auto",
  showSkeleton = true,
  containerClassName,
  className,
  priority = false,
  ...props
}: OptimizedImageProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [imageSrc, setImageSrc] = useState<string>(src);

  // Update src when prop changes
  useEffect(() => {
    setImageSrc(src);
    setHasError(false);
    setIsLoading(true);
  }, [src]);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleError = useCallback(() => {
    setHasError(true);
    setImageSrc(fallbackSrc);
    setIsLoading(false);
  }, [fallbackSrc]);

  const aspectClasses = {
    video: "aspect-video",
    square: "aspect-square",
    portrait: "aspect-[3/4]",
    banner: "aspect-[21/9]",
    auto: "",
  };

  return (
    <div className={cn("relative overflow-hidden", aspectClasses[aspectRatio], containerClassName)}>
      {showSkeleton && isLoading && !priority && (
        <Skeleton className="absolute inset-0 z-10" />
      )}
      <img
        src={hasError ? fallbackSrc : imageSrc}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding={priority ? "sync" : "async"}
        fetchPriority={priority ? "high" : "auto"}
        onLoad={handleLoad}
        onError={handleError}
        className={cn(
          "h-full w-full object-cover",
          !priority && "transition-opacity duration-200",
          (isLoading && !priority) ? "opacity-0" : "opacity-100",
          className
        )}
        {...props}
      />
    </div>
  );
};
