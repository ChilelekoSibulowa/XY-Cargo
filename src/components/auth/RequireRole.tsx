import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuthContext } from "@/components/auth/AuthContext";
import { getRoleLandingRoute } from "@/lib/portalLanding";

export const RequireRole = ({
  allowedRoles,
  children,
}: {
  allowedRoles: string[];
  children: ReactNode;
}) => {
  const { userRole } = useAuthContext();

  if (!allowedRoles.includes(userRole)) {
    // If user doesn't have the required role, redirect to their appropriate landing page
    return <Navigate to={getRoleLandingRoute(userRole)} replace />;
  }

  return <>{children}</>;
};
