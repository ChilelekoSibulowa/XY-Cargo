import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { MessageSquareMore, Package, Pencil } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useDefaultCurrency } from "@/hooks/useDefaultCurrency";
import {
  fetchAgentCustomers,
  fetchAgentShipments,
  fetchAgentSupportTickets,
  getCurrentAgentId,
  getShipmentInvoiceTotal,
  type AgentCustomerRow,
  type AgentShipmentRow,
  type AgentSupportTicketRow,
} from "@/lib/agentPortal";
import { toast } from "sonner";

const AgentCustomers = () => {
  const { formatAmount } = useDefaultCurrency();
  const [customers, setCustomers] = useState<AgentCustomerRow[]>([]);
  const [shipments, setShipments] = useState<AgentShipmentRow[]>([]);
  const [tickets, setTickets] = useState<AgentSupportTicketRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadCustomers = async () => {
      try {
        const agentId = await getCurrentAgentId();
        if (!agentId) {
          setCustomers([]);
          setShipments([]);
          setTickets([]);
          setIsLoading(false);
          return;
        }

        const [customerRows, shipmentScope] = await Promise.all([
          fetchAgentCustomers(agentId),
          fetchAgentShipments(agentId, 500),
        ]);
        const ticketRows = await fetchAgentSupportTickets(agentId, shipmentScope.customerIds, 150);

        setCustomers(customerRows);
        setShipments(shipmentScope.shipments);
        setTickets(ticketRows);
      } catch (error: any) {
        toast.error(error?.message || "Failed to load client portfolio.");
      } finally {
        setIsLoading(false);
      }
    };

    loadCustomers();
  }, []);

  const shipmentCounts = useMemo(() => {
    const map = new Map<string, { total: number; active: number; revenue: number }>();

    shipments.forEach((shipment) => {
      const current = map.get(shipment.customer_id) || { total: 0, active: 0, revenue: 0 };
      current.total += 1;
      if (!["closed", "returned", "returned_stock", "returned_delivered"].includes(shipment.status)) {
        current.active += 1;
      }
      current.revenue += getShipmentInvoiceTotal(shipment);
      map.set(shipment.customer_id, current);
    });

    return map;
  }, [shipments]);

  const ticketCounts = useMemo(() => {
    const map = new Map<string, number>();

    tickets.forEach((ticket) => {
      if (!ticket.customer_id || ticket.status === "closed") return;
      map.set(ticket.customer_id, (map.get(ticket.customer_id) || 0) + 1);
    });

    return map;
  }, [tickets]);

  const columns: Column<AgentCustomerRow>[] = [
    { key: "code", label: "Customer ID" },
    { key: "full_name", label: "Client" },
    { key: "phone", label: "Phone" },
    {
      key: "city",
      label: "City",
      render: (item) => item.city || "-",
    },
    {
      key: "shipments",
      label: "Shipments",
      render: (item) => shipmentCounts.get(item.id)?.total || 0,
    },
    {
      key: "active_shipments",
      label: "Active",
      render: (item) => shipmentCounts.get(item.id)?.active || 0,
    },
    {
      key: "support_requests",
      label: "Open Support",
      render: (item) => ticketCounts.get(item.id) || 0,
    },
    {
      key: "portfolio_revenue",
      label: "Portfolio Value",
      render: (item) => formatAmount(shipmentCounts.get(item.id)?.revenue || 0),
    },
    {
      key: "created_at",
      label: "Joined",
      render: (item) => format(new Date(item.created_at), "dd MMM yyyy"),
    },
    {
      key: "action",
      label: "Action",
      render: (item) => (
        <Button asChild size="icon" variant="ghost" className="h-8 w-8 p-0" title="Edit customer">
          <Link to={`/customers/${item.id}/edit?from=agent`}>
            <Pencil className="h-4 w-4 text-blue-600" />
          </Link>
        </Button>
      ),
    },
  ];

  const totals = useMemo(
    () => ({
      customers: customers.length,
      activeShipments: shipments.filter((shipment) => !["closed", "returned", "returned_stock", "returned_delivered"].includes(shipment.status)).length,
      openTickets: tickets.filter((ticket) => ticket.status !== "closed").length,
      walletBalance: customers.reduce((sum, customer) => sum + Number(customer.wallet_balance || 0), 0),
    }),
    [customers, shipments, tickets],
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Client Management"
        
        createLink="/agent/customers/create"
        createLabel="Add New Client"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Client List</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold">{isLoading ? "..." : totals.customers}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Client Shipment History</CardTitle></CardHeader>
          <CardContent className="flex items-center gap-3">
            <Package className="h-5 w-5 text-primary" />
            <div className="text-2xl font-semibold">{isLoading ? "..." : totals.activeShipments}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Client Support Requests</CardTitle></CardHeader>
          <CardContent className="flex items-center gap-3">
            <MessageSquareMore className="h-5 w-5 text-primary" />
            <div className="text-2xl font-semibold">{isLoading ? "..." : totals.openTickets}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Wallet Balance</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold">{isLoading ? "..." : formatAmount(totals.walletBalance)}</div></CardContent>
        </Card>
      </div>

      <DataTable columns={columns} data={customers} isLoading={isLoading} searchPlaceholder="Search your clients..." />
    </div>
  );
};

export default AgentCustomers;

