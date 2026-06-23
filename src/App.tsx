import { Suspense, useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Routes, Route, useLocation, Outlet } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PublicLayout } from "@/components/public/PublicLayout";
import { RequireNonCustomer } from "./components/auth/RequireNonCustomer";
import { RequireRole } from "./components/auth/RequireRole";
import { CurrencyProvider } from "@/hooks/useCurrencyContext";
import { GoogleAnalytics } from "@/components/shared/GoogleAnalytics";
import { AutoTableExportButtons } from "@/components/shared/AutoTableExportButtons";
import { safeLazy } from "@/lib/safeLazy";
import { supabase } from "@/integrations/supabase/client";

// Eagerly loaded pages (critical path)
import Home from "./pages/Index";

import Login from "./pages/Login";
import Register from "./pages/Register";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

// Lazy loaded public pages
const HowWeWork = safeLazy(() => import("./pages/public/HowWeWork"));
const Services = safeLazy(() => import("./pages/public/Services"));
const ProductSourcingService = safeLazy(() => import("./pages/public/ProductSourcingService"));
const SupplierPaymentFacilitation = safeLazy(() => import("./pages/public/SupplierPaymentFacilitation"));
const CustomsClearanceService = safeLazy(() => import("./pages/public/CustomsClearanceService"));
const ExportService = safeLazy(() => import("./pages/public/ExportService"));
const Faq = safeLazy(() => import("./pages/public/Faq"));
const PublicCalculator = safeLazy(() => import("./pages/public/PublicCalculator"));
const Pricing = safeLazy(() => import("./pages/public/Pricing"));
const Locations = safeLazy(() => import("./pages/public/Locations"));
const Tracking = safeLazy(() => import("./pages/public/Tracking"));
const Support = safeLazy(() => import("./pages/public/Support"));
const JoinUs = safeLazy(() => import("./pages/public/JoinUs"));
const Shop = safeLazy(() => import("./pages/public/Shop"));
const Language = safeLazy(() => import("./pages/public/Language"));
const About = safeLazy(() => import("./pages/public/About"));
const Gallery = safeLazy(() => import("./pages/public/Gallery"));
const Podcast = safeLazy(() => import("./pages/public/Podcast"));
const Blog = safeLazy(() => import("./pages/public/Blog"));
const Privacy = safeLazy(() => import("./pages/public/Privacy"));
const Terms = safeLazy(() => import("./pages/public/Terms"));
const RefundPolicy = safeLazy(() => import("./pages/public/RefundPolicy"));

// Lazy loaded dashboard pages
const Dashboard = safeLazy(() => import("./pages/Dashboard"));
const Profile = safeLazy(() => import("./pages/Profile"));

const CmsEditor = safeLazy(() => import("./pages/cms/CmsEditor"));

// Customer portal
const CustomerInbox = safeLazy(() => import("./pages/customer/CustomerInbox"));
const CustomerOverview = safeLazy(() => import("./pages/customer/CustomerOverview"));
const CustomerDashboard = safeLazy(() => import("./pages/customer/CustomerDashboard"));
const CustomerPlaceOrder = safeLazy(() => import("./pages/customer/CustomerPlaceOrder"));
const CustomerRequestDelivery = safeLazy(() => import("./pages/customer/CustomerRequestDelivery"));
const CustomerProblemParcels = safeLazy(() => import("./pages/customer/CustomerProblemParcels"));
const CustomerClaims = safeLazy(() => import("./pages/customer/CustomerClaims"));
const CustomerWarehouseAddress = safeLazy(() => import("./pages/customer/CustomerWarehouseAddress"));
const CustomerAddresses = safeLazy(() => import("./pages/customer/CustomerAddresses"));
const CustomerPayOnBehalf = safeLazy(() => import("./pages/customer/CustomerPayOnBehalf"));
const CustomerSecurity = safeLazy(() => import("./pages/customer/CustomerSecurity"));
const CustomerProfile = safeLazy(() => import("./pages/customer/CustomerProfile"));
const CustomerPayments = safeLazy(() => import("./pages/customer/CustomerPayments"));
const CustomerTracking = safeLazy(() => import("./pages/customer/CustomerTracking"));
const CustomerReports = safeLazy(() => import("./pages/customer/CustomerReports"));
const CustomerSourcing = safeLazy(() => import("./pages/customer/CustomerSourcing"));
const CustomerSupportTickets = safeLazy(() => import("./pages/customer/CustomerSupportTickets"));
const CustomerSupportTicketDetail = safeLazy(() => import("./pages/customer/CustomerSupportTicketDetail"));
const CustomerSupplierRequests = safeLazy(() => import("./pages/customer/CustomerSupplierRequests"));
const CustomerCustomPayment = safeLazy(() => import("./pages/customer/CustomerCustomPayment"));

// Agent portal
const AgentDashboard = safeLazy(() => import("./pages/agent/AgentDashboard"));
const AgentShipments = safeLazy(() => import("./pages/agent/AgentShipments"));
const AgentRequestDelivery = safeLazy(() => import("./pages/agent/AgentRequestDelivery"));
const AgentCustomers = safeLazy(() => import("./pages/agent/AgentCustomers"));
const AgentCustomerCreate = safeLazy(() => import("./pages/agent/AgentCustomerCreate"));
const AgentPlaceOrder = safeLazy(() => import("./pages/agent/AgentPlaceOrder"));
const AgentPayments = safeLazy(() => import("./pages/agent/AgentPayments"));
const AgentCommissions = safeLazy(() => import("./pages/agent/AgentCommissions"));
const AgentPricing = safeLazy(() => import("./pages/agent/AgentPricing"));
const AgentTracking = safeLazy(() => import("./pages/agent/AgentTracking"));
const AgentRefunds = safeLazy(() => import("./pages/agent/AgentRefunds"));
const AgentReports = safeLazy(() => import("./pages/agent/AgentReports"));
const AgentSourcing = safeLazy(() => import("./pages/agent/AgentSourcing"));
const AgentSupport = safeLazy(() => import("./pages/agent/AgentSupport"));
const AgentSupportTicketDetail = safeLazy(() => import("./pages/agent/AgentSupportTicketDetail"));
const AgentSettings = safeLazy(() => import("./pages/agent/AgentSettings"));
const AgentWithdrawals = safeLazy(() => import("./pages/agent/AgentWithdrawals"));
const AgentSupplierRequests = safeLazy(() => import("./pages/agent/AgentSupplierRequests"));
const AgentCustomPayment = safeLazy(() => import("./pages/agent/AgentCustomPayment"));

// Agents admin
const AgentList = safeLazy(() => import("./pages/agents/AgentList"));
const AdminAgentCommissions = safeLazy(() => import("./pages/agents/AdminAgentCommissions"));
const AdminAgentReports = safeLazy(() => import("./pages/agents/AdminAgentReports"));

// Finance portal
const FinanceDashboard = safeLazy(() => import("./pages/finance/FinanceDashboard"));
const FinancePayments = safeLazy(() => import("./pages/finance/FinancePayments"));
const FinanceClaims = safeLazy(() => import("./pages/finance/FinanceClaims"));
const FinanceInvoices = safeLazy(() => import("./pages/finance/FinanceInvoices"));
const FinanceCodSettlements = safeLazy(() => import("./pages/finance/FinanceCodSettlements"));
const FinanceCommissions = safeLazy(() => import("./pages/finance/FinanceCommissions"));
const FinanceReports = safeLazy(() => import("./pages/finance/FinanceReports"));
const FinancePaymentHistory = safeLazy(() => import("./pages/finance/FinancePaymentHistory"));
const FinanceAccountsReceivable = safeLazy(() => import("./pages/finance/FinanceAccountsReceivable"));
const FinanceReconciliation = safeLazy(() => import("./pages/finance/FinanceReconciliation"));
const FinanceBilling = safeLazy(() => import("./pages/finance/FinanceBilling"));
const FinanceClientStatements = safeLazy(() => import("./pages/finance/FinanceClientStatements"));
const FinanceWallets = safeLazy(() => import("./pages/finance/FinanceWallets"));
const FinanceSettings = safeLazy(() => import("./pages/finance/FinanceSettings"));

// Driver portal
const DriverDashboard = safeLazy(() => import("./pages/driver/DriverDashboard"));
const DriverDeliveries = safeLazy(() => import("./pages/driver/DriverShipments"));
const DriverPerformance = safeLazy(() => import("./pages/driver/DriverPerformance"));
const DriverIncidents = safeLazy(() => import("./pages/driver/DriverIncidents"));
const DriverSettings = safeLazy(() => import("./pages/driver/DriverSettings"));

// Compliance portal
const ComplianceDashboard = safeLazy(() => import("./pages/compliance/ComplianceDashboard"));
const ComplianceQueue = safeLazy(() => import("./pages/compliance/ComplianceQueue"));
const ComplianceCharges = safeLazy(() => import("./pages/compliance/ComplianceCharges"));

// Marketing portal
const MarketingDashboard = safeLazy(() => import("./pages/marketing/MarketingDashboard"));
const MarketingContent = safeLazy(() => import("./pages/marketing/MarketingContent"));
const MarketingCampaigns = safeLazy(() => import("./pages/marketing/MarketingCampaigns"));
const MarketingLeads = safeLazy(() => import("./pages/marketing/MarketingLeads"));
const MarketingAnalytics = safeLazy(() => import("./pages/marketing/MarketingAnalytics"));
const MarketingPromotions = safeLazy(() => import("./pages/marketing/MarketingPromotions"));
const MarketingSocial = safeLazy(() => import("./pages/marketing/MarketingSocial"));
const MarketingEmail = safeLazy(() => import("./pages/marketing/MarketingEmail"));
const MarketingBudget = safeLazy(() => import("./pages/marketing/MarketingBudget"));
const MarketingSales = safeLazy(() => import("./pages/marketing/MarketingSales"));
const MarketingReports = safeLazy(() => import("./pages/marketing/MarketingReports"));
const MarketingSettings = safeLazy(() => import("./pages/marketing/MarketingSettings"));

// Support portal
const SupportDashboard = safeLazy(() => import("./pages/support/SupportDashboard"));
const SupportTickets = safeLazy(() => import("./pages/support/SupportTickets"));
const SupportTicketDetail = safeLazy(() => import("./pages/support/SupportTicketDetail"));
const SupportDepartmentTickets = safeLazy(() => import("./pages/support/SupportDepartmentTickets"));
const SupportCreateTicket = safeLazy(() => import("./pages/support/SupportCreateTicket"));
const SupportProblemParcels = safeLazy(() => import("./pages/support/SupportProblemParcels"));
const SupportClaims = safeLazy(() => import("./pages/support/SupportClaims"));
const SupportInternalNotes = safeLazy(() => import("./pages/support/SupportInternalNotes"));
const SupportKnowledgeBase = safeLazy(() => import("./pages/support/SupportKnowledgeBase"));
const SupportMyTickets = safeLazy(() => import("./pages/support/SupportMyTickets"));
const SupportEscalated = safeLazy(() => import("./pages/support/SupportEscalated"));
const SupportCustomerProfiles = safeLazy(() => import("./pages/support/SupportCustomerProfiles"));
const SupportSlaMonitoring = safeLazy(() => import("./pages/support/SupportSlaMonitoring"));
const SupportReports = safeLazy(() => import("./pages/support/SupportReports"));
const SupportBulkSms = safeLazy(() => import("./pages/support/SupportBulkSms"));
const SupportSourcingRequests = safeLazy(() => import("./pages/support/SupportSourcingRequests"));
const SupportSupplierRequests = safeLazy(() => import("./pages/support/SupportSupplierRequests"));

// Warehouse
const WarehouseAllParcels = safeLazy(() => import("./pages/warehouse/WarehouseAllParcels"));
const WarehouseDashboard = safeLazy(() => import("./pages/warehouse/WarehouseDashboard"));
const WarehouseAllShipments = safeLazy(() => import("./pages/warehouse/WarehouseAllShipments"));
const WarehousePendingShipments = safeLazy(() => import("./pages/warehouse/WarehousePendingShipments"));
const WarehouseCustomers = safeLazy(() => import("./pages/warehouse/WarehouseCustomers"));
const WarehouseStaff = safeLazy(() => import("./pages/warehouse/WarehouseStaff"));
const WarehouseDrivers = safeLazy(() => import("./pages/warehouse/WarehouseDrivers"));
const WarehouseDeliveries = safeLazy(() => import("./pages/warehouse/WarehouseDeliveries"));
const WarehouseDeliveryRequests = safeLazy(() => import("./pages/warehouse/WarehouseDeliveryRequests"));
const WarehouseReceive = safeLazy(() => import("./pages/warehouse/WarehouseReceive"));
const WarehouseStatusUpdate = safeLazy(() => import("./pages/warehouse/WarehouseStatusUpdate"));
const WarehouseProblemParcels = safeLazy(() => import("./pages/warehouse/WarehouseProblemParcels"));
const WarehouseConsolidation = safeLazy(() => import("./pages/warehouse/WarehouseConsolidation"));
const WarehouseInspectionUploads = safeLazy(() => import("./pages/warehouse/WarehouseInspectionUploads"));
const WarehouseOutgoingContainers = safeLazy(() => import("./pages/warehouse/WarehouseOutgoingContainers"));
const WarehouseCreateShipment = safeLazy(() => import("./pages/warehouse/WarehouseCreateShipment"));

// Users + Roles
const UserList = safeLazy(() => import("./pages/users/UserList"));
const UserCreate = safeLazy(() => import("./pages/users/UserCreate"));
const UserEdit = safeLazy(() => import("./pages/users/UserEdit"));
const RoleList = safeLazy(() => import("./pages/roles/RoleList"));
const RoleCreate = safeLazy(() => import("./pages/roles/RoleCreate"));
const StaffPortalAssignments = safeLazy(() => import("./pages/roles/StaffPortalAssignments"));

// Transactions
const TransactionList = safeLazy(() => import("./pages/transactions/TransactionList"));
const TransactionCreate = safeLazy(() => import("./pages/transactions/TransactionCreate"));

// Warehouses (branches)
const BranchList = safeLazy(() => import("./pages/branches/BranchList"));
const BranchCreate = safeLazy(() => import("./pages/branches/BranchCreate"));
const BranchEdit = safeLazy(() => import("./pages/branches/BranchEdit"));

// Customers
const CustomerList = safeLazy(() => import("./pages/customers/CustomerList"));
const CustomerCreate = safeLazy(() => import("./pages/customers/CustomerCreate"));
const CustomerEdit = safeLazy(() => import("./pages/customers/CustomerEdit"));

// Drivers
const DriverList = safeLazy(() => import("./pages/drivers/DriverList"));
const DriverCreate = safeLazy(() => import("./pages/drivers/DriverCreate"));
const DriverEdit = safeLazy(() => import("./pages/drivers/DriverEdit"));
const DriverIncidentReports = safeLazy(() => import("./pages/drivers/DriverIncidentReports"));

// Receivers
const ReceiverList = safeLazy(() => import("./pages/receivers/ReceiverList"));
const ReceiverCreate = safeLazy(() => import("./pages/receivers/ReceiverCreate"));
const ReceiverEdit = safeLazy(() => import("./pages/receivers/ReceiverEdit"));

// Missions
const MissionList = safeLazy(() => import("./pages/missions/MissionList"));
const MissionCreate = safeLazy(() => import("./pages/missions/MissionCreate"));
const MissionEdit = safeLazy(() => import("./pages/missions/MissionEdit"));

// Reports
const ShipmentsReport = safeLazy(() => import("./pages/reports/ShipmentsReport"));
const CustomersReport = safeLazy(() => import("./pages/reports/CustomersReport"));
const BranchesReport = safeLazy(() => import("./pages/reports/BranchesReport"));
const DriversReport = safeLazy(() => import("./pages/reports/DriversReport"));
const ReportPlaceholder = safeLazy(() => import("./pages/reports/ReportPlaceholder"));

// Settings
const ShippingRates = safeLazy(() => import("./pages/settings/ShippingRates"));
const ShippingSettings = safeLazy(() => import("./pages/settings/ShippingSettings"));
const PaymentsSettings = safeLazy(() => import("./pages/settings/PaymentsSettings"));
const GeneralSettings = safeLazy(() => import("./pages/settings/GeneralSettings"));
const SettingsPlaceholder = safeLazy(() => import("./pages/settings/SettingsPlaceholder"));
const CoveredPlaces = safeLazy(() => import("./pages/settings/CoveredPlaces"));
const AreasManagement = safeLazy(() => import("./pages/settings/AreasManagement"));
const DeliveryTime = safeLazy(() => import("./pages/settings/DeliveryTime"));
const Packages = safeLazy(() => import("./pages/settings/Packages"));
const ProductTypes = safeLazy(() => import("./pages/settings/ProductTypes"));
const PickupDestinations = safeLazy(() => import("./pages/settings/PickupDestinations"));
const Currencies = safeLazy(() => import("./pages/settings/Currencies"));
const Localization = safeLazy(() => import("./pages/settings/Localization"));
const NotificationsSettings = safeLazy(() => import("./pages/settings/NotificationsSettings"));
const GoogleSettings = safeLazy(() => import("./pages/settings/GoogleSettings"));
const BackupDatabase = safeLazy(() => import("./pages/settings/BackupDatabase"));
const Themes = safeLazy(() => import("./pages/settings/Themes"));
const ThemeSettings = safeLazy(() => import("./pages/settings/ThemeSettings"));
const ApiSecretsSettings = safeLazy(() => import("./pages/settings/ApiSecretsSettings"));
const CurrencyManagement = safeLazy(() => import("./pages/settings/CurrencyManagement"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchOnMount: "always",
      staleTime: 0,
    },
  },
});

const Loading = () => (
  <div className="flex items-center justify-center min-h-[200px]">
    <div className="space-y-3 w-full max-w-md px-6">
      <div className="h-3 rounded-full bg-muted animate-pulse" />
      <div className="h-3 rounded-full bg-muted animate-pulse w-3/4" />
      <div className="h-3 rounded-full bg-muted animate-pulse w-1/2" />
    </div>
  </div>
);

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);

  return null;
};


const App = () => (
  <QueryClientProvider client={queryClient}>
    <CurrencyProvider>
    <TooltipProvider>
      <Toaster />
        <AutoTableExportButtons />
      <Sonner />
      <BrowserRouter>
        <ScrollToTop />
        <GoogleAnalytics />
        <Suspense fallback={<Loading />}>
          <Routes>
            {/* Public site */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/services" element={<Services />} />
              <Route path="/services/product-sourcing" element={<ProductSourcingService />} />
              <Route path="/services/supplier-payment-facilitation" element={<SupplierPaymentFacilitation />} />
              <Route path="/services/customs-clearance" element={<CustomsClearanceService />} />
              <Route path="/services/export" element={<ExportService />} />
              <Route path="/how-we-work" element={<HowWeWork />} />
              <Route path="/gallery" element={<Gallery />} />
              <Route path="/podcast" element={<Podcast />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/refund-policy" element={<RefundPolicy />} />
              <Route path="/faq" element={<Faq />} />
              <Route path="/calculator" element={<PublicCalculator />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/locations" element={<Locations />} />
              <Route path="/tracking" element={<Tracking />} />
              <Route path="/support" element={<Support />} />
              <Route path="/about" element={<About />} />
              <Route path="/join-us" element={<JoinUs />} />
              <Route path="/shop" element={<Shop />} />
              <Route path="/language" element={<Language />} />
            </Route>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route element={<DashboardLayout />}>
              <Route path="/dashboard" element={<RequireNonCustomer><Suspense fallback={<Loading />}><Dashboard /></Suspense></RequireNonCustomer>} />
              <Route path="/profile" element={<Suspense fallback={<Loading />}><Profile /></Suspense>} />

              {/* Content Management */}
              <Route path="/settings/content" element={<RequireNonCustomer><CmsEditor /></RequireNonCustomer>} />

              {/* Customer Portal */}
              <Route path="/customer/dashboard" element={<RequireRole allowedRoles={["customer"]}><CustomerOverview /></RequireRole>} />
              <Route path="/customer/inbox" element={<RequireRole allowedRoles={["customer"]}><CustomerInbox /></RequireRole>} />
              <Route path="/customer/shipments" element={<RequireRole allowedRoles={["customer"]}><CustomerDashboard /></RequireRole>} />
              <Route path="/customer/place-order" element={<RequireRole allowedRoles={["customer"]}><CustomerPlaceOrder /></RequireRole>} />
              <Route path="/customer/request-delivery" element={<RequireRole allowedRoles={["customer"]}><CustomerRequestDelivery /></RequireRole>} />
              <Route path="/customer/tracking" element={<RequireRole allowedRoles={["customer"]}><CustomerTracking /></RequireRole>} />
              <Route path="/customer/problem-parcels" element={<RequireRole allowedRoles={["customer"]}><CustomerProblemParcels /></RequireRole>} />
              <Route path="/customer/claims" element={<RequireRole allowedRoles={["customer"]}><CustomerClaims /></RequireRole>} />
              <Route path="/customer/refunds" element={<RequireRole allowedRoles={["customer"]}><CustomerClaims /></RequireRole>} />
              <Route path="/customer/warehouse-address" element={<RequireRole allowedRoles={["customer"]}><CustomerWarehouseAddress /></RequireRole>} />
              <Route path="/customer/addresses" element={<RequireRole allowedRoles={["customer"]}><CustomerAddresses /></RequireRole>} />
              <Route path="/customer/pay-on-behalf" element={<RequireRole allowedRoles={["customer"]}><CustomerPayOnBehalf /></RequireRole>} />
              <Route path="/customer/payments" element={<RequireRole allowedRoles={["customer"]}><CustomerPayments /></RequireRole>} />
              <Route path="/customer/profile" element={<RequireRole allowedRoles={["customer"]}><CustomerProfile /></RequireRole>} />
              <Route path="/customer/security" element={<RequireRole allowedRoles={["customer"]}><CustomerSecurity /></RequireRole>} />
              <Route path="/customer/support-tickets" element={<RequireRole allowedRoles={["customer"]}><CustomerSupportTickets /></RequireRole>} />
              <Route path="/customer/support-tickets/:ticketId" element={<RequireRole allowedRoles={["customer"]}><CustomerSupportTicketDetail /></RequireRole>} />
              <Route path="/customer/reports" element={<RequireRole allowedRoles={["customer"]}><CustomerReports /></RequireRole>} />
              <Route path="/customer/sourcing" element={<RequireRole allowedRoles={["customer"]}><CustomerSourcing /></RequireRole>} />
              <Route path="/customer/supplier-requests" element={<RequireRole allowedRoles={["customer"]}><CustomerSupplierRequests /></RequireRole>} />
              <Route path="/customer/custom-payment" element={<RequireRole allowedRoles={["customer"]}><CustomerCustomPayment /></RequireRole>} />

              {/* Agents Admin */}
              <Route path="/agents" element={<RequireRole allowedRoles={["admin"]}><AgentList /></RequireRole>} />
              <Route path="/agents/commissions" element={<RequireRole allowedRoles={["admin"]}><AdminAgentCommissions /></RequireRole>} />
              <Route path="/agents/reports" element={<RequireRole allowedRoles={["admin"]}><AdminAgentReports /></RequireRole>} />

              {/* Agent Portal */}
              <Route path="/agent/dashboard" element={<RequireRole allowedRoles={["agent"]}><AgentDashboard /></RequireRole>} />
              <Route path="/agent/shipments" element={<RequireRole allowedRoles={["agent"]}><AgentShipments /></RequireRole>} />
              <Route path="/agent/request-delivery" element={<RequireRole allowedRoles={["agent"]}><AgentRequestDelivery /></RequireRole>} />
              <Route path="/agent/customers" element={<RequireRole allowedRoles={["agent"]}><AgentCustomers /></RequireRole>} />
              <Route path="/agent/customers/create" element={<RequireRole allowedRoles={["agent"]}><AgentCustomerCreate /></RequireRole>} />
              <Route path="/agent/place-order" element={<RequireRole allowedRoles={["agent"]}><AgentPlaceOrder /></RequireRole>} />
              <Route path="/agent/payments" element={<RequireRole allowedRoles={["agent"]}><AgentPayments /></RequireRole>} />
              <Route path="/agent/commissions" element={<RequireRole allowedRoles={["agent"]}><AgentCommissions /></RequireRole>} />
              <Route path="/agent/pricing" element={<RequireRole allowedRoles={["agent"]}><AgentPricing /></RequireRole>} />
              <Route path="/agent/tracking" element={<RequireRole allowedRoles={["agent"]}><AgentTracking /></RequireRole>} />
              <Route path="/agent/refunds" element={<RequireRole allowedRoles={["agent"]}><AgentRefunds /></RequireRole>} />
              <Route path="/agent/reports" element={<RequireRole allowedRoles={["agent"]}><AgentReports /></RequireRole>} />
              <Route path="/agent/sourcing" element={<RequireRole allowedRoles={["agent"]}><AgentSourcing /></RequireRole>} />
              <Route path="/agent/support" element={<RequireRole allowedRoles={["agent"]}><AgentSupport /></RequireRole>} />
              <Route path="/agent/support/:ticketId" element={<RequireRole allowedRoles={["agent"]}><AgentSupportTicketDetail /></RequireRole>} />
              <Route path="/agent/settings" element={<RequireRole allowedRoles={["agent"]}><AgentSettings /></RequireRole>} />
              <Route path="/agent/withdrawals" element={<RequireRole allowedRoles={["agent"]}><AgentWithdrawals /></RequireRole>} />
              <Route path="/agent/supplier-requests" element={<RequireRole allowedRoles={["agent"]}><AgentSupplierRequests /></RequireRole>} />
              <Route path="/agent/custom-payment" element={<RequireRole allowedRoles={["agent"]}><AgentCustomPayment /></RequireRole>} />

              {/* Finance Portal */}
              <Route path="/finance/dashboard" element={<RequireNonCustomer><FinanceDashboard /></RequireNonCustomer>} />
              <Route path="/finance/payments" element={<RequireNonCustomer><FinancePayments /></RequireNonCustomer>} />
              <Route path="/finance/claims" element={<RequireNonCustomer><FinanceClaims /></RequireNonCustomer>} />
              <Route path="/finance/invoices" element={<RequireNonCustomer><FinanceInvoices /></RequireNonCustomer>} />
              <Route path="/finance/cod" element={<RequireNonCustomer><FinanceCodSettlements /></RequireNonCustomer>} />
              <Route path="/finance/commissions" element={<RequireNonCustomer><FinanceCommissions /></RequireNonCustomer>} />
              <Route path="/finance/reports" element={<RequireNonCustomer><FinanceReports /></RequireNonCustomer>} />
              <Route path="/finance/payment-history" element={<RequireNonCustomer><FinancePaymentHistory /></RequireNonCustomer>} />
              <Route path="/finance/receivable" element={<RequireNonCustomer><FinanceAccountsReceivable /></RequireNonCustomer>} />
              <Route path="/finance/reconciliation" element={<RequireNonCustomer><FinanceReconciliation /></RequireNonCustomer>} />
              <Route path="/finance/billing" element={<RequireNonCustomer><FinanceBilling /></RequireNonCustomer>} />
              <Route path="/finance/client-statements" element={<RequireNonCustomer><FinanceClientStatements /></RequireNonCustomer>} />
              <Route path="/finance/wallets" element={<RequireNonCustomer><FinanceWallets /></RequireNonCustomer>} />
              <Route path="/finance/settings" element={<RequireNonCustomer><FinanceSettings /></RequireNonCustomer>} />

              {/* Driver Portal */}
              <Route path="/driver/dashboard" element={<RequireRole allowedRoles={["driver"]}><DriverDashboard /></RequireRole>} />
              <Route path="/driver/deliveries" element={<RequireRole allowedRoles={["driver"]}><DriverDeliveries /></RequireRole>} />
              <Route path="/driver/performance" element={<RequireRole allowedRoles={["driver"]}><DriverPerformance /></RequireRole>} />
              <Route path="/driver/incidents" element={<RequireRole allowedRoles={["driver"]}><DriverIncidents /></RequireRole>} />
              <Route path="/driver/settings" element={<RequireRole allowedRoles={["driver"]}><DriverSettings /></RequireRole>} />
              <Route path="/driver/shipments" element={<Navigate to="/driver/deliveries" replace />} />
              <Route path="/driver/escalated-tickets" element={<Navigate to="/support/my-tickets" replace />} />

              {/* Compliance Portal */}
              <Route path="/compliance/dashboard" element={<RequireNonCustomer><ComplianceDashboard /></RequireNonCustomer>} />
              <Route path="/compliance/queue" element={<RequireNonCustomer><ComplianceQueue /></RequireNonCustomer>} />
              <Route path="/compliance/charges" element={<RequireNonCustomer><ComplianceCharges /></RequireNonCustomer>} />

              {/* Marketing Portal */}
              <Route path="/marketing/dashboard" element={<RequireNonCustomer><MarketingDashboard /></RequireNonCustomer>} />
              <Route path="/marketing/campaigns" element={<RequireNonCustomer><MarketingCampaigns /></RequireNonCustomer>} />
              <Route path="/marketing/leads" element={<RequireNonCustomer><MarketingLeads /></RequireNonCustomer>} />
              <Route path="/marketing/content" element={<RequireNonCustomer><MarketingContent /></RequireNonCustomer>} />
              <Route path="/marketing/analytics" element={<RequireNonCustomer><MarketingAnalytics /></RequireNonCustomer>} />
              <Route path="/marketing/promotions" element={<RequireNonCustomer><MarketingPromotions /></RequireNonCustomer>} />
              <Route path="/marketing/social" element={<RequireNonCustomer><MarketingSocial /></RequireNonCustomer>} />
              <Route path="/marketing/email" element={<RequireNonCustomer><MarketingEmail /></RequireNonCustomer>} />
              <Route path="/marketing/budget" element={<RequireNonCustomer><MarketingBudget /></RequireNonCustomer>} />
              <Route path="/marketing/sales" element={<RequireNonCustomer><MarketingSales /></RequireNonCustomer>} />
              <Route path="/marketing/reports" element={<RequireNonCustomer><MarketingReports /></RequireNonCustomer>} />
              <Route path="/marketing/settings" element={<RequireNonCustomer><MarketingSettings /></RequireNonCustomer>} />

              {/* Support Portal */}
              <Route path="/support/dashboard" element={<RequireNonCustomer><SupportDashboard /></RequireNonCustomer>} />
              <Route path="/support/tickets" element={<RequireNonCustomer><SupportTickets /></RequireNonCustomer>} />
              <Route path="/support/tickets/:ticketId" element={<RequireNonCustomer><SupportTicketDetail /></RequireNonCustomer>} />
              <Route path="/support/department/:department" element={<RequireNonCustomer><SupportDepartmentTickets /></RequireNonCustomer>} />
              <Route path="/support/my-tickets" element={<RequireNonCustomer><SupportMyTickets /></RequireNonCustomer>} />
              <Route path="/support/tickets/create" element={<RequireNonCustomer><SupportCreateTicket /></RequireNonCustomer>} />

              <Route path="/support/escalated" element={<RequireNonCustomer><SupportEscalated /></RequireNonCustomer>} />
              <Route path="/support/customer-profiles" element={<RequireNonCustomer><SupportCustomerProfiles /></RequireNonCustomer>} />
              <Route path="/support/sla" element={<RequireNonCustomer><SupportSlaMonitoring /></RequireNonCustomer>} />
              <Route path="/support/reports" element={<RequireNonCustomer><SupportReports /></RequireNonCustomer>} />
              <Route path="/support/problem-parcels" element={<RequireNonCustomer><SupportProblemParcels /></RequireNonCustomer>} />
              <Route path="/support/sourcing-requests" element={<RequireNonCustomer><SupportSourcingRequests /></RequireNonCustomer>} />
              <Route path="/support/claims" element={<RequireNonCustomer><SupportClaims /></RequireNonCustomer>} />

              <Route path="/support/notes" element={<RequireNonCustomer><SupportInternalNotes /></RequireNonCustomer>} />
              <Route path="/support/knowledge-base" element={<RequireNonCustomer><SupportKnowledgeBase /></RequireNonCustomer>} />
              <Route path="/support/bulk-sms" element={<RequireNonCustomer><SupportBulkSms /></RequireNonCustomer>} />
              <Route path="/support/supplier-requests" element={<RequireNonCustomer><SupportSupplierRequests /></RequireNonCustomer>} />

              {/* Warehouses */}
              <Route path="/warehouses" element={<RequireNonCustomer><BranchList /></RequireNonCustomer>} />
              <Route path="/warehouses/create" element={<RequireNonCustomer><BranchCreate /></RequireNonCustomer>} />
              <Route path="/warehouses/:id/edit" element={<RequireNonCustomer><BranchEdit /></RequireNonCustomer>} />

              {/* Customers */}
              <Route path="/customers" element={<RequireNonCustomer><CustomerList /></RequireNonCustomer>} />
              <Route path="/customers/create" element={<RequireNonCustomer><CustomerCreate /></RequireNonCustomer>} />
              <Route path="/customers/:id/edit" element={<RequireNonCustomer><CustomerEdit /></RequireNonCustomer>} />

              {/* Drivers */}
              <Route path="/drivers" element={<RequireNonCustomer><DriverList /></RequireNonCustomer>} />
              <Route path="/drivers/create" element={<RequireNonCustomer><DriverCreate /></RequireNonCustomer>} />
              <Route path="/drivers/:id/edit" element={<RequireNonCustomer><DriverEdit /></RequireNonCustomer>} />
              <Route path="/drivers/incident-reports" element={<RequireRole allowedRoles={["admin", "staff"]}><DriverIncidentReports /></RequireRole>} />

              {/* Receivers */}
              <Route path="/receivers" element={<RequireNonCustomer><ReceiverList /></RequireNonCustomer>} />
              <Route path="/receivers/create" element={<RequireNonCustomer><ReceiverCreate /></RequireNonCustomer>} />
              <Route path="/receivers/:id/edit" element={<RequireNonCustomer><ReceiverEdit /></RequireNonCustomer>} />

              {/* Missions */}
              <Route path="/missions" element={<RequireNonCustomer><MissionList /></RequireNonCustomer>} />
              <Route path="/missions/create" element={<RequireNonCustomer><MissionCreate /></RequireNonCustomer>} />
              <Route path="/missions/:id/edit" element={<RequireNonCustomer><MissionEdit /></RequireNonCustomer>} />

              {/* Transactions */}
              <Route path="/transactions" element={<RequireNonCustomer><TransactionList /></RequireNonCustomer>} />
              <Route path="/transactions/create" element={<RequireNonCustomer><TransactionCreate /></RequireNonCustomer>} />

              {/* Legacy shipment URLs */}
              <Route path="/shipments" element={<Navigate to="/warehouse/shipments" replace />} />
              <Route path="/shipments/create" element={<Navigate to="/warehouse/create-shipment" replace />} />
              <Route path="/shipments/*" element={<Navigate to="/warehouse/shipments" replace />} />

              {/* Users */}
              <Route path="/users" element={<RequireNonCustomer><UserList /></RequireNonCustomer>} />
              <Route path="/users/create" element={<RequireNonCustomer><UserCreate /></RequireNonCustomer>} />
              <Route path="/users/:id/edit" element={<RequireNonCustomer><UserEdit /></RequireNonCustomer>} />

              {/* Roles */}
              <Route path="/roles" element={<RequireNonCustomer><RoleList /></RequireNonCustomer>} />
              <Route path="/roles/create" element={<RequireNonCustomer><RoleCreate /></RequireNonCustomer>} />
              <Route path="/roles/portal-assignments" element={<RequireNonCustomer><StaffPortalAssignments /></RequireNonCustomer>} />

              <Route path="/shipment-team/*" element={<Navigate to="/dashboard" replace />} />

              {/* Warehouse */}
              <Route path="/warehouse/dashboard" element={<RequireNonCustomer><WarehouseDashboard /></RequireNonCustomer>} />
              <Route path="/warehouse/parcels" element={<RequireNonCustomer><WarehouseAllParcels /></RequireNonCustomer>} />
              <Route path="/warehouse/shipments" element={<RequireNonCustomer><WarehouseAllShipments /></RequireNonCustomer>} />
              <Route path="/warehouse/pending" element={<RequireNonCustomer><WarehousePendingShipments /></RequireNonCustomer>} />
              <Route path="/warehouse/receive" element={<RequireNonCustomer><WarehouseReceive /></RequireNonCustomer>} />
              <Route path="/warehouse/status" element={<RequireNonCustomer><WarehouseStatusUpdate /></RequireNonCustomer>} />
              <Route path="/warehouse/problems" element={<RequireNonCustomer><WarehouseProblemParcels /></RequireNonCustomer>} />
              <Route path="/warehouse/consolidation" element={<RequireNonCustomer><WarehouseConsolidation /></RequireNonCustomer>} />
              <Route path="/warehouse/inspections" element={<RequireNonCustomer><WarehouseInspectionUploads /></RequireNonCustomer>} />
              <Route path="/warehouse/outgoing" element={<RequireNonCustomer><WarehouseOutgoingContainers /></RequireNonCustomer>} />
              <Route path="/warehouse/customers" element={<RequireNonCustomer><WarehouseCustomers /></RequireNonCustomer>} />
              <Route path="/warehouse/staff" element={<RequireNonCustomer><WarehouseStaff /></RequireNonCustomer>} />
              <Route path="/warehouse/drivers" element={<RequireNonCustomer><WarehouseDrivers /></RequireNonCustomer>} />
              <Route path="/warehouse/deliveries" element={<RequireNonCustomer><WarehouseDeliveries /></RequireNonCustomer>} />
              <Route path="/warehouse/delivery-requests" element={<RequireNonCustomer><WarehouseDeliveryRequests /></RequireNonCustomer>} />
              <Route path="/warehouse/create-shipment" element={<RequireNonCustomer><WarehouseCreateShipment /></RequireNonCustomer>} />

              {/* Reports */}
              <Route path="/reports/shipments" element={<RequireNonCustomer><ShipmentsReport /></RequireNonCustomer>} />
              <Route path="/reports/transactions" element={<Navigate to="/reports/shipments" replace />} />
              <Route path="/reports/customers" element={<RequireNonCustomer><CustomersReport /></RequireNonCustomer>} />
              <Route path="/reports/warehouses" element={<RequireNonCustomer><BranchesReport /></RequireNonCustomer>} />
              <Route path="/reports/drivers" element={<RequireNonCustomer><DriversReport /></RequireNonCustomer>} />
              <Route path="/reports/:reportId" element={<RequireNonCustomer><ReportPlaceholder /></RequireNonCustomer>} />

              {/* Settings */}
              <Route path="/settings/shipping-rates" element={<RequireNonCustomer><ShippingRates /></RequireNonCustomer>} />
              <Route path="/settings/shipping" element={<RequireNonCustomer><ShippingSettings /></RequireNonCustomer>} />
              <Route path="/settings/payments" element={<RequireNonCustomer><PaymentsSettings /></RequireNonCustomer>} />
              <Route path="/settings/general" element={<RequireNonCustomer><GeneralSettings /></RequireNonCustomer>} />
              <Route path="/settings/covered-places" element={<RequireNonCustomer><CoveredPlaces /></RequireNonCustomer>} />
              <Route path="/settings/areas" element={<RequireNonCustomer><AreasManagement /></RequireNonCustomer>} />
              <Route path="/settings/delivery-time" element={<RequireNonCustomer><DeliveryTime /></RequireNonCustomer>} />
              <Route path="/settings/packages" element={<RequireNonCustomer><Packages /></RequireNonCustomer>} />
              <Route path="/settings/product-types" element={<RequireNonCustomer><ProductTypes /></RequireNonCustomer>} />
              <Route path="/settings/pickup-destinations" element={<RequireNonCustomer><PickupDestinations /></RequireNonCustomer>} />
              <Route path="/settings/currencies" element={<RequireNonCustomer><Currencies /></RequireNonCustomer>} />
              <Route path="/settings/localization" element={<RequireNonCustomer><Localization /></RequireNonCustomer>} />
              <Route path="/settings/notifications" element={<RequireNonCustomer><NotificationsSettings /></RequireNonCustomer>} />
              <Route path="/settings/google" element={<RequireNonCustomer><GoogleSettings /></RequireNonCustomer>} />
              <Route path="/settings/backup" element={<RequireNonCustomer><BackupDatabase /></RequireNonCustomer>} />
              <Route path="/settings/themes" element={<RequireNonCustomer><Themes /></RequireNonCustomer>} />
              <Route path="/settings/theme-settings" element={<RequireNonCustomer><ThemeSettings /></RequireNonCustomer>} />
              <Route path="/settings/api-secrets" element={<RequireNonCustomer><ApiSecretsSettings /></RequireNonCustomer>} />
              <Route path="/settings/currency-management" element={<RequireNonCustomer><CurrencyManagement /></RequireNonCustomer>} />
              <Route path="/settings/:sectionId" element={<RequireNonCustomer><SettingsPlaceholder /></RequireNonCustomer>} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
    </CurrencyProvider>
  </QueryClientProvider>
);

export default App;
