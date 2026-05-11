import { Link } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuthContext } from "@/components/auth/AuthContext";
import TwoFactorAuthCard from "@/components/settings/TwoFactorAuthCard";
import { updateCurrentUserMfaMetadata } from "@/lib/authMfa";

const settingsItems = [
  { title: "User Roles", description: "Manage marketing user access and permissions.", actionLabel: "Manage Roles", actionTo: "/roles" },
  { title: "Tracking Codes", description: "Configure analytics, pixels, and tracking IDs.", actionLabel: "Tracking Settings", actionTo: "/settings/google" },
  { title: "API Integrations", description: "Connect email, social, and ad platforms.", actionLabel: "API Secrets", actionTo: "/settings/api-secrets" },
  { title: "CRM Integration", description: "Sync leads and campaign activity to CRM.", actionLabel: "General Settings", actionTo: "/settings/general" },
  { title: "Ad Account Connections", description: "Link Google, Facebook, and TikTok ad accounts.", actionLabel: "Ad Accounts", actionTo: "/settings/google" },
  { title: "Automation Rules", description: "Define automated follow-up and lead routing.", actionLabel: "Notifications", actionTo: "/settings/notifications" },
];

const MarketingSettings = () => {
  const { userRole } = useAuthContext();
  const normalizedRole = (userRole || "").toLowerCase();

  if (normalizedRole !== "admin") {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader title="Marketing Settings"  />
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            You do not have access to Marketing Settings. Please contact an administrator.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Marketing Settings"  />
      <TwoFactorAuthCard
        portalLabel="Marketing Portal"
        onEnabledChange={(enabled) =>
          updateCurrentUserMfaMetadata({
            mfa_enabled: enabled,
            marketing_mfa_enabled: enabled,
          })
        }
      />
      <div className="grid gap-4 md:grid-cols-2">
        {settingsItems.map((item) => (
          <Card key={item.title}>
            <CardHeader><CardTitle className="text-sm">{item.title}</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{item.description}</p>
              <Button asChild size="sm" variant="outline" className="mt-3">
                <Link to={item.actionTo}>{item.actionLabel}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default MarketingSettings;

