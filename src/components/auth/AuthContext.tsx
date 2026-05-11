import { createContext, useContext } from "react";
import type { ReactNode } from "react";

type AuthContextValue = {
  user: any | null;
  userRole: string;
  isLoading?: boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({
  value,
  children,
}: {
  value: AuthContextValue;
  children: ReactNode;
}) => {
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) {
    return { user: null, userRole: "customer", isLoading: true };
  }
  return context;
};
