import { useState, useEffect } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Eye, Loader2, Settings2, User } from "lucide-react";

interface AgentUser {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  bank_name: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  created_at: string;
  managed_clients: number;
  commission_rate_kg: number;
  commission_rate_cbm: number;
}

const AgentList = () => {
  const [agents, setAgents] = useState<AgentUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAgents = async () => {
    setIsLoading(true);

    const [profilesRes, rolesRes, customersRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("*").eq("role", "agent"),
      supabase.from("customers").select("user_id, agent_id"),
    ]);

    if (profilesRes.error || rolesRes.error) {
      toast.error("Failed to fetch agents");
      setIsLoading(false);
      return;
    }

    const agentUserIds = new Set((rolesRes.data || []).map((r) => r.user_id));

    const agentPortfolioCount = new Map<string, number>();
    (customersRes.data || []).forEach((c) => {
      if (!c.agent_id) return;
      agentPortfolioCount.set(c.agent_id, (agentPortfolioCount.get(c.agent_id) || 0) + 1);
    });

    const agentList: AgentUser[] = (profilesRes.data || [])
      .filter((p) => agentUserIds.has(p.user_id))
      .map((p) => ({
        id: p.id,
        user_id: p.user_id,
        full_name: p.full_name,
        email: p.email,
        phone: p.phone,
        address: p.address,
        city: p.city,
        country: p.country,
        bank_name: p.bank_name,
        bank_account_name: p.bank_account_name,
        bank_account_number: p.bank_account_number,
        created_at: p.created_at,
        managed_clients: agentPortfolioCount.get(p.user_id) || 0,
        commission_rate_kg: Number(p.commission_rate_kg || 0.5),
        commission_rate_cbm: Number(p.commission_rate_cbm || 10.0),
      }));

    setAgents(agentList);
    setIsLoading(false);
  };

  const [selectedAgent, setSelectedAgent] = useState<AgentUser | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editRates, setEditRates] = useState({ kg: "0.5", cbm: "10.0" });

  const handleManage = (agent: AgentUser) => {
    setSelectedAgent(agent);
    setEditRates({
      kg: String(agent.commission_rate_kg),
      cbm: String(agent.commission_rate_cbm),
    });
  };

  const handleSaveRates = async () => {
    if (!selectedAgent) return;
    setIsSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        commission_rate_kg: Number(editRates.kg),
        commission_rate_cbm: Number(editRates.cbm),
      })
      .eq("user_id", selectedAgent.user_id);

    if (error) {
      toast.error("Failed to update commission rates");
    } else {
      toast.success("Commission rates updated successfully");
      setSelectedAgent(null);
      await fetchAgents();
    }
    setIsSaving(false);
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const columns: Column<AgentUser>[] = [
    { key: "full_name", label: "Name" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone", render: (item) => item.phone || "-" },
    {
      key: "managed_clients",
      label: "Managed Clients",
      render: (item) => (
        <StatusBadge
          status={item.managed_clients > 0 ? "active" : "inactive"}
          label={`${item.managed_clients} client${item.managed_clients === 1 ? "" : "s"}`}
        />
      ),
    },
    {
      key: "created_at",
      label: "Joined",
      render: (item) => format(new Date(item.created_at), "dd MMM yyyy"),
    },
    {
      key: "actions",
      label: "Actions",
      render: (item) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
            onClick={() => handleManage(item)}
          >
            <Settings2 className="h-4 w-4" />
            Manage
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => handleManage(item)}
            title="View Details"
          >
            <Eye className="h-4 w-4 text-blue-600" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Agents"
        
      />
      <DataTable
        columns={columns}
        data={agents}
        isLoading={isLoading}
        searchPlaceholder="Search agents..."
      />

      <Dialog open={!!selectedAgent} onOpenChange={(open) => !open && setSelectedAgent(null)}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-blue-600" />
              Agent Profile & Settings
            </DialogTitle>
          </DialogHeader>

          {selectedAgent && (
            <div className="space-y-6 py-4">
              <section>
                <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Personal Details</h4>
                <div className="grid grid-cols-2 gap-4 rounded-lg bg-muted/50 p-4">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Full Name</p>
                    <p className="text-sm font-semibold">{selectedAgent.full_name}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Email Address</p>
                    <p className="text-sm font-semibold truncate">{selectedAgent.email}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Phone Number</p>
                    <p className="text-sm font-semibold">{selectedAgent.phone || "-"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Address</p>
                    <p className="text-sm font-semibold">{selectedAgent.address || "-"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase">City</p>
                    <p className="text-sm font-semibold">{selectedAgent.city || "-"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Country</p>
                    <p className="text-sm font-semibold">{selectedAgent.country || "-"}</p>
                  </div>
                </div>
              </section>

              <section>
                <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Bank Details</h4>
                <div className="grid grid-cols-2 gap-4 rounded-lg bg-blue-50/50 p-4 border border-blue-100">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-blue-600 uppercase">Bank Name</p>
                    <p className="text-sm font-semibold">{selectedAgent.bank_name || "Not provided"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-blue-600 uppercase">Account Name</p>
                    <p className="text-sm font-semibold">{selectedAgent.bank_account_name || "Not provided"}</p>
                  </div>
                  <div className="col-span-2 space-y-1">
                    <p className="text-xs font-medium text-blue-600 uppercase">Account Number</p>
                    <p className="text-sm font-bold tracking-wider">{selectedAgent.bank_account_number || "Not provided"}</p>
                  </div>
                </div>
              </section>

              <section>
                <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Commission Settings</h4>
                <div className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-lg border">
                  <div className="space-y-2">
                    <Label htmlFor="rate-kg" className="text-xs font-bold">Rate per KG (USD)</Label>
                    <Input
                      id="rate-kg"
                      type="number"
                      step="0.01"
                      value={editRates.kg}
                      onChange={(e) => setEditRates({ ...editRates, kg: e.target.value })}
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rate-cbm" className="text-xs font-bold">Rate per CBM (USD)</Label>
                    <Input
                      id="rate-cbm"
                      type="number"
                      step="0.01"
                      value={editRates.cbm}
                      onChange={(e) => setEditRates({ ...editRates, cbm: e.target.value })}
                      className="bg-white"
                    />
                  </div>
                </div>
              </section>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedAgent(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRates} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700">
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AgentList;

