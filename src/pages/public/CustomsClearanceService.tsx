import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useCmsPage } from "@/hooks/useCmsPage";
import { cmsDefaults, CmsServicesData } from "@/content/cmsDefaults";

const CustomsClearanceService = () => {
  const { data: servicesContent } = useCmsPage<CmsServicesData>("services", cmsDefaults.services);
  const heroImage =
    servicesContent.services.find((service) => service.title.toLowerCase() === "custom clearance")?.image ||
    cmsDefaults.services.services.find((service) => service.title.toLowerCase() === "custom clearance")?.image ||
    "/services/service-05.jpg";

  return (
    <div className="flex flex-col bg-slate-50">
      <section className="relative h-[170px] w-full overflow-hidden md:h-[210px]">
        <img src={heroImage} alt="Customs Clearance Services" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/45 to-black/30" />
        <div className="absolute inset-0 flex items-center justify-center text-center text-white">
          <div className="px-4">
            <p className="mx-auto w-fit rounded-full border border-white/40 bg-white/15 px-3 py-1 text-[11px] font-medium tracking-wide text-white/95">
              XY Cargo Zambia / Services
            </p>
            <h1 className="public-hero-title service-page-title mt-2">Customs Clearance Services</h1>
            <p className="mt-1 text-[11px] text-white/90 md:text-xs">Fast, reliable, and hassle-free customs support.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl space-y-6 px-6 py-10 md:py-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <p className="text-sm leading-7 text-slate-700 md:text-[15px]">
            At XY Cargo Logistics, we simplify the complexities of international trade by providing efficient and compliant customs clearance services. Whether you are importing or exporting goods, our experienced team ensures your shipments move smoothly across borders with minimal delays.
          </p>

          <h2 className="service-section-title mt-8 text-slate-900">What Is Customs Clearance?</h2>
          <p className="mt-2 text-sm leading-7 text-slate-700 md:text-[15px]">
            Customs clearance is the process of preparing and submitting documentation required to facilitate the import or export of goods.
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700 md:text-[15px]">
            <li>Declaration of goods</li>
            <li>Payment of duties and taxes</li>
            <li>Inspection and compliance checks</li>
            <li>Approval by customs authorities</li>
          </ul>
          <p className="mt-3 text-sm leading-7 text-slate-700 md:text-[15px]">We handle everything so you do not have to.</p>

          <h2 className="service-section-title mt-8 text-slate-900">Our Customs Clearance Services</h2>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-base font-semibold text-slate-900">Import Clearance</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                <li>Processing of import documentation</li>
                <li>Duty and tax assessment</li>
                <li>Coordination with customs authorities</li>
                <li>Fast release of goods</li>
              </ul>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-base font-semibold text-slate-900">Export Clearance</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                <li>Export documentation preparation</li>
                <li>Compliance with export regulations</li>
                <li>Customs approvals and inspections</li>
              </ul>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-base font-semibold text-slate-900">Transit Clearance</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                <li>Handling goods in transit across borders</li>
                <li>Cross-border documentation and permits</li>
              </ul>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-base font-semibold text-slate-900">Documentation Support</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                <li>Bill of Entry processing</li>
                <li>Commercial invoices verification</li>
                <li>Packing list preparation</li>
                <li>Certificates of origin</li>
              </ul>
            </div>
          </div>

          <h2 className="service-section-title mt-8 text-slate-900">Countries and Borders Covered</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700 md:text-[15px]">
            <li>Zambia</li>
            <li>Tanzania</li>
            <li>Mozambique</li>
          </ul>

          <h2 className="service-section-title mt-8 text-slate-900">Why Choose XY Cargo Logistics?</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700 md:text-[15px]">
            <li>Experienced customs specialists</li>
            <li>Fast turnaround time</li>
            <li>Compliance with all regulations</li>
            <li>Real-time shipment updates</li>
          </ul>

          <h2 className="service-section-title mt-8 text-slate-900">Compliance and Transparency</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700 md:text-[15px]">
            <li>Accurate declaration of goods</li>
            <li>Full compliance with customs laws</li>
            <li>Transparent cost structure (no hidden charges)</li>
          </ul>

          <h2 className="service-section-title mt-8 text-slate-900">Documents Required</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700 md:text-[15px]">
            <li>Commercial Invoice</li>
            <li>Packing List</li>
            <li>Bill of Lading / Airway Bill</li>
            <li>Import/Export Permit</li>
            <li>Tax Identification Number (TPIN)</li>
          </ul>

          <div className="mt-8 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5 md:p-6">
            <h2 className="service-section-title text-slate-900">Start Your Customs Clearance Process</h2>
            <p className="mt-2 text-sm text-slate-700 md:text-[15px]">
              Contact XY Cargo Logistics, Lusaka, Zambia on +260 211220012 to get started.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button asChild className="rounded-full bg-[#d8000d] px-6 text-sm font-semibold text-white">
                <Link to="/support">Start Now</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full px-6 text-sm font-semibold">
                <Link to="/services">Back to All Services</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default CustomsClearanceService;
