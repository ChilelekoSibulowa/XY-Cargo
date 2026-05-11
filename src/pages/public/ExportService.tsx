import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useCmsPage } from "@/hooks/useCmsPage";
import { cmsDefaults, CmsServicesData } from "@/content/cmsDefaults";

const ExportService = () => {
  const { data: servicesContent } = useCmsPage<CmsServicesData>("services", cmsDefaults.services);
  const heroImage =
    servicesContent.services.find((service) => service.title.toLowerCase() === "export")?.image ||
    cmsDefaults.services.services.find((service) => service.title.toLowerCase() === "export")?.image ||
    "/services/service-07.jpg";

  return (
    <div className="flex flex-col bg-slate-50">
      <section className="relative h-[170px] w-full overflow-hidden md:h-[210px]">
        <img src={heroImage} alt="Export Services" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/45 to-black/30" />
        <div className="absolute inset-0 flex items-center justify-center text-center text-white">
          <div className="px-4">
            <p className="mx-auto w-fit rounded-full border border-white/40 bg-white/15 px-3 py-1 text-[11px] font-medium tracking-wide text-white/95">
              XY Cargo Zambia / Services
            </p>
            <h1 className="public-hero-title service-page-title mt-2">Export Services</h1>
            <p className="mt-1 text-[11px] text-white/90 md:text-xs">Efficient, secure, and fully managed exports.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl space-y-6 px-6 py-10 md:py-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <p className="text-sm leading-7 text-slate-700 md:text-[15px]">
            At XY Cargo Logistics, we provide efficient, secure, and fully managed export services for businesses and individuals shipping goods from Zambia to international destinations.
          </p>
          <p className="mt-2 text-sm leading-7 text-slate-700 md:text-[15px]">
            Whether you are exporting commercial cargo or personal consignments, we ensure your shipments reach their destination safely and on time.
          </p>

          <h2 className="service-section-title mt-8 text-slate-900">Our Export Services</h2>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-base font-semibold text-slate-900">Air Freight Export</h3>
              <p className="mt-1 text-sm text-slate-700">Fast and reliable delivery for urgent shipments.</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                <li>Express cargo handling</li>
                <li>Priority shipping options</li>
                <li>Global airline partnerships</li>
              </ul>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-base font-semibold text-slate-900">Sea Freight Export</h3>
              <p className="mt-1 text-sm text-slate-700">Cost-effective solutions for bulk and heavy cargo.</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                <li>Full Container Load (FCL)</li>
                <li>Less than Container Load (LCL)</li>
                <li>Port-to-port and door-to-door services</li>
              </ul>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
              <h3 className="text-base font-semibold text-slate-900">Regional Export Solutions Within Africa</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                <li>Cross-border transport</li>
                <li>Consolidated cargo</li>
                <li>Flexible delivery schedules</li>
              </ul>
            </div>
          </div>

          <h2 className="service-section-title mt-8 text-slate-900">Documentation and Compliance</h2>
          <p className="mt-2 text-sm leading-7 text-slate-700 md:text-[15px]">
            We handle all export documentation to ensure smooth clearance and full compliance with Zambian and international export regulations.
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700 md:text-[15px]">
            <li>Commercial invoices</li>
            <li>Packing lists</li>
            <li>Export permits and licenses</li>
            <li>Customs declarations</li>
            <li>Certificates of origin</li>
          </ul>

          <h2 className="service-section-title mt-8 text-slate-900">Industries We Serve</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700 md:text-[15px]">
            <li>Mining and minerals (including copper)</li>
            <li>Agriculture and agro-products</li>
            <li>Retail and wholesale goods</li>
            <li>Industrial equipment</li>
            <li>Personal effects</li>
          </ul>

          <h2 className="service-section-title mt-8 text-slate-900">Why Choose XY Cargo Logistics?</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700 md:text-[15px]">
            <li>End-to-end export management</li>
            <li>Real-time shipment tracking</li>
            <li>Competitive pricing</li>
            <li>Experienced logistics team</li>
            <li>Strong global partner network</li>
          </ul>

          <h2 className="service-section-title mt-8 text-slate-900">Export Process (How It Works)</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-700 md:text-[15px]">
            <li>Request a Quote: Submit shipment details.</li>
            <li>Cargo Collection: We pick up or receive at our warehouse.</li>
            <li>Documentation: We prepare all export paperwork.</li>
            <li>Customs Clearance: Smooth processing at origin.</li>
            <li>Shipping: Via air, sea, or road.</li>
            <li>Delivery: To final destination.</li>
          </ol>

          <h2 className="service-section-title mt-8 text-slate-900">Track Your Shipment</h2>
          <p className="mt-2 text-sm leading-7 text-slate-700 md:text-[15px]">
            Stay informed every step of the way with our tracking system. Enter your tracking number on our platform to get real-time updates.
          </p>

          <div className="mt-8 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5 md:p-6">
            <h2 className="service-section-title text-slate-900">Get Started Today</h2>
            <p className="mt-2 text-sm text-slate-700 md:text-[15px]">
              Ready to export with confidence? Contact our team or request a quote today for the best export solution tailored to your needs.
            </p>
            <p className="mt-2 text-sm text-slate-700 md:text-[15px]">Phone: +260 211220012 | Location: Lusaka, Zambia</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button asChild className="rounded-full bg-[#d8000d] px-6 text-sm font-semibold text-white">
                <Link to="/support">Request Export Quote</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full px-6 text-sm font-semibold">
                <Link to="/tracking">Track Shipment</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ExportService;
