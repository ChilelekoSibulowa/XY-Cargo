import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, Column } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDefaultCurrency } from "@/hooks/useDefaultCurrency";
import { downloadCsv, getShipmentInvoiceTotal, getShipmentOutstandingBalance, openPrintWindow, toNumber } from "@/lib/financePortal";
import { fetchLogo } from "@/hooks/useLogo";
import { toast } from "sonner";
import { Download, Eye, Printer } from "lucide-react";

 type Row = {
  id: string;
  code: string;
  full_name: string;
  phone: string;
  wallet_balance: number | null;
  is_active: boolean | null;
  shipment_count: number;
  paid_shipments: number;
  total_spent: number;
  outstanding: number;
};

 type ShipmentRow = {
  id: string;
  customer_id: string;
  total_cost: number;
  shipping_cost: number | null;
  paid_amount: number | null;
  payment_status: string | null;
  created_at: string;
  code: string;
};

 const FinanceClientStatements = () => {
  const { formatAmount } = useDefaultCurrency();
  const [rows, setRows] = useState<Row[]>([]);
  const [shipments, setShipments] = useState<ShipmentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const [cr, sr] = await Promise.all([
        supabase.from("customers").select("id, code, full_name, phone, wallet_balance, is_active").order("full_name"),
        supabase.from("shipments").select("id, customer_id, total_cost, shipping_cost, paid_amount, payment_status, created_at, code"),
      ]);

      const customers = (cr.data || []) as any[];
      const shipmentRows = ((sr.data || []) as ShipmentRow[]).map((shipment) => ({
        ...shipment,
        total_cost: toNumber(shipment.total_cost),
        shipping_cost: shipment.shipping_cost === null ? null : toNumber(shipment.shipping_cost),
        paid_amount: shipment.paid_amount === null ? null : toNumber(shipment.paid_amount),
      }));
      setShipments(shipmentRows);

      const mapped = customers.map((c) => {
        const cs = shipmentRows.filter((s) => s.customer_id === c.id);
        const totalSpent = cs
          .filter((s) => s.payment_status === "completed")
          .reduce((sum, x) => sum + getShipmentInvoiceTotal(x), 0);
        const outstanding = cs
          .filter((s) => s.payment_status !== "completed")
          .reduce((sum, x) => sum + getShipmentOutstandingBalance(x), 0);
        return {
          ...c,
          wallet_balance: c.wallet_balance === null ? null : toNumber(c.wallet_balance),
          shipment_count: cs.length,
          paid_shipments: cs.filter((s) => s.payment_status === "completed").length,
          total_spent: totalSpent,
          outstanding,
        };
      });

      setRows(mapped);
      setIsLoading(false);
    };
    fetch();
  }, []);

  const handleDownload = async (row: Row) => {
    const customerShipments = shipments.filter((s) => s.customer_id === row.id);
    if (customerShipments.length === 0) {
      toast.error("No shipments found for this customer.");
      return;
    }

    downloadCsv(
      `client-statement-${row.code}.csv`,
      ["Shipment Code", "Invoice Total", "Outstanding", "Payment Status", "Date"],
      customerShipments.map((s) => [
        s.code,
        getShipmentInvoiceTotal(s).toFixed(2),
        getShipmentOutstandingBalance(s).toFixed(2),
        s.payment_status || "pending",
        new Date(s.created_at).toLocaleDateString(),
      ]),
    );
  };

  const handlePrint = async (row: Row) => {
    const customerShipments = shipments.filter((s) => s.customer_id === row.id);
    const rowsHtml = customerShipments.map((shipment) => `
      <tr>
        <td>${shipment.code}</td>
        <td>${formatAmount(getShipmentInvoiceTotal(shipment))}</td>
        <td>${formatAmount(getShipmentOutstandingBalance(shipment))}</td>
        <td>${shipment.payment_status || "pending"}</td>
        <td>${new Date(shipment.created_at).toLocaleDateString()}</td>
      </tr>
    `).join("");

    openPrintWindow(
      `Client Statement ${row.code}`,
      `<h1>Client Statement</h1><p><strong>Client:</strong> ${row.full_name} (${row.code})</p><p><strong>Phone:</strong> ${row.phone}</p><p><strong>Total Paid:</strong> ${formatAmount(row.total_spent)}</p><p><strong>Outstanding:</strong> ${formatAmount(row.outstanding)}</p><table><thead><tr><th>Shipment</th><th>Invoice Total</th><th>Outstanding</th><th>Status</th><th>Date</th></tr></thead><tbody>${rowsHtml}</tbody></table>`,
      await fetchLogo(),
    );
  };

  const totalOutstanding = useMemo(() => rows.reduce((sum, row) => sum + row.outstanding, 0), [rows]);
  const totalPaid = useMemo(() => rows.reduce((sum, row) => sum + row.total_spent, 0), [rows]);
  const activeClients = useMemo(() => rows.filter((row) => row.is_active).length, [rows]);
  const clientsWithOutstanding = useMemo(() => rows.filter((row) => row.outstanding > 0).length, [rows]);

  const columns: Column<Row>[] = [
    { key: "full_name", label: "Name", render: (r) => `${r.full_name} (${r.code})` },
    { key: "phone", label: "Phone" },
    { key: "shipment_count", label: "Shipments" },
    { key: "paid_shipments", label: "Paid Shipments" },
    { key: "total_spent", label: "Total Spent", align: "center", render: (r) => formatAmount(r.total_spent) },
    { key: "outstanding", label: "Outstanding", align: "center", render: (r) => formatAmount(r.outstanding) },
    { key: "wallet_balance", label: "Wallet", align: "center", render: (r) => formatAmount(r.wallet_balance || 0) },
    { key: "is_active", label: "Status", render: (r) => <Badge variant={r.is_active ? "default" : "secondary"}>{r.is_active ? "Active" : "Inactive"}</Badge> },
    {
      key: "actions",
      label: "Reports",
      render: (r) => (
        <div className="flex flex-nowrap gap-2">
          <Button size="icon" variant="outline" onClick={() => handleDownload(r)} title="Download CSV">
            <Download className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="outline" onClick={() => handlePrint(r)} title="Print statement">
            <Printer className="h-4 w-4" />
          </Button>
          <Button size="icon" asChild title="View payment history">
            <Link to={`/finance/payment-history?customer=${r.id}`}>
              <Eye className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Client Financial Portal"  />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border/50 bg-white p-5 shadow-sm transition-all hover:shadow-md">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">Total Outstanding</p>
          <p className="text-2xl font-black text-slate-900 tracking-tight">{formatAmount(totalOutstanding)}</p>
        </div>
        <div className="rounded-xl border border-border/50 bg-white p-5 shadow-sm transition-all hover:shadow-md">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">Total Paid</p>
          <p className="text-2xl font-black text-emerald-600 tracking-tight">{formatAmount(totalPaid)}</p>
        </div>
        <div className="rounded-xl border border-border/50 bg-white p-5 shadow-sm transition-all hover:shadow-md">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">Active Clients</p>
          <p className="text-2xl font-black text-blue-600 tracking-tight">{activeClients}</p>
        </div>
        <div className="rounded-xl border border-border/50 bg-white p-5 shadow-sm transition-all hover:shadow-md">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">Outstanding Clients</p>
          <p className="text-2xl font-black text-orange-600 tracking-tight">{clientsWithOutstanding}</p>
        </div>
      </div>

      <DataTable columns={columns} data={rows} isLoading={isLoading} searchPlaceholder="Search clients..." />
    </div>
  );
};

export default FinanceClientStatements;

