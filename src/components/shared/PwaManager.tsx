import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { WifiOff } from "lucide-react";
import { isPwaMode } from "@/lib/pwaUtils";
import { subscribeToPushNotifications } from "@/lib/pushNotifications";
import { supabase } from "@/integrations/supabase/client";

import { AppControllers } from "./AppControllers";

export const PwaManager = ({ children }: { children: React.ReactNode }) => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const location = useLocation();
  const navigate = useNavigate();
  const isPwa = isPwaMode();

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isPwa, location.pathname, navigate]);

  // Only show offline overlay if in PWA mode
  if (isPwa && isOffline) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background p-6 text-center animate-in fade-in duration-300">
        <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mb-6">
          <WifiOff className="w-10 h-10 text-red-600" />
        </div>
        <h1 className="text-2xl font-bold mb-2">No Internet Connection</h1>
        <p className="text-muted-foreground max-w-xs mx-auto mb-8">
          XY Cargo requires an internet connection to track your shipments and manage your portal.
        </p>
        <button 
          onClick={() => window.location.reload()}
          className="px-8 py-3 bg-primary text-white rounded-lg font-semibold hover:opacity-90 transition-opacity"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <AppControllers>
      {children}
    </AppControllers>
  );
};
