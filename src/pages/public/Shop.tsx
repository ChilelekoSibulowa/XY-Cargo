import { ShoppingBag } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const products = [
  {
    name: "Packaging Kit",
    description: "Reinforced cartons, seals, and labels for fragile items.",
    price: "K 120",
  },
  {
    name: "Insurance Bundle",
    description: "Coverage for high-value electronics and retail goods.",
    price: "From K 60",
  },
  {
    name: "Inspection Service",
    description: "Photo inspection and compliance checks before shipping.",
    price: "K 85",
  },
];

const Shop = () => {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-14">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Shop</p>
        <h1 className="text-3xl font-semibold text-slate-900 md:text-4xl">
          Value-added services for your cargo.
        </h1>
        <p className="text-sm text-slate-600 md:text-base">
          Add packaging, insurance, and inspection services directly to your shipment.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {products.map((product) => (
          <Card key={product.name} className="border-slate-200/70 bg-white">
            <CardContent className="space-y-3 p-6">
              <ShoppingBag className="h-5 w-5 text-slate-700" />
              <h3 className="text-lg font-semibold text-slate-900">{product.name}</h3>
              <p className="text-sm text-slate-600">{product.description}</p>
              <div className="flex items-center justify-between text-sm text-slate-700">
                <span className="font-semibold">{product.price}</span>
                <Button variant="outline" size="sm">
                  Add to Order
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Shop;
