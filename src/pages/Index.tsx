import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BatteryCharging,
  Box,
  Calculator,
  Check,
  HeartPulse,
  Laptop,
  Package,
  Play,
  Scissors,
  Smartphone,
  Users,
  Globe,
  Clock,
  CheckCircle2,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCmsPage } from "@/hooks/useCmsPage";
import { cmsDefaults, CmsHomeData } from "@/content/cmsDefaults";
import { OptimizedImage } from "@/components/shared/OptimizedImage";
import MetaPixel from "@/components/marketing/MetaPixel";
import { useDefaultCurrency } from "@/hooks/useDefaultCurrency";
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

const Index = () => {
  const { data: home } = useCmsPage<CmsHomeData>("home", cmsDefaults.home);
  const { formatAmount } = useDefaultCurrency();
  const { optionsByService, isLoading: isProductTypesLoading } = useProductTypes();
  const [activeSlide, setActiveSlide] = useState(0);
  const [serviceType, setServiceType] = useState("air-standard");
  const [productType, setProductType] = useState("");
  const [origin, setOrigin] = useState("china-foshan");
  const [destination, setDestination] = useState("zambia-lusaka");
  
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"tracking" | "shipping">("tracking");
  const [trackingCode, setTrackingCode] = useState("");
  const [estOrigin, setEstOrigin] = useState("china-foshan");
  const [estDestination, setEstDestination] = useState("zambia-lusaka");

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (trackingCode.trim()) {
      navigate(`/tracking?query=${encodeURIComponent(trackingCode.trim())}`);
    }
  };

  const handleEstimateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const element = document.getElementById("homepage-calculator");
    if (element) {
      setOrigin(estOrigin);
      setDestination(estDestination);
      element.scrollIntoView({ behavior: "smooth" });
    } else {
      navigate(`/calculator?origin=${estOrigin}&destination=${estDestination}`);
    }
  };
  const [weight, setWeight] = useState(10);
  const [length, setLength] = useState(40);
  const [width, setWidth] = useState(30);
  const [height, setHeight] = useState(25);
  const [shippingRates, setShippingRates] = useState<PublicShippingRate[]>([]);
  const [airRateIndex, setAirRateIndex] = useState(0);
  const [seaRateIndex, setSeaRateIndex] = useState(0);
  const [hasStartedVideoPlayback, setHasStartedVideoPlayback] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const steps = Array.isArray(home?.steps) ? home.steps : cmsDefaults.home.steps;
  const aboutAccordions = Array.isArray(home?.about?.accordions)
    ? home.about.accordions
    : cmsDefaults.home.about.accordions;
  const stats = Array.isArray(home?.stats) ? home.stats : cmsDefaults.home.stats;
  const airRatesContent = Array.isArray(home?.airRates) ? home.airRates : cmsDefaults.home.airRates;
  const seaRatesContent = Array.isArray(home?.seaRates) ? home.seaRates : cmsDefaults.home.seaRates;
  const minimumRequirements = Array.isArray(home?.infoSection?.minimumRequirements)
    ? home.infoSection.minimumRequirements
    : cmsDefaults.home.infoSection.minimumRequirements;
  const storagePolicy = Array.isArray(home?.infoSection?.storagePolicy)
    ? home.infoSection.storagePolicy
    : cmsDefaults.home.infoSection.storagePolicy;
  const includeCardItems = Array.isArray(home?.infoSection?.includeCard?.items)
    ? home.infoSection.includeCard.items
    : cmsDefaults.home.infoSection.includeCard.items;
  const safeVideoTitle = home?.video?.title || cmsDefaults.home.video.title;
  const videoSrc =
    typeof home?.video?.image === "string" && home.video.image.trim().length > 0
      ? home.video.image
      : cmsDefaults.home.video.image;
  const isVideo = typeof videoSrc === "string" && videoSrc.toLowerCase().endsWith(".mp4");

  const handleVideoPlay = async () => {
    const videoElement = videoRef.current;

    if (!videoElement) {
      return;
    }

    videoElement.currentTime = 0;
    videoElement.muted = false;

    try {
      await videoElement.play();
      setHasStartedVideoPlayback(true);
    } catch (error) {
      console.error("Unable to start homepage video playback", error);
    }
  };

  const slides = useMemo(() => {
    if (Array.isArray(home?.heroSlides) && home.heroSlides.length > 0) {
      return home.heroSlides;
    }
    return [
      {
        title: home?.hero?.title || cmsDefaults.home.hero.title,
        subtitle: home?.hero?.subtitle || cmsDefaults.home.hero.subtitle,
        description: home?.hero?.description || home?.hero?.subtitle || cmsDefaults.home.hero.subtitle,
        image: home?.hero?.image || cmsDefaults.home.hero.image,
      },
    ];
  }, [home]);

  useEffect(() => {
    if (slides.length <= 1) {
      return undefined;
    }
    const interval = setInterval(() => {
      setActiveSlide((current) => (current + 1) % slides.length);
    }, 6500);
    return () => clearInterval(interval);
  }, [slides.length]);

  const currentSlide = slides[Math.min(activeSlide, slides.length - 1)];
  const heroKey = `${currentSlide?.title || "slide"}-${activeSlide}`;
  const serviceTypeOptions = [
    {
      id: "air-standard",
      title: "Standard Air Freight",
      subtitle: "10-17 days",
      image: "/hero/hero-1.jpg",
    },
    {
      id: "air-express",
      title: "Express Air Freight",
      subtitle: "1-5 days",
      image: "/hero/hero-2.jpg",
    },
    {
      id: "sea-freight",
      title: "Sea Freight",
      subtitle: "45-60 days",
      image: "/hero/hero-3.jpg",
    },
  ];

  useEffect(() => {
    const fetchShippingRates = async () => {
      const { data, error } = await supabase
        .from("shipping_rates")
        .select("id, name, service_type, rate_per_kg, rate_per_cbm, minimum_charge")
        .eq("is_active", true)
        .order("name");

      if (!error) {
        setShippingRates((data || []) as PublicShippingRate[]);
      }
    };

    void fetchShippingRates();
  }, []);

  useEffect(() => {
    if (airRatesContent.length > 0) {
      setAirRateIndex((prev) => (prev < airRatesContent.length ? prev : 0));
    }
  }, [airRatesContent]);
  const activeAirRate = airRatesContent[airRateIndex] ?? airRatesContent[0];
  useEffect(() => {
    if (seaRatesContent.length > 0) {
      setSeaRateIndex((prev) => (prev < seaRatesContent.length ? prev : 0));
    }
  }, [seaRatesContent]);
  const activeSeaRate = seaRatesContent[seaRateIndex] ?? seaRatesContent[0];
  const airRateIcons: Record<string, JSX.Element> = {
    "Normal Goods": <Package className="h-6 w-6 text-slate-500" />,
    "Wigs & Hair Products": <Scissors className="h-6 w-6 text-slate-500" />,
    "Mobile Phones": <Smartphone className="h-6 w-6 text-slate-500" />,
    "Battery Goods & Electronics": <BatteryCharging className="h-6 w-6 text-slate-500" />,
    "Laptops & iPads": <Laptop className="h-6 w-6 text-slate-500" />,
    Medicare: <HeartPulse className="h-6 w-6 text-slate-500" />,
  };
  const seaRateIcons: Record<string, JSX.Element> = {
    "General Goods": <Package className="h-6 w-6 text-slate-500" />,
    "Special Goods": <Box className="h-6 w-6 text-slate-500" />,
  };

  const isSea = serviceType === "sea-freight";
  const productServiceType = isSea ? "sea" : "air";
  const systemProductTypeOptions = useMemo(
    () => getSystemProductTypeOptions(shippingRates, productServiceType),
    [productServiceType, shippingRates]
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
  const selectedRate = useMemo(() => {
    return selectSystemShippingRate(shippingRates, productServiceType, destination, productType);
  }, [destination, productServiceType, productType, shippingRates]);
  const cbm = useMemo(() => (length * width * height) / 1000000, [height, length, width]);
  const rateBasis = getRateBasis(selectedRate, productServiceType);
  const rateValue = getRateValue(selectedRate, productServiceType);
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
  }, [cbm, rateBasis, rateValue, selectedRate, weight]);
  const [calculatedQuote, setCalculatedQuote] = useState(currentQuote);
  const displayedQuote = calculatedQuote || currentQuote;
  const pricingInfo = useMemo(() => {
    const info = shippingRates.map((rate) => {
      const service = rate.service_type === "air" ? "Air" : "Sea";
      return {
        title: `${service} Service: ${rate.name}`,
        items: [
          rate.rate_per_kg ? `Rate per KG: ${formatAmount(rate.rate_per_kg)}` : null,
          rate.rate_per_cbm ? `Rate per CBM: ${formatAmount(rate.rate_per_cbm)}` : null,
          rate.minimum_charge ? `Minimum charge: ${formatAmount(rate.minimum_charge)}` : null,
        ].filter((item): item is string => Boolean(item)),
      };
    });

    info.push({
      title: "Delivery Times:",
      items: ["Standard Air: 10-17 days", "Express Air: 1-5 days", "Sea Freight: 45-60 days"],
    });

    return info;
  }, [formatAmount, shippingRates]);
  const toNumber = (value: string) => {
    const next = Number(value);
    return Number.isFinite(next) ? next : 0;
  };
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

  return (
    <>
      <MetaPixel />
      <div className="flex flex-col">
        {/* Redesigned Hero Section */}
        <section className="relative w-full min-h-[580px] lg:min-h-[640px] flex flex-col justify-between overflow-hidden bg-slate-950 text-white">
          {/* Background image with high contrast dark gradient overlay */}
          <div className="absolute inset-0 z-0">
            <OptimizedImage
              src="/hero/xy-hero-bg.png"
              alt="XY Cargo Redesign background"
              className="h-full w-full object-cover opacity-35"
              containerClassName="h-full w-full"
              aspectRatio="auto"
              priority={true}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-900/60 to-slate-950/80" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-slate-950/90" />
          </div>

          <div className="relative z-10 w-full max-w-7xl mx-auto px-6 py-16 lg:py-24 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center flex-1">
            {/* Left Content Column */}
            <div className="lg:col-span-7 space-y-6 motion-safe:animate-fade-up">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#d8000d]/10 text-[#d8000d] border border-[#d8000d]/20 uppercase tracking-wider">
                China & UAE to Zambia Logistics
              </span>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight uppercase">
                We Keep Your <span className="text-[#d8000d]">Supply Chain</span> Moving
              </h1>
              <p className="text-base sm:text-lg text-slate-200 max-w-xl leading-relaxed">
                From China and UAE to Zambia, our seamless logistics solutions ensure on-time, secure, and hassle-free delivery. Connect your business across borders with speed and certainty.
              </p>
              <Button
                asChild
                className="rounded-full bg-[#d8000d] text-white hover:bg-[#bf000c] text-sm font-semibold px-8 py-6 shadow-lg shadow-[#d8000d]/20 transition-all hover:translate-y-[-1px] group"
              >
                <Link to="/about" className="inline-flex items-center gap-2">
                  <span>Learn More Now</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
            </div>

            {/* Right Card Column */}
            <div className="lg:col-span-5 motion-safe:animate-fade-up [animation-delay:150ms]">
              <Card className="bg-white/95 backdrop-blur-md border border-slate-200/50 rounded-3xl shadow-2xl p-6 sm:p-8 relative overflow-hidden text-slate-900">
                <div className="flex border-b border-slate-100 mb-6">
                  <button
                    type="button"
                    onClick={() => setActiveTab("tracking")}
                    className={cn(
                      "flex-1 pb-4 text-xs sm:text-sm font-bold border-b-2 text-center transition-all uppercase tracking-wide",
                      activeTab === "tracking"
                        ? "border-[#d8000d] text-[#d8000d]"
                        : "border-transparent text-slate-500 hover:text-slate-900"
                    )}
                  >
                    Tracking Order
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("shipping")}
                    className={cn(
                      "flex-1 pb-4 text-xs sm:text-sm font-bold border-b-2 text-center transition-all uppercase tracking-wide",
                      activeTab === "shipping"
                        ? "border-[#d8000d] text-[#d8000d]"
                        : "border-transparent text-slate-500 hover:text-slate-900"
                    )}
                  >
                    Ship Order
                  </button>
                </div>

                {activeTab === "tracking" && (
                  <form onSubmit={handleTrackSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="trackingCode" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Tracking Number
                      </Label>
                      <Input
                        id="trackingCode"
                        type="text"
                        placeholder="Type your tracking number here"
                        value={trackingCode}
                        onChange={(e) => setTrackingCode(e.target.value)}
                        className="w-full rounded-xl border-slate-200 focus:border-[#d8000d] focus:ring-[#d8000d]/10 h-12"
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full rounded-xl bg-[#d8000d] text-white hover:bg-[#bf000c] h-12 font-bold shadow-lg shadow-[#d8000d]/20 transition-all"
                    >
                      Track Now
                    </Button>
                    <div className="flex items-center justify-between pt-2 text-xs">
                      <Link to="/tracking" className="text-[#d8000d] hover:underline font-semibold">
                        Multiple Tracking Numbers
                      </Link>
                      <Link to="/support" className="flex items-center gap-1 text-slate-500 hover:text-slate-950 transition-colors">
                        <HelpCircle className="h-4 w-4 text-slate-400" />
                        <span>Need Help</span>
                      </Link>
                    </div>
                  </form>
                )}

                {activeTab === "shipping" && (
                  <form onSubmit={handleEstimateSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">From (Origin)</Label>
                        <Select value={estOrigin} onValueChange={setEstOrigin}>
                          <SelectTrigger className="rounded-xl border-slate-200 h-11 text-xs">
                            <SelectValue placeholder="Origin" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="china-foshan">China (Foshan)</SelectItem>
                            <SelectItem value="china-yiwu">China (Yiwu)</SelectItem>
                            <SelectItem value="uae-dubai">UAE (Dubai)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">To (Destination)</Label>
                        <Select value={estDestination} onValueChange={setEstDestination}>
                          <SelectTrigger className="rounded-xl border-slate-200 h-11 text-xs">
                            <SelectValue placeholder="Destination" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="zambia-lusaka">Zambia (Lusaka)</SelectItem>
                            <SelectItem value="zambia-ndola">Zambia (Ndola)</SelectItem>
                            <SelectItem value="zambia-livingstone">Zambia (Livingstone)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button
                      type="submit"
                      className="w-full rounded-xl bg-[#d8000d] text-white hover:bg-[#bf000c] h-12 font-bold shadow-lg shadow-[#d8000d]/20 transition-all"
                    >
                      Estimate Cost
                    </Button>
                    <p className="text-[11px] text-slate-500 text-center leading-relaxed">
                      Instant shipping calculation for Air Cargo and Sea Freight.
                    </p>
                  </form>
                )}
              </Card>
            </div>
          </div>

          {/* Stats Bar Overlay */}
          <div className="relative z-10 w-full bg-slate-950/70 border-t border-white/5 py-8 backdrop-blur-md">
            <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm transition-all hover:bg-white/10">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#d8000d]/15 text-[#d8000d]">
                  <Users className="h-6 w-6" />
                </div>
                <div className="flex flex-col">
                  <span className="text-2xl font-bold text-white leading-tight">2,000+</span>
                  <span className="text-xs text-slate-400 font-medium mt-0.5">Satisfied Clients</span>
                </div>
              </div>

              <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm transition-all hover:bg-white/10">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#d8000d]/15 text-[#d8000d]">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div className="flex flex-col">
                  <span className="text-2xl font-bold text-white leading-tight">99.98%</span>
                  <span className="text-xs text-slate-400 font-medium mt-0.5">On-Time Delivery</span>
                </div>
              </div>

              <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm transition-all hover:bg-white/10">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#d8000d]/15 text-[#d8000d]">
                  <Globe className="h-6 w-6" />
                </div>
                <div className="flex flex-col">
                  <span className="text-2xl font-bold text-white leading-tight">150+</span>
                  <span className="text-xs text-slate-400 font-medium mt-0.5">Countries Served</span>
                </div>
              </div>

              <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm transition-all hover:bg-white/10">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#d8000d]/15 text-[#d8000d]">
                  <Clock className="h-6 w-6" />
                </div>
                <div className="flex flex-col">
                  <span className="text-2xl font-bold text-white leading-tight">24/7</span>
                  <span className="text-xs text-slate-400 font-medium mt-0.5">Customer Support</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Shipping Process Text Header */}
        <section className="mx-auto max-w-6xl px-6 py-16 text-center motion-safe:animate-fade-in">
          <div className="mx-auto max-w-3xl space-y-4">
            <h2 className="text-3xl font-extrabold text-slate-900 uppercase tracking-tight">{home.process.title}</h2>
            <div className="h-1 w-20 bg-[#d8000d] mx-auto rounded-full" />
            <p className="text-base text-slate-600 mt-4 leading-relaxed">{home.process.body}</p>
            <Button asChild className="rounded-full bg-[#d8000d] hover:bg-[#bf000c] px-8 py-5 text-sm font-semibold text-white shadow-md shadow-[#d8000d]/10">
              <Link to="/tracking">{home.process.buttonLabel}</Link>
            </Button>
          </div>
        </section>

        {/* Process Steps Cards */}
        <section className="bg-slate-50 border-y border-slate-100 py-16 motion-safe:animate-fade-in">
          <div className="mx-auto grid max-w-7xl grid-cols-1 sm:grid-cols-2 gap-8 px-6 md:grid-cols-4">
            {steps.map((step, index) => (
              <Card key={step.title} className="text-center group bg-white border border-slate-200/60 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300">
                <div className="relative mx-auto h-24 w-24 overflow-hidden rounded-full ring-2 ring-transparent transition-all duration-300 group-hover:ring-[#d8000d] group-hover:scale-105">
                  <OptimizedImage src={step.image} alt={step.title} className="h-full w-full object-cover" />
                  <span className="absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full bg-[#d8000d] text-xs font-bold text-white shadow-lg">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="mt-5 text-base font-bold text-slate-900 transition-colors group-hover:text-[#d8000d]">{step.title}</h3>
                <p className="mt-2 text-xs sm:text-sm text-slate-500 leading-relaxed">{step.body}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* About Section */}
        <section className="mx-auto max-w-6xl px-6 py-16 grid grid-cols-1 md:grid-cols-[1.1fr_0.9fr] gap-12 md:items-center motion-safe:animate-fade-in">
          <div className="space-y-6">
            <div className="space-y-2">
              <span className="text-xs font-bold text-[#d8000d] uppercase tracking-widest">Who We Are</span>
              <h2 className="text-3xl font-extrabold text-slate-900 uppercase tracking-tight">{home.about.title}</h2>
              <div className="h-1 w-16 bg-[#d8000d] rounded-full" />
            </div>
            <p className="text-base text-slate-600 leading-relaxed">{home.about.body}</p>
            <Accordion type="single" collapsible className="space-y-3 w-full">
              {aboutAccordions.map((item, idx) => (
                <AccordionItem key={item.title} value={item.title} className="border border-slate-200 rounded-xl px-4 bg-white">
                  <AccordionTrigger className="text-sm font-bold text-slate-800 hover:text-[#d8000d] hover:no-underline py-3">
                    {item.title}
                  </AccordionTrigger>
                  <AccordionContent className="text-xs sm:text-sm text-slate-500 leading-relaxed pb-4 pt-1 border-t border-slate-100">
                    {item.body}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-tr from-[#d8000d]/10 to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-all duration-500" />
            <OptimizedImage 
              src={home.about.image} 
              alt="About XY Cargo Zambia" 
              className="rounded-3xl shadow-lg border border-slate-200/50" 
              aspectRatio="video"
            />
          </div>
        </section>

      <section className="bg-[#fefafa] py-10 motion-safe:animate-fade-in">
        <div className="mx-auto max-w-6xl space-y-6 px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <h2 className="text-2xl font-semibold">Air Freight Services</h2>
            <div className="flex items-center gap-3">
               {airRatesContent.map((rate, index) => {
                const isActive = index === airRateIndex;
                return (
                  <button
                    key={rate.location}
                    type="button"
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      isActive
                        ? "bg-[#d8000d] text-white shadow-lg"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                    onClick={() => setAirRateIndex(index)}
                  >
                    {rate.location}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {activeAirRate?.cards.map((card) => (
              <Card key={card.title} className="rounded-2xl border border-slate-200/70 bg-white shadow-sm">
                <CardContent className="space-y-3 p-5 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-slate-200">
                    {airRateIcons[card.title] ?? <Package className="h-6 w-6 text-slate-500" />}
                  </div>
                  <h3 className="text-lg font-semibold">{card.title}</h3>
                  <p className="text-xs font-semibold text-slate-500">{card.price}</p>
                  <p className="text-xs text-slate-600">{card.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#fefafa] py-10 motion-safe:animate-fade-in">
        <div className="mx-auto max-w-6xl space-y-6 px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <h2 className="text-2xl font-semibold">Sea Freight Services</h2>
            <div className="flex items-center gap-3">
               {seaRatesContent.map((rate, index) => {
                const isActive = index === seaRateIndex;
                return (
                  <button
                    key={rate.location}
                    type="button"
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      isActive
                        ? "bg-[#d8000d] text-white shadow-lg"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                    onClick={() => setSeaRateIndex(index)}
                  >
                    {rate.location}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {activeSeaRate?.cards.map((card) => (
              <Card key={card.title} className="rounded-2xl border border-slate-200/70 bg-white shadow-sm">
                <CardContent className="space-y-3 p-5 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-slate-200">
                    {seaRateIcons[card.title] ?? <Package className="h-6 w-6 text-slate-500" />}
                  </div>
                  <h3 className="text-lg font-semibold">{card.title}</h3>
                  <p className="text-xs font-semibold text-slate-500">{card.price}</p>
                  <p className="text-xs text-slate-600">{card.description}</p>
                  {card.notes && (
                    <div className="space-y-1 text-xs text-slate-500">
                      {card.notes.map((note) => (
                        <p key={note}>{note}</p>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="relative mt-4 h-[280px] w-full overflow-hidden motion-safe:animate-fade-in">
        {isVideo ? (
          <video
            ref={videoRef}
            src={videoSrc}
            className="h-full w-full object-cover"
            controls={hasStartedVideoPlayback}
            playsInline
            preload="metadata"
          />
        ) : (
            <OptimizedImage src={videoSrc} alt={safeVideoTitle} className="h-full w-full" />
        )}
        {isVideo && !hasStartedVideoPlayback ? (
          <>
            <div className="absolute inset-0 bg-black/40" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Button
                type="button"
                onClick={handleVideoPlay}
                aria-label={`Play ${safeVideoTitle} with sound`}
                className="h-14 w-14 rounded-full bg-white text-brand shadow-xl transition-transform hover:scale-110 hover:shadow-2xl"
              >
                <Play className="h-6 w-6" />
              </Button>
            </div>
          </>
        ) : null}
      </section>

      <section id="homepage-calculator" className="mx-auto max-w-6xl px-6 py-12 motion-safe:animate-fade-in">
        <div className="space-y-3 text-center">
          <h2 className="text-2xl font-semibold md:text-3xl">{home.calculator.title}</h2>
          <p className="text-sm text-slate-600">{home.calculator.subtitle}</p>
        </div>
        <div className="mt-8 grid gap-8 md:grid-cols-[1.1fr_0.9fr] md:items-start">
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
                <Select
                  value={productType}
                  onValueChange={setProductType}
                  disabled={productTypeOptions.length === 0}
                >
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

              <Button
                type="button"
                onClick={handleCalculate}
                className="w-full rounded-full bg-[#d8000d] text-white hover:bg-[#b8000b]"
              >
                <Calculator className="mr-2 h-4 w-4" />
                Calculate
              </Button>

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
              {pricingInfo.map((section) => (
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
      </section>

      <section className="mx-auto grid max-w-6xl items-start gap-6 px-6 pb-12 md:grid-cols-2 motion-safe:animate-fade-in">
        <Card className="rounded-3xl border border-dashed border-slate-300 bg-white">
          <CardContent className="space-y-6 p-6">
            <h3 className="text-lg font-semibold text-[#d8000d]">Important Information</h3>
            <div>
              <p className="text-xs font-semibold text-slate-900">Minimum Requirements</p>
              <ul className="space-y-2 text-sm text-slate-600">
                 {minimumRequirements.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <Check className="mt-1 h-4 w-4 text-slate-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-900">Storage Policy</p>
              <ul className="space-y-2 text-sm text-slate-600">
                 {storagePolicy.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <Check className="mt-1 h-4 w-4 text-slate-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden rounded-3xl shadow-lg">
          <img
            src={home.infoSection.includeCard.image}
            alt={home.infoSection.includeCard.title}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="relative bg-slate-900/60 p-6 text-white">
            <h3 className="text-lg font-semibold">{home.infoSection.includeCard.title}</h3>
            <p className="text-xs uppercase tracking-[0.2em]">{home.infoSection.includeCard.subheading}</p>
            <ul className="mt-4 space-y-2 text-sm">
              {includeCardItems.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Check className="mt-1 h-4 w-4 text-white" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </section>
    </div>
    </>
  );

};

export default Index;
