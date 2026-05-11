import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useCmsPage } from "@/hooks/useCmsPage";
import { cmsDefaults, CmsServicesData } from "@/content/cmsDefaults";

const ProductSourcingService = () => {
  const { data: servicesContent } = useCmsPage<CmsServicesData>("services", cmsDefaults.services);
  const heroImage =
    servicesContent.services.find((service) => service.title.toLowerCase() === "product sourcing")?.image ||
    cmsDefaults.services.services.find((service) => service.title.toLowerCase() === "product sourcing")?.image ||
    "/services/service-03.jpg";

  return (
    <div className="flex flex-col bg-slate-50">
      <section className="relative h-[170px] w-full overflow-hidden md:h-[210px]">
        <img
          src={heroImage}
          alt="Product Sourcing Service"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/45 to-black/30" />
        <div className="absolute inset-0 flex items-center justify-center text-center text-white">
          <div className="px-4">
            <p className="mx-auto w-fit rounded-full border border-white/40 bg-white/15 px-3 py-1 text-[11px] font-medium tracking-wide text-white/95">
              XY Cargo Zambia / Services
            </p>
            <h1 className="public-hero-title service-page-title mt-2">Product Sourcing Service</h1>
            <p className="mt-1 text-[11px] text-white/90 md:text-xs">Source smarter, verify faster, ship with confidence.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl space-y-6 px-6 py-10 md:py-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <p className="text-sm leading-7 text-slate-700 md:text-[15px]">
            At XY Cargo Logistics, we go beyond transportation. We help you find, verify, and ship quality products from trusted suppliers across the globe, especially from key markets like China and the United Arab Emirates.
          </p>
          <p className="mt-3 text-sm leading-7 text-slate-700 md:text-[15px]">
            Whether you are an individual importer or a large business, our sourcing solutions are designed to make global trade simple, safe, and cost-effective.
          </p>

          <h2 className="service-section-title mt-8 text-slate-900">What We Do</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700 md:text-[15px]">
            <li>Supplier Identification: We find reliable and verified manufacturers and wholesalers based on your product requirements.</li>
            <li>Price Negotiation: We negotiate directly with suppliers to get you the best market price.</li>
            <li>Product Verification: We confirm product quality, specifications, and authenticity before purchase.</li>
            <li>Sample Procurement: We arrange samples so you can approve before bulk ordering.</li>
            <li>Order Management: We handle communication, order placement, and supplier follow-ups.</li>
            <li>Consolidation and Shipping: We combine your goods and ship them efficiently to Zambia.</li>
          </ul>

          <h2 className="service-section-title mt-8 text-slate-900">How It Works</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-700 md:text-[15px]">
            <li>Step 1: Submit Request. Fill out our sourcing request form with product details (name, quantity, specifications, budget).</li>
            <li>Step 2: Supplier Search. Our team identifies and contacts suitable suppliers.</li>
            <li>Step 3: Quotation and Approval. We send you pricing options and supplier details for approval.</li>
            <li>Step 4: Payment Facilitation. We assist with secure supplier payments.</li>
            <li>Step 5: Shipping and Delivery. Your goods are shipped, tracked, and delivered to your destination.</li>
          </ol>

          <h2 className="service-section-title mt-8 text-slate-900">Who This Service Is For</h2>
          <ul className="mt-3 grid list-disc gap-2 pl-5 text-sm text-slate-700 md:grid-cols-2 md:text-[15px]">
            <li>Importers and traders</li>
            <li>SMEs and retail businesses</li>
            <li>Online sellers (e-commerce)</li>
            <li>Individuals buying in bulk</li>
          </ul>

          <h2 className="service-section-title mt-8 text-slate-900">Why Choose XY Cargo Logistics</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700 md:text-[15px]">
            <li>Trusted global supplier network</li>
            <li>Transparent pricing</li>
            <li>Quality assurance checks</li>
            <li>End-to-end logistics support</li>
            <li>Real-time shipment tracking</li>
            <li>Dedicated customer support</li>
          </ul>

          <h2 className="service-section-title mt-8 text-slate-900">Popular Products We Source</h2>
          <ul className="mt-3 grid list-disc gap-2 pl-5 text-sm text-slate-700 md:grid-cols-2 md:text-[15px]">
            <li>Electronics and accessories</li>
            <li>Clothing and textiles</li>
            <li>Industrial equipment</li>
            <li>Automotive parts</li>
            <li>Household goods</li>
            <li>Packaging materials</li>
          </ul>

          <div className="mt-8 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5 md:p-6">
            <h2 className="service-section-title text-slate-900">Request Product Sourcing</h2>
            <p className="mt-2 text-sm text-slate-700 md:text-[15px]">
              Ready to source your products? Sign up and fill in the request form, and our team will get back to you within 24 hours.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button asChild className="rounded-full bg-[#d8000d] px-6 text-sm font-semibold text-white">
                <Link to="/register">Sign Up and Fill Request Form</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full px-6 text-sm font-semibold">
                <Link to="/support">Need Help? Contact Support</Link>
              </Button>
            </div>
            <p className="mt-4 text-sm text-slate-700 md:text-[15px]">
              Let Us Source for You: With XY Cargo Logistics, sourcing products internationally has never been easier. We handle the complexity so you can focus on growing your business.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ProductSourcingService;
