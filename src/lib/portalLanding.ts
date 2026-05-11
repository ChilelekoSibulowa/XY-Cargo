export const portalLandingRouteById: Record<string, string> = {
  admin: "/dashboard",
  warehouse: "/warehouse/dashboard",
  finance: "/finance/dashboard",
  support: "/support/dashboard",
  compliance: "/compliance/dashboard",
  marketing: "/marketing/dashboard",
  agent: "/agent/dashboard",
  driver: "/driver/dashboard",
  customer: "/customer/dashboard",
};

export const getPreferredPortalRoute = (portalIds: string[]) => {
  for (const portalId of portalIds) {
    const route = portalLandingRouteById[portalId];
    if (route) return route;
  }
  return "/dashboard";
};

export const getRoleLandingRoute = (role: string, assignedPortals: string[] = []) => {
  const normalized = role.toLowerCase().trim();
  const nonAdminPortals = assignedPortals.filter((portalId) => portalId !== "admin");

  if (normalized === "customer") return "/customer/dashboard";
  if (normalized === "agent") return "/agent/dashboard";
  if (normalized === "driver") return "/driver/dashboard";
  if (normalized === "admin") return "/dashboard";

  if (normalized === "staff") {
    return nonAdminPortals.length > 0
      ? getPreferredPortalRoute(nonAdminPortals)
      : "/dashboard";
  }

  if (normalized === "branch_manager") {
    return nonAdminPortals.length > 0
      ? getPreferredPortalRoute(nonAdminPortals)
      : "/warehouse/dashboard";
  }

  return "/dashboard";
};
