import { MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const locations = [
  {
    city: "Lusaka",
    address: "Plot 12, Logistics Park",
    phone: "+260 97 000 0000",
    hours: "Mon - Sat, 08:00 - 18:00",
  },
  {
    city: "Ndola/Kitwe",
    address: "Warehouse 7, Copperbelt Free Zone",
    phone: "+260 96 000 0000",
    hours: "Mon - Sat, 08:00 - 17:00",
  },
  {
    city: "Livingstone",
    address: "Airport Cargo Bay, Gate 3",
    phone: "+260 95 000 0000",
    hours: "Mon - Fri, 08:00 - 17:30",
  },
];

const Locations = () => {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-14">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Locations</p>
        <h1 className="text-3xl font-semibold text-slate-900 md:text-4xl">Warehouses and drop-off points.</h1>
        <p className="text-sm text-slate-600 md:text-base">
          Visit a nearby facility or contact us to schedule a pickup.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {locations.map((location) => (
          <Card key={location.city} className="border-slate-200/70 bg-white">
            <CardContent className="space-y-3 p-6">
              <div className="flex items-center gap-2 text-slate-900">
                <MapPin className="h-4 w-4" />
                <h3 className="text-lg font-semibold">{location.city}</h3>
              </div>
              <div className="space-y-1 text-sm text-slate-600">
                <p>{location.address}</p>
                <p>{location.phone}</p>
                <p>{location.hours}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Locations;
