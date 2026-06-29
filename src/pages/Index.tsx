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
  Phone,
  ChevronDown,
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
import { LogoImage } from "@/components/shared/LogoImage";
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

  // State variables for transparent overlay navigation and tabs in the hero section
  const [heroActiveTab, setHeroActiveTab] = useState<"track" | "ship">("track");
  const [heroTrackingNumber, setHeroTrackingNumber] = useState("");
  const navigate = useNavigate();

  const [heroShipOrigin, setHeroShipOrigin] = useState("china-foshan");
  const [heroShipDestination, setHeroShipDestination] = useState("zambia-lusaka");
  const [heroShipWeight, setHeroShipWeight] = useState(10);

  const handleHeroTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (heroTrackingNumber.trim()) {
      navigate(`/tracking?query=${encodeURIComponent(heroTrackingNumber.trim())}`);
    }
  };

  const handleHeroShipSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setOrigin(heroShipOrigin);
    setDestination(heroShipDestination);
    setWeight(heroShipWeight);
    setServiceType("air-standard");
    const calcElement = document.getElementById("homepage-calculator");
    if (calcElement) {
      calcElement.scrollIntoView({ behavior: "smooth" });
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
        {/* Transparent Overlay Navigation Bar */}
        <header className="absolute top-0 left-0 right-0 z-50 w-full bg-slate-900/15 backdrop-blur-md border-b border-white/10">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
            {/* Logo: LogoImage + XY Cargo */}
            <Link to="/" className="flex items-center gap-3 transition-transform hover:scale-[1.01]">
              <div className="relative">
                <LogoImage size="md" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-base font-extrabold tracking-tight text-white leading-tight">XY Cargo Zambia</span>
              </div>
            </Link>

            {/* Navigation links */}
            <nav className="hidden items-center gap-8 lg:flex">
              <Link to="/" className="text-xs font-bold uppercase tracking-wider text-white transition-colors hover:text-[#d8000d] relative py-1 group">
                Home
                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#d8000d] scale-x-100 transition-transform origin-left" />
              </Link>
              <div className="relative group/shipping">
                <button className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:text-[#d8000d] py-1">
                  Shipping
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                <div className="absolute top-full left-0 hidden group-hover/shipping:block bg-slate-950/90 backdrop-blur-md text-white rounded-2xl shadow-2xl border border-white/10 py-2.5 w-48 mt-1 z-50 transition-all duration-300 animate-fade-in">
                  <Link to="/calculator" className="block px-4 py-2.5 text-xs font-bold uppercase tracking-wider hover:bg-white/10 hover:text-[#d8000d] transition-colors">
                    Shipping Calculator
                  </Link>
                  <Link to="/services" className="block px-4 py-2.5 text-xs font-bold uppercase tracking-wider hover:bg-white/10 hover:text-[#d8000d] transition-colors">
                    Our Services
                  </Link>
                  <Link to="/pricing" className="block px-4 py-2.5 text-xs font-bold uppercase tracking-wider hover:bg-white/10 hover:text-[#d8000d] transition-colors">
                    Pricing Rates
                  </Link>
                </div>
              </div>
              <Link to="/tracking" className="text-xs font-bold uppercase tracking-wider text-white transition-colors hover:text-[#d8000d] relative py-1 group">
                Tracking
                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#d8000d] scale-x-0 transition-transform origin-left group-hover:scale-x-100" />
              </Link>
              <Link to="/support" className="text-xs font-bold uppercase tracking-wider text-white transition-colors hover:text-[#d8000d] relative py-1 group">
                Support
                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#d8000d] scale-x-0 transition-transform origin-left group-hover:scale-x-100" />
              </Link>
              <Link to="/join-us" className="text-xs font-bold uppercase tracking-wider text-white transition-colors hover:text-[#d8000d] relative py-1 group">
                Career
                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#d8000d] scale-x-0 transition-transform origin-left group-hover:scale-x-100" />
              </Link>
            </nav>

            {/* Right: Phone and CTA */}
            <div className="flex items-center gap-4">
              {/* Phone pill */}
              <a
                href="tel:+260967379139"
                className="hidden md:flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/10 text-white font-bold text-xs py-2.5 px-4 rounded-full transition hover:bg-white/20"
              >
                <Phone className="h-3.5 w-3.5 text-[#d8000d] fill-current animate-pulse" />
                <span>+260 967379139</span>
              </a>
              {/* Get Started button */}
              <Button
                asChild
                className="bg-white hover:bg-slate-50 text-slate-900 font-extrabold text-xs py-3 px-5 rounded-full flex items-center gap-2 transition-all duration-300 shadow-md hover:shadow-lg border border-slate-200/50 group hover:scale-[1.02]"
              >
                <Link to="/login" className="flex items-center gap-2">
                  <span>Get Started Now</span>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-900 transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
              </Button>
            </div>
          </div>
        </header>

        {/* Hero Section Container */}
        <section className="relative w-full overflow-hidden bg-slate-950 h-screen min-h-[700px] flex items-center">
          {/* Background Image of Truck at Port */}
          <div className="absolute inset-0">
            <img
              src="/hero/hero section main.webp"
              alt="Arrow Cargo Truck at Port"
              className="h-full w-full object-cover"
            />
            {/* Subtle Overlays */}
            <div className="absolute inset-0 bg-black/15" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-transparent to-black/20" />
          </div>

          <div className="relative mx-auto w-full max-w-7xl px-6 py-24 md:py-32 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center h-full z-10">
            {/* Left Column: Headline & Description */}
            <div className="lg:col-span-8 flex flex-col gap-6 text-left text-white animate-fade-up">
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-[68px] font-black tracking-tighter !text-white leading-[1.0] lg:leading-[0.95] font-syne uppercase select-none">
                We Keep Your <br />
                Supply Chain <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#d8000d] via-[#ff4d4d] to-[#ff8080] font-black">
                  Moving.
                </span>
              </h1>
              <p className="text-xs sm:text-sm !text-slate-200 max-w-[320px] leading-relaxed font-normal tracking-tight">
                From local to global shipments, our seamless logistics solutions ensure on-time, secure, and hassle-free delivery.
              </p>
              <div className="mt-4">
                <Button
                  asChild
                  className="bg-[#d8000d] hover:bg-[#bf000c] hover:shadow-red-900/20 text-white py-3 px-6 rounded-full font-black text-xs tracking-wider flex items-center gap-2 transition shadow-lg hover:scale-[1.03] group w-fit"
                >
                  <Link to="/calculator" className="flex items-center gap-2.5">
                    <span>Learn More Now</span>
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </Link>
                </Button>
              </div>
            </div>

            {/* Right Column: Double-Tab Tracking / Shipping Widget */}
            <div className="lg:col-span-4 w-full animate-zoom-in-soft ml-auto">
              <div className="bg-slate-950/45 backdrop-blur-xl border border-white/10 rounded-3xl p-5 shadow-2xl flex flex-col gap-4 w-full max-w-sm ml-auto relative overflow-hidden">
                {/* Tabs Header */}
                <div className="flex border-b border-white/10 pb-1">
                  <button
                    type="button"
                    onClick={() => setHeroActiveTab("track")}
                    className={cn(
                      "flex-1 text-center py-2.5 text-xs font-black uppercase tracking-wider transition-all relative",
                      heroActiveTab === "track" ? "text-white" : "text-white/50 hover:text-white/70"
                    )}
                  >
                    Tracking Order
                    {heroActiveTab === "track" && (
                      <span className="absolute bottom-0 left-0 right-0 h-1 bg-[#d8000d] rounded-full" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setHeroActiveTab("ship")}
                    className={cn(
                      "flex-1 text-center py-2.5 text-xs font-black uppercase tracking-wider transition-all relative",
                      heroActiveTab === "ship" ? "text-white" : "text-white/50 hover:text-white/70"
                    )}
                  >
                    Ship Order
                    {heroActiveTab === "ship" && (
                      <span className="absolute bottom-0 left-0 right-0 h-1 bg-[#d8000d] rounded-full" />
                    )}
                  </button>
                </div>

                {/* Tab Forms */}
                {heroActiveTab === "track" ? (
                  <form onSubmit={handleHeroTrackSubmit} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <Input
                        type="text"
                        placeholder="Type your tracking number here"
                        value={heroTrackingNumber}
                        onChange={(e) => setHeroTrackingNumber(e.target.value)}
                        className="bg-white/10 border border-white/15 rounded-2xl py-6 px-4 text-white placeholder-white/40 text-sm focus-visible:ring-[#d8000d]/50 focus-visible:border-[#d8000d]"
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full bg-[#d8000d] hover:bg-[#bf000c] text-white py-6 rounded-2xl font-bold transition shadow-lg"
                    >
                      Track Now
                    </Button>
                    <div className="flex justify-between items-center text-[10px] text-white/60 font-bold uppercase tracking-wider px-1">
                      <Link to="/tracking" className="hover:text-[#d8000d] transition">Multiple Tracking Numbers</Link>
                      <Link to="/support" className="flex items-center gap-1 hover:text-[#d8000d] transition">
                        <HelpCircle className="h-3.5 w-3.5" />
                        <span>Need Help</span>
                      </Link>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleHeroShipSubmit} className="flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1 text-left">
                        <label className="text-[10px] uppercase font-black text-white/70 tracking-wider">From</label>
                        <Select value={heroShipOrigin} onValueChange={setHeroShipOrigin}>
                          <SelectTrigger className="bg-white/10 border border-white/15 rounded-xl text-white text-xs py-5 focus:ring-[#d8000d]/50">
                            <SelectValue placeholder="Select origin" />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-950 text-white border border-slate-800">
                            <SelectItem value="china-foshan">China (Foshan)</SelectItem>
                            <SelectItem value="china-yiwu">China (Yiwu)</SelectItem>
                            <SelectItem value="uae-dubai">UAE (Dubai)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1 text-left">
                        <label className="text-[10px] uppercase font-black text-white/70 tracking-wider">To</label>
                        <Select value={heroShipDestination} onValueChange={setHeroShipDestination}>
                          <SelectTrigger className="bg-white/10 border border-white/15 rounded-xl text-white text-xs py-5 focus:ring-[#d8000d]/50">
                            <SelectValue placeholder="Select destination" />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-950 text-white border border-slate-800">
                            <SelectItem value="zambia-lusaka">Zambia (Lusaka)</SelectItem>
                            <SelectItem value="zambia-ndola">Zambia (Ndola)</SelectItem>
                            <SelectItem value="zambia-livingstone">Zambia (Livingstone)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1 text-left">
                      <label className="text-[10px] uppercase font-black text-white/70 tracking-wider">Est. Weight (kg)</label>
                      <Input
                        type="number"
                        min="1"
                        value={heroShipWeight}
                        onChange={(e) => setHeroShipWeight(Number(e.target.value))}
                        className="bg-white/10 border border-white/15 rounded-xl py-5 text-white text-xs focus-visible:ring-[#d8000d]/50 focus-visible:border-[#d8000d]"
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full bg-[#d8000d] hover:bg-[#bf000c] text-white py-6 rounded-2xl font-bold transition shadow-lg mt-1"
                    >
                      Ship Now & Get Quote
                    </Button>
                  </form>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Glassmorphic Stats Panel (Desktop Only) */}
          <div className="absolute bottom-10 left-0 right-0 hidden lg:block z-20 px-6">
            <div className="mx-auto max-w-5xl rounded-3xl bg-slate-950/65 backdrop-blur-md border border-white/10 p-5 shadow-2xl">
              <div className="grid grid-cols-4 gap-6 text-white divide-x divide-white/10 text-center">
                <div className="px-4">
                  <p className="text-2xl font-black tracking-tight text-white font-jakarta">2000+</p>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 mt-1 font-bold">Satisfied Clients</p>
                </div>
                <div className="px-4">
                  <p className="text-2xl font-black tracking-tight text-white font-jakarta">2.98%</p>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 mt-1 font-bold">On-Time Delivery Rate</p>
                </div>
                <div className="px-4">
                  <p className="text-2xl font-black tracking-tight text-white font-jakarta">150+</p>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 mt-1 font-bold">Countries Served</p>
                </div>
                <div className="px-4">
                  <p className="text-2xl font-black tracking-tight text-white font-jakarta">24/7</p>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 mt-1 font-bold">Customer Support</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Mobile Stats Panel (Mobile Only) */}
        <section className="bg-slate-950 border-b border-slate-900 py-8 lg:hidden">
          <div className="mx-auto grid grid-cols-2 gap-y-6 gap-x-4 px-6 text-center text-white">
            <div>
              <p className="text-2xl font-black text-white font-jakarta">2000+</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-400 mt-1 font-bold">Satisfied Clients</p>
            </div>
            <div>
              <p className="text-2xl font-black text-white font-jakarta">2.98%</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-400 mt-1 font-bold">On-Time Delivery Rate</p>
            </div>
            <div>
              <p className="text-2xl font-black text-white font-jakarta">150+</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-400 mt-1 font-bold">Countries Served</p>
            </div>
            <div>
              <p className="text-2xl font-black text-white font-jakarta">24/7</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-400 mt-1 font-bold">Customer Support</p>
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



        {/* Air Freight Services Section */}
        <section className="bg-slate-50/50 border-y border-slate-100 py-20 motion-safe:animate-fade-in">
          <div className="mx-auto max-w-6xl space-y-8 px-6">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <span className="text-xs font-bold text-[#f04f23] uppercase tracking-widest">Air Transport</span>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight font-jakarta">Air Freight Services</h2>
                <div className="h-1 w-16 bg-gradient-to-r from-orange-500 to-red-500 rounded-full" />
              </div>
              <div className="flex items-center gap-2.5">
                {airRatesContent.map((rate, index) => {
                  const isActive = index === airRateIndex;
                  return (
                    <button
                      key={rate.location}
                      type="button"
                      className={`rounded-full px-5 py-2.5 text-xs font-bold uppercase tracking-wider transition-all duration-300 ${isActive
                        ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/25 scale-105"
                        : "bg-white border border-slate-200/60 text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                        }`}
                      onClick={() => setAirRateIndex(index)}
                    >
                      {rate.location}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
              {activeAirRate?.cards.map((card) => (
                <Card key={card.title} className="rounded-3xl border border-slate-200/50 bg-white shadow-sm hover:shadow-xl transition-all duration-300 hover:scale-[1.02] flex flex-col justify-between overflow-hidden group p-6">
                  <CardContent className="space-y-4 p-0 text-center flex flex-col items-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-[#f04f23] transition-all duration-300 group-hover:bg-gradient-to-r group-hover:from-orange-500 group-hover:to-red-500 group-hover:text-white shadow-sm">
                      {airRateIcons[card.title] ?? <Package className="h-6 w-6" />}
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-base font-bold text-slate-800 transition-colors duration-300 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-orange-500 group-hover:to-red-500">{card.title}</h3>
                      <p className="text-base font-extrabold text-[#f04f23] font-jakarta">{card.price}</p>
                      <p className="text-xs text-slate-500 leading-relaxed max-w-xs">{card.description}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Sea Freight Services Section */}
        <section className="bg-white py-20 border-b border-slate-100 motion-safe:animate-fade-in">
          <div className="mx-auto max-w-6xl space-y-8 px-6">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <span className="text-xs font-bold text-[#f04f23] uppercase tracking-widest">Ocean Transport</span>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight font-jakarta">Sea Freight Services</h2>
                <div className="h-1 w-16 bg-gradient-to-r from-orange-500 to-red-500 rounded-full" />
              </div>
              <div className="flex items-center gap-2.5">
                {seaRatesContent.map((rate, index) => {
                  const isActive = index === seaRateIndex;
                  return (
                    <button
                      key={rate.location}
                      type="button"
                      className={`rounded-full px-5 py-2.5 text-xs font-bold uppercase tracking-wider transition-all duration-300 ${isActive
                        ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/25 scale-105"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800"
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
                <Card key={card.title} className="rounded-3xl border border-slate-200/50 bg-white shadow-sm hover:shadow-xl transition-all duration-300 hover:scale-[1.02] flex flex-col justify-between overflow-hidden group p-6">
                  <CardContent className="space-y-4 p-0 text-center flex flex-col items-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-[#f04f23] transition-all duration-300 group-hover:bg-gradient-to-r group-hover:from-orange-500 group-hover:to-red-500 group-hover:text-white shadow-sm">
                      {seaRateIcons[card.title] ?? <Package className="h-6 w-6" />}
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-base font-bold text-slate-800 transition-colors duration-300 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-orange-500 group-hover:to-red-500">{card.title}</h3>
                      <p className="text-base font-extrabold text-[#f04f23] font-jakarta">{card.price}</p>
                      <p className="text-xs text-slate-500 leading-relaxed max-w-xs">{card.description}</p>
                    </div>
                    {card.notes && (
                      <div className="w-full bg-slate-50 rounded-2xl p-3 space-y-1 text-left text-[11px] text-slate-500 border border-slate-100">
                        {card.notes.map((note) => (
                          <p key={note} className="flex items-start gap-1">
                            <span className="text-[#f04f23] font-bold">•</span>
                            <span>{note}</span>
                          </p>
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
                        className={`relative rounded-2xl border p-3 text-left transition ${isActive
                          ? "border-[#f04f23] ring-2 ring-[#f04f23]/20"
                          : "border-slate-200 hover:border-slate-300"
                          }`}
                      >
                        <span
                          className={`absolute right-3 top-3 h-4 w-4 rounded-full border ${isActive ? "border-[#f04f23] bg-[#f04f23]" : "border-slate-300 bg-white"
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
                  className="w-full rounded-full bg-[#f04f23] text-white hover:bg-[#e0451b]"
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
              <p className="text-sm font-semibold text-[#f04f23]">Ready to Calculate</p>
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
              <h3 className="text-lg font-semibold text-[#f04f23]">Important Information</h3>
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
