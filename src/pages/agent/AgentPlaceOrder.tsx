import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SearchableSelect from "@/components/shared/SearchableSelect";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useDefaultCurrency } from "@/hooks/useDefaultCurrency";
import { useProductTypes } from "@/hooks/useProductTypes";
import { usePickupDestinations } from "@/hooks/usePickupDestinations";
import { notifyShipmentCreated } from "@/lib/notifications";

type Branch = { id: string; name: string };
type Rate = {
  id: string;
  name: string;
  service_type: "air" | "sea";
  rate_per_kg: number | null;
  rate_per_cbm: number | null;
  minimum_charge: number | null;
};
type DeliveryTime = { service_type: "air" | "sea"; min_days: number; max_days: number };
type AgentCustomerOption = { id: string; full_name: string; code: string };

const toNumberOrZero = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const AgentPlaceOrder = () => {
  const navigate = useNavigate();
  const { formatAmount } = useDefaultCurrency();
  const [customers, setCustomers] = useState<AgentCustomerOption[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [rates, setRates] = useState<Rate[]>([]);
  const [deliveryTimes, setDeliveryTimes] = useState<DeliveryTime[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    customer_id: "",
    branch_id: "",
    service_type: "air" as "air" | "sea",
    handling_method: "single",
    product_type: "",
    item_description: "",
    quantity: 1,
    unit_price: 0,
    custom_tracking_number: "",
    pickup_destination_id: "",
    pickup_destination_other: "",
    shipping_option: "standard",
    shipment_type: "lcl",
    description: "",
    weight: 0,
    length: 0,
    width: 0,
    height: 0,
    receiver_name: "",
    receiver_phone: "",
    receiver_address: "",
    receiver_city: "",
    receiver_country: "",
    add_insurance: false,
    request_special_packaging: false,
  });

  useEffect(() => {
    const fetchOptions = async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return;

      const [customersRes, branchesRes, ratesRes, timesRes] = await Promise.all([
        supabase
          .from("customers")
          .select("id, full_name, code")
          .eq("agent_id", userId)
          .order("created_at", { ascending: false }),
        supabase.from("branches").select("id, name").eq("is_active", true).eq("country", "China"),
        supabase.from("shipping_rates").select("id, name, service_type, rate_per_kg, rate_per_cbm, minimum_charge").eq("is_active", true),
        supabase.from("delivery_times").select("service_type, min_days, max_days").eq("is_active", true),
      ]);

      setCustomers((customersRes.data || []) as AgentCustomerOption[]);
      setBranches(branchesRes.data || []);
      setRates(ratesRes.data || []);
      setDeliveryTimes(timesRes.data || []);
    };

    fetchOptions();
  }, []);

  const availableRates = useMemo(
    () => rates.filter((rate) => rate.service_type === form.service_type),
    [rates, form.service_type]
  );

  const { optionsByService, isLoading: isProductTypesLoading } = useProductTypes();
  const productTypeOptions = optionsByService[form.service_type] || [];
  const { options: pickupOptions, destinations, isLoading: isPickupLoading } = usePickupDestinations();

  useEffect(() => {
    if (isProductTypesLoading) return;
    if (!form.product_type) return;
    const allowed = new Set(productTypeOptions.map((option) => option.value));
    if (!allowed.has(form.product_type)) {
      setForm((prev) => ({ ...prev, product_type: "" }));
    }
  }, [form.product_type, productTypeOptions, isProductTypesLoading]);

  const selectedPickup = useMemo(
    () => destinations.find((dest) => dest.id === form.pickup_destination_id),
    [destinations, form.pickup_destination_id]
  );

  const selectedRate = availableRates[0];
  const cbm = (form.length * form.width * form.height) / 1000000;
  const estimatedCost =
    form.service_type === "air"
      ? form.weight * (selectedRate?.rate_per_kg || 0)
      : cbm * (selectedRate?.rate_per_cbm || 0);

  const delivery = deliveryTimes.find((time) => time.service_type === form.service_type);

  const handleSubmit = async () => {
    if (!form.customer_id) {
      toast.error("Customer selection is required.");
      return;
    }
    if (!form.branch_id) {
      toast.error("Origin Warehouse is required.");
      return;
    }
    if (!form.service_type) {
      toast.error("Service Type is required.");
      return;
    }
    if (!form.handling_method) {
      toast.error("Handling Method is required.");
      return;
    }
    if (!form.product_type) {
      toast.error("Product Type is required.");
      return;
    }
    if (!form.item_description.trim()) {
      toast.error("Item Description is required.");
      return;
    }
    if (form.quantity <= 0) {
      toast.error("Quantity must be at least 1.");
      return;
    }
    if (form.unit_price <= 0) {
      toast.error("Price is required.");
      return;
    }
    if (!form.custom_tracking_number.trim()) {
      toast.error("Tracking number is required.");
      return;
    }
    if (form.weight <= 0) {
      toast.error("Weight is required.");
      return;
    }
    if (!form.receiver_name.trim() || !form.receiver_phone.trim() || !form.receiver_address.trim() || !form.receiver_city.trim() || !form.receiver_country.trim() || !form.pickup_destination_id) {
      toast.error("Please fill in all required receiver information.");
      return;
    }
    if (!selectedRate) {
      toast.error("No shipping rate available for the selected service type.");
      return;
    }
    if (selectedPickup?.requires_details && !form.pickup_destination_other.trim()) {
      toast.error("Please specify another pickup location.");
      return;
    }
    setIsSaving(true);

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    const { data: receiverCode } = await supabase.rpc("generate_code", { prefix: "RCV" });
    const { data: shipmentCode } = await supabase.rpc("generate_code", { prefix: "SHP" });

    const { data: receiver, error: receiverError } = await supabase
      .from("receivers")
      .insert({
        code: receiverCode || `RCV-${Date.now()}`,
        full_name: form.receiver_name,
        phone: form.receiver_phone,
        address: form.receiver_address,
        city: form.receiver_city || null,
        country: form.receiver_country || null,
        customer_id: form.customer_id,
      })
      .select("id")
      .single();

    if (receiverError || !receiver) {
      toast.error("Failed to create receiver.");
      setIsSaving(false);
      return;
    }

    const shippingInfo =
      form.service_type === "air"
        ? `Shipping: ${form.shipping_option === "express" ? "Express" : "Standard"}`
        : `Shipment: ${form.shipment_type === "fcl" ? "Full Container Load (FCL)" : "Less Container Load (LCL)"}`;

    const pickupDestination = selectedPickup?.requires_details
      ? `${selectedPickup.name}: ${form.pickup_destination_other}`
      : selectedPickup?.name;

    const notes = [
      `Handling method: ${form.handling_method}`,
      `Product type: ${form.product_type}`,
      `Item: ${form.item_description}`,
      `Quantity: ${form.quantity}`,
      `Price: ${form.unit_price}`,
      shippingInfo,
      pickupDestination ? `Pickup destination: ${pickupDestination}` : null,
      form.add_insurance ? "Add insurance" : null,
      form.request_special_packaging ? "Special packaging: Requested" : null,
    ]
      .filter(Boolean)
      .join(" | ");

    const shipmentPayload = {
      code: shipmentCode || `SHP-${Date.now()}`,
      customer_id: form.customer_id,
      receiver_id: receiver.id,
      branch_id: form.branch_id,
      status: "saved_pickup",
      service_type: form.service_type,
      description: form.item_description || form.product_type || form.description,
      custom_tracking_number: form.custom_tracking_number || null,
      weight: form.weight,
      length: form.length,
      width: form.width,
      height: form.height,
      quantity: form.quantity,
      shipping_rate_id: selectedRate.id,
      // Shipping fee stays blank until warehouse confirms the shipment.
      shipping_cost: null,
      total_cost: null,
      payment_method: "lipila",
      payment_status: "pending",
      handling_method: form.handling_method,
      notes,
      created_by: userId || null,
    };

    const { data: shipmentData, error: shipmentError } = await supabase
      .from("shipments")
      .insert([shipmentPayload as any])
      .select("id, code")
      .single();

    if (shipmentError || !shipmentData) {
      toast.error("Failed to create shipment.");
    } else {
      void notifyShipmentCreated({
        creator: "agent",
        userId: userId || undefined,
        shipmentCode: form.custom_tracking_number || shipmentData.code,
        shipmentId: shipmentData.id,
      });
      toast.success("Shipment created successfully.");
      navigate("/agent/shipments");
    }
    setIsSaving(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Book Shipment"  />

      <div className="max-w-4xl mx-auto">
        <Card className="border-border/70">
          <CardContent className="space-y-5 p-6">
            <div className="space-y-2">
              <Label>Customer <span className="text-destructive">*</span></Label>
              <SearchableSelect
                value={form.customer_id}
                onValueChange={(value) => setForm({ ...form, customer_id: value })}
                options={customers.map((customer) => ({
                  value: customer.id,
                  label: `${customer.full_name} (${customer.code})`,
                  keywords: `${customer.full_name} ${customer.code}`,
                }))}
                placeholder="Select customer"
                searchPlaceholder="Search customer by name or code..."
              />
              {customers.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No customers registered yet. Create a customer first.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Warehouse Selection (China) <span className="text-destructive">*</span></Label>
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

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Service Type <span className="text-destructive">*</span></Label>
                <Select value={form.service_type} onValueChange={(value: "air" | "sea") => setForm({ ...form, service_type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="air">Air Freight</SelectItem>
                    <SelectItem value="sea">Sea Freight</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Handling Method <span className="text-destructive">*</span></Label>
                <Select value={form.handling_method} onValueChange={(value) => setForm({ ...form, handling_method: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Single</SelectItem>
                    <SelectItem value="consolidated">Consolidation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Product Type <span className="text-destructive">*</span></Label>
                <Select value={form.product_type} onValueChange={(value) => setForm({ ...form, product_type: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select product type" />
                  </SelectTrigger>
                  <SelectContent>
                    {isProductTypesLoading && (
                      <SelectItem value="loading" disabled>
                        Loading product types...
                      </SelectItem>
                    )}
                    {!isProductTypesLoading && productTypeOptions.length === 0 && (
                      <SelectItem value="none" disabled>
                        No product types configured
                      </SelectItem>
                    )}
                    {productTypeOptions.map((option) => (
                      <SelectItem key={option.id} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Item Description <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="e.g. Samsung Galaxy S24 Ultra"
                  value={form.item_description}
                  onChange={(event) => setForm({ ...form, item_description: event.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Quantity <span className="text-destructive">*</span></Label>
                <Input
                  type="number"
                  min="1"
                  value={form.quantity}
                  onChange={(event) => setForm({ ...form, quantity: Number(event.target.value) })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Price <span className="text-destructive">*</span></Label>
                <Input
                  type="number"
                  min="0"
                  value={form.unit_price === 0 ? "" : form.unit_price}
                  onChange={(event) => setForm({ ...form, unit_price: toNumberOrZero(event.target.value) })}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>
                  Tracking Number <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="Enter your tracking number"
                  value={form.custom_tracking_number}
                  onChange={(event) => setForm({ ...form, custom_tracking_number: event.target.value })}
                  required
                />
              </div>
              {form.service_type === "air" ? (
                <div className="space-y-2">
                  <Label>Shipping Options <span className="text-destructive">*</span></Label>
                  <Select value={form.shipping_option} onValueChange={(value) => setForm({ ...form, shipping_option: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard Shipping</SelectItem>
                      <SelectItem value="express">Express Shipping</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Shipment Type <span className="text-destructive">*</span></Label>
                  <Select value={form.shipment_type} onValueChange={(value) => setForm({ ...form, shipment_type: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fcl">Full Container Load (FCL)</SelectItem>
                      <SelectItem value="lcl">Less Container Load (LCL)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label>Weight (kg) <span className="text-destructive">*</span></Label>
                <Input
                  type="number"
                  min="0"
                  value={form.weight === 0 ? "" : form.weight}
                  onChange={(event) => setForm({ ...form, weight: toNumberOrZero(event.target.value) })}
                  required
                />
              </div>
              {form.service_type === "sea" && (
                <>
                  <div className="space-y-2">
                    <Label>Length (cm)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={form.length === 0 ? "" : form.length}
                      onChange={(event) => setForm({ ...form, length: toNumberOrZero(event.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Width (cm)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={form.width === 0 ? "" : form.width}
                      onChange={(event) => setForm({ ...form, width: toNumberOrZero(event.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Height (cm)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={form.height === 0 ? "" : form.height}
                      onChange={(event) => setForm({ ...form, height: toNumberOrZero(event.target.value) })}
                    />
                  </div>
                </>
              )}
            </div>

            <div className="space-y-2">
              <Label>Description / Notes</Label>
              <Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
            </div>

            <div className="space-y-2">
              <Label>Receiver Information <span className="text-destructive">*</span></Label>
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  placeholder="Full name *"
                  value={form.receiver_name}
                  onChange={(event) => setForm({ ...form, receiver_name: event.target.value })}
                  required
                />
                <Input
                  placeholder="Phone *"
                  value={form.receiver_phone}
                  onChange={(event) => setForm({ ...form, receiver_phone: event.target.value })}
                  required
                />
                <Input
                  placeholder="Address *"
                  value={form.receiver_address}
                  onChange={(event) => setForm({ ...form, receiver_address: event.target.value })}
                  required
                />
                <div className="space-y-2">
                  <Label>Pickup Destination (Zambia) <span className="text-destructive">*</span></Label>
                  <Select
                    value={form.pickup_destination_id}
                    onValueChange={(value) => {
                      const selected = destinations.find((dest) => dest.id === value);
                      setForm({
                        ...form,
                        pickup_destination_id: value,
                        pickup_destination_other: selected?.requires_details ? form.pickup_destination_other : "",
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select pickup destination" />
                    </SelectTrigger>
                    <SelectContent>
                      {isPickupLoading && (
                        <SelectItem value="loading" disabled>
                          Loading destinations...
                        </SelectItem>
                      )}
                      {!isPickupLoading && pickupOptions.length === 0 && (
                        <SelectItem value="none" disabled>
                          No destinations configured
                        </SelectItem>
                      )}
                      {pickupOptions.map((option) => (
                        <SelectItem key={option.id} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedPickup?.requires_details && (
                  <div className="space-y-2">
                    <Label htmlFor="pickup_destination_other">Please specify another location</Label>
                    <Input
                      id="pickup_destination_other"
                      placeholder="Enter the pickup destination"
                      value={form.pickup_destination_other}
                      onChange={(event) => setForm({ ...form, pickup_destination_other: event.target.value })}
                    />
                  </div>
                )}
                <Input
                  placeholder="City *"
                  value={form.receiver_city}
                  onChange={(event) => setForm({ ...form, receiver_city: event.target.value })}
                  required
                />
                <Input
                  placeholder="Country *"
                  value={form.receiver_country}
                  onChange={(event) => setForm({ ...form, receiver_country: event.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Value Added Services</Label>
              <p className="text-xs text-muted-foreground">
                For fragile items, request special packaging before submitting.
              </p>
              <div className="grid gap-2 md:grid-cols-2 text-sm text-muted-foreground">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.add_insurance}
                    onChange={(event) => setForm({ ...form, add_insurance: event.target.checked })}
                  />
                  Insurance
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.request_special_packaging}
                    onChange={(event) => setForm({ ...form, request_special_packaging: event.target.checked })}
                  />
                  Request Special Packaging
                </label>
              </div>
            </div>

            <Button onClick={handleSubmit} disabled={isSaving} className="w-full">
              {isSaving ? "Submitting..." : "Book Shipment"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AgentPlaceOrder;

