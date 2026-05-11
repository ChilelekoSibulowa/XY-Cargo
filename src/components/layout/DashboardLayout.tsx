import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Loader2, LogOut, ShieldCheck } from "lucide-react";
import { AppSidebar } from "./AppSidebar";
import { TopBar } from "./TopBar";
import { PushNotificationPrompt } from "@/components/shared/PushNotificationPrompt";
import { supabase } from "@/integrations/supabase/client";
import { AuthProvider } from "@/components/auth/AuthContext";
import { getVerifiedTotpFactor } from "@/lib/authMfa";
import {
  clearDashboardAuthSnapshot,
  readDashboardAuthSnapshot,
  writeDashboardAuthSnapshot,
} from "@/lib/dashboardSessionCache";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isPwaMode, enforcePwaGate } from "@/lib/pwaUtils";
import { cn } from "@/lib/utils";
import { StickyBottomNav } from "./StickyBottomNav";
import { PullToRefresh } from "./PullToRefresh";


const cachedAuthSnapshot = readDashboardAuthSnapshot();

export const DashboardLayout = () => {
  const [isLoading, setIsLoading] = useState(!cachedAuthSnapshot);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [user, setUser] = useState<any>(cachedAuthSnapshot?.user ?? null);
  const [userRole, setUserRole] = useState<string>(cachedAuthSnapshot?.userRole ?? "customer");
  const [isCheckingMfa, setIsCheckingMfa] = useState(!cachedAuthSnapshot);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [isVerifyingMfa, setIsVerifyingMfa] = useState(false);
  const [isSigningOutFromMfa, setIsSigningOutFromMfa] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const hasInitializedAuth = useRef(Boolean(cachedAuthSnapshot));

  const getDisplayRoleLabel = (role: string) => {
    const normalized = (role || "").toLowerCase();
    if (normalized === "agent") return "Agent Portal";
    if (normalized === "customer") return "Customer Portal";
    if (normalized === "driver") return "Driver Portal";
    if (normalized === "branch_manager") return "Branch Manager";
    return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : "User";
  };

  const clearMfaGate = () => {
    setMfaRequired(false);
    setMfaFactorId("");
    setMfaCode("");
    setIsCheckingMfa(false);
  };

  const loadUserRole = async (userId: string) => {
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (!roles || roles.length === 0) {
      return "customer";
    }

    const roleOrder = ["admin", "staff", "branch_manager", "agent", "driver", "customer"];
    const userRoles = roles.map((role) => role.role as string);
    return roleOrder.find((role) => userRoles.includes(role)) || "customer";
  };

  const syncMfaRequirement = async (
    session: any | null,
    options?: { showBlockingLoader?: boolean },
  ) => {
    if (!session) {
      clearMfaGate();
      return;
    }

    if (options?.showBlockingLoader ?? true) {
      setIsCheckingMfa(true);
    }

    const { data: assuranceData, error: assuranceError } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (assuranceError) {
      toast.error(assuranceError.message || "Unable to verify two-factor status.");
      clearMfaGate();
      return;
    }

    const needsMfa =
      assuranceData?.nextLevel === "aal2" && assuranceData?.currentLevel !== "aal2";

    if (!needsMfa) {
      clearMfaGate();
      return;
    }

    const { data: factorData, error: factorError } = await supabase.auth.mfa.listFactors();
    if (factorError) {
      toast.error(factorError.message || "Unable to load your authenticator factor.");
      clearMfaGate();
      return;
    }

    const verifiedFactor = getVerifiedTotpFactor(factorData);
    if (!verifiedFactor) {
      clearMfaGate();
      return;
    }

    setMfaFactorId(verifiedFactor.id);
    setMfaRequired(true);
    setIsCheckingMfa(false);
  };

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        clearDashboardAuthSnapshot();
        navigate("/login", { replace: true, state: { from: location.pathname } });
        return;
      }

      setUser(session.user);

      const highestRole = await loadUserRole(session.user.id);
      setUserRole(highestRole);
      writeDashboardAuthSnapshot(session.user, highestRole);
      await syncMfaRequirement(session, { showBlockingLoader: !cachedAuthSnapshot });
      hasInitializedAuth.current = true;
      setIsLoading(false);
    };

    void checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        clearDashboardAuthSnapshot();
        clearMfaGate();
        navigate("/login", { replace: true });
        return;
      }

      const hasCachedSnapshot = Boolean(readDashboardAuthSnapshot());
      setUser(session.user);

      void (async () => {
        const highestRole = await loadUserRole(session.user.id);

        // PWA Role Failsafe: Redirect and sign out if role is not allowed in App
        if (await enforcePwaGate(highestRole, { silent: true })) {
          navigate("/login", { replace: true });
          return;
        }

        setUserRole(highestRole);
        writeDashboardAuthSnapshot(session.user, highestRole);

        const shouldBlockUi = event === "SIGNED_IN" || (!hasInitializedAuth.current && !hasCachedSnapshot);
        await syncMfaRequirement(session, { showBlockingLoader: shouldBlockUi });

        hasInitializedAuth.current = true;
        setIsLoading(false);
      })();
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  const handleVerifyMfa = async () => {
    if (!mfaFactorId) {
      toast.error("No verified authenticator factor was found for this account.");
      return;
    }

    const code = mfaCode.replace(/\s+/g, "");
    if (code.length !== 6) {
      toast.error("Enter the 6-digit code from Google Authenticator.");
      return;
    }

    setIsVerifyingMfa(true);

    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: mfaFactorId,
      code,
    });

    if (error) {
      toast.error(error.message || "Verification failed.");
      setIsVerifyingMfa(false);
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    await syncMfaRequirement(session);
    toast.success("Two-factor verification complete.");
    setIsVerifyingMfa(false);
  };

  const handleMfaSignOut = async () => {
    if (isSigningOutFromMfa) return;

    setIsSigningOutFromMfa(true);

    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        await supabase.auth.signOut({ scope: "local" });
      }
    } finally {
      clearDashboardAuthSnapshot();
      clearMfaGate();
      navigate("/login", { replace: true });
      setIsSigningOutFromMfa(false);
    }
  };

  if (isLoading || isCheckingMfa) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="space-y-4 w-full max-w-sm px-8">
          <div className="h-4 rounded-full bg-muted animate-pulse" />
          <div className="h-4 rounded-full bg-muted animate-pulse w-3/4" />
          <div className="h-4 rounded-full bg-muted animate-pulse w-1/2" />
          <p className="text-xs text-muted-foreground text-center pt-2">
            {isCheckingMfa ? "Checking security..." : "Loading..."}
          </p>
        </div>
      </div>
    );
  }

  if (mfaRequired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md border-border/70">
          <CardHeader className="space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <CardTitle>Two-Factor Authentication</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter the 6-digit Google Authenticator code to continue to your account.
            </p>
            <div className="space-y-2">
              <Label htmlFor="dashboard-mfa-code">Verification Code</Label>
              <Input
                id="dashboard-mfa-code"
                value={mfaCode}
                onChange={(event) => setMfaCode(event.target.value)}
                placeholder="123456"
                inputMode="numeric"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Signed in as {user?.email || "your account"}.
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleMfaSignOut}
                disabled={isSigningOutFromMfa || isVerifyingMfa}
              >
                {isSigningOutFromMfa ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <LogOut className="mr-2 h-4 w-4" />
                )}
                Sign Out
              </Button>
              <Button
                type="button"
                onClick={handleVerifyMfa}
                disabled={isVerifyingMfa || isSigningOutFromMfa}
              >
                {isVerifyingMfa ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Verify & Continue
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <AuthProvider value={{ user, userRole, isLoading }}>
      <div id="title-bar" className="hidden display-mode-window-controls-overlay:flex" />
      <div className="dashboard-shell min-h-screen flex bg-background">
        <div
          className={`fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm transition-opacity md:hidden ${isSidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          onClick={() => setIsSidebarOpen(false)}
        />
        <div
          className={cn(
            "fixed inset-y-0 left-0 z-[70] w-72 transform transition-all duration-300 md:sticky md:top-0 md:h-screen md:translate-x-0 md:opacity-100 md:visible md:pointer-events-auto",
            isSidebarOpen
              ? "translate-x-0 opacity-100 visible pointer-events-auto"
              : "-translate-x-full opacity-0 invisible pointer-events-none"
          )}
        >
          <AppSidebar
            userName={user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User"}
            userRole={getDisplayRoleLabel(userRole)}
          />
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar onMenuClick={() => setIsSidebarOpen((prev) => !prev)} />
          <main className="flex-1 overflow-auto bg-background px-4 py-8 md:px-8 lg:px-10 pb-mobile-nav md:pb-8">
            <PullToRefresh>
              <div className="max-w-[1600px] mx-auto w-full">
                <Outlet />
              </div>
            </PullToRefresh>
          </main>
          <StickyBottomNav />
        </div>
      </div>
      <PushNotificationPrompt />
    </AuthProvider>
  );
};
