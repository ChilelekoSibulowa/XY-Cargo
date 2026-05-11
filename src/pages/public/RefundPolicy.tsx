import { cmsDefaults, CmsAboutData } from "@/content/cmsDefaults";
import { useCmsPage } from "@/hooks/useCmsPage";

const cancellationRules = [
  "Customers may request cancellation of a service in writing before shipment processing or dispatch begins.",
  "If cancellation is approved before service commencement, a partial or full refund may be considered.",
  "If cancellation occurs after shipment processing, booking, or dispatch, cancellation fees will apply, and refunds may not be available.",
];

const nonCancellable = [
  "The shipment has already been dispatched",
  "Customs documentation has been submitted",
  "Third-party costs (airlines, shipping lines, customs, ports) have already been incurred",
];

const refundEligible = [
  "Duplicate or erroneous payment by the customer",
  "Cancellation approved before service commencement",
  "Failure by XY Cargo Logistics to provide the agreed service due to internal operational reasons",
];

const nonRefundable = [
  "Customs duties, taxes, and government charges",
  "Third-party service fees already incurred",
  "Storage, demurrage, or detention charges",
  "Delays caused by customs authorities, weather, strikes, or force majeure",
  "Losses arising from incorrect shipment information provided by the customer",
];

const RefundPolicy = () => {
  const { data: aboutContent } = useCmsPage<CmsAboutData>("about", cmsDefaults.about);
  const fallbackHeroImage = "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?q=80&w=1920&auto=format&fit=crop";
  const heroImage = aboutContent?.hero?.image || fallbackHeroImage;

  return (
    <div className="flex flex-col">
      <section className="relative h-[220px] w-full overflow-hidden md:h-[260px]">
        <img
          src={heroImage}
          alt="Refund & Cancellation Policy"
          className="h-full w-full object-cover"
          onError={(event) => {
            event.currentTarget.src = fallbackHeroImage;
          }}
        />
        <div className="absolute inset-0 bg-black/40" />
        <div className="absolute inset-0 flex items-center justify-center text-center text-white">
          <div>
            <h1 className="public-hero-title text-3xl font-semibold md:text-4xl">Refund & Cancellation Policy</h1>
            <p className="mt-2 text-xs text-white">XY Cargo Zambia / Refund Policy</p>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-4xl px-6 py-12">
        <div className="space-y-10">
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold">XY Cargo Logistics Limited</h2>
            <p className="text-sm text-slate-500">Last Updated: 16/01/2026</p>
            <p className="text-base text-slate-600">
              XY Cargo Logistics Limited ("XY Cargo", "we", "our", or "us") is committed to transparency and fairness
              in the delivery of our logistics and freight services. This Refund & Cancellation Policy explains the
              conditions under which cancellations and refunds may apply.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Nature of Services</h3>
            <p className="text-base text-slate-600">
              XY Cargo Logistics provides service-based logistics solutions, including freight forwarding, customs
              clearance, transportation, and warehousing. Once a logistics service has commenced, costs are incurred
              immediately and may involve third parties.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Cancellation Policy</h3>
            <h4 className="text-base font-semibold text-slate-900">2.1 Customer-Initiated Cancellations</h4>
            <ul className="list-disc space-y-1 pl-6 text-base text-slate-600">
              {cancellationRules.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <h4 className="text-base font-semibold text-slate-900">2.2 Non-Cancellable Services</h4>
            <p className="text-base text-slate-600">Cancellations will not be accepted where:</p>
            <ul className="list-disc space-y-1 pl-6 text-base text-slate-600">
              {nonCancellable.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Refund Policy</h3>
            <h4 className="text-base font-semibold text-slate-900">3.1 Eligibility for Refunds</h4>
            <p className="text-base text-slate-600">Refunds may be considered in the following cases:</p>
            <ul className="list-disc space-y-1 pl-6 text-base text-slate-600">
              {refundEligible.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <h4 className="text-base font-semibold text-slate-900">3.2 Non-Refundable Charges</h4>
            <p className="text-base text-slate-600">The following are non-refundable:</p>
            <ul className="list-disc space-y-1 pl-6 text-base text-slate-600">
              {nonRefundable.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Refund Processing</h3>
            <p className="text-base text-slate-600">
              Approved refunds will be processed within 7–14 working days. Refunds will be made using the original
              payment method where possible. Bank charges or transaction fees may be deducted where applicable.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Disputes</h3>
            <p className="text-base text-slate-600">
              Any disputes regarding cancellations or refunds shall be resolved in accordance with the laws of the
              Republic of Zambia. XY Cargo Logistics reserves the right to make the final determination based on
              service records and incurred costs.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Policy Amendments</h3>
            <p className="text-base text-slate-600">
              XY Cargo Logistics reserves the right to update or modify this Refund & Cancellation Policy at any
              time. Changes will be published on our website and take effect immediately upon posting.
            </p>
          </div>
        </div>
      </section>

    </div>
  );
};

export default RefundPolicy;
