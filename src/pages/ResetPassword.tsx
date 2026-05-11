import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/layout/Logo";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setSessionReady(true);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setIsSaving(true);
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      toast.error(error.message || "Failed to reset password.");
      setIsSaving(false);
      return;
    }

    toast.success("Password updated. Please sign in with your new password.");
    await supabase.auth.signOut();
    setIsSaving(false);
    navigate("/login", { replace: true });
  };

  if (!sessionReady) {
    return (
      <div className="py-12 md:py-24 px-4 sm:px-6 flex items-center justify-center bg-muted/30">
        <div className="w-full max-w-[420px] space-y-8 text-center">
          <div className="flex flex-col items-center justify-center space-y-6">
            <div className="rounded-2xl border border-border/50 bg-background/80 p-5 shadow-sm backdrop-blur-sm">
              <Logo className="[&_span]:text-foreground" />
            </div>
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Verifying your reset link…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-12 md:py-24 px-4 sm:px-6 flex items-center justify-center bg-muted/30">
      <div className="w-full max-w-[420px] space-y-8">
        <div className="flex flex-col items-center justify-center space-y-6">
          <div className="rounded-2xl border border-border/50 bg-background/80 p-5 shadow-sm backdrop-blur-sm">
            <Logo className="[&_span]:text-foreground" />
          </div>
          <div className="space-y-2 text-center">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Reset password</h1>
            <p className="text-sm text-muted-foreground">Set a new password for your account</p>
          </div>
        </div>

        <Card className="border-border/40 bg-background shadow-xl">
          <CardContent className="space-y-6 p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2.5">
                <Label htmlFor="password">New Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Use at least 6 characters"
                  className="h-12 px-4 rounded-xl bg-muted/40"
                  minLength={6}
                  required
                />
              </div>

              <div className="space-y-2.5">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Re-enter your password"
                  className="h-12 px-4 rounded-xl bg-muted/40"
                  minLength={6}
                  required
                />
              </div>

              <Button type="submit" className="h-12 w-full rounded-xl text-base font-medium" disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                Save New Password
              </Button>
            </form>

            <div className="border-t border-border/50 pt-6 text-center">
              <Button variant="outline" asChild className="h-12 w-full rounded-xl border-dashed">
                <Link to="/login">Back to Sign In</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ResetPassword;
