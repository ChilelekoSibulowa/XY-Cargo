import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useCmsPage } from "@/hooks/useCmsPage";
import { cmsDefaults, CmsServicesData } from "@/content/cmsDefaults";

const SupplierPaymentFacilitation = () => {
  const { data: servicesContent } = useCmsPage<CmsServicesData>("services", cmsDefaults.services);
  const heroImage =
    servicesContent.services.find((service) => service.title.toLowerCase() === "supplier payment facilitation")?.image ||
    cmsDefaults.services.services.find((service) => service.title.toLowerCase() === "supplier payment facilitation")?.image ||
    "/services/service-04.jpg";

  return (
    <div className="flex flex-col bg-slate-50">
      <section className="relative h-[170px] w-full overflow-hidden md:h-[210px]">
        <img
          src={heroImage}
          alt="Supplier Payment Facilitation"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/45 to-black/30" />
        <div className="absolute inset-0 flex items-center justify-center text-center text-white">
          <div className="px-4">
            <p className="mx-auto w-fit rounded-full border border-white/40 bg-white/15 px-3 py-1 text-[11px] font-medium tracking-wide text-white/95">
              XY Cargo Zambia / Services
            </p>
            <h1 className="public-hero-title service-page-title mt-2">Supplier Payment Facilitation</h1>
            <p className="mt-1 text-[11px] text-white/90 md:text-xs">Secure supplier payments with clear processing steps.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl space-y-6 px-6 py-10 md:py-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <h2 className="service-section-title text-slate-900">Overview</h2>
          <p className="mt-2 text-sm leading-7 text-slate-700 md:text-[15px]">
            At XY Cargo Logistics, we offer a Supplier Payment Facilitation Service to help our clients pay international and local suppliers securely, quickly, and efficiently.
          </p>
          <p className="mt-2 text-sm leading-7 text-slate-700 md:text-[15px]">
            This service is ideal for clients who need assistance handling payments for goods purchased from suppliers across different countries.
          </p>

          <h2 className="service-section-title mt-8 text-slate-900">What This Service Covers</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700 md:text-[15px]">
            <li>Payment to international suppliers (for example China and UAE)</li>
            <li>Local supplier payments within Zambia</li>
            <li>Currency conversion and transfer coordination</li>
            <li>Proof of payment issuance</li>
            <li>Supplier confirmation and follow-up</li>
          </ul>

          <h2 className="service-section-title mt-8 text-slate-900">Why Choose Our Payment Facilitation</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700 md:text-[15px]">
            <li>Secure and verified transactions</li>
            <li>Faster processing times</li>
            <li>Trusted supplier handling</li>
            <li>Transparent communication</li>
            <li>Integrated with your shipment process</li>
          </ul>

          <h2 className="service-section-title mt-8 text-slate-900">Process Flow</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700 md:text-[15px]">
            <li>Submit payment request form</li>
            <li>XY Cargo reviews and verifies details</li>
            <li>Payment quote and confirmation sent</li>
            <li>Client approves and funds payment</li>
            <li>Payment processed to supplier</li>
            <li>Proof of payment shared</li>
            <li>Supplier confirms receipt</li>
          </ul>

          <h2 className="service-section-title mt-8 text-slate-900">Processing Time</h2>
          <p className="mt-2 text-sm text-slate-700 md:text-[15px]">International payments: 1-3 business days</p>

          <h2 className="service-section-title mt-8 text-slate-900">Need Assistance?</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700 md:text-[15px]">
            <li>Email: support@xycargozm.com</li>
            <li>Phone: +260 211220012</li>
            <li>WhatsApp: +260 953477949 / +260 769481203</li>
          </ul>

          <h2 className="service-section-title mt-8 text-slate-900">Important Notes</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700 md:text-[15px]">
            <li>Ensure all supplier details are accurate.</li>
            <li>Payments are processed only after confirmation.</li>
            <li>XY Cargo Logistics is not responsible for supplier disputes beyond payment facilitation.</li>
          </ul>

          <div className="mt-8 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5 md:p-6">
            <h2 className="service-section-title text-slate-900">Ready to Start?</h2>
            <p className="mt-2 text-sm text-slate-700 md:text-[15px]">
              Contact our team to begin your supplier payment process and get guided support end-to-end.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
            <Button asChild className="rounded-full bg-[#d8000d] px-6 text-sm font-semibold text-white">
              <Link to="/support">Contact Support Team</Link>
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

export default SupplierPaymentFacilitation;
