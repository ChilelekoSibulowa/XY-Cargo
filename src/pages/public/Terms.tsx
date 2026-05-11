import { cmsDefaults, CmsAboutData } from "@/content/cmsDefaults";
import { useCmsPage } from "@/hooks/useCmsPage";

const definitions = [
  { term: "Client / Customer", value: "Any individual or entity using XY Cargo Logistics services." },
  { term: "Goods", value: "Items, cargo, or shipments handled by XY Cargo Logistics." },
  {
    term: "Services",
    value:
      "Freight forwarding, cargo handling, customs clearance, warehousing, delivery, Sourcing & Procurement, Supplier Payment Facilitation and related logistics services.",
  },
  { term: "Website", value: "The official XY Cargo Logistics website." },
];

const scope = [
  "Air freight and sea freight services",
  "Road transportation and last-mile delivery",
  "Customs clearance and documentation",
  "Warehousing and cargo consolidation",
  "Import and export logistics solutions",
  "Sourcing & Procurement",
  "Supplier Payment Facilitation",
];

const obligations = [
  "Provide accurate and complete shipment information",
  "Declare the correct nature, value, weight, and contents of goods",
  "Comply with all customs, import, export, and regulatory requirements",
  "Ensure goods are properly packaged and labeled",
];

const prohibited = [
  "Illegal, counterfeit, or prohibited items",
  "Dangerous goods without prior written approval",
  "Explosives, firearms, narcotics, or hazardous materials (unless authorized)",
];

const pricing = [
  "All prices are quoted in agreed currency and may exclude taxes, duties, or government charges",
  "Payment terms are as agreed in writing or invoice",
  "Full or partial payment may be required before release of goods",
  "Late payments may attract penalties or storage charges",
  "XY Cargo Logistics reserves the right to withhold delivery until all outstanding balances are settled",
];

const customs = [
  "Customs duties, taxes, and government charges are the responsibility of the customer",
  "XY Cargo Logistics acts as an agent and is not liable for customs decisions, inspections, or delays",
  "Any penalties arising from incorrect declarations shall be borne by the customer",
];

const delays = [
  "Delivery timelines are estimates and not guaranteed",
  "Delays may occur due to weather, customs inspections, strikes, port congestion, or force majeure",
  "XY Cargo Logistics shall not be liable for indirect or consequential losses due to delays",
];

const liabilityExclusions = [
  "Acts of God",
  "Customs or government actions",
  "Improper packaging",
  "Inherent nature of the goods",
];

const storage = [
  "Storage beyond agreed free periods will attract additional charges",
  "Goods left uncollected may be disposed of after reasonable notice",
  "XY Cargo Logistics is not responsible for deterioration of perishable goods",
];

const termination = ["Terms are breached", "Payments are overdue", "Illegal or unsafe activities are suspected"];

const Terms = () => {
  const { data: aboutContent } = useCmsPage<CmsAboutData>("about", cmsDefaults.about);
  const fallbackHeroImage = "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?q=80&w=1920&auto=format&fit=crop";
  const heroImage = aboutContent?.hero?.image || fallbackHeroImage;

  return (
    <div className="flex flex-col">
      <section className="relative h-[220px] w-full overflow-hidden md:h-[260px]">
        <img
          src={heroImage}
          alt="Terms and Conditions"
          className="h-full w-full object-cover"
          onError={(event) => {
            event.currentTarget.src = fallbackHeroImage;
          }}
        />
        <div className="absolute inset-0 bg-black/40" />
        <div className="absolute inset-0 flex items-center justify-center text-center text-white">
          <div>
            <h1 className="public-hero-title text-3xl font-semibold md:text-4xl">Terms & Conditions</h1>
            <p className="mt-2 text-xs text-white">XY Cargo Zambia / Terms & Conditions</p>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-4xl px-6 py-12">
        <div className="space-y-10">
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold">XY Cargo Logistics Limited</h2>
            <p className="text-sm text-slate-500">Last Updated: 16/01/2026</p>
            <p className="text-base text-slate-600">
              These Terms and Conditions ("Terms") govern the use of the services provided by XY Cargo Logistics
              Limited ("XY Cargo", "we", "our", or "us"). By accessing our website or using our logistics, freight,
              and cargo services, you agree to be bound by these Terms. If you do not agree with any part of these
              Terms, please do not use our services.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Definitions</h3>
            <ul className="space-y-2 text-base text-slate-600">
              {definitions.map((item) => (
                <li key={item.term}>
                  <span className="font-semibold text-slate-900">{item.term}:</span> {item.value}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Scope of Services</h3>
            <p className="text-base text-slate-600">XY Cargo Logistics provides, but is not limited to:</p>
            <ul className="list-disc space-y-1 pl-6 text-base text-slate-600">
              {scope.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="text-base text-slate-600">
              Services are provided subject to availability, operational constraints, and applicable laws.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Customer Obligations</h3>
            <p className="text-base text-slate-600">The customer agrees to:</p>
            <ul className="list-disc space-y-1 pl-6 text-base text-slate-600">
              {obligations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="text-base text-slate-600">
              XY Cargo Logistics shall not be responsible for delays or losses arising from incorrect or incomplete
              information provided by the customer.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Prohibited and Restricted Goods</h3>
            <p className="text-base text-slate-600">Customers must not ship:</p>
            <ul className="list-disc space-y-1 pl-6 text-base text-slate-600">
              {prohibited.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="text-base text-slate-600">
              XY Cargo Logistics reserves the right to refuse, inspect, detain, or dispose of prohibited goods in
              accordance with the law.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Pricing and Payments</h3>
            <ul className="list-disc space-y-1 pl-6 text-base text-slate-600">
              {pricing.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Customs, Duties, and Taxes</h3>
            <ul className="list-disc space-y-1 pl-6 text-base text-slate-600">
              {customs.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Delivery Timelines</h3>
            <ul className="list-disc space-y-1 pl-6 text-base text-slate-600">
              {delays.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Liability and Limitation of Liability</h3>
            <p className="text-base text-slate-600">
              XY Cargo Logistic’s liability is limited to direct loss proven to be caused by our negligence. We are
              not liable for loss due to:
            </p>
            <ul className="list-disc space-y-1 pl-6 text-base text-slate-600">
              {liabilityExclusions.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="text-base text-slate-600">
              Maximum liability shall not exceed the value declared by the customer or applicable international
              freight conventions.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Insurance</h3>
            <p className="text-base text-slate-600">
              Cargo insurance is not included unless expressly requested and paid for. Customers are advised to
              arrange adequate insurance coverage. XY Cargo Logistic is not responsible for uninsured losses.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Storage and Warehousing</h3>
            <ul className="list-disc space-y-1 pl-6 text-base text-slate-600">
              {storage.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Right of Inspection</h3>
            <p className="text-base text-slate-600">
              XY Cargo Logistics reserves the right to inspect shipments, open packages when required by law or
              authorities, and cooperate with customs, security, and regulatory agencies.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Termination of Service</h3>
            <p className="text-base text-slate-600">XY Cargo Logistics may suspend or terminate services if:</p>
            <ul className="list-disc space-y-1 pl-6 text-base text-slate-600">
              {termination.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="text-base text-slate-600">
              Termination does not waive the customer’s obligation to pay outstanding charges.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Intellectual Property</h3>
            <p className="text-base text-slate-600">
              All website content, logos, trademarks, and materials are the property of XY Cargo Logistics and may
              not be reproduced without written permission.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Privacy and Data Protection</h3>
            <p className="text-base text-slate-600">
              Customer information is handled in accordance with our Privacy Policy and applicable data protection
              laws.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Governing Law and Jurisdiction</h3>
            <p className="text-base text-slate-600">
              These Terms shall be governed by and interpreted in accordance with the laws of the Republic of
              Zambia. Any disputes shall be resolved in the courts of Zambia.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Amendments</h3>
            <p className="text-base text-slate-600">
              XY Cargo Logistics reserves the right to update or modify these Terms at any time. Continued use of
              our services constitutes acceptance of the revised Terms.
            </p>
          </div>
        </div>
      </section>

    </div>
  );
};

export default Terms;
