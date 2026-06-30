import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
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
  MessageSquare,
  AlignRight,
  User,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetTrigger } from "@/components/ui/sheet";
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
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
  const [serviceType, setServiceType] = useState("air-standard");
  const [productType, setProductType] = useState("");
  const [origin, setOrigin] = useState("china-foshan");
  const [destination, setDestination] = useState("zambia-lusaka");

  const services = [
    {
      title: "Cargo Transport",
      id: "01",
      image: "/services/grid-cargo-transport.png",
      description: "Safe And Efficient Cargo Movement By Land, Sea, And Air, Ensuring Your Goods Reach Their Destination Securely And On Time."
    },
    {
      title: "Supply Chain",
      id: "02",
      image: "/services/grid-supply-chain.png",
      description: "End-To-End Supply Chain Solutions That Streamline Operations, Reduce Costs, And Improve Overall Efficiency For Businesses Of Any Scale."
    },
    {
      title: "Express Delivery",
      id: "03",
      image: "/services/grid-express-delivery.png",
      description: "Rapid And Secure Delivery Services Designed To Meet Urgent Demands, Providing Your Customers With Faster Turnaround Times."
    },
    {
      title: "Inventory Solutions",
      id: "04",
      image: "/services/grid-inventory-solutions.png",
      description: "Smart Warehousing With Real-Time Tracking And Flexible Storage Options, Giving You Full Visibility And Control Over Your Stock."
    },
    {
      title: "Customs & Compliance",
      id: "05",
      image: "/services/grid-customs-compliance.png",
      description: "Expert Handling Of Customs Clearance And International Regulations, Minimizing Delays And Ensuring Smooth Cross-Border Transactions."
    },
    {
      title: "Distribution Services",
      id: "06",
      image: "/services/grid-distribution-services.png",
      description: "Seamless Distribution Networks That Connect Your Products To Customers Quickly And Efficiently, No Matter Where They Are Located."
    }
  ];

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
    navigate(
      `/calculator?origin=${encodeURIComponent(heroShipOrigin)}&destination=${encodeURIComponent(
        heroShipDestination
      )}&weight=${heroShipWeight}&serviceType=air-standard`
    );
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

  // FAQ Category State and Data
  const [faqTab, setFaqTab] = useState<"shipping" | "services" | "pricing">("shipping");
  const faqData = {
    shipping: [
      {
        question: "How long does shipping from China to Zambia take?",
        answer: "Standard air freight takes 10-17 days, express air freight takes 1-5 days, and sea freight cargo takes 45-60 days from cargo departure."
      },
      {
        question: "Where are your consolidation warehouses in China located?",
        answer: "Our main receiving warehouses are in Foshan and Guangzhou. You can send items from different suppliers to these locations for free consolidation."
      },
      {
        question: "Do you offer real-time tracking for all packages?",
        answer: "Yes, every parcel is assigned a unique tracking ID. You can enter this ID on our homepage to see its step-by-step movement from China to Zambia."
      },
      {
        question: "What is your minimum weight or size requirement?",
        answer: "For air freight, the minimum weight is 0.1 kg. For sea freight, the minimum shipping volume is 0.05 CBM, making it suitable for all sizes."
      },
      {
        question: "How do you handle fragile or high-value shipments?",
        answer: "We offer special protective crating and bubble-wrapping services at our China warehouses to secure fragile cargo before transit."
      },
      {
        question: "Are customs duties included in your freight rates?",
        answer: "Yes! We offer customs clearance-inclusive options for most standard commercial and personal shipments, avoiding unexpected local fees."
      }
    ],
    services: [
      {
        question: "What logistics services does XY Cargo Zambia offer?",
        answer: "We offer a wide range of services including air cargo consolidation, ocean container shipping, professional customs clearance, and local warehouse storage."
      },
      {
        question: "Can you source products directly from suppliers in China?",
        answer: "Yes! We assist client sourcing requests, communicate with manufacturers on platforms like 1688 or Taobao, and verify product quality."
      },
      {
        question: "Do you provide door-to-door delivery within Zambia?",
        answer: "Currently, you can pick up from our main warehouses in Lusaka, Ndola, and Kitwe, or arrange regional dispatch to other Zambian towns."
      },
      {
        question: "Do you handle clearing at Nakonde and other borders?",
        answer: "Yes, our dedicated in-house customs agents handle transit document processing and border clearance at Nakonde, Chirundu, and Kariba."
      },
      {
        question: "Can I store my cargo in your Lusaka warehouse?",
        answer: "Yes, we provide secure short-term and long-term warehousing solutions with 24/7 CCTV surveillance at our main depot in Lusaka."
      },
      {
        question: "How do I report cargo damage or file a claim?",
        answer: "You can submit cargo claims directly through the customer dashboard within 48 hours of cargo collection, attaching photos and receipts."
      }
    ],
    pricing: [
      {
        question: "How are shipping rates calculated for my package?",
        answer: "Air freight is charged per kilogram. Sea freight is calculated per cubic meter (CBM) based on length, width, and height dimensions."
      },
      {
        question: "Are there any hidden customs or local handling fees?",
        answer: "No. Our quotes outline all freight costs upfront. We ensure all clearance fees, import duties, and border taxes are clear before cargo sails."
      },
      {
        question: "What payment methods do you accept in Zambia?",
        answer: "We accept local bank transfers, mobile money payments (MTN, Airtel, Zamtel), cash on collection, and international credit cards."
      },
      {
        question: "Do you offer bulk cargo or container discounts?",
        answer: "Yes, we offer special volume-based contract pricing for commercial importers and businesses shipping more than 10 CBM or 500 kg monthly."
      },
      {
        question: "Is there a minimum charge for sea freight?",
        answer: "Our sea cargo minimum charge starts at 0.05 CBM, ensuring you don't pay for empty container space if you only have small parcels."
      },
      {
        question: "Can I pay for my shipment on arrival in Lusaka?",
        answer: "Yes, cash-on-delivery and mobile money on collection are fully supported at our Lusaka, Ndola, and Kitwe distribution offices."
      }
    ]
  };

  // Scroll Reveal Observer Effect
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
          }
        });
      },
      { threshold: 0.05 }
    );

    const elements = document.querySelectorAll(".reveal-on-scroll");
    elements.forEach((el) => observer.observe(el));

    return () => {
      elements.forEach((el) => observer.unobserve(el));
    };
  }, []);
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
        <header className={cn(
          "left-0 right-0 z-50 w-full transition-all duration-300",
          isScrolled 
            ? "fixed top-0 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-sm py-2" 
            : "absolute top-0 bg-slate-900/15 backdrop-blur-md border-b border-white/10 py-4"
        )}>
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6">
            {/* Logo: LogoImage + XY Cargo */}
            <Link to="/" className="flex items-center gap-3 transition-transform hover:scale-[1.01]">
              <div className="relative">
                <LogoImage size="md" />
              </div>
              <div className="flex flex-col text-left">
                <span className={cn(
                  "text-base font-extrabold tracking-tight leading-tight transition-colors duration-300",
                  isScrolled ? "text-slate-900" : "text-white"
                )}>
                  XY Cargo Zambia
                </span>
              </div>
            </Link>

            {/* Navigation links */}
            <nav className="hidden items-center gap-8 lg:flex">
              <Link 
                to="/" 
                className={cn(
                  "text-xs font-bold uppercase tracking-wider transition-colors relative py-1 group",
                  isScrolled ? "text-slate-700 hover:text-[#d8000d]" : "text-white hover:text-[#d8000d]"
                )}
              >
                Home
                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#d8000d] scale-x-100 transition-transform origin-left" />
              </Link>
              <div className="relative group/shipping">
                <button 
                  className={cn(
                    "flex items-center gap-1 text-xs font-bold uppercase tracking-wider transition-colors py-1",
                    isScrolled ? "text-slate-700 hover:text-[#d8000d]" : "text-white hover:text-[#d8000d]"
                  )}
                >
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
              <Link 
                to="/tracking" 
                className={cn(
                  "text-xs font-bold uppercase tracking-wider transition-colors relative py-1 group",
                  isScrolled ? "text-slate-700 hover:text-[#d8000d]" : "text-white hover:text-[#d8000d]"
                )}
              >
                Tracking
                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#d8000d] scale-x-0 transition-transform origin-left group-hover:scale-x-100" />
              </Link>
              <Link 
                to="/support" 
                className={cn(
                  "text-xs font-bold uppercase tracking-wider transition-colors relative py-1 group",
                  isScrolled ? "text-slate-700 hover:text-[#d8000d]" : "text-white hover:text-[#d8000d]"
                )}
              >
                Support
                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#d8000d] scale-x-0 transition-transform origin-left group-hover:scale-x-100" />
              </Link>
              <Link 
                to="/join-us" 
                className={cn(
                  "text-xs font-bold uppercase tracking-wider transition-colors relative py-1 group",
                  isScrolled ? "text-slate-700 hover:text-[#d8000d]" : "text-white hover:text-[#d8000d]"
                )}
              >
                Career
                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#d8000d] scale-x-0 transition-transform origin-left group-hover:scale-x-100" />
              </Link>
            </nav>

            {/* Right: Phone and CTA */}
            <div className="flex items-center gap-4">
              {/* Phone pill */}
              <a
                href="tel:+260967379139"
                className={cn(
                  "hidden md:flex items-center gap-2 border font-bold text-xs py-2 px-4 rounded-full transition duration-300",
                  isScrolled 
                    ? "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100" 
                    : "bg-white/10 border-white/10 text-white hover:bg-white/20"
                )}
              >
                <Phone className="h-3.5 w-3.5 text-[#d8000d] fill-current animate-pulse" />
                <span>+260 967379139</span>
              </a>
              {/* Get Started button */}
              <Button
                asChild
                className={cn(
                  "hidden sm:flex font-extrabold text-xs py-3 px-5 rounded-full items-center gap-2 transition-all duration-300 shadow-md hover:shadow-lg group hover:scale-[1.02]",
                  isScrolled
                    ? "bg-[#d8000d] hover:bg-[#bf000c] text-white"
                    : "bg-white hover:bg-slate-50 text-slate-900 border border-slate-200/50"
                )}
              >
                <Link to="/login" className="flex items-center gap-2">
                  <span>Get Started Now</span>
                  <ArrowRight className={cn(
                    "h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1",
                    isScrolled ? "text-white" : "text-slate-900"
                  )} />
                </Link>
              </Button>

              {/* Custom Morphing Hamburger Button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="relative h-10 w-10 flex items-center justify-center lg:hidden z-50 focus:outline-none"
                aria-label="Toggle Menu"
              >
                <div className="relative w-6 h-5">
                  <span className={cn(
                    "absolute left-0 w-6 h-0.5 rounded-full transition-all duration-300 ease-in-out",
                    isMobileMenuOpen ? "top-2.5 rotate-45" : "top-0",
                    isScrolled || isMobileMenuOpen ? "bg-slate-900" : "bg-white"
                  )} />
                  <span className={cn(
                    "absolute left-0 top-2.5 w-6 h-0.5 rounded-full transition-all duration-300 ease-in-out",
                    isMobileMenuOpen ? "opacity-0 scale-0" : "opacity-100",
                    isScrolled || isMobileMenuOpen ? "bg-slate-900" : "bg-white"
                  )} />
                  <span className={cn(
                    "absolute left-0 w-6 h-0.5 rounded-full transition-all duration-300 ease-in-out",
                    isMobileMenuOpen ? "top-2.5 -rotate-45" : "top-5",
                    isScrolled || isMobileMenuOpen ? "bg-slate-900" : "bg-white"
                  )} />
                </div>
              </button>
            </div>
          </div>
        </header>

        {/* Custom Mobile Drawer Portalled */}
        {createPortal(
          <>
            {/* Custom Mobile Drawer Overlay */}
            <div 
              onClick={() => setIsMobileMenuOpen(false)}
              className={cn(
                "fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-sm transition-all duration-300 ease-in-out lg:hidden",
                isMobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
              )}
            />

            {/* Custom Mobile Drawer Panel */}
            <div 
              className={cn(
                "fixed top-0 right-0 bottom-0 z-[101] w-[300px] max-w-[85vw] bg-white shadow-2xl border-l border-slate-100 p-6 pt-20 flex flex-col justify-between transition-transform duration-300 ease-in-out lg:hidden",
                isMobileMenuOpen ? "translate-x-0" : "translate-x-full"
              )}
            >
              <div className="flex flex-col gap-8">
                <div className="flex items-center gap-3 pb-6 border-b border-slate-100">
                  <LogoImage size="md" />
                  <span className="text-lg font-bold text-slate-900 leading-tight">XY Cargo Zambia</span>
                </div>

                <nav className="flex flex-col gap-5">
                  <Link 
                    to="/" 
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="text-base font-bold text-slate-900 hover:text-[#d8000d] transition-colors py-1 flex items-center justify-between group"
                  >
                    <span>Home</span>
                    <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-[#d8000d] group-hover:translate-x-1 transition-all" />
                  </Link>
                  <Link 
                    to="/calculator" 
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="text-base font-bold text-slate-900 hover:text-[#d8000d] transition-colors py-1 flex items-center justify-between group"
                  >
                    <span>Shipping Calculator</span>
                    <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-[#d8000d] group-hover:translate-x-1 transition-all" />
                  </Link>
                  <Link 
                    to="/services" 
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="text-base font-bold text-slate-900 hover:text-[#d8000d] transition-colors py-1 flex items-center justify-between group"
                  >
                    <span>Our Services</span>
                    <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-[#d8000d] group-hover:translate-x-1 transition-all" />
                  </Link>
                  <Link 
                    to="/pricing" 
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="text-base font-bold text-slate-900 hover:text-[#d8000d] transition-colors py-1 flex items-center justify-between group"
                  >
                    <span>Pricing Rates</span>
                    <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-[#d8000d] group-hover:translate-x-1 transition-all" />
                  </Link>
                  <Link 
                    to="/tracking" 
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="text-base font-bold text-slate-900 hover:text-[#d8000d] transition-colors py-1 flex items-center justify-between group"
                  >
                    <span>Tracking</span>
                    <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-[#d8000d] group-hover:translate-x-1 transition-all" />
                  </Link>
                  <Link 
                    to="/support" 
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="text-base font-bold text-slate-900 hover:text-[#d8000d] transition-colors py-1 flex items-center justify-between group"
                  >
                    <span>Support</span>
                    <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-[#d8000d] group-hover:translate-x-1 transition-all" />
                  </Link>
                  <Link 
                    to="/join-us" 
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="text-base font-bold text-slate-900 hover:text-[#d8000d] transition-colors py-1 flex items-center justify-between group"
                  >
                    <span>Career</span>
                    <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-[#d8000d] group-hover:translate-x-1 transition-all" />
                  </Link>
                </nav>
              </div>

              <div className="space-y-6 pt-6 border-t border-slate-100">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Customer Support</p>
                  <a href="tel:+260967379139" className="flex items-center gap-3 group text-slate-700 hover:text-[#d8000d] transition-colors">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-sm border border-slate-100 text-slate-800 transition-colors group-hover:bg-[#d8000d] group-hover:text-white">
                      <Phone className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-bold">+260 967379139</span>
                  </a>
                </div>

                <Button asChild onClick={() => setIsMobileMenuOpen(false)} className="w-full rounded-xl bg-[#d8000d] hover:bg-[#bf000c] h-12 text-sm font-bold shadow-lg shadow-[#d8000d]/10">
                  <Link to="/login" className="flex items-center justify-center gap-2">
                    <User className="h-4 w-4" />
                    Get Started Now
                  </Link>
                </Button>
              </div>
            </div>
          </>,
          document.body
        )}

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
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-[68px] font-black tracking-tighter !text-white leading-[1.0] lg:leading-[0.95] font-satoshi uppercase select-none">
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
                  <p className="text-2xl font-black tracking-tight text-white font-satoshi">2000+</p>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 mt-1 font-bold">Satisfied Clients</p>
                </div>
                <div className="px-4">
                  <p className="text-2xl font-black tracking-tight text-white font-satoshi">2.98%</p>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 mt-1 font-bold">On-Time Delivery Rate</p>
                </div>
                <div className="px-4">
                  <p className="text-2xl font-black tracking-tight text-white font-satoshi">150+</p>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 mt-1 font-bold">Countries Served</p>
                </div>
                <div className="px-4">
                  <p className="text-2xl font-black tracking-tight text-white font-satoshi">24/7</p>
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
              <p className="text-2xl font-black text-white font-satoshi">2000+</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-400 mt-1 font-bold">Satisfied Clients</p>
            </div>
            <div>
              <p className="text-2xl font-black text-white font-satoshi">2.98%</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-400 mt-1 font-bold">On-Time Delivery Rate</p>
            </div>
            <div>
              <p className="text-2xl font-black text-white font-satoshi">150+</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-400 mt-1 font-bold">Countries Served</p>
            </div>
            <div>
              <p className="text-2xl font-black text-white font-satoshi">24/7</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-400 mt-1 font-bold">Customer Support</p>
            </div>
          </div>
        </section>

        {/* Section 1: Tailored Logistics Services */}
        <section className="bg-white py-24 border-t border-slate-100 reveal-on-scroll">
          <div className="mx-auto max-w-7xl px-6">
            {/* Header Area */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start mb-16">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-[#d8000d] shrink-0" />
                  <span className="text-xs font-extrabold text-slate-900 uppercase tracking-widest">Our Services</span>
                </div>
                <h2 className="text-4xl md:text-[60px] font-[900] md:leading-[60px] text-slate-900 uppercase font-satoshi tracking-tight">
                  Tailored Logistics <br /> Services For You
                </h2>
              </div>
              <div className="md:pt-8">
                <p className="text-sm sm:text-base text-slate-500 leading-relaxed max-w-xl font-medium">
                  From Transportation To Supply Chain Optimization, XY Cargo Provides End-To-End Services That Help Your Business Move Faster And Smarter.
                </p>
              </div>
            </div>

            {/* 3x2 Border Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 border-t border-l border-slate-200">
              {services.map((service) => (
                <div 
                  key={service.id} 
                  className="border-r border-b border-slate-200 bg-white group overflow-hidden flex flex-col justify-between"
                >
                  <div>
                    {/* Seamless Image Container */}
                    <div className="relative w-full aspect-[16/10] overflow-hidden bg-slate-100">
                      <OptimizedImage 
                        src={service.image} 
                        alt={service.title} 
                        className="h-full w-full object-cover group-hover:scale-105 transition-all duration-700 ease-out" 
                      />
                    </div>
                    {/* Text Block */}
                    <div className="p-8 space-y-4">
                      <div className="flex items-center justify-between gap-4">
                        <h3 className="text-lg font-extrabold text-slate-900 uppercase tracking-tight font-syne group-hover:text-[#d8000d] transition-colors duration-300">
                          {service.title}
                        </h3>
                        <span className="text-sm font-bold text-slate-400 font-mono tracking-wider">
                          {service.id}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-500 leading-relaxed font-medium">
                        {service.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 1.5: About Us Section */}
        <section className="bg-white py-24 border-t border-slate-100 reveal-on-scroll">
          <div className="mx-auto max-w-7xl px-6 relative z-10">
            {/* Top Grid: Copywriting & Rotated Card Stack */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
              {/* Left Column: Text and CTA Button */}
              <div className="lg:col-span-7 space-y-8 text-left">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-[#d8000d] shrink-0" />
                    <span className="text-xs font-extrabold text-slate-900 uppercase tracking-widest">Who We Are</span>
                  </div>
                  <h2 className="text-4xl md:text-[60px] font-[900] md:leading-[60px] text-slate-900 uppercase font-satoshi tracking-tight">
                    About Us
                  </h2>
                </div>
                <div className="space-y-6 text-sm sm:text-base text-slate-600 leading-relaxed font-medium">
                  <p>
                    XY Cargo Zambia is your premier logistics gateway connecting China to Zambia. We specialize in fast, secure, and affordable air and sea freight cargo consolidation, dedicated customs clearance, and secure warehousing. From individual parcels to commercial cargo shipments, we manage your entire supply chain with total transparency and care.
                  </p>
                  <p>
                    With daily air cargo consolidation and weekly ocean freight shipments, we help importers, traders, and businesses receive their packages safely in Lusaka, Ndola, Kitwe, and across Zambia. Our real-time package tracking and responsive support team ensure you are always informed at every stage of your shipment's journey.
                  </p>
                </div>
                <div className="pt-2">
                  <Button asChild className="rounded-full bg-[#d8000d] hover:bg-[#bf000c] text-white font-extrabold text-xs uppercase tracking-widest px-8 py-5 shadow-lg shadow-red-900/10 transition-all duration-300 hover:scale-[1.02] group">
                    <Link to="/about" className="flex items-center gap-2">
                      <span>More About Us</span>
                      <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
                    </Link>
                  </Button>
                </div>
              </div>

              {/* Right Column: Rotated Overlapping Stack & Dashed Plane Line */}
              <div className="lg:col-span-5 relative h-[460px] sm:h-[500px] w-full z-10">
                {/* SVG Loop Path & Airplane */}
                <svg className="absolute inset-0 w-full h-full -z-10 pointer-events-none" viewBox="0 0 500 400" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M 30,340 Q 150,400 280,280 T 440,50" fill="none" stroke="#d8000d" strokeWidth="2.5" strokeDasharray="6,6" opacity="0.35" />
                  <g transform="translate(440,50) rotate(-35)">
                    <path d="M0,0 L-10,-4 L-8,0 L-10,4 Z" fill="#d8000d" opacity="0.75" />
                  </g>
                </svg>

                {/* Background Rotated Card - Polaroid Style */}
                <div className="absolute top-2 left-6 w-[280px] h-[320px] sm:w-[340px] sm:h-[380px] rounded-[24px] overflow-hidden shadow-2xl border border-slate-100 bg-white p-3.5 pb-16 transform rotate-[-6deg] hover:rotate-[-2deg] transition-all duration-500">
                  <OptimizedImage
                    src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=600&auto=format&fit=crop"
                    alt="XY Cargo Warehouse Operations"
                    className="w-full h-full object-cover rounded-[16px]"
                  />
                </div>

                {/* Foreground Rotated Card - Polaroid Style */}
                <div className="absolute top-14 left-24 sm:left-36 w-[260px] h-[300px] sm:w-[320px] sm:h-[360px] rounded-[24px] overflow-hidden shadow-2xl border border-slate-100 bg-white p-3.5 pb-16 transform rotate-[8deg] hover:rotate-[3deg] transition-all duration-500 bg-white z-20">
                  <OptimizedImage
                    src={home?.about?.image || cmsDefaults.home.about.image}
                    alt="XY Cargo Logistics Delivery"
                    className="w-full h-full object-cover rounded-[16px]"
                  />
                </div>
              </div>
            </div>

            {/* Bottom Stats Row */}
            <div className="border-t border-slate-100 pt-16 mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 justify-center">
              <div className="space-y-1 text-center">
                <p className="text-4xl sm:text-5xl font-[900] text-slate-900 tracking-tight font-satoshi">
                  10,000<span className="text-[#d8000d] font-black">+</span>
                </p>
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-black">Packages Delivered</p>
              </div>
              <div className="space-y-1 text-center">
                <p className="text-4xl sm:text-5xl font-[900] text-slate-900 tracking-tight font-satoshi">
                  50<span className="text-[#d8000d] font-black">+</span>
                </p>
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-black">Global Partners</p>
              </div>
              <div className="space-y-1 text-center">
                <p className="text-4xl sm:text-5xl font-[900] text-slate-900 tracking-tight font-satoshi">
                  98<span className="text-[#d8000d] font-black">%</span>
                </p>
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-black">Delivery Success</p>
              </div>
              <div className="space-y-1 text-center">
                <p className="text-4xl sm:text-5xl font-[900] text-slate-900 tracking-tight font-satoshi">
                  15<span className="text-[#d8000d] font-black">+</span>
                </p>
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-black">Years Experience</p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Insights & Updates */}
        <section className="bg-white py-24 border-t border-slate-100 reveal-on-scroll">
          <div className="mx-auto max-w-7xl px-6">
            {/* Header Area */}
            <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
              <div className="flex items-center justify-center gap-2">
                <span className="w-2.5 h-2.5 bg-[#d8000d] shrink-0" />
                <span className="text-xs font-extrabold text-slate-900 uppercase tracking-widest">Insights & Updates</span>
              </div>
              <h2 className="text-4xl md:text-[60px] font-[900] md:leading-[60px] text-slate-900 uppercase font-satoshi tracking-tight">
                Stay Informed With <br className="sm:hidden" /> The Latest In Logistics
              </h2>
            </div>

            {/* Featured Article Card */}
            <div className="relative h-[480px] w-full overflow-hidden rounded-[32px] shadow-2xl border border-slate-100 group">
              <OptimizedImage 
                src="https://images.unsplash.com/photo-1494412574643-ff11b0a5c1c3?q=80&w=1200&auto=format&fit=crop" 
                alt="5 Trends Shaping The Future Of Global Logistics" 
                className="h-full w-full object-cover transform scale-100 group-hover:scale-[1.02] transition-all duration-700 ease-out" 
              />
              {/* Linear Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
              
              {/* Overlaid Content Grid */}
              <div className="absolute inset-0 p-8 sm:p-12 flex flex-col justify-end">
                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
                  {/* Left Column: Heading and Info */}
                  <div className="space-y-4 max-w-2xl text-left">
                    <h3 className="text-2xl sm:text-3xl font-[900] text-white leading-tight uppercase font-satoshi tracking-tight">
                      5 Trends Shaping The <br className="hidden sm:inline" /> Future Of Global Logistics
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-medium">
                      Discover The Key Innovations Transforming Supply Chains Worldwide, From Automation To Sustainable Shipping.
                    </p>
                  </div>
                  
                  {/* Right Column: Read More Button */}
                  <div className="shrink-0">
                    <Link 
                      to="/blog" 
                      className="flex items-center gap-4 text-white font-bold text-xs uppercase tracking-widest group/link hover:text-[#d8000d] transition-colors"
                    >
                      <span>Read More</span>
                      <div className="w-12 h-12 bg-[#d8000d] flex items-center justify-center rounded-2xl text-white font-bold transition-all duration-300 group-hover/link:scale-110 group-hover/link:bg-[#bf000c] shadow-lg shadow-red-900/30">
                        <ArrowRight className="h-5 w-5 text-white transform rotate-[-45deg]" />
                      </div>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: FAQ Section */}
        <section className="bg-white py-24 border-t border-slate-100 reveal-on-scroll">
          <div className="mx-auto max-w-7xl px-6">
            {/* Header Area */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end justify-between mb-16">
              <div className="lg:col-span-9 space-y-6 text-left">
                <div className="w-12 h-12 rounded-2xl bg-red-50 text-[#d8000d] flex items-center justify-center">
                  <MessageSquare className="h-6 w-6" />
                </div>
                <h2 className="text-4xl md:text-[60px] font-[900] md:leading-[60px] text-slate-900 uppercase font-satoshi tracking-tight">
                  Your questions <br /> resolved in one place
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 font-medium max-w-2xl leading-relaxed">
                  We've gathered the most frequently asked questions from our users. If you don't find what you're looking for, let us know, and we'll be happy to assist you.
                </p>
              </div>
              <div className="lg:col-span-3 flex lg:justify-end">
                <Button asChild className="rounded-2xl bg-[#d8000d] hover:bg-[#bf000c] text-white font-extrabold text-xs uppercase tracking-widest px-8 py-5 shadow-lg shadow-red-900/10 transition-all duration-300">
                  <Link to="/support">Contact us</Link>
                </Button>
              </div>
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/40 p-1.5 rounded-full w-fit mb-12">
              {(["shipping", "services", "pricing"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setFaqTab(tab)}
                  className={cn(
                    "px-6 py-2.5 rounded-full text-xs font-extrabold uppercase tracking-wider transition-all duration-300",
                    faqTab === tab
                      ? "bg-white text-slate-900 shadow-sm border border-slate-200/30"
                      : "text-slate-400 hover:text-slate-900"
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* FAQ Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {faqData[faqTab].map((faq, index) => {
                const isFirst = index === 0;
                return (
                  <div
                    key={faq.question}
                    className={cn(
                      "rounded-3xl p-8 text-left transition-all duration-300 hover:scale-[1.02] relative group shadow-sm flex flex-col justify-between min-h-[260px]",
                      isFirst
                        ? "bg-[#d8000d] text-white shadow-xl shadow-red-900/10"
                        : "bg-white border border-slate-200/60 hover:border-slate-300 hover:shadow-md"
                    )}
                  >
                    <div>
                      {/* Circle Question Icon */}
                      <div
                        className={cn(
                          "w-10 h-10 rounded-full border-2 flex items-center justify-center mb-6 transition-all duration-300",
                          isFirst
                            ? "border-white"
                            : "border-slate-900 group-hover:border-[#d8000d] group-hover:bg-[#d8000d]/5"
                        )}
                      >
                        <span
                          className={cn(
                            "font-extrabold text-lg font-syne",
                            isFirst
                              ? "text-white"
                              : "text-slate-900 group-hover:text-[#d8000d]"
                          )}
                        >
                          ?
                        </span>
                      </div>

                      {/* Question Heading */}
                      <h3
                        className={cn(
                          "font-[900] text-lg sm:text-xl font-satoshi uppercase tracking-tight leading-snug mb-4",
                          isFirst
                            ? "text-white"
                            : "text-slate-900 group-hover:text-[#d8000d] transition-colors"
                        )}
                      >
                        {faq.question}
                      </h3>
                    </div>

                    {/* Answer text */}
                    <p
                      className={cn(
                        "text-xs sm:text-sm leading-relaxed font-medium mt-auto pt-2",
                        isFirst ? "text-red-100" : "text-slate-500"
                      )}
                    >
                      {faq.answer}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Bottom Button */}
            <div className="flex justify-center mt-16">
              <Button asChild className="rounded-full bg-slate-950 hover:bg-slate-900 text-white font-extrabold text-xs uppercase tracking-widest px-8 py-5 shadow-xl transition-all duration-300 hover:scale-[1.02]">
                <Link to="/faq">See all questions</Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </>
  );
};

export default Index;
