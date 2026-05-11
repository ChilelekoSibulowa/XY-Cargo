import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

/**
 * Utility to check if the app is running in PWA/Standalone mode
 */
export const isPwaMode = () => {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.location.search.includes("source=pwa") ||
    (window.navigator as any).standalone === true
  );
};

/**
 * Roles allowed to use the PWA application
 */
export const ALLOWED_PWA_ROLES = ["customer", "agent", "driver"];

/**
 * Enforces PWA role restrictions during login or session changes
 * @returns true if access is denied
 */
export const enforcePwaGate = async (role: string, options?: { silent?: boolean }) => {
  if (isPwaMode() && !ALLOWED_PWA_ROLES.includes(role)) {
    if (!options?.silent) {
      toast.error("Invalid login details.");
    }
    await supabase.auth.signOut({ scope: "local" });
    return true;
  }
  return false;
};
