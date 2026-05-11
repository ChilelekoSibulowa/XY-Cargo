import { useEffect, useState } from "react";
import { Mail, Plus, Trash2, UserCheck } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CustomerProfileGate } from "@/components/customer/CustomerProfileGate";
import { useCustomerRecord } from "@/hooks/useCustomerRecord";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type BranchOption = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  country: string | null;
};

type TeamMember = {
  id: string;
  full_name: string;
  email: string;
  role: string | null;
  status: string;
  created_at: string;
};

const toText = (value: unknown) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return String(value);
  } catch {
    return "";
  }
};

const CustomerProfile = () => {
  const { customer, isLoading, refreshCustomer, createCustomer } = useCustomerRecord();
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isTeamLoading, setIsTeamLoading] = useState(false);
  const [isTeamSaving, setIsTeamSaving] = useState(false);
  const [teamForm, setTeamForm] = useState({
    full_name: "",
    email: "",
    role: "",
  });
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    country: "",
    branch_id: "",
    customer_type: "personal",
    company_name: "",
    company_registration_number: "",
    company_email: "",
    company_phone: "",
    company_address: "",
  });

  useEffect(() => {
    const fetchBranches = async () => {
      const { data } = await supabase
        .from("branches")
        .select("id, name, address, city, country")
        .eq("is_active", true)
        .eq("country", "China");
      setBranches(data || []);
    };

    fetchBranches();
  }, []);

  useEffect(() => {
    if (customer) return;

    const preloadSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;

      setForm((prev) => ({
        ...prev,
        full_name: data.session?.user.user_metadata?.full_name || prev.full_name,
        email: data.session?.user.email || prev.email,
        customer_type: data.session?.user.user_metadata?.customer_type || "personal",
      }));
    };

    preloadSession();
  }, [customer]);

  useEffect(() => {
    if (!customer) return;

    setForm({
      full_name: toText(customer.full_name),
      email: toText(customer.email),
      phone: toText(customer.phone),
      address: toText(customer.address),
      city: toText(customer.city),
      country: toText(customer.country),
      branch_id: toText(customer.branch_id),
      customer_type: toText((customer as any).customer_type) || "personal",
      company_name: toText(customer.company_name),
      company_registration_number: toText(customer.company_registration_number),
      company_email: toText(customer.company_email),
      company_phone: toText(customer.company_phone),
      company_address: toText(customer.company_address),
    });
  }, [customer]);

  const fetchTeamMembers = async () => {
    if (!customer?.id) return;

    setIsTeamLoading(true);
    const { data } = await supabase
      .from("customer_team_members")
      .select("id, full_name, email, role, status, created_at")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false });

    setTeamMembers((data || []) as TeamMember[]);
    setIsTeamLoading(false);
  };

  useEffect(() => {
    fetchTeamMembers();
  }, [customer?.id]);

  const persistCustomerProfile = async (showSuccessToast: boolean) => {
    // Basic Personal details validation
    if (!form.full_name || !form.email || !form.phone || !form.address || !form.city || !form.country) {
      toast.error("Full name, email, phone, address, city, and country are required.");
      return null;
    }

    // Company details validation if type is company
    if (form.customer_type === "company") {
      if (!form.company_name || !form.company_registration_number || !form.company_email || !form.company_phone || !form.company_address) {
        toast.error("All company details are required for company accounts.");
        return null;
      }
    }

    let customerId = customer?.id || null;

    const customerData = {
      full_name: form.full_name,
      email: form.email,
      phone: form.phone,
      address: form.address || null,
      city: form.city || null,
      country: form.country || null,
      branch_id: form.branch_id || null,
      customer_type: form.customer_type,
      company_name: form.customer_type === "company" ? form.company_name : null,
      company_registration_number: form.customer_type === "company" ? form.company_registration_number : null,
      company_email: form.customer_type === "company" ? form.company_email : null,
      company_phone: form.customer_type === "company" ? form.company_phone : null,
      company_address: form.customer_type === "company" ? form.company_address : null,
    };

    if (!customer) {
      const result = await createCustomer(customerData);

      if (result.error) {
        toast.error(result.error);
        return null;
      }

      customerId = (result.data as { id?: string } | undefined)?.id || null;
    } else {
      const { error } = await supabase
        .from("customers")
        .update(customerData)
        .eq("id", customer.id);

      if (error) {
        toast.error("Failed to update profile.");
        return null;
      }
    }

    await supabase.auth.updateUser({
      data: {
        full_name: form.full_name,
        customer_type: form.customer_type
      },
    });

    await refreshCustomer();

    if (showSuccessToast) {
      toast.success("Profile saved.");
    }

    return customerId || customer?.id || null;
  };

  const handleSave = async () => {
    setIsSaving(true);
    await persistCustomerProfile(true);
    setIsSaving(false);
  };

  const handleAddTeamMember = async () => {
    if (!teamForm.full_name || !teamForm.email) {
      toast.error("Full name and email are required.");
      return;
    }

    setIsTeamSaving(true);
    const customerId = customer?.id || (await persistCustomerProfile(false));
    if (!customerId) {
      setIsTeamSaving(false);
      return;
    }

    const { error } = await supabase.from("customer_team_members").insert({
      customer_id: customerId,
      full_name: teamForm.full_name,
      email: teamForm.email,
      role: teamForm.role || null,
      status: "active",
    });

    if (error) {
      toast.error("Failed to add team member.");
    } else {
      toast.success("Team member added.");
      setTeamForm({ full_name: "", email: "", role: "" });
      await fetchTeamMembers();
    }

    setIsTeamSaving(false);
  };

  const handleToggleTeamStatus = async (member: TeamMember) => {
    const nextStatus = member.status === "active" ? "inactive" : "active";
    const { error } = await supabase
      .from("customer_team_members")
      .update({ status: nextStatus })
      .eq("id", member.id);

    if (error) {
      toast.error("Failed to update status.");
      return;
    }

    setTeamMembers((prev) =>
      prev.map((item) => (item.id === member.id ? { ...item, status: nextStatus } : item))
    );
  };

  const handleRemoveTeamMember = async (memberId: string) => {
    const { error } = await supabase.from("customer_team_members").delete().eq("id", memberId);

    if (error) {
      toast.error("Failed to remove team member.");
      return;
    }

    setTeamMembers((prev) => prev.filter((item) => item.id !== memberId));
    toast.success("Team member removed.");
  };

  const selectedBranch = branches.find((branch) => branch.id === form.branch_id);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="page-title">Loading</h1>
      </div>
    );
  }

  return (
    <CustomerProfileGate>
      <div className="space-y-6">
        <PageHeader title="My Profile"  />

        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>Account Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setForm({ ...form, customer_type: "personal" })}
                className={cn(
                  "h-14 rounded-2xl border-2 transition-all font-bold flex items-center justify-center gap-2",
                  form.customer_type === "personal"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border/50 bg-background text-muted-foreground hover:border-border"
                )}
              >
                Personal Account
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, customer_type: "company" })}
                className={cn(
                  "h-14 rounded-2xl border-2 transition-all font-bold flex items-center justify-center gap-2",
                  form.customer_type === "company"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border/50 bg-background text-muted-foreground hover:border-border"
                )}
              >
                Company Account
              </button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>Personal Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Full Name <span className="text-destructive">*</span></Label>
                <Input value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Email <span className="text-destructive">*</span></Label>
                <Input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Phone <span className="text-destructive">*</span></Label>
                <Input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Address <span className="text-destructive">*</span></Label>
                <Input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>City <span className="text-destructive">*</span></Label>
                <Input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Country <span className="text-destructive">*</span></Label>
                <Input value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })} />
              </div>
            </div>
          </CardContent>
        </Card>

        {form.customer_type === "company" && (
          <Card className="border-border/70 animate-in fade-in slide-in-from-top-4 duration-300">
            <CardHeader>
              <CardTitle>Company Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Company Name <span className="text-destructive">*</span></Label>
                  <Input value={form.company_name} onChange={(event) => setForm({ ...form, company_name: event.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Registration Number <span className="text-destructive">*</span></Label>
                  <Input
                    value={form.company_registration_number}
                    onChange={(event) =>
                      setForm({ ...form, company_registration_number: event.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Company Email <span className="text-destructive">*</span></Label>
                  <Input value={form.company_email} onChange={(event) => setForm({ ...form, company_email: event.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Company Phone <span className="text-destructive">*</span></Label>
                  <Input value={form.company_phone} onChange={(event) => setForm({ ...form, company_phone: event.target.value })} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Company Address <span className="text-destructive">*</span></Label>
                  <Input value={form.company_address} onChange={(event) => setForm({ ...form, company_address: event.target.value })} />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>Warehouse Address</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Warehouse (China)</Label>
                <Select value={form.branch_id} onValueChange={(value) => setForm({ ...form, branch_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select origin warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Selected Warehouse Address</Label>
                <div className="rounded-md border p-3 text-sm text-muted-foreground">
                  {selectedBranch ? (
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">{selectedBranch.name}</p>
                      <p>{selectedBranch.address || "Address not provided"}</p>
                      <p>
                        {selectedBranch.city || ""} {selectedBranch.country ? `- ${selectedBranch.country}` : ""}
                      </p>
                    </div>
                  ) : (
                    <p>Select a warehouse to see the address.</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>

        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>Team Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input
                  value={teamForm.full_name}
                  onChange={(event) => setTeamForm({ ...teamForm, full_name: event.target.value })}
                  placeholder="Team member name"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  value={teamForm.email}
                  onChange={(event) => setTeamForm({ ...teamForm, email: event.target.value })}
                  placeholder="member@email.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Input
                  value={teamForm.role}
                  onChange={(event) => setTeamForm({ ...teamForm, role: event.target.value })}
                  placeholder="Logistics Manager"
                />
              </div>
            </div>

            <Button onClick={handleAddTeamMember} disabled={isTeamSaving}>
              {isTeamSaving ? (
                "Adding..."
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Team Member
                </>
              )}
            </Button>

            <div className="space-y-3">
              {isTeamLoading ? (
                <p className="text-sm text-muted-foreground">Loading team members...</p>
              ) : teamMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No team members added yet.</p>
              ) : (
                teamMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{member.full_name}</span>
                        <Badge variant={member.status === "active" ? "default" : "outline"}>
                          {member.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="h-3.5 w-3.5" />
                        {member.email}
                      </div>
                      {member.role && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <UserCheck className="h-3.5 w-3.5" />
                          {member.role}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleTeamStatus(member)}
                      >
                        {member.status === "active" ? "Deactivate" : "Activate"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveTeamMember(member.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </CustomerProfileGate>
  );
};

export default CustomerProfile;

