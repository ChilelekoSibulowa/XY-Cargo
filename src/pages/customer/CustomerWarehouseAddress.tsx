import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { CustomerProfileGate } from "@/components/customer/CustomerProfileGate";
import { useCustomerRecord } from "@/hooks/useCustomerRecord";
import { supabase } from "@/integrations/supabase/client";

type Branch = {
  name: string;
  address: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
};

const CustomerWarehouseAddress = () => {
  const { customer } = useCustomerRecord();
  const [branch, setBranch] = useState<Branch | null>(null);

  useEffect(() => {
    const fetchBranch = async () => {
      if (!customer?.branch_id) {
        setBranch(null);
        return;
      }
      const { data } = await supabase
        .from("branches")
        .select("name, address, city, country, phone")
        .eq("id", customer.branch_id)
        .maybeSingle();
      if (data) {
        setBranch(data as Branch);
      }
    };
    fetchBranch();
  }, [customer]);

  return (
    <CustomerProfileGate>
      <div className="space-y-6">
        <PageHeader title="Warehouse Address"  />
        <Card className="border-border/70">
          <CardContent className="space-y-4 p-6 text-sm text-muted-foreground">
            <div className="space-y-3">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">Customer Name:</span>
                <span className="text-base font-semibold text-foreground">{customer?.full_name ?? "-"}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">Phone:</span>
                <span className="text-foreground">{customer?.phone ?? "-"}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">Warehouse Address:</span>
                {branch ? (
                  <p className="text-foreground leading-relaxed">
                    {[branch.address, branch.city, branch.country].filter(Boolean).join(", ")}
                  </p>
                ) : (
                  <p className="text-foreground leading-relaxed">
                    No warehouse assigned yet. Contact support to assign your warehouse address.
                  </p>
                )}
              </div>
            </div>
            {branch && (
              <div className="border-t border-border/50 pt-4 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Warehouse Info</p>
                <p className="text-foreground font-semibold">{branch.name}</p>
                {branch.address && <p>{branch.address}</p>}
                <p>{branch.city}, {branch.country}</p>
                {branch.phone && <p>{branch.phone}</p>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </CustomerProfileGate>
  );
};

export default CustomerWarehouseAddress;



