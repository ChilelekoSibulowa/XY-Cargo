import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SearchableSelect, { type SearchableSelectOption } from "@/components/shared/SearchableSelect";
import { toast } from "sonner";
import { useAuthContext } from "@/components/auth/AuthContext";
import {
  SUPPORT_TICKET_CATEGORIES,
  SUPPORT_TICKET_PRIORITIES,
  SUPPORT_TICKET_DEPARTMENTS,
  buildSupportTicketCode,
  formatSupportLabel,
  uploadSupportAttachment,
} from "@/lib/supportTickets";

type CustomerOption = { id: string; full_name: string; code: string };

const SupportCreateTicket = () => {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [priority, setPriority] = useState("medium");
  const [department, setDepartment] = useState("support");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchCustomers = async () => {
      const { data } = await supabase
        .from("customers")
        .select("id, full_name, code")
        .eq("is_active", true)
        .order("full_name");
      setCustomers((data || []) as CustomerOption[]);
    };
    void fetchCustomers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim() || !customerId || !user) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setIsLoading(true);

    try {
      const { data: createdTicket, error } = await supabase
        .from("support_tickets")
        .insert({
          ticket_code: buildSupportTicketCode(),
          customer_id: customerId,
          subject: subject.trim(),
          description: description.trim(),
          category,
          priority,
          status: "open",
          created_by: user.id,
          escalated_to_department: department === "support" ? null : department,
          escalated_at: department === "support" ? null : new Date().toISOString(),
          escalated_by: department === "support" ? null : user.id,
        })
        .select("id")
        .single();

      if (error) throw error;

      let attachment: {
        attachment_url: string;
        attachment_name: string;
        attachment_type: string | null;
      } | null = null;

      if (selectedFile) {
        attachment = await uploadSupportAttachment(createdTicket.id, user.id, selectedFile);
      }

      const { error: messageError } = await supabase.from("support_ticket_messages").insert({
        ticket_id: createdTicket.id,
        sender_user_id: user.id,
        sender_role: "staff",
        sender_name: user.user_metadata?.full_name || user.email || "Support",
        message: description.trim(),
        ...(attachment || {}),
      });

      if (messageError) throw messageError;

      toast.success("Ticket created successfully.");
      navigate(`/support/tickets/${createdTicket.id}`);
    } catch (error: any) {
      toast.error(error?.message || "Failed to create ticket.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="animate-fade-in space-y-4">
      <PageHeader title="Create Ticket"  />
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>New Support Ticket</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Customer *</Label>
              <SearchableSelect
                value={customerId}
                onValueChange={setCustomerId}
                options={customers.map((customer) => ({
                  value: customer.id,
                  label: `${customer.full_name} (${customer.code})`,
                  keywords: `${customer.full_name} ${customer.code}`,
                }))}
                placeholder="Select customer"
                searchPlaceholder="Search customer by name or code..."
              />
            </div>

            <div className="space-y-2">
              <Label>Subject *</Label>
              <Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Ticket subject" />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORT_TICKET_CATEGORIES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {formatSupportLabel(item)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORT_TICKET_PRIORITIES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {formatSupportLabel(item)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Queue</Label>
                <Select value={department} onValueChange={setDepartment}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORT_TICKET_DEPARTMENTS.map((item) => (
                      <SelectItem key={item} value={item}>
                        {formatSupportLabel(item)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description *</Label>
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Describe the issue in detail..."
                rows={6}
              />
            </div>

            <div className="space-y-2">
              <Label>Attachment</Label>
              <Input type="file" onChange={(event) => setSelectedFile(event.target.files?.[0] || null)} />
              {selectedFile ? (
                <p className="text-xs text-muted-foreground">{selectedFile.name}</p>
              ) : null}
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create Ticket
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default SupportCreateTicket;

