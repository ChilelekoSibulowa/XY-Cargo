import { Navigate } from "react-router-dom";
import { useAuthContext } from "./AuthContext";

type RequireNonCustomerProps = {
  children: React.ReactNode;
  redirectTo?: string;
};

export const RequireNonCustomer = ({
  children,
  redirectTo = "/customer/dashboard",
}: RequireNonCustomerProps) => {
  const { userRole } = useAuthContext();

  if (userRole === "customer") {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
};
