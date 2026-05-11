import { Briefcase, Handshake, UserPlus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const JoinUs = () => {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-14">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Join us</p>
        <h1 className="text-3xl font-semibold text-slate-900 md:text-4xl">
          Partner with Clever Freight.
        </h1>
        <p className="text-sm text-slate-600 md:text-base">
          Become an agent, partner, or team member. We will help you expand your reach and revenue.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {[
          {
            title: "Agent Network",
            detail: "Register customers, book shipments, and earn commissions.",
            icon: UserPlus,
            to: "/register",
          },
          {
            title: "Partner Warehouses",
            detail: "Connect your warehouse to our intake and consolidation flows.",
            icon: Handshake,
            to: "/support",
          },
          {
            title: "Careers",
            detail: "Operations, finance, and customer success roles available.",
            icon: Briefcase,
            to: "/support",
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.title} className="border-slate-200/70 bg-white">
              <CardContent className="space-y-3 p-6">
                <Icon className="h-5 w-5 text-slate-700" />
                <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
                <p className="text-sm text-slate-600">{item.detail}</p>
                <Button asChild variant="outline" size="sm">
                  <Link to={item.to}>Learn More</Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default JoinUs;
