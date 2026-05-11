type CachedDashboardUser = {
  id: string;
  email: string | null;
  user_metadata?: Record<string, unknown> | null;
};

export type DashboardAuthSnapshot = {
  user: CachedDashboardUser;
  userRole: string;
  createdAt: number;
};

const DASHBOARD_AUTH_SNAPSHOT_KEY = "dashboard-auth-snapshot:v2";
const DASHBOARD_AUTH_SNAPSHOT_TTL_MS = 60 * 1000;

export const readDashboardAuthSnapshot = (): DashboardAuthSnapshot | null => {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(DASHBOARD_AUTH_SNAPSHOT_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as DashboardAuthSnapshot;
    if (!parsed?.user?.id) return null;
    if (!parsed?.createdAt || Date.now() - parsed.createdAt > DASHBOARD_AUTH_SNAPSHOT_TTL_MS) {
      window.sessionStorage.removeItem(DASHBOARD_AUTH_SNAPSHOT_KEY);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
};

export const writeDashboardAuthSnapshot = (user: any, userRole: string) => {
  if (typeof window === "undefined" || !user?.id) return;

  const snapshot: DashboardAuthSnapshot = {
    user: {
      id: user.id,
      email: user.email ?? null,
      user_metadata: user.user_metadata ?? null,
    },
    userRole: userRole || "customer",
    createdAt: Date.now(),
  };

  try {
    window.sessionStorage.setItem(DASHBOARD_AUTH_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore storage failures.
  }
};

export const clearDashboardAuthSnapshot = () => {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(DASHBOARD_AUTH_SNAPSHOT_KEY);
  } catch {
    // Ignore storage failures.
  }
};
