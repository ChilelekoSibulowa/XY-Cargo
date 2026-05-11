import { useLocation, Link } from "react-router-dom";
import { 
  LayoutDashboard, 
  Package, 
  Search, 
  MessageSquare, 
  Truck, 
  TrendingUp, 
  ShieldAlert 
} from "lucide-react";
import { useAuthContext } from "@/components/auth/AuthContext";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

export const StickyBottomNav = () => {
  const { userRole } = useAuthContext();
  const location = useLocation();
  const role = userRole?.toLowerCase() || "customer";
  const [isStandalone, setIsStandalone] = useState(false);

  // Rules: ONLY show for Customer, Agent, and Driver.
  // Must NOT show for any other role (Admin, Warehouse, Finance, Staff, etc.)
  const allowedRoles = ["customer", "agent", "driver"];
  if (!allowedRoles.includes(role)) return null;

  const getNavItems = () => {
    if (role === "driver") {
      return [
        { icon: LayoutDashboard, path: "/driver/dashboard", label: "Home" },
        { icon: Truck, path: "/driver/deliveries", label: "My Deliveries" },
        { icon: TrendingUp, path: "/driver/performance", label: "Performance" },
        { icon: ShieldAlert, path: "/driver/incidents", label: "Incident & Support" },
      ];
    }

    // Default for Customer and Agent
    return [
      { 
        icon: LayoutDashboard, 
        path: role === "agent" ? "/agent/dashboard" : "/customer/dashboard",
        label: "Home" 
      },
      { 
        icon: Package, 
        path: role === "agent" ? "/agent/shipments" : "/customer/shipments",
        label: "Shipment" 
      },
      { 
        icon: Search, 
        path: role === "agent" ? "/agent/tracking" : "/customer/tracking",
        label: "Track" 
      },
      { 
        icon: MessageSquare, 
        path: role === "agent" ? "/agent/support" : "/customer/support-tickets",
        label: "Support" 
      },
    ];
  };

  const navItems = getNavItems();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] md:hidden pb-safe px-6 mb-4">
      <div className="bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 shadow-lg rounded-lg px-4 py-1.5 flex justify-between items-center max-w-[280px] mx-auto">
        {navItems.map((item, index) => {
          const isActive = item.path === "/dashboard" 
            ? location.pathname === "/dashboard"
            : location.pathname.startsWith(item.path);
          const Icon = item.icon;
          return (
            <Link
              key={index}
              to={item.path}
              className={cn(
                "p-2 rounded-md transition-colors relative flex items-center justify-center",
                isActive 
                  ? "bg-primary text-white" 
                  : "text-slate-400 hover:text-slate-600 active:bg-slate-50"
              )}
            >
              <Icon className="w-5 h-5" />
              {isActive && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full opacity-60" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
};
