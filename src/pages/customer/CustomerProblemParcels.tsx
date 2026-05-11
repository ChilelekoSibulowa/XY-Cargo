import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { CustomerProfileGate } from "@/components/customer/CustomerProfileGate";
import { useCustomerRecord } from "@/hooks/useCustomerRecord";

type ShipmentRow = {
  id: string;
  code: string;
  status: string;
  payment_status: string | null;
  internal_notes: string | null;
};

const CustomerProblemParcels = () => {
  const { customer } = useCustomerRecord();
  const [shipments, setShipments] = useState<ShipmentRow[]>([]);

  useEffect(() => {
    const fetchShipments = async () => {
      if (!customer) return;
      const { data } = await supabase
        .from("shipments")
        .select("id, code, status, payment_status, internal_notes")
        .eq("customer_id", customer.id);
      const flagged = (data || []).filter(
        (shipment) => shipment.payment_status !== "completed" || shipment.internal_notes
      );
      setShipments(flagged);
    };
    fetchShipments();
  }, [customer]);

  return (
    <CustomerProfileGate>
      <div className="space-y-6">
        <PageHeader title="Problem Parcels"  />
        <Card className="border-border/70">
          <CardContent className="p-4 space-y-3 text-sm text-muted-foreground">
            {shipments.length === 0 && <p>No problem parcels at the moment.</p>}
            {shipments.map((shipment) => (
              <div key={shipment.id} className="flex items-center justify-between border-b pb-2">
                <div>
                  <p className="font-semibold text-foreground">{shipment.code}</p>
                  <p className="text-xs text-muted-foreground">
                    Status: {shipment.status} - Payment: {shipment.payment_status || "pending"}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {shipment.internal_notes ? "Needs review" : "Payment pending"}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </CustomerProfileGate>
  );
};

export default CustomerProblemParcels;


