import { useState, useEffect, useRef } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export const PullToRefresh = ({ children }: { children: React.ReactNode }) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startYRef = useRef(0);
  const pullDistanceRef = useRef(0);
  const isRefreshingRef = useRef(false);
  const isPullingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const pullThreshold = 80; // Higher threshold for more deliberate action

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      // Find the actual scrollable container (either the ref itself or its parent)
      const scrollContainer = containerRef.current?.parentElement || containerRef.current;
      
      if (scrollContainer && scrollContainer.scrollTop <= 0) {
        startYRef.current = e.touches[0].pageY;
        isPullingRef.current = true;
      } else {
        startYRef.current = 0;
        isPullingRef.current = false;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPullingRef.current || isRefreshingRef.current || startYRef.current === 0) return;

      const currentY = e.touches[0].pageY;
      const diff = currentY - startYRef.current;

      // Only handle downward pulls (diff > 0)
      if (diff > 20) { // Increased dead-zone to 20px
        const distance = Math.min(diff * 0.3, pullThreshold + 10);
        pullDistanceRef.current = distance;
        setPullDistance(distance);
        
        // Prevent native browser pull-to-refresh
        if (e.cancelable) {
          e.preventDefault();
        }
      } else if (diff < 0) {
        // If user pulls up, cancel the pulling state to allow normal scrolling
        isPullingRef.current = false;
        setPullDistance(0);
        pullDistanceRef.current = 0;
      }
    };

    const handleTouchEnd = () => {
      if (!isPullingRef.current) return;
      
      const distance = pullDistanceRef.current;
      
      if (distance >= pullThreshold) {
        isRefreshingRef.current = true;
        setIsRefreshing(true);
        // Standard reload
        window.location.reload();
      } else {
        setPullDistance(0);
        pullDistanceRef.current = 0;
      }
      
      startYRef.current = 0;
      isPullingRef.current = false;
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener("touchstart", handleTouchStart, { passive: true });
      container.addEventListener("touchmove", handleTouchMove, { passive: false });
      container.addEventListener("touchend", handleTouchEnd);
      container.addEventListener("touchcancel", handleTouchEnd);
    }

    return () => {
      if (container) {
        container.removeEventListener("touchstart", handleTouchStart);
        container.removeEventListener("touchmove", handleTouchMove);
        container.removeEventListener("touchend", handleTouchEnd);
        container.removeEventListener("touchcancel", handleTouchEnd);
      }
    };
  }, []);

  return (
    <div ref={containerRef} className="relative min-h-full">
      <div 
        className={cn(
          "absolute top-0 left-0 right-0 flex justify-center items-center pointer-events-none transition-opacity duration-150",
          pullDistance > 10 ? "opacity-100" : "opacity-0"
        )}
        style={{ 
          height: `${pullThreshold}px`, 
          transform: `translateY(${Math.min(pullDistance - pullThreshold, 0)}px)`,
          zIndex: 50
        }}
      >
        <div className="bg-white dark:bg-slate-800 rounded-full p-2 shadow-lg border border-border"
             style={{ transform: `scale(${Math.min(pullDistance / pullThreshold, 1)})` }}>
          <RefreshCw className={cn("w-5 h-5 text-primary", isRefreshing && "animate-spin")} />
        </div>
      </div>
      <div 
        className="transition-transform duration-150 ease-out"
        style={{ transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : 'none' }}
      >
        {children}
      </div>
    </div>
  );
};
