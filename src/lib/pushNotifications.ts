import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const VAPID_PUBLIC_KEY = "BE7ZS4Fa4y71f1xrOp_zO9jKC6y-Hmpmf2zCs6vNAeaILDqITR9rCYiahT_dk_IDuZz9iblH_8NcaSbNXcC1If4";

/**
 * Converts a base64 string to a Uint8Array
 */
function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Requests permission and subscribes the user to push notifications
 */
export async function subscribeToPushNotifications() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.warn("Push notifications are not supported by this browser.");
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    
    // Check if already subscribed
    let subscription = await registration.pushManager.getSubscription();
    
    if (!subscription) {
      // Request permission
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        console.warn("Notification permission denied.");
        return;
      }

      // Subscribe
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    // Save to database
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const subscriptionData = subscription.toJSON();
    if (!subscriptionData.endpoint || !subscriptionData.keys) return;

    const { error } = await supabase
      .from("push_subscriptions")
      .upsert({
        user_id: user.id,
        endpoint: subscriptionData.endpoint,
        p256dh: subscriptionData.keys.p256dh,
        auth: subscriptionData.keys.auth,
        user_agent: navigator.userAgent,
      }, { onConflict: 'endpoint' });

    if (error) {
      console.error("Error saving push subscription:", error);
    } else {
      console.log("Successfully subscribed to push notifications.");
    }
  } catch (error) {
    console.error("Failed to subscribe to push notifications:", error);
  }
}
