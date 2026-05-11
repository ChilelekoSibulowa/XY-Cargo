import { useState, useEffect } from "react";
import { Bell, X, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { isPwaMode } from "@/lib/pwaUtils";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const VAPID_PUBLIC_KEY = "BE7ZS4Fa4y71f1xrOp_zO9jKC6y-Hmpmf2zCs6vNAeaILDqITR9rCYiahT_dk_IDuZz9iblH_8NcaSbNXcC1If4";

export const PushNotificationPrompt = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>("default");

  useEffect(() => {
    const checkStatus = async () => {
      // 1. Detect mobile device vs desktop
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      // Only show popup on mobile devices (web or app), never on desktop
      if (!isMobile) {
        setIsVisible(false);
        return;
      }

      // 2. Check if browser supports push
      if (!("Notification" in window) || !("serviceWorker" in navigator)) {
        setIsSupported(false);
        return;
      }

      setPermissionStatus(Notification.permission);

      // 4. If already granted, no need to show prompt
      if (Notification.permission === "granted") {
        setIsVisible(false);
        return;
      }

      // 5. No need to check DB here - if browser permission isn't granted, we should show the prompt
      // to let the user enable it locally.

      // Show almost immediately after all checks pass
      const timer = setTimeout(() => setIsVisible(true), 800);
      return () => clearTimeout(timer);
    };

    checkStatus();
  }, []);

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const subscribeUser = async () => {
    setIsSubscribing(true);
    try {
      const permission = await Notification.requestPermission();
      setPermissionStatus(permission);
      
      if (permission !== "granted") {
        throw new Error("Permission not granted");
      }

      const registration = await navigator.serviceWorker.ready;
      
      // Subscribe
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Save to database
      const { error } = await supabase.from("push_subscriptions").upsert({
        user_id: user.id,
        endpoint: subscription.endpoint,
        p256dh: btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey("p256dh")!) as any)),
        auth: btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey("auth")!) as any)),
        user_agent: navigator.userAgent,
      }, { onConflict: 'endpoint' });

      if (error) throw error;

      toast.success("Notifications enabled! You'll receive updates instantly.");
      setIsVisible(false);
    } catch (err: any) {
      console.error("Subscription failed:", err);
      if (err.message === "Permission not granted") {
        toast.error("Please allow notifications in your device settings.");
      } else {
        toast.error("Failed to enable notifications. Please try again later.");
      }
      // If permission is denied, the UI will update to show the blocked message
    } finally {
      setIsSubscribing(false);
    }
  };

  const dismiss = () => {
    setIsVisible(false);
    sessionStorage.setItem("push-prompt-dismissed", "true");
  };

  if (!isVisible || !isSupported) return null;

  const isBlocked = permissionStatus === "denied";

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-full max-w-sm px-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 flex flex-col gap-4">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Bell className={cn("h-6 w-6 text-primary", !isBlocked && "animate-bounce")} />
          </div>
          <div className="flex-1 space-y-1">
            <h3 className="font-bold text-sm font-jakarta">
              {isBlocked ? "Notifications Blocked" : "Stay Updated!"}
            </h3>
            <p className="text-xs text-muted-foreground font-jakarta leading-relaxed">
              {isBlocked 
                ? "Please enable notifications in your device or app settings to receive tracking updates."
                : "Enable push notifications to receive instant tracking updates and exclusive offers."}
            </p>
          </div>
          <button onClick={dismiss} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        
        {!isBlocked && (
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1 h-9 text-xs font-jakarta rounded-lg"
              onClick={dismiss}
            >
              Not Now
            </Button>
            <Button 
              size="sm" 
              className="flex-1 h-9 text-xs font-jakarta rounded-lg shadow-lg shadow-primary/20"
              onClick={subscribeUser}
              disabled={isSubscribing}
            >
              {isSubscribing ? (
                <Loader2 className="h-3 w-3 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="h-3 w-3 mr-2" />
              )}
              Enable Now
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
