import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { hasSupabaseEnv, supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Eye, EyeOff, Loader2, ShieldCheck, UsersRound, Mail } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { getRoleLandingRoute } from "@/lib/portalLanding";
import { enforcePwaGate } from "@/lib/pwaUtils";
import { writeDashboardAuthSnapshot } from "@/lib/dashboardSessionCache";

const AUTH_CONFIG_ERROR =
  "Authentication is not configured in this environment. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to your .env file.";

declare global {
  interface Window {
    grecaptcha?: {
      ready: (callback: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

const getEdgeFunctionErrorMessage = (message: string | undefined, fallback: string) => {
  const normalized = (message || "").toLowerCase();
  if (normalized.includes("failed to send a request to the edge function")) {
    return "Password reset email is not available yet. Deploy the send-email edge function and set the Resend secrets first.";
  }
  return message || fallback;
};

const Login = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [recaptchaSiteKey, setRecaptchaSiteKey] = useState<string | null>(null);
  const navigate = useNavigate();

  // Load reCAPTCHA v3 site key + script
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.functions.invoke("verify-recaptcha", { method: "GET" } as any);
        const key = (data as any)?.site_key;
        if (cancelled || !key) return;
        setRecaptchaSiteKey(key);
        if (document.getElementById("recaptcha-v3-script")) return;
        const script = document.createElement("script");
        script.id = "recaptcha-v3-script";
        script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(key)}`;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const executeRecaptcha = async (): Promise<string | null> => {
    if (!recaptchaSiteKey || !window.grecaptcha) return null;
    return await new Promise((resolve) => {
      window.grecaptcha!.ready(async () => {
        try {
          const token = await window.grecaptcha!.execute(recaptchaSiteKey, { action: "login" });
          resolve(token);
        } catch {
          resolve(null);
        }
      });
    });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!hasSupabaseEnv) {
      toast.error(AUTH_CONFIG_ERROR);
      return;
    }

    setIsLoading(true);

    // Verify reCAPTCHA v3 if configured
    if (recaptchaSiteKey) {
      const token = await executeRecaptcha();
      if (!token) {
        toast.error("Could not verify you are human. Please refresh and try again.");
        setIsLoading(false);
        return;
      }
      try {
        const { data: verify } = await supabase.functions.invoke("verify-recaptcha", {
          body: { token, action: "login" },
        });
        if (verify && (verify as any).success === false) {
          toast.error("reCAPTCHA verification failed. Please try again.");
          setIsLoading(false);
          return;
        }
      } catch {
        // Fail open if verification call errors out, but log
        console.warn("reCAPTCHA verification skipped due to network error.");
      }
    }

    const normalizedEmail = email.trim().toLowerCase();

    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      toast.error(error.message);
      setIsLoading(false);
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const userId = session?.user?.id;

    if (!userId) {
      navigate("/customer/dashboard", { replace: true });
      setIsLoading(false);
      return;
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const roleOrder = ["admin", "staff", "branch_manager", "agent", "driver", "customer"];
    const userRoles = (roles || []).map((role) => role.role as string);
    const highestRole = roleOrder.find((role) => userRoles.includes(role)) || "customer";

    // PWA Role Restriction: Only Customers, Agents, and Drivers
    if (await enforcePwaGate(highestRole)) {
      setIsLoading(false);
      return;
    }

    let assignedPortals: string[] = [];
    if (highestRole === "staff" || highestRole === "branch_manager") {
      const { data: assignments } = await supabase
        .from("staff_portal_assignments")
        .select("portal_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });
      assignedPortals = (assignments || []).map((item) => item.portal_id);
    }

    const destination = (location.state as { from?: string } | undefined)?.from;
    // Store session info for dashboard layout initialization
    writeDashboardAuthSnapshot(session.user, highestRole);

    // Re-prompt push notification opt-in on each successful login (PWA mode)
    try { sessionStorage.removeItem("push-prompt-dismissed"); } catch { /* noop */ }

    navigate(destination || getRoleLandingRoute(highestRole, assignedPortals), { replace: true });
    setIsLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!hasSupabaseEnv) {
      toast.error(AUTH_CONFIG_ERROR);
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      toast.error("Enter your email first, then click Forgot password.");
      return;
    }

    setIsSendingReset(true);
    const { error } = await supabase.functions.invoke("send-email", {
      body: {
        mode: "password_reset",
        email: trimmedEmail,
        redirectTo: `https://xycargozm.com/reset-password`,
      },
    });

    if (error) {
      toast.error(getEdgeFunctionErrorMessage(error.message, "Failed to send reset link."));
    } else {
      toast.success("Password reset link sent. Check your email.");
    }
    setIsSendingReset(false);
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-white">
      {/* Left Side: Brand Panel (Desktop Only) */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[60%] relative bg-slate-900 overflow-hidden">
        <div className="absolute inset-0 bg-[#d8000d]/10 z-10" />
        <img
          src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=2070&auto=format&fit=crop"
          alt="Logistics Background"
          className="absolute inset-0 w-full h-full object-cover opacity-60 scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent z-20" />

        <div className="relative z-30 flex flex-col justify-between p-12 lg:p-20 h-full w-full">
          <div className="flex items-center gap-3">
            <div className="bg-white p-2 rounded-xl shadow-lg">
              <Logo className="[&_span]:hidden" />
            </div>
            <span className="text-2xl font-extrabold text-white tracking-tight">XY Cargo Zambia</span>
          </div>

          <div className="space-y-6">
            <h2 className="text-4xl lg:text-7xl font-extrabold text-white leading-[1.1] tracking-tight">
              Fast, Reliable & <br />
              <span className="text-[#d8000d]">Professional Logistics</span>
            </h2>
            <p className="text-xl text-slate-300 max-w-lg leading-relaxed font-medium">
              Access your personalized dashboard to track shipments, manage your logistics pipeline, and grow your business with Zambia's leading freight partner.
            </p>
          </div>

          <div className="flex items-center gap-8 text-sm font-medium text-slate-400">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-[#d8000d]" />
              <span>Real-time Tracking</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-[#d8000d]" />
              <span>Secure Payments</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-[#d8000d]" />
              <span>24/7 Support</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side: Login Section */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-12 lg:p-20 bg-white lg:bg-white">
        <div className="w-full max-w-[480px]">
          {/* Desktop Layout: Direct Form */}
          <div className="hidden lg:block space-y-10">
            <div className="space-y-2">
              <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">Sign In</h1>
              <p className="text-lg text-slate-500 font-medium">Please enter your credentials to access your dashboard.</p>
            </div>
            
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email-desktop" className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <Input
                    id="email-desktop"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="h-14 px-12 rounded-2xl bg-slate-50 border-slate-100 focus:bg-white focus:ring-2 focus:ring-[#d8000d]/10 transition-all text-base font-medium"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password-desktop" className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Password</Label>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={isSendingReset}
                    className="text-[10px] font-bold text-[#d8000d] hover:underline disabled:opacity-50"
                  >
                    {isSendingReset ? "Sending..." : "Forgot password?"}
                  </button>
                </div>
                <div className="relative">
                  <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <Input
                    id="password-desktop"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="h-14 px-12 pr-14 rounded-2xl bg-slate-50 border-slate-100 focus:bg-white focus:ring-2 focus:ring-[#d8000d]/10 transition-all text-base font-medium"
                    required
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-0 flex items-center px-4 text-slate-400 hover:text-slate-900 transition-colors"
                    onClick={() => setShowPassword((prev) => !prev)}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="h-14 w-full rounded-2xl bg-[#d8000d] hover:bg-[#bf000c] text-lg font-bold text-white shadow-xl shadow-[#d8000d]/20 transition-all active:scale-[0.98] mt-4" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                Access Dashboard
              </Button>
            </form>

            <div className="pt-2 text-center space-y-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-100"></span></div>
                <div className="relative flex justify-center text-[10px] font-bold uppercase tracking-widest"><span className="bg-slate-50/30 px-4 text-slate-400">Join XY Cargo</span></div>
              </div>

              <Button variant="ghost" asChild className="h-12 w-full rounded-2xl text-sm font-bold text-[#d8000d] hover:bg-slate-50 transition-colors">
                <Link to="/register">
                  New customer? Create an account
                </Link>
              </Button>
            </div>
          </div>

          {/* Mobile/Tablet Layout: Widget Layout (Card) */}
          <div className="lg:hidden w-full">
            <Card className="border-none shadow-2xl shadow-slate-200/50 rounded-[2rem] overflow-hidden bg-white">
              {/* Form Top Design */}
              <div className="h-48 relative overflow-hidden group">
                <img
                  src="https://images.unsplash.com/photo-1578575437130-527eed3abbec?q=80&w=2070&auto=format&fit=crop"
                  alt="Shipping"
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-white via-white/20 to-transparent" />
                <div className="absolute bottom-6 left-8 flex items-center gap-3">
                  <div className="bg-white p-2 rounded-xl shadow-xl">
                    <Logo className="[&_span]:hidden" />
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-900 tracking-tight leading-none">XY Cargo</h2>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-1">Zambia Portal</p>
                  </div>
                </div>
              </div>

              <CardContent className="p-8 md:p-10 space-y-8">
                <div className="space-y-2">
                  <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Sign In</h1>
                  <p className="text-sm text-slate-500 font-medium">Please enter your credentials to access your dashboard.</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="email-mobile" className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                      <Input
                        id="email-mobile"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@company.com"
                        className="h-14 px-12 rounded-2xl bg-slate-50 border-slate-100 focus:bg-white focus:ring-2 focus:ring-[#d8000d]/10 transition-all text-base font-medium"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password-mobile" className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Password</Label>
                      <button
                        type="button"
                        onClick={handleForgotPassword}
                        disabled={isSendingReset}
                        className="text-[10px] font-bold text-[#d8000d] hover:underline disabled:opacity-50"
                      >
                        {isSendingReset ? "Sending..." : "Forgot password?"}
                      </button>
                    </div>
                    <div className="relative">
                      <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                      <Input
                        id="password-mobile"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="h-14 px-12 pr-14 rounded-2xl bg-slate-50 border-slate-100 focus:bg-white focus:ring-2 focus:ring-[#d8000d]/10 transition-all text-base font-medium"
                        required
                      />
                      <button
                        type="button"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        className="absolute inset-y-0 right-0 flex items-center px-4 text-slate-400 hover:text-slate-900 transition-colors"
                        onClick={() => setShowPassword((prev) => !prev)}
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  <Button type="submit" className="h-14 w-full rounded-2xl bg-[#d8000d] hover:bg-[#bf000c] text-lg font-bold text-white shadow-xl shadow-[#d8000d]/20 transition-all active:scale-[0.98] mt-4" disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                    Access Dashboard
                  </Button>
                </form>

                <div className="pt-2 text-center space-y-6">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-100"></span></div>
                    <div className="relative flex justify-center text-[10px] font-bold uppercase tracking-widest"><span className="bg-white px-4 text-slate-400">Join XY Cargo</span></div>
                  </div>

                  <Button variant="ghost" asChild className="h-12 w-full rounded-2xl text-sm font-bold text-[#d8000d] hover:bg-slate-50 transition-colors">
                    <Link to="/register">
                      New customer? Create an account
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
          {!hasSupabaseEnv ? (
            <p className="text-xs font-medium text-destructive text-center mt-6">{AUTH_CONFIG_ERROR}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default Login;
