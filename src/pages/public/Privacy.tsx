import { cmsDefaults, CmsAboutData } from "@/content/cmsDefaults";
import { useCmsPage } from "@/hooks/useCmsPage";

const infoCollect = [
  {
    title: "Personal Information",
    items: [
      "Full name",
      "Phone number",
      "Email address",
      "Physical address",
      "Identification details (where required for customs clearance)",
    ],
  },
  {
    title: "Business and Shipment Information",
    items: [
      "Company name",
      "Shipment details (cargo type, weight, value, destination)",
      "Import and export documentation",
      "Payment and transaction details",
    ],
  },
  {
    title: "Website Usage Information",
    items: ["IP address", "Browser type", "Pages visited", "Date and time of access"],
  },
];

const useInfo = [
  "Provide logistics, freight, and cargo services",
  "Process shipments, deliveries, and customs clearance",
  "Communicate with you regarding orders, updates, or inquiries",
  "Process payments and issue invoices",
  "Improve our website and service quality",
  "Comply with legal and regulatory requirements",
];

const legalBasis = [
  "Performance of a contract",
  "Legal obligations (customs, taxation, regulatory compliance)",
  "Legitimate business interests",
  "Your consent, where applicable",
];

const sharing = [
  "Customs authorities and government agencies",
  "Shipping partners, airlines, shipping lines, and transport providers",
  "Payment processors and financial institutions",
  "IT and system service providers",
];

const security = ["Unauthorized access", "Loss or misuse", "Alteration or disclosure"];

const retention = [
  "Fulfill contractual obligations",
  "Comply with legal and regulatory requirements",
  "Resolve disputes and enforce agreements",
];

const rights = [
  "Access your personal information",
  "Request correction of inaccurate data",
  "Request deletion of data where legally permissible",
  "Withdraw consent where processing is based on consent",
];

const Privacy = () => {
  const { data: aboutContent } = useCmsPage<CmsAboutData>("about", cmsDefaults.about);
  const fallbackHeroImage = "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?q=80&w=1920&auto=format&fit=crop";
  const heroImage = aboutContent?.hero?.image || fallbackHeroImage;

  return (
    <div className="flex flex-col">
      <section className="relative h-[220px] w-full overflow-hidden md:h-[260px]">
        <img
          src={heroImage}
          alt="Privacy Policy"
          className="h-full w-full object-cover"
          onError={(event) => {
            event.currentTarget.src = fallbackHeroImage;
          }}
        />
        <div className="absolute inset-0 bg-black/40" />
        <div className="absolute inset-0 flex items-center justify-center text-center text-white">
          <div>
            <h1 className="public-hero-title text-3xl font-semibold md:text-4xl">Privacy Policy</h1>
            <p className="mt-2 text-xs text-white">XY Cargo Zambia / Privacy Policy</p>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-4xl px-6 py-12">
        <div className="space-y-10">
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold">XY Cargo Logistics Limited</h2>
            <p className="text-sm text-slate-500">Last Updated: 16/01/2026</p>
            <p className="text-base text-slate-600">
              XY Cargo Logistics Limited ("XY Cargo", "we", "our", or "us") is committed to protecting the privacy
              and personal data of our customers, partners, and website visitors. This Privacy Policy explains how
              we collect, use, store, and protect your information when you interact with our website or use our
              logistics services.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Information We Collect</h3>
            <p className="text-base text-slate-600">We may collect the following types of information:</p>
            <div className="space-y-4">
              {infoCollect.map((section) => (
                <div key={section.title} className="space-y-2">
                  <h4 className="text-base font-semibold text-slate-900">{section.title}</h4>
                  <ul className="list-disc space-y-1 pl-6 text-base text-slate-600">
                    {section.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold">How We Use Your Information</h3>
            <p className="text-base text-slate-600">We use your information to:</p>
            <ul className="list-disc space-y-1 pl-6 text-base text-slate-600">
              {useInfo.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Legal Basis for Processing</h3>
            <p className="text-base text-slate-600">We process personal data based on:</p>
            <ul className="list-disc space-y-1 pl-6 text-base text-slate-600">
              {legalBasis.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Information Sharing and Disclosure</h3>
            <p className="text-base text-slate-600">We may share your information with:</p>
            <ul className="list-disc space-y-1 pl-6 text-base text-slate-600">
              {sharing.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="text-base text-slate-600">
              We do not sell or rent your personal information to third parties.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Data Storage and Security</h3>
            <p className="text-base text-slate-600">
              XY Cargo Logistics takes reasonable technical and organizational measures to protect personal data
              against:
            </p>
            <ul className="list-disc space-y-1 pl-6 text-base text-slate-600">
              {security.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="text-base text-slate-600">
              Access to personal information is limited to authorized personnel only.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Data Retention</h3>
            <p className="text-base text-slate-600">We retain personal information only for as long as necessary to:</p>
            <ul className="list-disc space-y-1 pl-6 text-base text-slate-600">
              {retention.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="text-base text-slate-600">
              When no longer required, data is securely deleted or anonymized.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Your Rights</h3>
            <p className="text-base text-slate-600">You have the right to:</p>
            <ul className="list-disc space-y-1 pl-6 text-base text-slate-600">
              {rights.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="text-base text-slate-600">
              Requests can be made by contacting us using the details below.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Cookies and Tracking Technologies</h3>
            <p className="text-base text-slate-600">
              Our website may use cookies to enhance user experience, analyze website traffic, and improve website
              performance. You may disable cookies through your browser settings; however, some website features may
              not function properly.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Third-Party Links</h3>
            <p className="text-base text-slate-600">
              Our website may contain links to third-party websites. XY Cargo Logistics is not responsible for the
              privacy practices or content of external sites.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold">International Data Transfers</h3>
            <p className="text-base text-slate-600">
              Where shipments or services involve cross-border operations, your information may be transferred
              outside Zambia. We ensure such transfers comply with applicable data protection laws and safeguards.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Changes to This Privacy Policy</h3>
            <p className="text-base text-slate-600">
              XY Cargo Logistics reserves the right to update this Privacy Policy at any time. Updates will be
              posted on our website, and continued use of our services constitutes acceptance of the revised policy.
            </p>
          </div>
        </div>
      </section>

    </div>
  );
};

export default Privacy;
