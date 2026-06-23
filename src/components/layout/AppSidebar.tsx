import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ChevronDown,
  ChevronLeft,
  LayoutDashboard,
  Users,
  Shield,
  Package,
  UserCheck,
  Ship,
  Plane,
  FileText,
  CreditCard,
  Building2,
  UsersRound,
  Car,
  BarChart3,
  Settings,
  MapPin,
  Globe,
  Clock,
  Boxes,
  DollarSign,
  Palette,
  Bell,
  Database,
  RefreshCw,
  QrCode,
  Plus,
  List,
  CircleDot,
  CheckSquare,
  Key,
  LogOut,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";
import { useAuthContext } from "@/components/auth/AuthContext";
import { useStaffPortals, getMenuItemsForPortals } from "@/hooks/useStaffPortals";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MenuItem {
  title: string;
  icon: React.ElementType;
  path?: string;
  children?: MenuItem[];
  roles?: string[];
  action?: "logout";
}

const sortMenuItemsByOrder = (items: MenuItem[], order: string[]) => {
  const orderMap = new Map(order.map((title, index) => [title, index]));
  return [...items].sort((left, right) => {
    const leftIndex = orderMap.get(left.title) ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = orderMap.get(right.title) ?? Number.MAX_SAFE_INTEGER;
    if (leftIndex !== rightIndex) return leftIndex - rightIndex;
    return left.title.localeCompare(right.title);
  });
};

const ADMIN_MENU_ORDER = [
  "Dashboard",
  "Warehouse",
  "Finance",
  "Support",
  "Compliance",
  "Marketing",
  "Users",
  "Customers",
  "Agents",
  "Drivers",
  "Reports",
  "Access Control Level",
  "Settings",
];

const ADMIN_SETTINGS_ORDER = [
  "General Settings",
  "Content Management",
  "Localization",
  "Pickup Destinations",
  "Delivery Time",
  "Product Types",
  "Shipping Rates",
  "Currencies",
  "Currency Management",
  "Payments Settings",
  "Notifications Settings",
  "Google Settings",
  "API Secrets",
];

const ADMIN_ACCESS_CONTROL_ORDER = [
  "Role List",
  "Create New Role",
  "Portal Assignments",
];

const customizeAdminMenu = (items: MenuItem[]) =>
  sortMenuItemsByOrder(
    items
      .filter((item) => item.title !== "Shipments")
      .map((item) => {
        if (item.title === "Access Control Level" && item.children) {
          return {
            ...item,
            children: sortMenuItemsByOrder(item.children, ADMIN_ACCESS_CONTROL_ORDER),
          };
        }

        if (item.title === "Settings" && item.children) {
          return {
            ...item,
            children: sortMenuItemsByOrder(item.children, ADMIN_SETTINGS_ORDER),
          };
        }

        return item;
      }),
    ADMIN_MENU_ORDER,
  );

const menuItems: MenuItem[] = [
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    path: "/dashboard",
    roles: ["admin"],
  },
  {
    title: "My Portal",
    icon: Users,
    roles: ["customer"],
    children: [
      { title: "Dashboard", icon: LayoutDashboard, path: "/customer/dashboard", roles: ["customer"] },
      { title: "My Shipments", icon: Package, path: "/customer/shipments", roles: ["customer"] },
      { title: "Request Delivery", icon: Plane, path: "/customer/request-delivery", roles: ["customer"] },
      { title: "Track Shipment", icon: QrCode, path: "/customer/tracking", roles: ["customer"] },
      { title: "Payments & Invoices", icon: CreditCard, path: "/customer/payments", roles: ["customer"] },
      { title: "Refund Requests", icon: RefreshCw, path: "/customer/refunds", roles: ["customer"] },
      { title: "Sourcing Requests", icon: Boxes, path: "/customer/sourcing", roles: ["customer"] },
      { title: "Supplier Requests", icon: CreditCard, path: "/customer/supplier-requests", roles: ["customer"] },
      { title: "Support Center", icon: FileText, path: "/customer/support-tickets", roles: ["customer"] },
      { title: "Make Payment", icon: Wallet, path: "/customer/custom-payment", roles: ["customer"] },
      { title: "Reports", icon: BarChart3, path: "/customer/reports", roles: ["customer"] },
      { title: "My Profile", icon: UserCheck, path: "/customer/profile", roles: ["customer"] },
      { title: "Settings", icon: Settings, path: "/customer/security", roles: ["customer"] },
      { title: "Logout", icon: LogOut, roles: ["customer"], action: "logout" },
    ],
  },
  {
    title: "Users",
    icon: Users,
    roles: ["admin", "staff"],
    children: [
      { title: "User List", icon: List, path: "/users", roles: ["admin", "staff"] },
      { title: "Create New User", icon: Plus, path: "/users/create", roles: ["admin"] },
    ],
  },
  {
    title: "Access Control Level",
    icon: Shield,
    roles: ["admin"],
    children: [
      { title: "Role List", icon: CircleDot, path: "/roles", roles: ["admin"] },
      { title: "Create New Role", icon: Plus, path: "/roles/create", roles: ["admin"] },
      { title: "Portal Assignments", icon: Globe, path: "/roles/portal-assignments", roles: ["admin"] },
    ],
  },
  {
    title: "Agent Portal",
    icon: UsersRound,
    roles: ["agent"],
    children: [
      { title: "Dashboard", icon: LayoutDashboard, path: "/agent/dashboard", roles: ["agent"] },
      { title: "Shipments", icon: Package, path: "/agent/shipments", roles: ["agent"] },
      { title: "Request Delivery", icon: Plane, path: "/agent/request-delivery", roles: ["agent"] },
      { title: "Track Shipment", icon: QrCode, path: "/agent/tracking", roles: ["agent"] },
      { title: "Clients", icon: Users, path: "/agent/customers", roles: ["agent"] },
      { title: "Payments & Invoices", icon: CreditCard, path: "/agent/payments", roles: ["agent"] },
      { title: "Refund Requests", icon: RefreshCw, path: "/agent/refunds", roles: ["agent"] },
      { title: "Commission & Earnings", icon: DollarSign, path: "/agent/commissions", roles: ["agent"] },
      { title: "Withdrawals", icon: Wallet, path: "/agent/withdrawals", roles: ["agent"] },
      { title: "Reports & Analytics", icon: BarChart3, path: "/agent/reports", roles: ["agent"] },
      { title: "Sourcing Requests", icon: Boxes, path: "/agent/sourcing", roles: ["agent"] },
      { title: "Supplier Requests", icon: CreditCard, path: "/agent/supplier-requests", roles: ["agent"] },
      { title: "Support Center", icon: FileText, path: "/agent/support", roles: ["agent"] },
      { title: "Make Payment", icon: Wallet, path: "/agent/custom-payment", roles: ["agent"] },
      { title: "Settings", icon: Settings, path: "/agent/settings", roles: ["agent"] },
      { title: "Logout", icon: LogOut, roles: ["agent"], action: "logout" },
    ],
  },
  {
    title: "Warehouse",
    icon: Boxes,
    roles: ["admin", "staff", "branch_manager"],
    children: [
      { title: "Dashboard", icon: LayoutDashboard, path: "/warehouse/dashboard", roles: ["admin", "staff", "branch_manager"] },
      { title: "All Shipments", icon: Package, path: "/warehouse/shipments", roles: ["admin", "staff", "branch_manager"] },
      { title: "Assigned Tickets", icon: FileText, path: "/support/department/warehouse", roles: ["admin", "staff", "branch_manager"] },
      { title: "Operations Tickets", icon: FileText, path: "/support/department/operations", roles: ["admin", "staff", "branch_manager"] },
      { title: "All Customers", icon: UsersRound, path: "/warehouse/customers", roles: ["admin", "staff", "branch_manager"] },
      { title: "Warehouse Staff", icon: Users, path: "/warehouse/staff", roles: ["admin", "staff", "branch_manager"] },
      { title: "All Drivers", icon: Car, path: "/warehouse/drivers", roles: ["admin", "staff", "branch_manager"] },
      { title: "All Warehouses", icon: Building2, path: "/warehouses", roles: ["admin", "staff", "branch_manager"] },
      { title: "Delivery Requests", icon: Plane, path: "/warehouse/delivery-requests", roles: ["admin", "staff", "branch_manager"] },
    ],
  },
  {
    title: "Driver Portal",
    icon: Ship,
    roles: ["driver"],
    children: [
      { title: "Dashboard", icon: LayoutDashboard, path: "/driver/dashboard", roles: ["driver"] },
      { title: "My Deliveries", icon: Package, path: "/driver/deliveries", roles: ["driver"] },
      { title: "Performance", icon: BarChart3, path: "/driver/performance", roles: ["driver"] },
      { title: "Incident & Support", icon: Shield, path: "/driver/incidents", roles: ["driver"] },
      { title: "Escalated Tickets", icon: Bell, path: "/driver/escalated-tickets", roles: ["driver"] },
      { title: "Settings", icon: Settings, path: "/driver/settings", roles: ["driver"] },
      { title: "Logout", icon: LogOut, roles: ["driver"], action: "logout" },
    ],
  },
  {
    title: "Compliance",
    icon: Shield,
    roles: ["admin", "staff"],
    children: [
      { title: "Dashboard", icon: LayoutDashboard, path: "/compliance/dashboard", roles: ["admin", "staff"] },
      { title: "Compliance Queue", icon: FileText, path: "/compliance/queue", roles: ["admin", "staff"] },
      { title: "Assigned Tickets", icon: Bell, path: "/support/department/compliance", roles: ["admin", "staff"] },
      { title: "Duty & Charges", icon: DollarSign, path: "/compliance/charges", roles: ["admin", "staff"] },
    ],
  },
  {
    title: "Marketing",
    icon: Palette,
    roles: ["admin", "staff"],
    children: [
      { title: "Dashboard", icon: LayoutDashboard, path: "/marketing/dashboard", roles: ["admin", "staff"] },
      { title: "Campaigns", icon: Globe, path: "/marketing/campaigns", roles: ["admin", "staff"] },
      { title: "Leads", icon: UsersRound, path: "/marketing/leads", roles: ["admin", "staff"] },
      { title: "Website Analytics", icon: BarChart3, path: "/marketing/analytics", roles: ["admin", "staff"] },
      { title: "Content", icon: FileText, path: "/marketing/content", roles: ["admin", "staff"] },
      { title: "Service Promotions", icon: Globe, path: "/marketing/promotions", roles: ["admin", "staff"] },
      { title: "Social Media", icon: Globe, path: "/marketing/social", roles: ["admin", "staff"] },
      { title: "Email & Automation", icon: Bell, path: "/marketing/email", roles: ["admin", "staff"] },
      { title: "Budget & ROI", icon: DollarSign, path: "/marketing/budget", roles: ["admin", "staff"] },
      { title: "Sales Integration", icon: UsersRound, path: "/marketing/sales", roles: ["admin", "staff"] },
      { title: "Reports", icon: BarChart3, path: "/marketing/reports", roles: ["staff"] },
      { title: "Settings", icon: Settings, path: "/marketing/settings", roles: ["admin"] },
    ],
  },
  {
    title: "Finance",
    icon: CreditCard,
    roles: ["admin", "staff"],
    children: [
      { title: "Dashboard", icon: LayoutDashboard, path: "/finance/dashboard", roles: ["admin", "staff"] },
      { title: "Assigned Tickets", icon: Bell, path: "/support/department/finance", roles: ["admin", "staff"] },
      { title: "Invoices", icon: FileText, path: "/finance/invoices", roles: ["admin", "staff"] },
      { title: "Accounts Receivable", icon: DollarSign, path: "/finance/receivable", roles: ["admin", "staff"] },
      { title: "Payments", icon: CreditCard, path: "/finance/payments", roles: ["admin", "staff"] },
      { title: "Client Wallets", icon: CreditCard, path: "/finance/wallets", roles: ["admin", "staff"] },
      { title: "Payment Reconciliation", icon: CheckSquare, path: "/finance/reconciliation", roles: ["admin", "staff"] },
      { title: "Refund Management", icon: Shield, path: "/finance/claims", roles: ["admin", "staff"] },
      { title: "Financial Reports", icon: BarChart3, path: "/finance/reports", roles: ["staff"] },
      { title: "Billing & Pricing", icon: DollarSign, path: "/finance/billing", roles: ["admin", "staff"] },
      { title: "Commissions", icon: UsersRound, path: "/finance/commissions", roles: ["admin", "staff"] },
      { title: "Client Financial Portal", icon: FileText, path: "/finance/client-statements", roles: ["admin", "staff"] },
      { title: "Settings", icon: Settings, path: "/finance/settings", roles: ["admin", "staff"] },
    ],
  },
  {
    title: "Support",
    icon: FileText,
    roles: ["admin", "staff"],
    children: [
      { title: "Dashboard", icon: LayoutDashboard, path: "/support/dashboard", roles: ["admin", "staff"] },
      { title: "All Tickets", icon: List, path: "/support/tickets", roles: ["admin", "staff"] },
      { title: "Support Queue", icon: Bell, path: "/support/department/support", roles: ["admin", "staff"] },
      { title: "My Tickets", icon: FileText, path: "/support/my-tickets", roles: ["admin", "staff"] },
      { title: "Create Ticket", icon: Plus, path: "/support/tickets/create", roles: ["admin", "staff"] },
      { title: "Sourcing Requests", icon: Boxes, path: "/support/sourcing-requests", roles: ["admin", "staff"] },
      { title: "Supplier Requests", icon: CreditCard, path: "/support/supplier-requests", roles: ["admin", "staff"] },
      { title: "Escalated Tickets", icon: Shield, path: "/support/escalated", roles: ["admin", "staff"] },
      { title: "Customer Profiles", icon: UsersRound, path: "/support/customer-profiles", roles: ["admin", "staff"] },
      { title: "SLA Monitoring", icon: Clock, path: "/support/sla", roles: ["admin", "staff"] },
      { title: "Reports (Limited)", icon: BarChart3, path: "/support/reports", roles: ["staff"] },
      { title: "Knowledge Base", icon: FileText, path: "/support/knowledge-base", roles: ["admin", "staff"] },
      { title: "Bulk SMS", icon: Bell, path: "/support/bulk-sms", roles: ["admin", "staff"] },
    ],
  },
  {
    title: "Customers",
    icon: UsersRound,
    roles: ["admin", "staff", "branch_manager"],
    children: [
      { title: "Customer List", icon: List, path: "/customers", roles: ["admin", "staff", "branch_manager"] },
      { title: "Create New Customer", icon: Plus, path: "/customers/create", roles: ["admin", "staff", "branch_manager"] },
    ],
  },
  {
    title: "Agents",
    icon: UsersRound,
    roles: ["admin"],
    children: [
      { title: "Agent List", icon: List, path: "/agents", roles: ["admin"] },
      { title: "Agent Commissions", icon: DollarSign, path: "/agents/commissions", roles: ["admin"] },
      { title: "Agent Reports", icon: BarChart3, path: "/agents/reports", roles: ["admin"] },
    ],
  },
  {
    title: "Drivers",
    icon: Car,
    roles: ["admin", "staff", "branch_manager"],
    children: [
      { title: "Driver List", icon: List, path: "/drivers", roles: ["admin", "staff", "branch_manager"] },
      { title: "Create New Driver", icon: Plus, path: "/drivers/create", roles: ["admin", "staff"] },
      { title: "Incident Reports", icon: Shield, path: "/drivers/incident-reports", roles: ["admin", "staff"] },
    ],
  },
  {
    title: "Reports",
    icon: BarChart3,
    roles: ["admin", "staff", "branch_manager"],
    children: [
      { title: "Shipments Report", icon: Package, path: "/reports/shipments", roles: ["admin", "staff", "branch_manager"] },
      { title: "Financial Reports", icon: BarChart3, path: "/finance/reports", roles: ["admin"] },
      { title: "Marketing Reports", icon: Palette, path: "/marketing/reports", roles: ["admin"] },
      { title: "Support Reports", icon: FileText, path: "/support/reports", roles: ["admin"] },
      { title: "Warehouses Report", icon: Building2, path: "/reports/warehouses", roles: ["admin", "staff"] },
      { title: "Customers Report", icon: UsersRound, path: "/reports/customers", roles: ["admin", "staff", "branch_manager"] },
      { title: "Drivers Report", icon: Car, path: "/reports/drivers", roles: ["admin", "staff", "branch_manager"] },
    ],
  },
  {
    title: "Settings",
    icon: Settings,
    roles: ["admin"],
    children: [
      { title: "General Settings", icon: Settings, path: "/settings/general", roles: ["admin"] },
      { title: "Delivery Time", icon: Clock, path: "/settings/delivery-time", roles: ["admin"] },
      { title: "Product Types", icon: Package, path: "/settings/product-types", roles: ["admin"] },
      { title: "Pickup Destinations", icon: MapPin, path: "/settings/pickup-destinations", roles: ["admin"] },
      { title: "Shipping Rates", icon: DollarSign, path: "/settings/shipping-rates", roles: ["admin"] },
      { title: "Currencies", icon: DollarSign, path: "/settings/currencies", roles: ["admin"] },
      { title: "Currency Management", icon: DollarSign, path: "/settings/currency-management", roles: ["admin", "staff"] },
      { title: "Localization", icon: Globe, path: "/settings/localization", roles: ["admin"] },
      { title: "Payments Settings", icon: CreditCard, path: "/settings/payments", roles: ["admin"] },
      { title: "Notifications Settings", icon: Bell, path: "/settings/notifications", roles: ["admin"] },
      { title: "Content Management", icon: FileText, path: "/settings/content", roles: ["admin"] },
      { title: "Google Settings", icon: Settings, path: "/settings/google", roles: ["admin"] },
      { title: "API Secrets", icon: Key, path: "/settings/api-secrets", roles: ["admin"] },
    ],
  },
];

interface SidebarItemProps {
  item: MenuItem;
  depth?: number;
  onLogout?: () => void;
}

const SidebarItem = ({ item, depth = 0, onLogout }: SidebarItemProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const hasChildren = item.children && item.children.length > 0;

  const currentPath = `${location.pathname}${location.search}`;
  const matchesPath = (path?: string) => {
    if (!path) return false;
    if (path.includes("?")) return currentPath === path;
    return location.pathname === path || location.pathname.startsWith(path + "/");
  };

  const isActive = matchesPath(item.path);
  const hasActiveChild = hasChildren && item.children?.some((child) => matchesPath(child.path));

  const Icon = item.icon;

  if (hasChildren) {
    return (
      <div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "w-full flex items-center justify-between px-4 py-2.5 rounded-md text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors",
            (isOpen || hasActiveChild) && "bg-sidebar-accent text-sidebar-foreground"
          )}
        >
          <div className="flex items-center gap-3">
            <Icon className="w-5 h-5" />
            <span className="text-sm font-semibold font-jakarta whitespace-nowrap">{item.title}</span>
          </div>
          <ChevronDown
            className={cn(
              "w-4 h-4 transition-transform",
              isOpen && "rotate-180"
            )}
          />
        </button>
        {(isOpen || hasActiveChild) && (
          <div className="bg-sidebar-accent/50">
            {item.children?.map((child, idx) => (
              <SidebarItem key={idx} item={child} depth={depth + 1} onLogout={onLogout} />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (item.action === "logout") {
    return (
      <button
        type="button"
        onClick={onLogout}
        className={cn(
          "w-full flex items-center gap-3 px-4 py-2.5 text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors",
          depth > 0 && "pl-12"
        )}
      >
        <Icon className="w-5 h-5" />
        <span className="text-sm font-semibold font-jakarta whitespace-nowrap">{item.title}</span>
      </button>
    );
  }

  return (
    <Link
      to={item.path || "#"}
      className={cn(
        "flex items-center gap-3 px-4 py-2.5 text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors",
        depth > 0 && "pl-12",
        isActive && "bg-stat-blue text-white"
      )}
    >
      <Icon className="w-5 h-5" />
      <span className="text-sm font-semibold font-jakarta whitespace-nowrap">{item.title}</span>
    </Link>
  );
};

interface AppSidebarProps {
  userRole?: string;
  userName?: string;
}

export const AppSidebar = ({ userRole = "Admin", userName = "Admin" }: AppSidebarProps) => {
  const { userRole: contextRole, user } = useAuthContext();
  const navigate = useNavigate();
  const normalizedRole = (contextRole || userRole).toLowerCase();
  const isElevated = ["admin", "staff"].includes(normalizedRole);
  const isStaff = normalizedRole === "staff";
  const isAdmin = normalizedRole === "admin";

  // Fetch portal assignments for staff users
  const { assignedPortals } = useStaffPortals(
    isStaff ? user?.id : undefined
  );

  // Get allowed menu titles based on portal assignments
  const allowedMenuTitles = isStaff
    ? getMenuItemsForPortals(assignedPortals)
    : null;

  const filterMenuItems = (items: MenuItem[], parentAllowed = false): MenuItem[] => {
    return items
      .map((item) => {
        const portalAllowed = allowedMenuTitles === null
          ? true
          : parentAllowed || allowedMenuTitles.includes(item.title);

        if (item.children) {
          const filteredChildren = filterMenuItems(item.children, portalAllowed);
          return { ...item, children: filteredChildren };
        }
        return { ...item, portalAllowed };
      })
      .filter((item: MenuItem & { portalAllowed?: boolean }) => {
        const portalAllowed = item.portalAllowed ?? true;
        
        // Filter out empty parent items
        if (item.children && item.children.length === 0) {
          return false;
        }
        // If item has roles defined, check if user role is included
        if (item.roles && item.roles.length > 0) {
          const hasRoleAccess = item.roles.includes(normalizedRole);
          if (isStaff && allowedMenuTitles !== null) {
            return hasRoleAccess && portalAllowed;
          }
          return hasRoleAccess;
        }
        // If no roles defined, only show to admin/staff
        if (isStaff && allowedMenuTitles !== null) {
          return portalAllowed;
        }
        return isAdmin;
      });
  };

  const visibleMenuItems = normalizedRole === "admin"
    ? customizeAdminMenu(filterMenuItems(menuItems))
    : filterMenuItems(menuItems);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleLogout = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        await supabase.auth.signOut({ scope: "local" });
        toast.error("Signed out locally. Please log in again if needed.");
      }
    } finally {
      navigate("/login", { replace: true });
      setIsSigningOut(false);
    }
  };

  return (
    <aside className="w-72 h-screen bg-slate-900 flex flex-col border-r border-sidebar-border/70 shadow-[0_12px_30px_-24px_rgba(15,23,42,0.6)] overflow-hidden">
      {/* Logo */}
      <div className="shrink-0 p-4 flex justify-center">
        <Logo />
      </div>

      {/* User Info */}
      <div className="shrink-0 px-6 py-5 flex items-center gap-4 border-b border-sidebar-border bg-slate-900/50">
        <div className="w-12 h-12 rounded-full bg-sidebar-accent flex items-center justify-center shadow-inner">
          <Users className="w-6 h-6 text-sidebar-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold font-jakarta text-sidebar-foreground truncate">{userName} |</p>
        </div>
        <span className="px-2 py-0.5 text-xs font-bold font-jakarta bg-stat-red text-white rounded">
          {userRole}
        </span>
      </div>

      {/* Navigation - Scrollable area */}
      <div className="flex-1 min-h-0 overflow-y-auto sidebar-scroll">
        <nav className="py-2">
          {visibleMenuItems.map((item, idx) => (
            <SidebarItem key={idx} item={item} onLogout={handleLogout} />
          ))}
        </nav>
      </div>

      {/* Footer */}
      <div className="shrink-0 p-4 border-t border-sidebar-border">
        <p className="text-xs text-sidebar-muted text-center font-jakarta">
          Copyright (c) 2025 <span className="text-stat-blue font-bold">Xy Cargo Zambia</span>.
        </p>
      </div>
    </aside>
  );
};
