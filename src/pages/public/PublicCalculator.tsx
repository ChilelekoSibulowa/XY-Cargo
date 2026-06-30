import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useDefaultCurrency } from "@/hooks/useDefaultCurrency";
import { Calculator, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProductTypes } from "@/hooks/useProductTypes";
import { supabase } from "@/integrations/supabase/client";
import {
  getRateBasis,
  getRateValue,
  getSystemProductTypeOptions,
  mergeProductTypeOptions,
  PublicShippingRate,
  selectSystemShippingRate,
} from "@/lib/publicShippingRates";
import { fallbackProductTypeOptions } from "@/lib/publicProductTypeOptions";

const serviceTypeOptions = [
  {
    id: "air-standard",
    title: "Standard Air Freight",
    subtitle: "10-17 days",
    image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=600&auto=format&fit=crop",
  },
  {
    id: "air-express",
    title: "Express Air Freight",
    subtitle: "1-5 days",
    image: "https://images.unsplash.com/photo-1540962351504-03099e0a754b?q=80&w=600&auto=format&fit=crop",
  },
  {
    id: "sea-freight",
    title: "Sea Freight",
    subtitle: "45-60 days",
    image: "https://images.unsplash.com/photo-1494412574643-ff11b0a5c1c3?q=80&w=600&auto=format&fit=crop",
  },
];


const toNumber = (value: string) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
};

const PublicCalculator = () => {
  const { formatAmount } = useDefaultCurrency();
  const { optionsByService, isLoading: isProductTypesLoading } = useProductTypes();
  const [searchParams] = useSearchParams();
  const [serviceType, setServiceType] = useState(() => searchParams.get("serviceType") || "air-standard");
  const [productType, setProductType] = useState("");
  const [origin, setOrigin] = useState(() => searchParams.get("origin") || "china-foshan");
  const [destination, setDestination] = useState(() => searchParams.get("destination") || "zambia-lusaka");
  const [weight, setWeight] = useState(() => {
    const w = searchParams.get("weight");
    return w ? toNumber(w) : 10;
  });
  const [length, setLength] = useState(40);
  const [width, setWidth] = useState(30);
  const [height, setHeight] = useState(25);
  const [rates, setRates] = useState<PublicShippingRate[]>([]);

  useEffect(() => {
    const o = searchParams.get("origin");
    const d = searchParams.get("destination");
    const w = searchParams.get("weight");
    const s = searchParams.get("serviceType");
    if (o) setOrigin(o);
    if (d) setDestination(d);
    if (w) setWeight(toNumber(w));
    if (s) setServiceType(s);
  }, [searchParams]);

  useEffect(() => {
    const fetchRates = async () => {
      const { data } = await supabase
        .from("shipping_rates")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (data) {
        setRates(data as PublicShippingRate[]);
      }
    };
    fetchRates();
  }, []);

  const isSea = serviceType === "sea-freight";
  const productServiceType = isSea ? "sea" : "air";
  const systemProductTypeOptions = useMemo(
    () => getSystemProductTypeOptions(rates, productServiceType),
    [productServiceType, rates]
  );
  const configuredProductTypeOptions = optionsByService[productServiceType] || [];
  const baseProductTypeOptions =
    !isProductTypesLoading && configuredProductTypeOptions.length > 0
      ? configuredProductTypeOptions
      : fallbackProductTypeOptions[productServiceType];
  const productTypeOptions = useMemo(
    () => mergeProductTypeOptions(baseProductTypeOptions, systemProductTypeOptions),
    [baseProductTypeOptions, systemProductTypeOptions]
  );
  const selectedRate = useMemo(
    () => selectSystemShippingRate(rates, productServiceType, destination, productType),
    [destination, productServiceType, productType, rates]
  );
  const rateBasis = getRateBasis(selectedRate, productServiceType);
  const rateValue = getRateValue(selectedRate, productServiceType);

  const cbm = useMemo(() => (length * width * height) / 1000000, [height, length, width]);

  const rateUnit = rateBasis === "cbm" ? "CBM" : "kg";
  const currentQuote = useMemo(() => {
    const minimumCharge = selectedRate?.minimum_charge || 0;
    const estimatedCost =
      rateBasis === "cbm"
        ? Math.max(cbm * rateValue, minimumCharge)
        : Math.max(weight * rateValue, minimumCharge);

    return {
      estimatedCost,
      rateValue,
      rateUnit,
      detail: rateBasis === "cbm" ? `CBM: ${cbm.toFixed(3)}` : `Weight: ${weight.toFixed(1)} kg`,
    };
  }, [cbm, rateBasis, rateValue, weight, selectedRate]);
  const [calculatedQuote, setCalculatedQuote] = useState(currentQuote);
  const displayedQuote = calculatedQuote || currentQuote;
  const handleCalculate = () => {
    setCalculatedQuote(currentQuote);
  };

  useEffect(() => {
    if (productTypeOptions.length === 0) {
      if (productType) {
        setProductType("");
      }
      return;
    }

    const hasSelectedType = productTypeOptions.some((option) => option.value === productType);
    if (!hasSelectedType) {
      setProductType(productTypeOptions[0].value);
    }
  }, [productType, productTypeOptions]);

  const dynamicPricingInfo = useMemo(() => {
    const info = rates.reduce((acc: any[], rate) => {
      const type = rate.service_type === "air" ? "Air" : "Sea";
      acc.push({
        title: `${type} Service: ${rate.name}`,
        items: [
          rate.rate_per_kg ? `Rate per KG: ${formatAmount(rate.rate_per_kg)}` : null,
          rate.rate_per_cbm ? `Rate per CBM: ${formatAmount(rate.rate_per_cbm)}` : null,
          rate.minimum_charge ? `Minimum charge: ${formatAmount(rate.minimum_charge)}` : null,
        ].filter(Boolean)
      });
      return acc;
    }, []);

    info.push({
      title: "Delivery Times:",
      items: ["Standard Air: 10-17 days", "Express Air: 1-5 days", "Sea Freight: 45-60 days"],
    });

    return info;
  }, [formatAmount, rates]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-14">
      <div className="space-y-3 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Shipping calculator</p>
        <h1 className="text-3xl font-semibold text-slate-900 md:text-4xl">China to Zambia Shipping Calculator</h1>
        <p className="text-sm text-slate-600 md:text-base">Get instant quotes for your shipments from China to Zambia</p>
      </div>

      <div className="mt-10 grid gap-8 md:grid-cols-[1.1fr_0.9fr] md:items-start">
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-700">From</Label>
              <Select value={origin} onValueChange={setOrigin}>
                <SelectTrigger className="rounded-full border-slate-200">
                  <SelectValue placeholder="Select origin" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="china-foshan">China (Foshan)</SelectItem>
                  <SelectItem value="china-yiwu">China (Yiwu)</SelectItem>
                  <SelectItem value="uae-dubai">UAE (Dubai)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-700">To</Label>
              <Select value={destination} onValueChange={setDestination}>
                <SelectTrigger className="rounded-full border-slate-200">
                  <SelectValue placeholder="Select destination" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="zambia-lusaka">Zambia (Lusaka)</SelectItem>
                  <SelectItem value="zambia-ndola">Zambia (Ndola/Kitwe)</SelectItem>
                  <SelectItem value="zambia-livingstone">Zambia (Livingstone)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-semibold text-slate-700">Service Type</Label>
            <div className="grid gap-4 md:grid-cols-3">
              {serviceTypeOptions.map((option) => {
                const isActive = serviceType === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setServiceType(option.id)}
                    className={`relative rounded-2xl border p-3 text-left transition ${
                      isActive
                        ? "border-[#d8000d] ring-2 ring-[#d8000d]/20"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <span
                      className={`absolute right-3 top-3 h-4 w-4 rounded-full border ${
                        isActive ? "border-[#d8000d] bg-[#d8000d]" : "border-slate-300 bg-white"
                      }`}
                    />
                    <img src={option.image} alt={option.title} className="h-24 w-full rounded-xl object-cover" />
                    <div className="mt-3 space-y-1">
                      <p className="text-xs font-semibold text-slate-900">{option.title}</p>
                      <p className="text-[10px] text-slate-500">{option.subtitle}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5">
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-700">Product Type</Label>
              <Select value={productType} onValueChange={setProductType} disabled={productTypeOptions.length === 0}>
                <SelectTrigger className="rounded-full border-slate-200">
                  <SelectValue placeholder="Select product type" />
                </SelectTrigger>
                <SelectContent>
                  {productTypeOptions.length === 0 ? (
                    <SelectItem value="no-product-types" disabled>
                      No product types configured
                    </SelectItem>
                  ) : (
                    productTypeOptions.map((option) => (
                      <SelectItem key={option.id} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {rateBasis === "kg" && (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-slate-700">Weight (kg)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.1"
                    value={weight}
                    onChange={(event) => setWeight(toNumber(event.target.value))}
                    className="rounded-full border-slate-200"
                  />
                </div>
              )}
              {rateBasis === "cbm" && (
                <>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-slate-700">Length (cm)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={length}
                      onChange={(event) => setLength(toNumber(event.target.value))}
                      className="rounded-full border-slate-200"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-slate-700">Width (cm)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={width}
                      onChange={(event) => setWidth(toNumber(event.target.value))}
                      className="rounded-full border-slate-200"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-slate-700">Height (cm)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={height}
                      onChange={(event) => setHeight(toNumber(event.target.value))}
                      className="rounded-full border-slate-200"
                    />
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={handleCalculate}
              className="w-full rounded-full bg-[#d8000d] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b8000b]"
            >
              <Calculator className="mr-2 inline h-4 w-4 align-[-2px]" />
              Calculate
            </button>

            <div className="rounded-2xl border border-slate-200/70 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estimated Total</p>
              <div className="mt-2 flex items-end gap-3">
                <p className="text-2xl font-semibold text-slate-900">{formatAmount(displayedQuote.estimatedCost)}</p>
                <p className="text-xs text-slate-500">Based on current rates</p>
              </div>
              <div className="mt-3 grid gap-2 text-xs text-slate-500 md:grid-cols-2">
                <div>
                  Rate: {formatAmount(displayedQuote.rateValue)} / {displayedQuote.rateUnit}
                </div>
                <div>{displayedQuote.detail}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6">
          <p className="text-sm font-semibold text-[#d8000d]">Ready to Calculate</p>
          <div className="mt-4 space-y-5 text-sm text-slate-700">
            {dynamicPricingInfo.map((section) => (
              <div key={section.title} className="space-y-2">
                <p className="font-semibold text-slate-900">{section.title}</p>
                <ul className="space-y-1">
                  {section.items.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <Check className="mt-1 h-4 w-4 text-slate-700" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicCalculator;
