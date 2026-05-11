import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { MoveLeft, PackageOpen } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 py-24 text-center">
      <div className="relative mb-12">
        <div className="absolute inset-0 scale-[2.5] blur-3xl opacity-10 bg-[#d8000d] rounded-full" />
        <div className="relative flex h-32 w-32 items-center justify-center rounded-full bg-slate-50 ring-1 ring-slate-100">
          <PackageOpen className="h-16 w-16 text-[#d8000d]" strokeWidth={1.5} />
        </div>
        <div className="absolute -bottom-2 -right-2 flex h-10 w-10 items-center justify-center rounded-full bg-white text-xs font-black shadow-lg ring-1 ring-slate-100">
          404
        </div>
      </div>
      
      <div className="max-w-md space-y-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 md:text-5xl">
            Shipment Lost?
          </h1>
          <p className="text-lg text-slate-500 font-medium">
            We couldn't find the page you're looking for. It might have been moved or doesn't exist anymore.
          </p>
        </div>

        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Button asChild className="h-12 rounded-xl bg-[#d8000d] px-8 text-sm font-bold text-white hover:bg-[#bf000c] shadow-lg shadow-[#d8000d]/20 transition-all active:scale-[0.95]">
            <Link to="/">
              Return to Home
            </Link>
          </Button>
          <Button variant="ghost" asChild className="h-12 rounded-xl text-slate-600 font-bold hover:bg-slate-50 transition-all">
            <Link to="/tracking" className="flex items-center gap-2">
              <MoveLeft className="h-4 w-4" />
              Track a Package
            </Link>
          </Button>
        </div>
      </div>
      
      <div className="mt-20 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-300">
        XY Cargo Zambia &bull; Logistics & Freight
      </div>
    </div>
  );
};

export default NotFound;
