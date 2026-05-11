import { useEffect, useMemo, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  buildTotpEnrollmentUri,
  getPendingTotpFactor,
  getTotpQrImage,
  getVerifiedTotpFactor,
} from "@/lib/authMfa";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type TwoFactorAuthCardProps = {
  portalLabel: string;
  accountLabel?: string | null;
  onEnabledChange?: (enabled: boolean) => Promise<void> | void;
};

const TwoFactorAuthCard = ({
  portalLabel,
  accountLabel,
  onEnabledChange,
}: TwoFactorAuthCardProps) => {
  const [fallbackAccountLabel, setFallbackAccountLabel] = useState("");
  const [isLoadingFactors, setIsLoadingFactors] = useState(true);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [enrollFactorId, setEnrollFactorId] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);

  const hasPendingFactor = Boolean(enrollFactorId);
  const hasPendingEnrollment = Boolean(enrollFactorId && (qrCode || secret));
  const mfaSwitchChecked = mfaEnabled || hasPendingFactor;

  const clearEnrollmentState = () => {
    setEnrollFactorId("");
    setQrCode("");
    setSecret("");
    setVerificationCode("");
  };

  const syncPortalState = async (enabled: boolean) => {
    if (!onEnabledChange) return;

    try {
      await onEnabledChange(enabled);
    } catch (error: any) {
      toast.error(
        error?.message ||
          "Two-factor authentication changed, but the portal profile flag could not be synced.",
      );
    }
  };

  const loadFactors = async () => {
    setIsLoadingFactors(true);

    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      toast.error("Unable to check two-factor status.");
      setIsLoadingFactors(false);
      return;
    }

    const pendingFactor = getPendingTotpFactor(data);
    const verifiedFactor = getVerifiedTotpFactor(data);

    setMfaEnabled(Boolean(verifiedFactor));
    setEnrollFactorId(pendingFactor?.id || "");

    if (!pendingFactor) {
      setQrCode("");
      setSecret("");
      setVerificationCode("");
    }

    setIsLoadingFactors(false);
  };

  useEffect(() => {
    void loadFactors();
  }, []);

  useEffect(() => {
    if (accountLabel?.trim()) {
      setFallbackAccountLabel("");
      return;
    }

    const loadUserLabel = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setFallbackAccountLabel(user?.email || "");
    };

    void loadUserLabel();
  }, [accountLabel]);

  const handleStartEnrollment = async () => {
    if (mfaEnabled || isEnrolling) return;
    setIsEnrolling(true);
    clearEnrollmentState();

    const { data: factorData, error: factorError } = await supabase.auth.mfa.listFactors();
    if (factorError) {
      toast.error(factorError.message || "Unable to prepare Google Authenticator setup.");
      setIsEnrolling(false);
      return;
    }

    const pendingFactors = (factorData?.all || []).filter(
      (factor) => factor.factor_type === "totp" && factor.status === "unverified",
    );

    for (const factor of pendingFactors) {
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
      if (unenrollError) {
        toast.error(unenrollError.message || "Unable to reset the previous authenticator setup.");
        setIsEnrolling(false);
        return;
      }
    }

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `${portalLabel} - Google Authenticator`,
    });

    if (error || !data) {
      toast.error(error?.message || "Failed to start two-factor enrollment.");
      await loadFactors();
      setIsEnrolling(false);
      return;
    }

    setEnrollFactorId(data.id);
    setQrCode(data.totp.qr_code || (data.totp as { uri?: string } | undefined)?.uri || "");
    setSecret(data.totp.secret);
    setIsEnrolling(false);
  };

  const handleVerify = async () => {
    if (!enrollFactorId) {
      toast.error("Start enrollment first.");
      return;
    }

    const code = verificationCode.replace(/\s+/g, "");
    if (code.length !== 6) {
      toast.error("Enter the 6-digit code from Google Authenticator.");
      return;
    }

    setIsVerifying(true);

    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: enrollFactorId,
      code,
    });

    if (error) {
      toast.error(error.message || "Verification failed.");
      setIsVerifying(false);
      return;
    }

    clearEnrollmentState();
    await loadFactors();
    await syncPortalState(true);
    toast.success("Google Authenticator is enabled.");
    setIsVerifying(false);
  };

  const handleDisable = async () => {
    if (isDisabling) return;

    setIsDisabling(true);

    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      toast.error(error.message || "Unable to update two-factor authentication.");
      setIsDisabling(false);
      return;
    }

    const totpFactorIds = (data?.all || [])
      .filter((factor) => factor.factor_type === "totp")
      .map((factor) => factor.id);

    for (const factorId of totpFactorIds) {
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId });
      if (unenrollError) {
        toast.error(unenrollError.message || "Failed to disable Google Authenticator.");
        setIsDisabling(false);
        return;
      }
    }

    clearEnrollmentState();
    setMfaEnabled(false);
    await loadFactors();
    await syncPortalState(false);
    toast.success(
      hasPendingFactor && !mfaEnabled
        ? "Authenticator setup cancelled."
        : "Google Authenticator disabled.",
    );
    setIsDisabling(false);
  };

  const handleToggleMfa = async (checked: boolean) => {
    if (checked) {
      await handleStartEnrollment();
      return;
    }

    await handleDisable();
  };

  const resolvedAccountLabel = accountLabel?.trim() || fallbackAccountLabel || "user";

  const enrollmentUri = useMemo(
    () =>
      buildTotpEnrollmentUri({
        qrCode,
        secret,
        accountLabel: resolvedAccountLabel,
      }),
    [qrCode, resolvedAccountLabel, secret],
  );

  const qrImage = useMemo(
    () => getTotpQrImage(qrCode, enrollmentUri),
    [enrollmentUri, qrCode],
  );

  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle>Two-Factor Authentication</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-medium">Enable Two-Factor Authentication</p>
            <p className="text-sm text-muted-foreground">
              Secure sign in to the {portalLabel.toLowerCase()} with Google Authenticator.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isLoadingFactors ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            <Switch
              checked={mfaSwitchChecked}
              onCheckedChange={handleToggleMfa}
              disabled={isLoadingFactors || isEnrolling || isDisabling || isVerifying}
            />
          </div>
        </div>

        {mfaEnabled && (
          <div className="flex items-center gap-2 text-sm text-emerald-700">
            <ShieldCheck className="h-4 w-4" />
            Google Authenticator is enabled.
          </div>
        )}

        {hasPendingFactor && !mfaEnabled && !hasPendingEnrollment && (
          <div className="space-y-3 rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">
              Google Authenticator setup was started earlier but is not complete. Generate a fresh
              QR code, then verify the 6-digit code from the app.
            </p>
            <div className="flex items-center gap-2">
              <Button onClick={handleStartEnrollment} disabled={isEnrolling}>
                {isEnrolling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Generate New QR Code
              </Button>
              <Button variant="outline" onClick={handleDisable} disabled={isDisabling}>
                Cancel Setup
              </Button>
            </div>
          </div>
        )}

        {hasPendingEnrollment && (
          <div className="space-y-3 rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">
              Scan this QR code with Google Authenticator, then enter the 6-digit code to finish
              setup.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              {qrImage && (
                <img src={qrImage} alt="TOTP QR" className="h-32 w-32 rounded-md border" />
              )}
              <div className="text-sm">
                <p className="text-muted-foreground">Secret key</p>
                <p className="font-mono break-all">{secret}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-2">
                <Label>Verification Code</Label>
                <Input
                  value={verificationCode}
                  onChange={(event) => setVerificationCode(event.target.value)}
                  placeholder="123456"
                  inputMode="numeric"
                />
              </div>
              <Button onClick={handleVerify} disabled={isVerifying}>
                {isVerifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Verify & Enable
              </Button>
              <Button
                variant="outline"
                onClick={handleDisable}
                disabled={isDisabling || isVerifying}
              >
                Cancel Setup
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TwoFactorAuthCard;
