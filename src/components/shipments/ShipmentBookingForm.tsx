import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useDefaultCurrency } from "@/hooks/useDefaultCurrency";
import { useProductTypes } from "@/hooks/useProductTypes";
import { usePickupDestinations } from "@/hooks/usePickupDestinations";
import { notifyShipmentCreated } from "@/lib/notifications";
import SearchableSelect from "@/components/shared/SearchableSelect";

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

const toNumberOrZero = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

interface ShipmentBookingFormProps {
  initialCustomerId?: string;
  isStaffMode?: boolean;
  onSuccess?: () => void;
}

export const ShipmentBookingForm = ({
  initialCustomerId,
  isStaffMode = false,
  onSuccess,
}: ShipmentBookingFormProps) => {
  const navigate = useNavigate();
  const { formatAmount } = useDefaultCurrency();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [rates, setRates] = useState<Rate[]>([]);
  const [deliveryTimes, setDeliveryTimes] = useState<DeliveryTime[]>([]);
  const [customers, setCustomers] = useState<{ id: string; full_name: string; code: string }[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(initialCustomerId || "");
  const [isSaving, setIsSaving] = useState(false);
  
  const [searchParams] = useSearchParams();
  
  const [form, setForm] = useState({
    branch_id: "",
    service_type: "air" as "air" | "sea",
    handling_method: "single",
    product_type: "",
    item_description: searchParams.get("title") || searchParams.get("text") || "",
    quantity: 1,
    unit_price: 0,
    custom_tracking_number: searchParams.get("url") || "",
    pickup_destination_id: "",
    pickup_destination_other: "",
    shipping_option: "standard",
    shipment_type: "lcl",
    description: searchParams.get("text") || "",
    weight: 0,
    length: 0,
    width: 0,
    height: 0,
    receiver_name: "",
    receiver_phone: "",
    receiver_address: "",
    receiver_city: "",
    receiver_country: "Zambia",
    add_insurance: false,
    request_special_packaging: false,
  });

  useEffect(() => {
    // Update form if search params change
    const title = searchParams.get("title");
    const text = searchParams.get("text");
    const url = searchParams.get("url");
    
    if (title || text || url) {
      setForm(prev => ({
        ...prev,
        item_description: title || text || prev.item_description,
        custom_tracking_number: url || prev.custom_tracking_number,
        description: text || prev.description
      }));
    }
  }, [searchParams]);

  useEffect(() => {
    const fetchOptions = async () => {
      const [branchesRes, ratesRes, timesRes] = await Promise.all([
        supabase.from("branches").select("id, name").eq("is_active", true).eq("country", "China"),
        supabase.from("shipping_rates").select("id, name, service_type, rate_per_kg, rate_per_cbm, minimum_charge").eq("is_active", true),
        supabase.from("delivery_times").select("service_type, min_days, max_days").eq("is_active", true),
      ]);
      setBranches(branchesRes.data || []);
      setRates(ratesRes.data || []);
      setDeliveryTimes(timesRes.data || []);
    };

    fetchOptions();
  }, []);

  useEffect(() => {
    if (isStaffMode) {
      const fetchCustomers = async () => {
        const { data } = await supabase
          .from("customers")
          .select("id, full_name, code")
          .eq("is_active", true)
          .order("full_name");
        setCustomers(data || []);
      };
      fetchCustomers();
    }
  }, [isStaffMode]);

  const availableRates = useMemo(
    () => rates.filter((rate) => rate.service_type === form.service_type),
    [rates, form.service_type]
  );

  const { optionsByService, isLoading: isProductTypesLoading } = useProductTypes();
  const productTypeOptions = optionsByService[form.service_type] || [];
  const { destinations, options: pickupOptions, isLoading: isPickupLoading } = usePickupDestinations();

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

  const handleSubmit = async () => {
    if (isStaffMode && !selectedCustomerId) {
      toast.error("Please select a customer.");
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
    if (!form.receiver_name.trim() || !form.receiver_phone.trim() || !form.receiver_address.trim() || !form.pickup_destination_id) {
      toast.error("Please fill in all required receiver information.");
      return;
    }
    if (selectedPickup?.requires_details && !form.pickup_destination_other.trim()) {
      toast.error("Please specify another pickup location.");
      return;
    }

    setIsSaving(true);

    let customerId = selectedCustomerId;
    if (!customerId && !isStaffMode) {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) {
        toast.error("Please sign in again.");
        setIsSaving(false);
        return;
      }
      const { data: existingCustomer } = await supabase
        .from("customers")
        .select("id")
        .eq("user_id", session.user.id)
        .maybeSingle();
        
      customerId = existingCustomer?.id || "";

      // Auto-create customer record if it doesn't exist
      if (!customerId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (profile) {
          const { data: newCustomer, error: createError } = await supabase
            .from("customers")
            .insert({
              user_id: session.user.id,
              code: `CUST-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
              full_name: profile.full_name || session.user.email,
              email: session.user.email,
              phone: profile.phone || "Pending",
              address: profile.address || null,
              city: profile.city || null,
              country: profile.country || null,
              customer_type: "personal",
              is_active: true
            })
            .select("id")
            .maybeSingle();
            
          if (newCustomer) {
            customerId = newCustomer.id;
          } else if (createError) {
            console.error("Failed to auto-create customer:", createError);
          }
        }
      }
    }

    if (!customerId) {
        toast.error("Customer record not found. Please contact support.");
        setIsSaving(false);
        return;
    }

    const { data: receiver, error: receiverError } = await supabase
      .from("receivers")
      .insert({
        code: `RCV-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
        full_name: form.receiver_name,
        phone: form.receiver_phone,
        address: form.receiver_address,
        city: form.receiver_city,
        country: form.receiver_country,
        customer_id: customerId,
      })
      .select("id")
      .single();

    if (receiverError || !receiver) {
      toast.error("Failed to create receiver.");
      setIsSaving(false);
      return;
    }

    const shippingInfo = form.service_type === "air" 
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
      form.description ? `Notes: ${form.description}` : null,
    ]
      .filter(Boolean)
      .join(" | ");

    const { data: shipmentData, error: shipmentError } = await supabase
      .from("shipments")
      .insert({
        code: `SHP-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
        customer_id: customerId,
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
        shipping_rate_id: selectedRate?.id || null,
        // Shipping fee MUST stay blank in Created/Incoming/Need Action/Submitted.
        // It is only set later by the warehouse during Confirm Shipment.
        shipping_cost: null,
        total_cost: null,
        payment_method: "lipila",
        payment_status: "pending",
        handling_method: form.handling_method,
        notes,
      })
      .select("id, code")
      .single();

    if (shipmentError || !shipmentData) {
      console.error("Shipment creation error:", shipmentError);
      toast.error(shipmentError?.message || "Failed to create shipment.");
    } else {
      toast.success("Shipment created successfully.");
      if (onSuccess) {
        onSuccess();
      } else {
        navigate(isStaffMode ? "/warehouse/parcels" : "/customer/shipments");
      }
    }
    setIsSaving(false);
  };

  return (
    <div className="w-full">
      <Card className="border-border/70">
        <CardContent className="space-y-5 p-6">
          {isStaffMode && (
            <div className="space-y-2">
              <Label>Select Customer <span className="text-destructive">*</span></Label>
              <SearchableSelect
                value={selectedCustomerId}
                onValueChange={setSelectedCustomerId}
                options={customers.map((c) => ({
                  value: c.id,
                  label: `${c.full_name} (${c.code})`,
                  keywords: `${c.full_name} ${c.code}`,
                }))}
                placeholder="Select a customer"
                searchPlaceholder="Search customer by name or code..."
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Warehouse Selection (China) <span className="text-destructive">*</span></Label>
            <Select value={form.branch_id} onValueChange={(v) => setForm({ ...form, branch_id: v })}>
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
              <Select value={form.service_type} onValueChange={(v: "air" | "sea") => setForm({ ...form, service_type: v })}>
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
              <Select value={form.handling_method} onValueChange={(v) => setForm({ ...form, handling_method: v })}>
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
              <Select value={form.product_type} onValueChange={(v) => setForm({ ...form, product_type: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select product type" />
                </SelectTrigger>
                <SelectContent>
                  {isProductTypesLoading ? (
                    <SelectItem value="loading" disabled>Loading...</SelectItem>
                  ) : (
                    productTypeOptions.map((opt) => (
                      <SelectItem key={opt.id} value={opt.value}>{opt.label}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Item Description <span className="text-destructive">*</span></Label>
              <Input
                placeholder="e.g. Samsung Galaxy S24 Ultra"
                value={form.item_description}
                onChange={(e) => setForm({ ...form, item_description: e.target.value })}
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
                onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Price <span className="text-destructive">*</span></Label>
              <Input
                type="number"
                min="0"
                value={form.unit_price === 0 ? "" : form.unit_price}
                onChange={(e) => setForm({ ...form, unit_price: toNumberOrZero(e.target.value) })}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Tracking Number <span className="text-destructive">*</span></Label>
              <Input
                placeholder="Enter tracking number"
                value={form.custom_tracking_number}
                onChange={(e) => setForm({ ...form, custom_tracking_number: e.target.value })}
              />
            </div>
            {form.service_type === "air" ? (
              <div className="space-y-2">
                <Label>Shipping Options <span className="text-destructive">*</span></Label>
                <Select value={form.shipping_option} onValueChange={(v) => setForm({ ...form, shipping_option: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard Shipping</SelectItem>
                    <SelectItem value="express">Express Shipping</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Shipment Type <span className="text-destructive">*</span></Label>
                <Select value={form.shipment_type} onValueChange={(v) => setForm({ ...form, shipment_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
                onChange={(e) => setForm({ ...form, weight: toNumberOrZero(e.target.value) })}
              />
            </div>
            {form.service_type === "sea" && (
              <>
                <div className="space-y-2">
                  <Label>Length (cm)</Label>
                  <Input type="number" value={form.length === 0 ? "" : form.length} onChange={(e) => setForm({ ...form, length: toNumberOrZero(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Width (cm)</Label>
                  <Input type="number" value={form.width === 0 ? "" : form.width} onChange={(e) => setForm({ ...form, width: toNumberOrZero(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Height (cm)</Label>
                  <Input type="number" value={form.height === 0 ? "" : form.height} onChange={(e) => setForm({ ...form, height: toNumberOrZero(e.target.value) })} />
                </div>
              </>
            )}
          </div>

          <div className="space-y-2">
            <Label>Receiver Information <span className="text-destructive">*</span></Label>
            <div className="grid gap-4 md:grid-cols-2">
              <Input placeholder="Full name *" value={form.receiver_name} onChange={(e) => setForm({ ...form, receiver_name: e.target.value })} />
              <Input placeholder="Phone *" value={form.receiver_phone} onChange={(e) => setForm({ ...form, receiver_phone: e.target.value })} />
              <Input placeholder="Address *" value={form.receiver_address} onChange={(e) => setForm({ ...form, receiver_address: e.target.value })} />
              <div className="space-y-2">
                <Label>Pickup Destination <span className="text-destructive">*</span></Label>
                <Select value={form.pickup_destination_id} onValueChange={(v) => setForm({ ...form, pickup_destination_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select destination" /></SelectTrigger>
                  <SelectContent>
                    {isPickupLoading ? (
                      <SelectItem value="loading" disabled>Loading...</SelectItem>
                    ) : (
                      pickupOptions.map((opt) => (
                        <SelectItem key={opt.id} value={opt.value}>{opt.label}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <Input placeholder="City *" value={form.receiver_city} onChange={(e) => setForm({ ...form, receiver_city: e.target.value })} />
              <Input placeholder="Country *" value={form.receiver_country} onChange={(e) => setForm({ ...form, receiver_country: e.target.value })} />
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <Label>Value Added Services</Label>
            <div className="grid gap-2 md:grid-cols-2 text-sm text-muted-foreground border p-3 rounded-lg bg-muted/20">
              <label className="flex items-center gap-2 cursor-pointer hover:text-foreground transition-colors">
                <input type="checkbox" checked={form.add_insurance} onChange={(e) => setForm({ ...form, add_insurance: e.target.checked })} className="rounded border-border text-primary focus:ring-primary" />
                Insurance
              </label>
              <label className="flex items-center gap-2 cursor-pointer hover:text-foreground transition-colors">
                <input type="checkbox" checked={form.request_special_packaging} onChange={(e) => setForm({ ...form, request_special_packaging: e.target.checked })} className="rounded border-border text-primary focus:ring-primary" />
                Special Packaging
              </label>
            </div>
          </div>

          <Button onClick={handleSubmit} disabled={isSaving} className="w-full h-12 text-base font-bold shadow-lg shadow-primary/20">
            {isSaving ? "Submitting..." : "Create Shipment"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
