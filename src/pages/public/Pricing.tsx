import { useEffect, useMemo, useState } from "react";
import { useDefaultCurrency } from "@/hooks/useDefaultCurrency";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";

type PricingRow = {
  route: string;
  air?: string;
  sea?: string;
  handling: string;
};

const fallbackRows: PricingRow[] = [
  {
    route: "China to Lusaka",
    air: "K 6.20 / kg",
    sea: "K 180 / CBM",
    handling: "K 35",
  },
  {
    route: "UAE to Ndola/Kitwe",
    air: "K 5.50 / kg",
    sea: "K 165 / CBM",
    handling: "K 30",
  },
  {
    route: "UK to Livingstone",
    air: "K 6.80 / kg",
    sea: "K 190 / CBM",
    handling: "K 40",
  },
];

const Pricing = () => {
  const { formatAmount } = useDefaultCurrency();
  const [rows, setRows] = useState<PricingRow[]>(fallbackRows);

  useEffect(() => {
    const fetchRates = async () => {
      const { data } = await supabase
        .from("shipping_rates")
        .select("id, name, service_type, rate_per_kg, rate_per_cbm, minimum_charge")
        .eq("is_active", true)
        .order("name");

      if (!data || data.length === 0) {
        return;
      }

      const mapped = data.reduce<Record<string, PricingRow>>((acc, rate) => {
        const routeKey = rate.name?.trim() || "Route";
        const row = acc[routeKey] || {
          route: routeKey,
          handling: formatAmount(rate.minimum_charge || 0),
        };

        if (rate.service_type === "air") {
          row.air = `${formatAmount(rate.rate_per_kg || 0)} / kg`;
        }
        if (rate.service_type === "sea") {
          row.sea = `${formatAmount(rate.rate_per_cbm || 0)} / CBM`;
        }

        acc[routeKey] = row;
        return acc;
      }, {});

      const merged = Object.values(mapped);
      setRows(merged);
    };

    fetchRates();
  }, []);

  const normalizedRows = useMemo(
    () =>
      rows.map((row) => ({
        ...row,
        air: row.air || "On request",
        sea: row.sea || "On request",
      })),
    [rows]
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-14">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Pricing</p>
        <h1 className="text-3xl font-semibold text-slate-900 md:text-4xl">
          Transparent rates by lane and service type.
        </h1>
        <p className="text-sm text-slate-600 md:text-base">
          Rates include base freight only. Surcharges apply for fragile handling, customs inspection, and insurance.
        </p>
      </div>

      <Card className="border-slate-200/70 bg-white">
        <CardContent className="p-6">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Route</TableHead>
                <TableHead>Air Freight</TableHead>
                <TableHead>Sea Freight</TableHead>
                <TableHead>Handling Fee</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {normalizedRows.map((row) => (
                <TableRow key={row.route}>
                  <TableCell className="font-medium text-slate-900">{row.route}</TableCell>
                  <TableCell>{row.air}</TableCell>
                  <TableCell>{row.sea}</TableCell>
                  <TableCell>{row.handling}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          {
            title: "Special handling",
            detail: "Fragile, lithium, oversized goods start from K 65 per package.",
          },
          {
            title: "Customs support",
            detail: "Documentation, duties, and inspection support available per shipment.",
          },
          {
            title: "Value-added services",
            detail: "Consolidation, inspection, and insurance packages available on request.",
          },
        ].map((item) => (
          <Card key={item.title} className="border-slate-200/70 bg-white">
            <CardContent className="space-y-2 p-5">
              <h3 className="text-base font-semibold text-slate-900">{item.title}</h3>
              <p className="text-sm text-slate-600">{item.detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Pricing;
