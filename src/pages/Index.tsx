import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  ArrowLeftRight,
  Anchor,
  Navigation,
  Calendar,
  CalendarDays,
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
  const [activeTab, setActiveTab] = useState<"tracking" | "schedules">("schedules");
  const [trackingCode, setTrackingCode] = useState("");
  const [estOrigin, setEstOrigin] = useState("china-foshan");
  const [estDestination, setEstDestination] = useState("zambia-lusaka");
  const [estDate, setEstDate] = useState("29 Aug, 2026");

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (trackingCode.trim()) {
      navigate(`/tracking?query=${encodeURIComponent(trackingCode.trim())}`);
    }
  };

  const handleSwapLocations = () => {
    const originVals = ["china-foshan", "china-yiwu", "uae-dubai"];
    const destVals = ["zambia-lusaka", "zambia-ndola", "zambia-livingstone"];
    
    if (originVals.includes(estOrigin) && destVals.includes(estDestination)) {
      const temp = estOrigin;
      setEstOrigin(estDestination);
      setEstDestination(temp);
    } else {
      const temp = estOrigin;
      setEstOrigin(estDestination);
      setEstDestination(temp);
    }
  };

  const handleSchedulesSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const element = document.getElementById("homepage-calculator");
    if (element) {
      const originVals = ["china-foshan", "china-yiwu", "uae-dubai"];
      const destVals = ["zambia-lusaka", "zambia-ndola", "zambia-livingstone"];
      
      if (originVals.includes(estOrigin)) {
        setOrigin(estOrigin);
      }
      if (destVals.includes(estDestination)) {
        setDestination(estDestination);
      }
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
    "Normal Goods": <Package className="h-6 w-6 text-slate-400" />,
    "Wigs & Hair Products": <Scissors className="h-6 w-6 text-slate-400" />,
    "Mobile Phones": <Smartphone className="h-6 w-6 text-slate-400" />,
    "Battery Goods & Electronics": <BatteryCharging className="h-6 w-6 text-slate-400" />,
    "Laptops & iPads": <Laptop className="h-6 w-6 text-slate-400" />,
    Medicare: <HeartPulse className="h-6 w-6 text-slate-400" />,
  };
  
  const seaRateIcons: Record<string, JSX.Element> = {
    "General Goods": <Package className="h-6 w-6 text-slate-400" />,
    "Special Goods": <Box className="h-6 w-6 text-slate-400" />,
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
      <div className="flex flex-col bg-slate-950 text-slate-100 overflow-x-hidden font-sans">
        
        {/* Creative Awwwards-Style Hero Section */}
        <section className="relative w-full min-h-[95vh] flex flex-col justify-between overflow-hidden border-b border-white/5">
          {/* Ship Background Image Layer */}
          <div className="absolute inset-0 z-0">
            <OptimizedImage
              src="/hero/xy-hero-bg-ship.png"
              alt="XY Cargo ocean shipping container ship background"
              className="h-full w-full object-cover opacity-25 scale-105 transition-transform duration-[10000ms] hover:scale-100"
              containerClassName="h-full w-full"
              aspectRatio="auto"
              priority={true}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/40 to-slate-900/60" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-950/70 to-slate-950" />
          </div>

          <div className="relative z-10 w-full max-w-7xl mx-auto px-6 py-20 lg:py-28 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center flex-1">
            {/* Left Content Column: Editorial Title & Description */}
            <div className="lg:col-span-7 space-y-8 motion-safe:animate-fade-up">
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold bg-[#d8000d]/10 text-[#d8000d] border border-[#d8000d]/20 uppercase tracking-widest">
                Unmatched Worldwide Reach
              </span>
              <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight leading-[1.05] uppercase">
                Global Cargo <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-[#d8000d] italic font-normal tracking-wide">logistics</span> – Efficient & trusted
              </h1>
              <p className="text-base sm:text-lg text-slate-400 max-w-xl leading-relaxed">
                Direct shipping lanes from Foshan, Yiwu, and Dubai to major Zambian hubs. Secure cargo handling, transparent timelines, and unmatched reliability.
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <Button
                  asChild
                  className="rounded-full bg-[#d8000d] text-white hover:bg-[#bf000c] text-sm font-bold px-8 py-6 shadow-lg shadow-[#d8000d]/30 transition-all hover:translate-y-[-1px] group"
                >
                  <Link to="/about" className="inline-flex items-center gap-2">
                    <span>Learn More Now</span>
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById("homepage-calculator");
                    el?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-white text-sm font-semibold px-8 py-3.5 transition-all"
                >
                  Calculate Cost
                </button>
              </div>
            </div>

            {/* Right Column: Uthao-style glassmorphic floating search/tabs card */}
            <div className="lg:col-span-5 motion-safe:animate-fade-up [animation-delay:150ms]">
              <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] rounded-[32px] p-6 sm:p-8 relative overflow-hidden text-white">
                
                {/* Custom Tab selectors */}
                <div className="flex bg-slate-950/50 p-1 rounded-2xl mb-6 border border-white/5">
                  <button
                    type="button"
                    onClick={() => setActiveTab("tracking")}
                    className={cn(
                      "flex-1 py-3 text-xs font-bold rounded-xl text-center transition-all uppercase tracking-wider",
                      activeTab === "tracking"
                        ? "bg-[#d8000d] text-white shadow-lg"
                        : "text-slate-400 hover:text-white"
                    )}
                  >
                    Tracking
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("schedules")}
                    className={cn(
                      "flex-1 py-3 text-xs font-bold rounded-xl text-center transition-all uppercase tracking-wider",
                      activeTab === "schedules"
                        ? "bg-[#d8000d] text-white shadow-lg"
                        : "text-slate-400 hover:text-white"
                    )}
                  >
                    Schedules
                  </button>
                </div>

                {/* Tab content 1: Tracking form */}
                {activeTab === "tracking" && (
                  <form onSubmit={handleTrackSubmit} className="space-y-4">
                    <div className="space-y-2 relative">
                      <Label htmlFor="trackingCode" className="text-xs font-bold text-slate-300 uppercase tracking-widest">
                        Type tracking number here
                      </Label>
                      <div className="relative">
                        <Input
                          id="trackingCode"
                          type="text"
                          placeholder="Type your tracking number here"
                          value={trackingCode}
                          onChange={(e) => setTrackingCode(e.target.value)}
                          className="w-full rounded-2xl border-white/10 bg-slate-950/40 text-white placeholder-slate-500 focus:border-[#d8000d] focus:ring-0 h-14 pl-12 dynamic-fade-in"
                        />
                        <Navigation className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                      </div>
                    </div>
                    <Button
                      type="submit"
                      className="w-full rounded-2xl bg-[#d8000d] hover:bg-[#bf000c] h-14 font-bold text-white shadow-lg shadow-[#d8000d]/10 flex items-center justify-center gap-2 group transition-all"
                    >
                      <span>Search</span>
                      <ArrowUpRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </Button>
                    <div className="flex justify-center pt-2">
                      <Link to="/tracking" className="text-xs text-slate-400 hover:text-[#d8000d] font-semibold transition-colors">
                        Multiple Tracking Numbers
                      </Link>
                    </div>
                  </form>
                )}

                {/* Tab content 2: Schedules form (Uthao style) */}
                {activeTab === "schedules" && (
                  <form onSubmit={handleSchedulesSubmit} className="space-y-4 relative dynamic-fade-in">
                    
                    {/* Origin input */}
                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Origin</Label>
                      <div className="relative">
                        <Select value={estOrigin} onValueChange={setEstOrigin}>
                          <SelectTrigger className="w-full rounded-2xl border-white/10 bg-slate-950/40 h-12 pl-12 text-xs font-semibold text-white">
                            <SelectValue placeholder="Select Origin" />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-900 border-white/10 text-white">
                            <SelectItem value="china-foshan">China (Foshan)</SelectItem>
                            <SelectItem value="china-yiwu">China (Yiwu)</SelectItem>
                            <SelectItem value="uae-dubai">UAE (Dubai)</SelectItem>
                            <SelectItem value="zambia-lusaka" disabled>Zambia (Lusaka)</SelectItem>
                          </SelectContent>
                        </Select>
                        <Anchor className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      </div>
                    </div>

                    {/* Destination input */}
                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Destination</Label>
                      <div className="relative">
                        <Select value={estDestination} onValueChange={setEstDestination}>
                          <SelectTrigger className="w-full rounded-2xl border-white/10 bg-slate-950/40 h-12 pl-12 text-xs font-semibold text-white">
                            <SelectValue placeholder="Select Destination" />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-900 border-white/10 text-white">
                            <SelectItem value="zambia-lusaka">Zambia (Lusaka)</SelectItem>
                            <SelectItem value="zambia-ndola">Zambia (Ndola)</SelectItem>
                            <SelectItem value="zambia-livingstone">Zambia (Livingstone)</SelectItem>
                          </SelectContent>
                        </Select>
                        <Navigation className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      </div>
                    </div>

                    {/* Swap button overlapping on the right side */}
                    <button
                      type="button"
                      onClick={handleSwapLocations}
                      className="absolute right-4 top-[32%] -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-[#d8000d] text-white hover:bg-[#bf000c] shadow-md border border-white/10 z-20 transition-all active:scale-95"
                      title="Swap Locations"
                    >
                      <ArrowLeftRight className="h-4 w-4 rotate-90" />
                    </button>

                    {/* Date select & Search button grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                      <div className="sm:col-span-6 space-y-1">
                        <Label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Date</Label>
                        <div className="relative">
                          <Input
                            type="text"
                            value={estDate}
                            onChange={(e) => setEstDate(e.target.value)}
                            placeholder="Select Date"
                            className="w-full rounded-2xl border-white/10 bg-slate-950/40 text-white text-xs h-12 pl-10"
                          />
                          <CalendarDays className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        </div>
                      </div>
                      <div className="sm:col-span-6">
                        <Button
                          type="submit"
                          className="w-full rounded-2xl bg-[#d8000d] hover:bg-[#bf000c] h-12 font-bold text-white flex items-center justify-center gap-2 group transition-all"
                        >
                          <span>Search</span>
                          <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                        </Button>
                      </div>
                    </div>

                  </form>
                )}

              </div>
            </div>
          </div>

          {/* Stats Bar Overlay with dark glassy layout and red highlights */}
          <div className="relative z-10 w-full bg-slate-950/80 border-t border-white/5 py-8 backdrop-blur-md">
            <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-5 transition-all hover:bg-[#d8000d]/5 hover:border-[#d8000d]/20">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#d8000d]/10 text-[#d8000d]">
                  <Users className="h-6 w-6" />
                </div>
                <div className="flex flex-col">
                  <span className="text-2xl font-bold text-white leading-tight">2,000+</span>
                  <span className="text-xs text-slate-400 font-medium mt-0.5">Satisfied Clients</span>
                </div>
              </div>

              <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-5 transition-all hover:bg-[#d8000d]/5 hover:border-[#d8000d]/20">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#d8000d]/10 text-[#d8000d]">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div className="flex flex-col">
                  <span className="text-2xl font-bold text-white leading-tight">99.98%</span>
                  <span className="text-xs text-slate-400 font-medium mt-0.5">On-Time Delivery</span>
                </div>
              </div>

              <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-5 transition-all hover:bg-[#d8000d]/5 hover:border-[#d8000d]/20">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#d8000d]/10 text-[#d8000d]">
                  <Globe className="h-6 w-6" />
                </div>
                <div className="flex flex-col">
                  <span className="text-2xl font-bold text-white leading-tight">150+</span>
                  <span className="text-xs text-slate-400 font-medium mt-0.5">Countries Served</span>
                </div>
              </div>

              <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-5 transition-all hover:bg-[#d8000d]/5 hover:border-[#d8000d]/20">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#d8000d]/10 text-[#d8000d]">
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

        {/* Shipping Process steps redesigned in a clean timeline */}
        <section className="bg-slate-900/40 border-b border-white/5 py-20 motion-safe:animate-fade-in">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
              <span className="text-xs font-bold text-[#d8000d] uppercase tracking-widest">Workflow</span>
              <h2 className="text-4xl font-extrabold text-white tracking-tight uppercase">{home.process.title}</h2>
              <div className="h-1.5 w-24 bg-[#d8000d] mx-auto rounded-full" />
              <p className="text-slate-400 mt-4 leading-relaxed">{home.process.body}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {steps.map((step, index) => (
                <div key={step.title} className="relative group bg-slate-900 border border-white/5 rounded-3xl p-6 shadow-xl transition-all duration-300 hover:border-[#d8000d]/30 hover:-translate-y-1">
                  <div className="relative mx-auto h-24 w-24 overflow-hidden rounded-2xl ring-2 ring-transparent transition-all duration-300 group-hover:ring-[#d8000d]">
                    <OptimizedImage src={step.image} alt={step.title} className="h-full w-full object-cover" />
                    <span className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-xl bg-[#d8000d] text-xs font-bold text-white shadow-lg">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h3 className="mt-6 text-lg font-bold text-white text-center transition-colors group-hover:text-[#d8000d]">{step.title}</h3>
                  <p className="mt-2 text-xs sm:text-sm text-slate-400 text-center leading-relaxed">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* About us section: refined layout with accordions */}
        <section className="mx-auto max-w-7xl px-6 py-20 grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-16 lg:items-center motion-safe:animate-fade-in">
          <div className="space-y-6">
            <div className="space-y-2">
              <span className="text-xs font-bold text-[#d8000d] uppercase tracking-widest">About Us</span>
              <h2 className="text-4xl font-extrabold text-white tracking-tight uppercase">{home.about.title}</h2>
              <div className="h-1.5 w-16 bg-[#d8000d] rounded-full" />
            </div>
            <p className="text-slate-400 leading-relaxed">{home.about.body}</p>
            <Accordion type="single" collapsible className="space-y-3 w-full border-none">
              {aboutAccordions.map((item) => (
                <AccordionItem key={item.title} value={item.title} className="border border-white/5 rounded-2xl px-5 bg-slate-900/60">
                  <AccordionTrigger className="text-sm font-bold text-slate-200 hover:text-[#d8000d] hover:no-underline py-4">
                    {item.title}
                  </AccordionTrigger>
                  <AccordionContent className="text-xs sm:text-sm text-slate-400 leading-relaxed pb-4 pt-1 border-t border-white/5">
                    {item.body}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-tr from-[#d8000d]/10 to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-all duration-500 z-10" />
            <OptimizedImage 
              src={home.about.image} 
              alt="About XY Cargo Zambia" 
              className="rounded-3xl shadow-2xl border border-white/5 relative z-0" 
              aspectRatio="video"
            />
          </div>
        </section>

        {/* Air Rates Services block */}
        <section className="bg-slate-900/40 border-y border-white/5 py-16 motion-safe:animate-fade-in">
          <div className="mx-auto max-w-7xl space-y-8 px-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <span className="text-xs font-bold text-[#d8000d] uppercase tracking-widest">Air Cargo</span>
                <h2 className="text-3xl font-extrabold text-white tracking-tight mt-1 uppercase">Air Freight Rates</h2>
              </div>
              <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-full border border-white/5">
                {airRatesContent.map((rate, index) => {
                  const isActive = index === airRateIndex;
                  return (
                    <button
                      key={rate.location}
                      type="button"
                      className={`rounded-full px-5 py-2 text-xs font-bold transition uppercase tracking-wider ${
                        isActive
                          ? "bg-[#d8000d] text-white shadow-lg"
                          : "text-slate-400 hover:text-white"
                      }`}
                      onClick={() => setAirRateIndex(index)}
                    >
                      {rate.location}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {activeAirRate?.cards.map((card) => (
                <Card key={card.title} className="rounded-3xl border border-white/5 bg-slate-900 shadow-xl transition-all duration-300 hover:border-[#d8000d]/20 text-white">
                  <CardContent className="space-y-4 p-6 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-950 border border-white/10 text-[#d8000d]">
                      {airRateIcons[card.title] ?? <Package className="h-6 w-6" />}
                    </div>
                    <h3 className="text-lg font-bold text-white">{card.title}</h3>
                    <p className="text-sm font-black text-[#d8000d]">{card.price}</p>
                    <p className="text-xs text-slate-400 leading-relaxed">{card.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Sea Rates Services block */}
        <section className="bg-slate-900/40 border-b border-white/5 py-16 motion-safe:animate-fade-in">
          <div className="mx-auto max-w-7xl space-y-8 px-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <span className="text-xs font-bold text-[#d8000d] uppercase tracking-widest">Ocean Cargo</span>
                <h2 className="text-3xl font-extrabold text-white tracking-tight mt-1 uppercase">Sea Freight Rates</h2>
              </div>
              <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-full border border-white/5">
                {seaRatesContent.map((rate, index) => {
                  const isActive = index === seaRateIndex;
                  return (
                    <button
                      key={rate.location}
                      type="button"
                      className={`rounded-full px-5 py-2 text-xs font-bold transition uppercase tracking-wider ${
                        isActive
                          ? "bg-[#d8000d] text-white shadow-lg"
                          : "text-slate-400 hover:text-white"
                      }`}
                      onClick={() => setSeaRateIndex(index)}
                    >
                      {rate.location}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              {activeSeaRate?.cards.map((card) => (
                <Card key={card.title} className="rounded-3xl border border-white/5 bg-slate-900 shadow-xl transition-all duration-300 hover:border-[#d8000d]/20 text-white">
                  <CardContent className="space-y-4 p-6 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-950 border border-white/10 text-[#d8000d]">
                      {seaRateIcons[card.title] ?? <Package className="h-6 w-6" />}
                    </div>
                    <h3 className="text-lg font-bold text-white">{card.title}</h3>
                    <p className="text-sm font-black text-[#d8000d]">{card.price}</p>
                    <p className="text-xs text-slate-400 leading-relaxed">{card.description}</p>
                    {card.notes && (
                      <div className="space-y-1 text-xs text-slate-400/80 pt-2 border-t border-white/5">
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

        {/* Video or poster banner */}
        <section className="relative w-full h-[320px] overflow-hidden border-b border-white/5">
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
            <OptimizedImage src={videoSrc} alt={safeVideoTitle} className="h-full w-full object-cover" />
          )}
          {isVideo && !hasStartedVideoPlayback ? (
            <>
              <div className="absolute inset-0 bg-black/60" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Button
                  type="button"
                  onClick={handleVideoPlay}
                  aria-label={`Play ${safeVideoTitle} with sound`}
                  className="h-16 w-16 rounded-full bg-white text-slate-950 shadow-2xl transition-transform hover:scale-110 hover:shadow-[#d8000d]/25 flex items-center justify-center"
                >
                  <Play className="h-6 w-6 text-[#d8000d] fill-[#d8000d]" />
                </Button>
              </div>
            </>
          ) : null}
        </section>

        {/* Calculator anchor section */}
        <section id="homepage-calculator" className="mx-auto max-w-7xl px-6 py-20 motion-safe:animate-fade-in w-full">
          <div className="space-y-3 text-center mb-12">
            <span className="text-xs font-bold text-[#d8000d] uppercase tracking-widest">Rate Calculator</span>
            <h2 className="text-4xl font-extrabold text-white tracking-tight uppercase">{home.calculator.title}</h2>
            <div className="h-1.5 w-16 bg-[#d8000d] mx-auto rounded-full" />
            <p className="text-slate-400 mt-4 leading-relaxed">{home.calculator.subtitle}</p>
          </div>

          <div className="grid gap-8 md:grid-cols-[1.1fr_0.9fr] md:items-start">
            <div className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2 bg-slate-900/60 p-6 rounded-3xl border border-white/5">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-300 uppercase tracking-widest">From</Label>
                  <Select value={origin} onValueChange={setOrigin}>
                    <SelectTrigger className="rounded-xl border-white/10 bg-slate-950/80 h-11 text-xs text-white">
                      <SelectValue placeholder="Select origin" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-white/10 text-white">
                      <SelectItem value="china-foshan">China (Foshan)</SelectItem>
                      <SelectItem value="china-yiwu">China (Yiwu)</SelectItem>
                      <SelectItem value="uae-dubai">UAE (Dubai)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-300 uppercase tracking-widest">To</Label>
                  <Select value={destination} onValueChange={setDestination}>
                    <SelectTrigger className="rounded-xl border-white/10 bg-slate-955/80 h-11 text-xs text-white">
                      <SelectValue placeholder="Select destination" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-white/10 text-white">
                      <SelectItem value="zambia-lusaka">Zambia (Lusaka)</SelectItem>
                      <SelectItem value="zambia-ndola">Zambia (Ndola/Kitwe)</SelectItem>
                      <SelectItem value="zambia-livingstone">Zambia (Livingstone)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3 bg-slate-900/60 p-6 rounded-3xl border border-white/5">
                <Label className="text-xs font-bold text-slate-300 uppercase tracking-widest">Service Type</Label>
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
                            ? "border-[#d8000d] bg-[#d8000d]/5 shadow-lg"
                            : "border-white/5 bg-slate-955/40 hover:border-white/10"
                        }`}
                      >
                        <span
                          className={`absolute right-3 top-3 h-4 w-4 rounded-full border ${
                            isActive ? "border-[#d8000d] bg-[#d8000d]" : "border-slate-700 bg-transparent"
                          }`}
                        />
                        <img src={option.image} alt={option.title} className="h-20 w-full rounded-xl object-cover opacity-70 group-hover:opacity-100" />
                        <div className="mt-3 space-y-1">
                          <p className="text-xs font-bold text-white">{option.title}</p>
                          <p className="text-[10px] text-slate-400">{option.subtitle}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-6 bg-slate-900/60 p-6 rounded-3xl border border-white/5">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-300 uppercase tracking-widest">Product Type</Label>
                  <Select
                    value={productType}
                    onValueChange={setProductType}
                    disabled={productTypeOptions.length === 0}
                  >
                    <SelectTrigger className="rounded-xl border-white/10 bg-slate-955/80 h-11 text-xs text-white">
                      <SelectValue placeholder="Select product type" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-white/10 text-white">
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
                      <Label className="text-xs font-bold text-slate-300 uppercase tracking-widest">Weight (kg)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.1"
                        value={weight}
                        onChange={(event) => setWeight(toNumber(event.target.value))}
                        className="rounded-xl border-white/10 bg-slate-955/80 h-11 text-white text-xs"
                      />
                    </div>
                  )}
                  {rateBasis === "cbm" && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-300 uppercase tracking-widest">Length (cm)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={length}
                          onChange={(event) => setLength(toNumber(event.target.value))}
                          className="rounded-xl border-white/10 bg-slate-955/80 h-11 text-white text-xs"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-300 uppercase tracking-widest">Width (cm)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={width}
                          onChange={(event) => setWidth(toNumber(event.target.value))}
                          className="rounded-xl border-white/10 bg-slate-955/80 h-11 text-white text-xs"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-300 uppercase tracking-widest">Height (cm)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={height}
                          onChange={(event) => setHeight(toNumber(event.target.value))}
                          className="rounded-xl border-white/10 bg-slate-955/80 h-11 text-white text-xs"
                        />
                      </div>
                    </>
                  )}
                </div>

                <Button
                  type="button"
                  onClick={handleCalculate}
                  className="w-full rounded-xl bg-[#d8000d] text-white hover:bg-[#bf000c] h-12 font-bold shadow-lg shadow-[#d8000d]/10"
                >
                  <Calculator className="mr-2 h-4 w-4" />
                  Calculate
                </Button>

                <div className="rounded-2xl border border-white/5 bg-slate-950 p-5">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Estimated Total</p>
                  <div className="mt-2 flex items-end gap-3">
                    <p className="text-3xl font-extrabold text-[#d8000d]">{formatAmount(displayedQuote.estimatedCost)}</p>
                    <p className="text-xs text-slate-500 mb-1">Based on current rates</p>
                  </div>
                  <div className="mt-4 grid gap-2 text-xs text-slate-400 md:grid-cols-2 pt-3 border-t border-white/5">
                    <div>
                      Rate: {formatAmount(displayedQuote.rateValue)} / {displayedQuote.rateUnit}
                    </div>
                    <div>{displayedQuote.detail}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Ready to calculate sidebar panel */}
            <div className="rounded-3xl border border-dashed border-white/10 bg-slate-900/40 p-6">
              <p className="text-sm font-bold text-[#d8000d] uppercase tracking-wider">Ready to Calculate</p>
              <div className="mt-6 space-y-6 text-sm text-slate-300">
                {pricingInfo.map((section) => (
                  <div key={section.title} className="space-y-3">
                    <p className="font-bold text-white uppercase text-xs tracking-wider border-b border-white/5 pb-1">{section.title}</p>
                    <ul className="space-y-2">
                      {section.items.map((item) => (
                        <li key={item} className="flex items-start gap-2 text-xs sm:text-sm">
                          <Check className="mt-0.5 h-4 w-4 text-[#d8000d] shrink-0" />
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

        {/* Important Info Section */}
        <section className="mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-2 items-start gap-8 px-6 pb-24 motion-safe:animate-fade-in w-full">
          <Card className="rounded-3xl border border-white/5 bg-slate-900/80 text-white">
            <CardContent className="space-y-6 p-6 sm:p-8">
              <h3 className="text-xl font-bold text-[#d8000d] uppercase tracking-wider">Important Information</h3>
              <div>
                <p className="text-xs font-bold text-white uppercase tracking-wider mb-2">Minimum Requirements</p>
                <ul className="space-y-2 text-xs sm:text-sm text-slate-400">
                  {minimumRequirements.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 text-slate-500 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="border-t border-white/5 pt-4">
                <p className="text-xs font-bold text-white uppercase tracking-wider mb-2">Storage Policy</p>
                <ul className="space-y-2 text-xs sm:text-sm text-slate-400">
                  {storagePolicy.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 text-slate-500 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden rounded-3xl shadow-2xl h-full min-h-[300px]">
            <img
              src={home.infoSection.includeCard.image}
              alt={home.infoSection.includeCard.title}
              className="absolute inset-0 h-full w-full object-cover opacity-60"
            />
            <div className="absolute inset-0 bg-slate-950/80" />
            <div className="relative bg-transparent p-6 sm:p-8 text-white space-y-4">
              <h3 className="text-2xl font-black uppercase text-white tracking-tight">{home.infoSection.includeCard.title}</h3>
              <span className="inline-block text-xs uppercase tracking-[0.2em] text-[#d8000d] font-bold">{home.infoSection.includeCard.subheading}</span>
              <ul className="mt-4 space-y-2 text-xs sm:text-sm text-slate-300">
                {includeCardItems.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 text-[#d8000d]" />
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
