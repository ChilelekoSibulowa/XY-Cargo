import { PageHeader } from "@/components/shared/PageHeader";
import { CustomerProfileGate } from "@/components/customer/CustomerProfileGate";
import { ShipmentBookingForm } from "@/components/shipments/ShipmentBookingForm";

const CustomerPlaceOrder = () => {
  return (
    <CustomerProfileGate>
      <div className="space-y-6">
        <PageHeader 
          title="Book Shipment" 
           
        />
        <ShipmentBookingForm />
      </div>
    </CustomerProfileGate>
  );
};

export default CustomerPlaceOrder;

