import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { FormCard } from "@/components/shared/FormCard";
import { DataTable, Column } from "@/components/shared/DataTable";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface DeliveryTimeRow {
  id: string;
  name: string;
  min_days: number;
  max_days: number;
  service_type: string | null;
}

interface PackageTypeRow {
  id: string;
  name: string;
  description: string | null;
  max_weight: number | null;
}

const ShippingSettings = () => {
  const [deliveryTimes, setDeliveryTimes] = useState<DeliveryTimeRow[]>([]);
  const [packageTypes, setPackageTypes] = useState<PackageTypeRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingTime, setIsSavingTime] = useState(false);
  const [isSavingPackage, setIsSavingPackage] = useState(false);

  const [timeName, setTimeName] = useState("");
  const [minDays, setMinDays] = useState("");
  const [maxDays, setMaxDays] = useState("");
  const [serviceType, setServiceType] = useState("air");

  const [packageName, setPackageName] = useState("");
  const [packageDesc, setPackageDesc] = useState("");
  const [packageWeight, setPackageWeight] = useState("");

  const fetchData = async () => {
    setIsLoading(true);
    const [{ data: timeData, error: timeError }, { data: packageData, error: packageError }] =
      await Promise.all([
        supabase
          .from("delivery_times")
          .select("id, name, min_days, max_days, service_type")
          .order("min_days", { ascending: true }),
        supabase
          .from("package_types")
          .select("id, name, description, max_weight")
          .order("name", { ascending: true }),
      ]);

    if (timeError) {
      toast.error("Failed to load delivery times.");
      setDeliveryTimes([]);
    } else {
      setDeliveryTimes(timeData || []);
    }

    if (packageError) {
      toast.error("Failed to load package types.");
      setPackageTypes([]);
    } else {
      setPackageTypes(packageData || []);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddDeliveryTime = async () => {
    if (!timeName.trim()) {
      toast.error("Add a delivery time name.");
      return;
    }
    setIsSavingTime(true);
    const { error } = await supabase.from("delivery_times").insert({
      name: timeName.trim(),
      min_days: Number(minDays),
      max_days: Number(maxDays),
      service_type: serviceType as "air" | "sea",
    });

    if (error) {
      toast.error("Failed to create delivery time.");
    } else {
      toast.success("Delivery time created.");
      setTimeName("");
      setMinDays("");
      setMaxDays("");
      setServiceType("air");
      fetchData();
    }
    setIsSavingTime(false);
  };

  const handleAddPackageType = async () => {
    if (!packageName.trim()) {
      toast.error("Add a package type name.");
      return;
    }
    setIsSavingPackage(true);
    const { error } = await supabase.from("package_types").insert({
      name: packageName.trim(),
      description: packageDesc.trim() || null,
      max_weight: packageWeight ? Number(packageWeight) : null,
    });

    if (error) {
      toast.error("Failed to create package type.");
    } else {
      toast.success("Package type created.");
      setPackageName("");
      setPackageDesc("");
      setPackageWeight("");
      fetchData();
    }
    setIsSavingPackage(false);
  };

  const deliveryColumns: Column<DeliveryTimeRow>[] = [
    { key: "name", label: "Name" },
    { key: "service_type", label: "Service" },
    { key: "min_days", label: "Min days" },
    { key: "max_days", label: "Max days" },
  ];

  const packageColumns: Column<PackageTypeRow>[] = [
    { key: "name", label: "Package Type" },
    { key: "description", label: "Description" },
    {
      key: "max_weight",
      label: "Max weight",
      render: (item) => (item.max_weight ? `${item.max_weight} kg` : "-"),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Shipping Settings"
        
      />

      <FormCard title="Delivery Times">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium">Name</label>
            <Input value={timeName} onChange={(event) => setTimeName(event.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Service Type</label>
            <Select value={serviceType} onValueChange={setServiceType}>
              <SelectTrigger>
                <SelectValue placeholder="Select service type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="air">Air</SelectItem>
                <SelectItem value="sea">Sea</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Min days</label>
            <Input type="number" value={minDays} onChange={(event) => setMinDays(event.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Max days</label>
            <Input type="number" value={maxDays} onChange={(event) => setMaxDays(event.target.value)} />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={handleAddDeliveryTime} disabled={isSavingTime}>
            {isSavingTime ? "Saving..." : "Add Delivery Time"}
          </Button>
        </div>
      </FormCard>

      <DataTable
        columns={deliveryColumns}
        data={deliveryTimes}
        isLoading={isLoading}
        searchPlaceholder="Search delivery times..."
      />

      <FormCard title="Package Types">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium">Name</label>
            <Input value={packageName} onChange={(event) => setPackageName(event.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Max weight (kg)</label>
            <Input type="number" value={packageWeight} onChange={(event) => setPackageWeight(event.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm font-medium">Description</label>
            <Input value={packageDesc} onChange={(event) => setPackageDesc(event.target.value)} />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={handleAddPackageType} disabled={isSavingPackage}>
            {isSavingPackage ? "Saving..." : "Add Package Type"}
          </Button>
        </div>
      </FormCard>

      <DataTable
        columns={packageColumns}
        data={packageTypes}
        isLoading={isLoading}
        searchPlaceholder="Search package types..."
      />
    </div>
  );
};

export default ShippingSettings;

