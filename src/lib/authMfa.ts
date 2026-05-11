import { supabase } from "@/integrations/supabase/client";

type MfaFactor = {
  id: string;
  factor_type: string;
  status: string;
};

type MfaFactorList = {
  all?: MfaFactor[];
  totp?: MfaFactor[];
};

type TotpEnrollmentUriOptions = {
  qrCode: string;
  secret: string;
  accountLabel: string;
  issuer?: string;
};

export const getPendingTotpFactor = (factors: MfaFactorList | null | undefined) =>
  (factors?.all || []).find(
    (factor) => factor.factor_type === "totp" && factor.status === "unverified",
  );

export const getVerifiedTotpFactor = (factors: MfaFactorList | null | undefined) =>
  factors?.totp?.[0] ||
  (factors?.all || []).find(
    (factor) => factor.factor_type === "totp" && factor.status === "verified",
  );

export const buildTotpEnrollmentUri = ({
  qrCode,
  secret,
  accountLabel,
  issuer = "XY Cargo",
}: TotpEnrollmentUriOptions) => {
  const trimmedQr = qrCode.trim();
  if (trimmedQr.startsWith("otpauth://")) {
    return trimmedQr;
  }

  if (!secret) {
    return "";
  }

  const safeAccountLabel = accountLabel.trim() || "user";
  return `otpauth://totp/${encodeURIComponent(`${issuer}:${safeAccountLabel}`)}?secret=${encodeURIComponent(secret)}&issuer=${encodeURIComponent(issuer)}`;
};

export const getTotpQrImage = (qrCode: string, enrollmentUri: string) => {
  const trimmedQr = qrCode.trim();
  if (!trimmedQr && !enrollmentUri) return "";
  if (trimmedQr.startsWith("data:image/")) return trimmedQr;
  if (trimmedQr.startsWith("<svg")) {
    return `data:image/svg+xml;utf-8,${encodeURIComponent(trimmedQr)}`;
  }

  const qrValue = trimmedQr.startsWith("otpauth://") ? trimmedQr : enrollmentUri;
  if (!qrValue) return "";

  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrValue)}`;
};

export const updateCurrentUserMfaMetadata = async (patch: Record<string, boolean>) => {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    return;
  }

  const { error } = await supabase.auth.updateUser({
    data: { ...(user.user_metadata || {}), ...patch },
  });

  if (error) {
    throw error;
  }
};
