import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { Loader2, Upload } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DataTable, Column } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  DriverDelivery,
  DriverIncident,
  fetchDriverDeliveries,
  fetchDriverIncidents,
  getCurrentDriverContext,
} from "@/lib/driverPortal";
import {
  buildSupportTicketCode,
  uploadSupportAttachment,
  DRIVER_INCIDENT_CATEGORIES,
} from "@/lib/supportTickets";

const INCIDENT_TYPES: Array<{
  value: (typeof DRIVER_INCIDENT_CATEGORIES)[number];
  label: string;
}> = [
  { value: "delivery_issue", label: "Report Delivery Issue" },
  { value: "accident", label: "Report Accident" },
  { value: "customer_dispute", label: "Report Customer Dispute" },
];

const INCIDENT_DEPARTMENT_BY_TYPE: Record<(typeof DRIVER_INCIDENT_CATEGORIES)[number], string> = {
  delivery_issue: "operations",
  accident: "compliance",
  customer_dispute: "support",
};

const DriverIncidents = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<DriverDelivery[]>([]);
  const [tickets, setTickets] = useState<DriverIncident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    incidentType: "delivery_issue",
    shipmentId: "",
    priority: "medium",
    subject: "",
    description: "",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [shipmentSearch, setShipmentSearch] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  const loadIncidents = async () => {
    try {
      const { user, driver } = await getCurrentDriverContext();
      setUserId(user?.id || null);

      if (!user?.id || !driver?.id) {
        setDeliveries([]);
        setTickets([]);
        setIsLoading(false);
        return;
      }

      const [deliveryRows, ticketRows] = await Promise.all([
        fetchDriverDeliveries(driver.id, 120),
        fetchDriverIncidents(user.id, 100),
      ]);

      setDeliveries(deliveryRows);
      setTickets(ticketRows);
    } catch (error: any) {
      toast.error(error?.message || "Failed to load driver incidents.");
      setDeliveries([]);
      setTickets([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadIncidents();
  }, []);

  const openTickets = useMemo(
    () => tickets.filter((ticket) => !["closed", "resolved"].includes(ticket.status.toLowerCase())),
    [tickets],
  );
  const closedTickets = useMemo(
    () => tickets.filter((ticket) => ["closed", "resolved"].includes(ticket.status.toLowerCase())),
    [tickets],
  );

  const ticketColumns: Column<DriverIncident>[] = [
    { key: "ticket_code", label: "Ticket" },
    {
      key: "shipment_id",
      label: "Linked Delivery",
      render: (row) => row.shipment?.custom_tracking_number || "-",
    },
    { key: "subject", label: "Subject" },
    {
      key: "category",
      label: "Category",
      render: (row) => row.category.replace(/_/g, " "),
    },
    {
      key: "priority",
      label: "Priority",
      render: (row) => (
        <Badge variant="outline" className="capitalize">
          {row.priority}
        </Badge>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "created_at",
      label: "Created",
      render: (row) => format(new Date(row.created_at), "PP p"),
    },
  ];

  const handleSubmit = async () => {
    if (!userId) {
      toast.error("Driver session not found.");
      return;
    }
    if (!form.subject.trim() || !form.description.trim()) {
      toast.error("Subject and description are required.");
      return;
    }

    setIsSubmitting(true);

    try {
      const selectedDelivery =
        deliveries.find((delivery) => delivery.id === form.shipmentId) || null;

      const { data: createdTicket, error: ticketError } = await supabase
        .from("support_tickets")
        .insert({
          ticket_code: buildSupportTicketCode("DRV"),
          subject: form.subject.trim(),
          description: form.description.trim(),
          category: form.incidentType,
          priority: form.priority,
          status: "open",
          created_by: userId,
          shipment_id: selectedDelivery?.id || null,
          customer_id: selectedDelivery?.customer_id || null,
          escalated_to_department: INCIDENT_DEPARTMENT_BY_TYPE[form.incidentType],
          escalated_at: new Date().toISOString(),
          escalated_by: userId,
        })
        .select("id")
        .single();

      if (ticketError) throw ticketError;

      let attachment: {
        attachment_url: string;
        attachment_name: string;
        attachment_type: string | null;
      } | null = null;

      if (selectedFile) {
        attachment = await uploadSupportAttachment(createdTicket.id, userId, selectedFile);
      }

      const { error: messageError } = await supabase.from("support_ticket_messages").insert({
        ticket_id: createdTicket.id,
        sender_user_id: userId,
        sender_role: "driver",
        sender_name: "Driver",
        message: form.description.trim(),
        ...(attachment || {}),
      });

      if (messageError) throw messageError;

      toast.success("Incident report submitted.");
      setForm({
        incidentType: "delivery_issue",
        shipmentId: "",
        priority: "medium",
        subject: "",
        description: "",
      });
      setSelectedFile(null);
      if (fileRef.current) fileRef.current.value = "";
      await loadIncidents();
    } catch (error: any) {
      toast.error(error?.message || "Failed to submit incident report.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Incident & Support"
        
      />

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>Create Incident Report</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="incident-type">Incident Type</Label>
              <select
                id="incident-type"
                value={form.incidentType}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, incidentType: event.target.value }))
                }
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {INCIDENT_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="incident-shipment">Linked Delivery (optional)</Label>
              <div className="space-y-2">
                <Input
                  placeholder="Search tracking or client..."
                  value={shipmentSearch}
                  onChange={(e) => setShipmentSearch(e.target.value)}
                  className="h-9 text-xs"
                />
                <select
                  id="incident-shipment"
                  value={form.shipmentId}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, shipmentId: event.target.value }))
                  }
                  className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">No linked delivery</option>
                  {deliveries
                    .filter((d) => {
                      const search = shipmentSearch.toLowerCase();
                      return (
                        (d.custom_tracking_number || "").toLowerCase().includes(search) ||
                        (d.customer?.full_name || "").toLowerCase().includes(search) ||
                        (d.code || "").toLowerCase().includes(search)
                      );
                    })
                    .map((delivery) => (
                      <option key={delivery.id} value={delivery.id}>
                        {(delivery.custom_tracking_number || "-")} - {delivery.customer?.full_name || "Client"}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="incident-priority">Priority</Label>
              <select
                id="incident-priority"
                value={form.priority}
                onChange={(event) => setForm((prev) => ({ ...prev, priority: event.target.value }))}
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="incident-subject">Subject</Label>
              <Input
                id="incident-subject"
                value={form.subject}
                onChange={(event) => setForm((prev) => ({ ...prev, subject: event.target.value }))}
                placeholder="Summarize the issue"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="incident-description">Description</Label>
            <Textarea
              id="incident-description"
              value={form.description}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, description: event.target.value }))
              }
              placeholder="Describe the delivery issue, accident details, or dispute context"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="incident-upload">Upload Incident Photos</Label>
            <div className="rounded-xl border border-dashed border-border/80 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">
                    {selectedFile ? selectedFile.name : "Attach a photo or document"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    The file is uploaded to secure storage and linked to the ticket.
                  </p>
                </div>
                <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" />
                  Choose File
                </Button>
              </div>
              <input
                ref={fileRef}
                id="incident-upload"
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                className="hidden"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Submit Report
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>My Open Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={ticketColumns}
              data={openTickets}
              isLoading={isLoading}
              searchPlaceholder="Search open tickets..."
              viewLink={(row) => `/support/tickets/${row.id}`}
            />
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>Closed Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={ticketColumns}
              data={closedTickets}
              isLoading={isLoading}
              searchPlaceholder="Search closed tickets..."
              viewLink={(row) => `/support/tickets/${row.id}`}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DriverIncidents;

