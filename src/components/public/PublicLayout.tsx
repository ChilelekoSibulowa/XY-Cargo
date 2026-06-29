import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Clock, Mail, MapPin, Phone, Facebook, Instagram, AlignRight, Linkedin, Youtube, Music, X, ChevronRight, User, ChevronDown, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useCmsPage } from "@/hooks/useCmsPage";
import { cmsDefaults, CmsSiteData } from "@/content/cmsDefaults";
import { SupportFloatingActions } from "@/components/shared/SupportFloatingActions";
import { LogoImage } from "@/components/shared/LogoImage";
import { NewsletterCta } from "@/components/marketing/NewsletterCta";
import { CurrencySwitcher } from "@/components/shared/CurrencySwitcher";

const navItems = [
  { label: "Home", to: "/" },
  { label: "Services", to: "/services" },
  { label: "How We Work", to: "/how-we-work" },
  { label: "Gallery", to: "/gallery" },
  { label: "Podcast", to: "/podcast" },
  { label: "Blog", to: "/blog" },
  { label: "Faq", to: "/faq" },
  { label: "Support", to: "/support" },
  { label: "About Us", to: "/about" },
];

export const PublicLayout = () => {
  const { data: site } = useCmsPage<CmsSiteData>("site", cmsDefaults.site);
  const location = useLocation();
  const topBar = {
    ...cmsDefaults.site.topBar,
    ...(site?.topBar || {}),
    facebookUrl: "https://www.facebook.com/share/1AwnHQ7TFp/?mibextid=wwXIfr",
    instagramUrl: "https://www.instagram.com/xy_cargo_zm?igsh=MWVoNHowcDFjMHY3ag==",
    linkedinUrl: "https://www.linkedin.com/company/110032921/admin/dashboard/",
    youtubeUrl: "https://www.youtube.com/@XYCARGOZM",
    tiktokUrl: "https://www.tiktok.com/@xy.cargo.zm",
  };
  const nav = {
    ...cmsDefaults.site.nav,
    ...(site?.nav || {}),
  };
  const cta = {
    ...cmsDefaults.site.cta,
    ...(site?.cta || {}),
  };
  const footer = {
    ...cmsDefaults.site.footer,
    ...(site?.footer || {}),
    columns: Array.isArray(site?.footer?.columns)
      ? site.footer.columns
      : cmsDefaults.site.footer.columns,
    supportItems: Array.isArray(site?.footer?.supportItems)
      ? site.footer.supportItems
      : cmsDefaults.site.footer.supportItems,
  };
  const footerLinkMap: Record<string, string> = {
    home: "/",
    "sign in": "/login",
    "sign up": "/register",
    "shipping calculator": "/calculator",
    "package tracking": "/tracking",
    services: "/services",
    pricing: "/pricing",
    locations: "/locations",
    "support center": "/support",
    "contact us": "/support",
    contact: "/support",
    faqs: "/faq",
    faq: "/faq",
    "about us": "/about",
    blog: "/blog",
    podcast: "/podcast",
    shop: "/shop",
    "join us": "/join-us",
    language: "/language",
    "air freight": "/calculator",
    "sea freight": "/calculator",
    "product sourcing": "/services/product-sourcing",
    "supplier payment facilitation": "/services/supplier-payment-facilitation",
    "custom clearance": "/services/customs-clearance",
    "customs clearance": "/services/customs-clearance",
    "door to door delivery": "/login",
    export: "/services/export",
    "privacy policy": "/privacy",
    "terms & conditions": "/terms",
    "terms and conditions": "/terms",
    "refund policy": "/refund-policy",
  };
  const footerLegalLinks = [
    { label: "Privacy Policy", to: "/privacy" },
    { label: "Terms & Conditions", to: "/terms" },
    { label: "Refund Policy", to: "/refund-policy" },
  ];
  const normalizedFooterBottomLeft = footer.bottomLeft
    .replace("Designed by Platonic Hub", "Designed by")
    .replace("Designed by Platonyx Technology", "Designed by");
  const resolveFooterLink = (item: string, columnTitle: string) => {
    const key = item.trim().toLowerCase();
    if (footerLinkMap[key]) return footerLinkMap[key];
    if (key.includes("track")) return "/tracking";
    if (key.includes("price") || key.includes("rate")) return "/pricing";
    if (key.includes("support") || key.includes("contact")) return "/support";
    if (key.includes("faq")) return "/faq";
    if (key.includes("privacy")) return "/privacy";
    if (key.includes("term") || key.includes("condition")) return "/terms";
    if (key.includes("refund")) return "/refund-policy";
    if (columnTitle.trim().toLowerCase() === "services") return "/services";
    return "/";
  };

  return (
    <div className="public-scope min-h-screen bg-white text-slate-900">
      {location.pathname !== "/" && (
        <header className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-sm py-2">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6">
            {/* Logo: LogoImage + XY Cargo */}
            <Link to="/" className="flex items-center gap-3 transition-transform hover:scale-[1.01]">
              <div className="relative">
                <LogoImage size="md" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-base font-extrabold tracking-tight leading-tight text-slate-900">
                  XY Cargo Zambia
                </span>
              </div>
            </Link>

            {/* Navigation links */}
            <nav className="hidden items-center gap-8 lg:flex">
              <NavLink 
                to="/" 
                className={({ isActive }) => cn(
                  "text-xs font-bold uppercase tracking-wider transition-colors relative py-1 group",
                  isActive ? "text-[#d8000d]" : "text-slate-700 hover:text-[#d8000d]"
                )}
              >
                Home
                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#d8000d] scale-x-0 transition-transform origin-left group-hover:scale-x-100" />
              </NavLink>
              <div className="relative group/shipping">
                <button 
                  className={cn(
                    "flex items-center gap-1 text-xs font-bold uppercase tracking-wider transition-colors py-1 text-slate-700 hover:text-[#d8000d]"
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
              <NavLink 
                to="/tracking" 
                className={({ isActive }) => cn(
                  "text-xs font-bold uppercase tracking-wider transition-colors relative py-1 group",
                  isActive ? "text-[#d8000d]" : "text-slate-700 hover:text-[#d8000d]"
                )}
              >
                Tracking
                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#d8000d] scale-x-0 transition-transform origin-left group-hover:scale-x-100" />
              </NavLink>
              <NavLink 
                to="/support" 
                className={({ isActive }) => cn(
                  "text-xs font-bold uppercase tracking-wider transition-colors relative py-1 group",
                  isActive ? "text-[#d8000d]" : "text-slate-700 hover:text-[#d8000d]"
                )}
              >
                Support
                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#d8000d] scale-x-0 transition-transform origin-left group-hover:scale-x-100" />
              </NavLink>
              <NavLink 
                to="/join-us" 
                className={({ isActive }) => cn(
                  "text-xs font-bold uppercase tracking-wider transition-colors relative py-1 group",
                  isActive ? "text-[#d8000d]" : "text-slate-700 hover:text-[#d8000d]"
                )}
              >
                Career
                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#d8000d] scale-x-0 transition-transform origin-left group-hover:scale-x-100" />
              </NavLink>
            </nav>

            {/* Right: Phone, Currency, and CTA */}
            <div className="flex items-center gap-4">
              <CurrencySwitcher />
              {/* Phone pill */}
              <a
                href="tel:+260967379139"
                className="hidden md:flex items-center gap-2 border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 font-bold text-xs py-2 px-4 rounded-full transition duration-300"
              >
                <Phone className="h-3.5 w-3.5 text-[#d8000d] fill-current animate-pulse" />
                <span>+260 967379139</span>
              </a>
              {/* Get Started button */}
              <Button
                asChild
                className="bg-[#d8000d] hover:bg-[#bf000c] text-white font-extrabold text-xs py-3 px-5 rounded-full flex items-center gap-2 transition-all duration-300 shadow-md hover:shadow-lg group hover:scale-[1.02]"
              >
                <Link to="/login" className="flex items-center gap-2">
                  <span>Get Started Now</span>
                  <ArrowRight className="h-3.5 w-3.5 text-white transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
              </Button>

              {/* Mobile Drawer Button */}
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="group h-10 w-10 lg:hidden">
                    <AlignRight className="h-7 w-7 text-slate-900 stroke-[2.5px] transition-colors group-hover:text-[#d8000d]" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[300px] border-l border-slate-100 bg-white p-0">
                  <div className="flex flex-col h-full">
                    <div className="flex items-center p-6 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <LogoImage size="md" />
                        <span className="text-lg font-bold text-slate-900 leading-tight">XY Cargo Zambia</span>
                      </div>
                    </div>

                    <nav className="flex-1 overflow-y-auto px-6 py-8">
                      <div className="flex flex-col gap-4">
                        <SheetClose asChild>
                          <Link to="/" className="flex items-center py-1.5 text-lg font-bold text-slate-900 hover:text-[#d8000d]">Home</Link>
                        </SheetClose>
                        <SheetClose asChild>
                          <Link to="/calculator" className="flex items-center py-1.5 text-lg font-bold text-slate-900 hover:text-[#d8000d]">Shipping Calculator</Link>
                        </SheetClose>
                        <SheetClose asChild>
                          <Link to="/services" className="flex items-center py-1.5 text-lg font-bold text-slate-900 hover:text-[#d8000d]">Our Services</Link>
                        </SheetClose>
                        <SheetClose asChild>
                          <Link to="/pricing" className="flex items-center py-1.5 text-lg font-bold text-slate-900 hover:text-[#d8000d]">Pricing Rates</Link>
                        </SheetClose>
                        <SheetClose asChild>
                          <Link to="/tracking" className="flex items-center py-1.5 text-lg font-bold text-slate-900 hover:text-[#d8000d]">Tracking</Link>
                        </SheetClose>
                        <SheetClose asChild>
                          <Link to="/support" className="flex items-center py-1.5 text-lg font-bold text-slate-900 hover:text-[#d8000d]">Support</Link>
                        </SheetClose>
                        <SheetClose asChild>
                          <Link to="/join-us" className="flex items-center py-1.5 text-lg font-bold text-slate-900 hover:text-[#d8000d]">Career</Link>
                        </SheetClose>
                      </div>
                    </nav>

                    <div className="p-6 bg-slate-50 border-t border-slate-100 space-y-6">
                      <div className="space-y-4">
                        <a href="tel:+260967379139" className="flex items-center gap-4 group">
                          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-white transition-colors group-hover:bg-[#d8000d]">
                            <Phone className="h-4 w-4" />
                          </div>
                          <span className="text-sm font-bold text-slate-900">+260 967379139</span>
                        </a>
                      </div>

                      <div className="space-y-3 pt-2">
                        <SheetClose asChild>
                          <Button asChild className="w-full rounded-xl bg-[#d8000d] h-12 text-sm font-bold shadow-lg shadow-[#d8000d]/20">
                            <Link to="/login" className="flex items-center justify-center gap-2">
                              <User className="h-4 w-4" />
                              Get Started Now
                            </Link>
                          </Button>
                        </SheetClose>
                      </div>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </header>
      )}

      <main>
        <div key={location.pathname} className="motion-safe:animate-fade-in">
          <Outlet />
        </div>
      </main>

      <NewsletterCta />

      <footer className="bg-slate-950 text-white">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <div className="grid gap-12 md:grid-cols-4">
            <div className="space-y-6">
              <LogoImage size="lg" />
              <p className="text-[15px] leading-relaxed text-slate-400 max-w-xs">{footer.about}</p>
              <div className="flex items-center gap-5">
                <a href={topBar.facebookUrl} aria-label="Facebook" className="transition-all hover:scale-110 hover:text-[#d8000d]">
                  <Facebook className="h-5 w-5" />
                </a>
                <a href={topBar.linkedinUrl} aria-label="LinkedIn" className="transition-all hover:scale-110 hover:text-[#d8000d]">
                  <Linkedin className="h-5 w-5" />
                </a>
                <a href={topBar.youtubeUrl} aria-label="YouTube" className="transition-all hover:scale-110 hover:text-[#d8000d]">
                  <Youtube className="h-5 w-5" />
                </a>
                <a href={topBar.instagramUrl} aria-label="Instagram" className="transition-all hover:scale-110 hover:text-[#d8000d]">
                  <Instagram className="h-5 w-5" />
                </a>
                <a href={topBar.tiktokUrl} aria-label="TikTok" className="transition-all hover:scale-110 hover:text-[#d8000d]">
                  <Music className="h-5 w-5" />
                </a>
              </div>
            </div>

            {/* Desktop View: Columns */}
            <div className="hidden md:contents">
              {footer.columns.map((column) => (
                <div key={column.title} className="space-y-6">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-white">{column.title}</h3>
                  <ul className="space-y-3.5 text-[15px] text-slate-400">
                    {column.items.map((item) => (
                      <li key={item}>
                        <Link
                          to={resolveFooterLink(item, column.title)}
                          className="transition-colors hover:text-white"
                        >
                          {item}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <div className="space-y-6">
                <h3 className="text-sm font-bold uppercase tracking-widest text-white">Support</h3>
                <ul className="space-y-3.5 text-[15px] text-slate-400">
                  {footer.supportItems.map((item) => (
                    <li key={item} className="transition-colors hover:text-white cursor-default">{item}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Mobile View: Accordion */}
            <div className="md:hidden space-y-2">
              <Accordion type="single" collapsible className="w-full border-none">
                {footer.columns.map((column) => (
                  <AccordionItem key={column.title} value={column.title} className="border-white/5">
                    <AccordionTrigger className="text-sm font-bold uppercase tracking-widest hover:no-underline py-4 text-white">
                      {column.title}
                    </AccordionTrigger>
                    <AccordionContent>
                      <ul className="space-y-3.5 text-[15px] text-slate-400 pb-4">
                        {column.items.map((item) => (
                          <li key={item}>
                            <Link
                              to={resolveFooterLink(item, column.title)}
                              className="transition-colors hover:text-white"
                            >
                              {item}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                ))}
                <AccordionItem value="support" className="border-white/5">
                  <AccordionTrigger className="text-sm font-bold uppercase tracking-widest hover:no-underline py-4 text-white">
                    Support
                  </AccordionTrigger>
                  <AccordionContent>
                    <ul className="space-y-3.5 text-[15px] text-slate-400 pb-4">
                      {footer.supportItems.map((item) => (
                        <li key={item} className="transition-colors hover:text-white cursor-default">{item}</li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </div>
        </div>
        <div className="border-t border-white/10 bg-slate-950/50">
          <div className="mx-auto max-w-7xl px-6 py-8 flex flex-col items-center gap-4 text-center">
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-400">
              {footerLegalLinks.map((link) => (
                <Link key={link.to} to={link.to} className="transition-colors hover:text-white">
                  {link.label}
                </Link>
              ))}
            </div>
            <span className="text-sm text-slate-400">
              {normalizedFooterBottomLeft}{" "}
              <a
                href="https://platonyx.com"
                target="_blank"
                rel="noreferrer"
                className="font-semibold transition-colors hover:text-white hover:underline"
              >
                Platonyx Technology
              </a>
            </span>
          </div>
        </div>
      </footer>

      <SupportFloatingActions />
    </div>
  );
};
