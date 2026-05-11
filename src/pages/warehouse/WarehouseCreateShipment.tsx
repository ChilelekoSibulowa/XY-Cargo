import { PageHeader } from "@/components/shared/PageHeader";
import { ShipmentBookingForm } from "@/components/shipments/ShipmentBookingForm";

const WarehouseCreateShipment = () => {
  return (
    <div className="space-y-6">
      <PageHeader 
        title="Create Customer Shipment" 
         
      />
      <div className="max-w-4xl">
        <ShipmentBookingForm isStaffMode={true} />
      </div>
    </div>
  );
};

export default WarehouseCreateShipment;

