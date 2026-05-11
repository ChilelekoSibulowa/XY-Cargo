import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, RotateCcw, Home, X, Loader2 } from "lucide-react";
import { isPwaMode } from "@/lib/pwaUtils";
import { cn } from "@/lib/utils";

interface AppControllersProps {
  children: React.ReactNode;
}

export const AppControllers = ({ children }: AppControllersProps) => {
  const isPwa = isPwaMode();
  const navigate = useNavigate();
  const location = useLocation();
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const PULL_THRESHOLD = 90;

  useEffect(() => {
    if (!isPwa) return;

    const handleTouchStart = (e: TouchEvent) => {
      const scrollPos = window.scrollY || document.documentElement.scrollTop;
      if (scrollPos <= 0) {
        startY.current = e.touches[0].pageY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (startY.current === 0 || isRefreshing) return;

      const currentY = e.touches[0].pageY;
      const diff = currentY - startY.current;

      if (diff > 0) {
        if (diff > 10 && e.cancelable) {
          // e.preventDefault(); 
        }
        const distance = Math.min(diff * 0.4, PULL_THRESHOLD + 20);
        setPullDistance(distance);
      }
    };

    const handleTouchEnd = () => {
      if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
        setIsRefreshing(true);
        setTimeout(() => window.location.reload(), 400);
      }
      setPullDistance(0);
      startY.current = 0;
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd);

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isPwa, pullDistance, isRefreshing]);

  if (!isPwa) return <>{children}</>;

  return (
    <div className="relative min-h-screen">
      {/* Refined Pull-to-refresh Indicator */}
      <div 
        className={cn(
          "fixed top-0 left-0 right-0 z-[100] flex justify-center pointer-events-none transition-all duration-200",
          pullDistance > 0 || isRefreshing ? "opacity-100" : "opacity-0"
        )}
        style={{ transform: `translateY(${pullDistance - 50}px)` }}
      >
        <div className="bg-white rounded-full shadow-2xl p-2.5 border border-slate-100 flex items-center gap-2">
          <RotateCcw 
            className={cn(
              "h-5 w-5 text-red-600 transition-transform",
              isRefreshing ? "animate-spin" : ""
            )}
            style={{ transform: !isRefreshing ? `rotate(${pullDistance * 3}deg)` : undefined }}
          />
          {pullDistance >= PULL_THRESHOLD && !isRefreshing && (
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter pr-1">Release to refresh</span>
          )}
        </div>
      </div>

      {/* Main Content with resistance effect */}
      <div 
        className="transition-transform duration-200"
        style={{ transform: pullDistance > 0 ? `translateY(${pullDistance * 0.5}px)` : 'none' }}
      >
        {children}
      </div>

      {/* Floating Navigation Controllers - Premium Style */}
      <div className="fixed bottom-8 right-6 z-[100] flex flex-col gap-3.5 items-center">
        {/* Back Button */}
        {location.pathname !== "/" && location.pathname !== "/login" && (
          <button
            onClick={() => navigate(-1)}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-2xl border border-slate-100 text-slate-700 active:scale-90 transition-all hover:bg-slate-50 group"
            title="Go Back"
          >
            <ArrowLeft className="h-5 w-5 transition-transform group-hover:-translate-x-0.5" />
          </button>
        )}

        {/* Refresh / Home Hybrid */}
        <button
          onClick={() => {
            if (window.scrollY > 500) {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
              navigate("/");
            }
          }}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-2xl border border-slate-100 text-slate-700 active:scale-90 transition-all hover:bg-slate-50 group"
          title="Home or Top"
        >
          <Home className="h-5 w-5 transition-transform group-hover:scale-110" />
        </button>

        {/* Global Close / Dismiss - Very prominent as requested */}
        <button
          onClick={() => {
            // If we are in a sub-route, go to parent or home
            const parts = location.pathname.split('/').filter(Boolean);
            if (parts.length > 1) {
              navigate(`/${parts[0]}/dashboard`);
            } else {
              navigate("/");
            }
          }}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 shadow-2xl text-white active:scale-90 transition-all hover:bg-black group border-4 border-white"
          title="Cancel / Close"
        >
          <X className="h-6 w-6 transition-transform group-hover:rotate-90" />
        </button>
      </div>
    </div>
  );
};
