import { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { createPortal } from "react-dom";
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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
    supportItems: (() => {
      const rawItems = Array.isArray(site?.footer?.supportItems)
        ? site.footer.supportItems
        : cmsDefaults.site.footer.supportItems;
      const hasOldAddress = rawItems.some(item => 
        item.toLowerCase().includes("carousel") || 
        item.toLowerCase().includes("shop #94") ||
        (item.toLowerCase().includes("kafue road") && !item.toLowerCase().includes("de la motte"))
      );
      return hasOldAddress ? cmsDefaults.site.footer.supportItems : rawItems;
    })(),
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
        <>
          <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-slate-100 py-4 px-8">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
              {/* Logo: LogoImage + XY Cargo */}
              <Link to="/" className="flex items-center gap-3 transition-transform hover:scale-[1.01]">
                <div className="relative">
                  <LogoImage size="md" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-base font-extrabold tracking-tight leading-tight text-slate-900 font-satoshi">
                    XY Cargo Zambia
                  </span>
                </div>
              </Link>

              {/* Navigation links */}
              <nav className="hidden items-center gap-6 xl:gap-8 lg:flex">
                <NavLink 
                  to="/" 
                  className={({ isActive }) => cn(
                    "text-sm font-medium tracking-wide transition-colors relative py-1",
                    isActive ? "text-[#E11D48]" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  Home
                </NavLink>

                {/* Shipping Dropdown */}
                <div className="relative group/dropdown">
                  <button className="flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900 tracking-wide py-1 focus:outline-none">
                    <span>Shipping</span>
                    <ChevronDown className="h-3.5 w-3.5 transition-transform duration-300 group-hover:rotate-180 text-slate-400 group-hover:text-slate-600" />
                  </button>
                  <div className="absolute top-full left-0 hidden group-hover/dropdown:block bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200/50 py-2.5 w-48 mt-1 z-50 transition-all duration-300 animate-fade-in text-slate-800">
                    <Link to="/calculator" className="block px-4 py-2 hover:bg-slate-50 hover:text-[#E11D48] rounded-lg text-xs font-semibold text-slate-600 transition-colors mx-1">
                      Shipping Calculator
                    </Link>
                    <Link to="/services" className="block px-4 py-2 hover:bg-slate-50 hover:text-[#E11D48] rounded-lg text-xs font-semibold text-slate-600 transition-colors mx-1">
                      Our Services
                    </Link>
                    <Link to="/how-we-work" className="block px-4 py-2 hover:bg-slate-50 hover:text-[#E11D48] rounded-lg text-xs font-semibold text-slate-600 transition-colors mx-1">
                      How We Work
                    </Link>
                  </div>
                </div>

                {/* Tracking */}
                <NavLink 
                  to="/tracking" 
                  className={({ isActive }) => cn(
                    "text-sm font-medium tracking-wide transition-colors relative py-1",
                    isActive ? "text-[#E11D48]" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  Tracking
                </NavLink>

                {/* Media & Resources Dropdown */}
                <div className="relative group/dropdown">
                  <button className="flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900 tracking-wide py-1 focus:outline-none">
                    <span>Media & Resources</span>
                    <ChevronDown className="h-3.5 w-3.5 transition-transform duration-300 group-hover:rotate-180 text-slate-400 group-hover:text-slate-600" />
                  </button>
                  <div className="absolute top-full left-0 hidden group-hover/dropdown:block bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200/50 py-2.5 w-48 mt-1 z-50 transition-all duration-300 animate-fade-in text-slate-800">
                    <Link to="/gallery" className="block px-4 py-2 hover:bg-slate-50 hover:text-[#E11D48] rounded-lg text-xs font-semibold text-slate-600 transition-colors mx-1">
                      Gallery
                    </Link>
                    <Link to="/podcast" className="block px-4 py-2 hover:bg-slate-50 hover:text-[#E11D48] rounded-lg text-xs font-semibold text-slate-600 transition-colors mx-1">
                      Podcast
                    </Link>
                    <Link to="/blog" className="block px-4 py-2 hover:bg-slate-50 hover:text-[#E11D48] rounded-lg text-xs font-semibold text-slate-600 transition-colors mx-1 flex items-center justify-between">
                      <span>Blog</span>
                      <span className="text-[9px] font-bold bg-rose-50 text-[#E11D48] px-1.5 py-0.5 rounded-full border border-rose-100">NEW</span>
                    </Link>
                  </div>
                </div>

                {/* Company Dropdown */}
                <div className="relative group/dropdown">
                  <button className="flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900 tracking-wide py-1 focus:outline-none">
                    <span>Company</span>
                    <ChevronDown className="h-3.5 w-3.5 transition-transform duration-300 group-hover:rotate-180 text-slate-400 group-hover:text-slate-600" />
                  </button>
                  <div className="absolute top-full left-0 hidden group-hover/dropdown:block bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200/50 py-2.5 w-48 mt-1 z-50 transition-all duration-300 animate-fade-in text-slate-800">
                    <Link to="/support" className="block px-4 py-2 hover:bg-slate-50 hover:text-[#E11D48] rounded-lg text-xs font-semibold text-slate-600 transition-colors mx-1">
                      Support
                    </Link>
                    <Link to="/join-us" className="block px-4 py-2 hover:bg-slate-50 hover:text-[#E11D48] rounded-lg text-xs font-semibold text-slate-600 transition-colors mx-1">
                      Careers
                    </Link>
                  </div>
                </div>
              </nav>

              {/* Right Side Actions */}
              <div className="flex items-center gap-4">
                <a
                  href="tel:+260211220012"
                  className="hidden md:flex items-center gap-2 text-slate-600 hover:text-[#E11D48] text-sm font-medium transition-colors"
                >
                  <Phone className="h-4 w-4 text-slate-400" />
                  <span>+260 211220012</span>
                </a>
                <Button
                  asChild
                  className="hidden sm:flex bg-[#E11D48] hover:bg-[#BE123C] text-white text-sm font-medium px-5 py-2.5 rounded-full shadow-sm hover:shadow transition-all duration-200 ease-in-out"
                >
                  <Link to="/login" className="flex items-center gap-2">
                    <span>Get Started Now</span>
                    <ArrowRight className="h-4 w-4 text-white transition-transform duration-300 group-hover:translate-x-1" />
                  </Link>
                </Button>

                {/* Mobile Hamburger Button */}
                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="relative h-10 w-10 flex items-center justify-center lg:hidden z-[102] focus:outline-none"
                  aria-label="Toggle Menu"
                >
                  <div className="relative w-6 h-5">
                    <span className={cn(
                      "absolute left-0 w-6 h-0.5 rounded-full transition-all duration-300 ease-in-out bg-slate-900",
                      isMobileMenuOpen ? "top-2.5 rotate-45" : "top-0"
                    )} />
                    <span className={cn(
                      "absolute left-0 top-2.5 w-6 h-0.5 rounded-full transition-all duration-300 ease-in-out bg-slate-900",
                      isMobileMenuOpen ? "opacity-0 scale-0" : "opacity-100"
                    )} />
                    <span className={cn(
                      "absolute left-0 w-6 h-0.5 rounded-full transition-all duration-300 ease-in-out bg-slate-900",
                      isMobileMenuOpen ? "top-2.5 -rotate-45" : "top-5"
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
                <div className="flex flex-col gap-6">
                  <div className="flex items-center gap-3 pb-6 border-b border-slate-100">
                    <LogoImage size="md" />
                    <span className="text-lg font-bold text-slate-900 leading-tight">XY Cargo Zambia</span>
                  </div>

                  <nav className="flex flex-col gap-4">
                    <Link 
                      to="/" 
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="text-sm font-semibold text-slate-700 hover:text-rose-600 transition-colors py-2 border-b border-slate-50"
                    >
                      Home
                    </Link>

                    <Accordion type="single" collapsible className="w-full border-none">
                      <AccordionItem value="shipping" className="border-b border-slate-50">
                        <AccordionTrigger className="text-sm font-semibold hover:no-underline py-2 text-slate-700 hover:text-rose-600">
                          Shipping
                        </AccordionTrigger>
                        <AccordionContent className="pl-4 pt-1 pb-2 flex flex-col gap-2">
                          <Link to="/calculator" onClick={() => setIsMobileMenuOpen(false)} className="text-xs font-medium text-slate-500 hover:text-rose-600 py-1">
                            Shipping Calculator
                          </Link>
                          <Link to="/services" onClick={() => setIsMobileMenuOpen(false)} className="text-xs font-medium text-slate-500 hover:text-rose-600 py-1">
                            Our Services
                          </Link>
                          <Link to="/how-we-work" onClick={() => setIsMobileMenuOpen(false)} className="text-xs font-medium text-slate-500 hover:text-rose-600 py-1">
                            How We Work
                          </Link>
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="media" className="border-b border-slate-50">
                        <AccordionTrigger className="text-sm font-semibold hover:no-underline py-2 text-slate-700 hover:text-rose-600">
                          Media & Resources
                        </AccordionTrigger>
                        <AccordionContent className="pl-4 pt-1 pb-2 flex flex-col gap-2">
                          <Link to="/gallery" onClick={() => setIsMobileMenuOpen(false)} className="text-xs font-medium text-slate-500 hover:text-rose-600 py-1">
                            Gallery
                          </Link>
                          <Link to="/podcast" onClick={() => setIsMobileMenuOpen(false)} className="text-xs font-medium text-slate-500 hover:text-rose-600 py-1">
                            Podcast
                          </Link>
                          <Link to="/blog" onClick={() => setIsMobileMenuOpen(false)} className="text-xs font-medium text-slate-500 hover:text-rose-600 py-1 flex items-center justify-between">
                            <span>Blog</span>
                            <span className="text-[8px] font-bold bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded-full border border-rose-100">NEW</span>
                          </Link>
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="company" className="border-b border-slate-50">
                        <AccordionTrigger className="text-sm font-semibold hover:no-underline py-2 text-slate-700 hover:text-rose-600">
                          Company
                        </AccordionTrigger>
                        <AccordionContent className="pl-4 pt-1 pb-2 flex flex-col gap-2">
                          <Link to="/support" onClick={() => setIsMobileMenuOpen(false)} className="text-xs font-medium text-slate-500 hover:text-rose-600 py-1">
                            Support
                          </Link>
                          <Link to="/join-us" onClick={() => setIsMobileMenuOpen(false)} className="text-xs font-medium text-slate-500 hover:text-rose-600 py-1">
                            Careers
                          </Link>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>

                    <Link 
                      to="/tracking" 
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="text-sm font-semibold text-slate-700 hover:text-rose-600 transition-colors py-2 border-b border-slate-50"
                    >
                      Tracking
                    </Link>
                  </nav>
                </div>

                <div className="space-y-6 pt-6 border-t border-slate-100">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Customer Support</p>
                    <a href="tel:+260211220012" className="flex items-center gap-3 group text-slate-700 hover:text-rose-600 transition-colors">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-sm border border-slate-100 text-slate-800 transition-colors group-hover:bg-[#E11D48] group-hover:text-white">
                        <Phone className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-bold">+260 211220012</span>
                    </a>
                  </div>

                  <Button asChild onClick={() => setIsMobileMenuOpen(false)} className="w-full rounded-xl bg-[#E11D48] hover:bg-[#BE123C] h-12 text-sm font-bold shadow-lg shadow-[#E11D48]/10 text-white border-none">
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
        </>
      )}

      <main>
        <div key={location.pathname} className="motion-safe:animate-fade-in">
          <Outlet />
        </div>
      </main>

      <NewsletterCta />

      <footer className="bg-slate-950 text-white border-t border-white/5">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <div className="grid gap-12 md:grid-cols-12">
            {/* Column 1: Logo & About & Socials (takes 4 cols on desktop) */}
            <div className="md:col-span-4 space-y-6">
              <LogoImage size="lg" />
              <p className="text-[15px] leading-relaxed !text-slate-300 font-satoshi max-w-sm">{footer.about}</p>
              <div className="flex items-center gap-3 pt-2">
                <a 
                  href={topBar.facebookUrl} 
                  aria-label="Facebook" 
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E11D48] text-white hover:bg-[#BE123C] transition-all hover:scale-105 shadow-sm"
                >
                  <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c4.56-.93 8-4.96 8-9.75z"/>
                  </svg>
                </a>
                <a 
                  href={topBar.instagramUrl} 
                  aria-label="Instagram" 
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-900 hover:bg-[#E11D48] hover:text-white transition-all hover:scale-105 shadow-sm"
                >
                  <svg className="h-4 w-4 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                  </svg>
                </a>
                <a 
                  href={topBar.linkedinUrl} 
                  aria-label="LinkedIn" 
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-900 hover:bg-[#E11D48] hover:text-white transition-all hover:scale-105 shadow-sm"
                >
                  <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.779-1.75-1.75s.784-1.75 1.75-1.75 1.75.779 1.75 1.75-.784 1.75-1.75 1.75zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                  </svg>
                </a>
                <a 
                  href={topBar.tiktokUrl} 
                  aria-label="TikTok" 
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-900 hover:bg-[#E11D48] hover:text-white transition-all hover:scale-105 shadow-sm"
                >
                  <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.17-2.89-.6-4.09-1.5-.7-.52-1.28-1.19-1.7-1.97-.05 2.56.02 5.12-.02 7.68-.15 2.33-1.18 4.6-3.08 5.96-1.9 1.37-4.49 1.83-6.83 1.25-2.34-.58-4.42-2.31-5.24-4.57-.84-2.25-.56-4.9.75-6.87a9.23 9.23 0 0 1 5.9-3.77v4.07c-1.31.25-2.61.99-3.37 2.09-.76 1.1-1 2.56-.58 3.86.42 1.3 1.58 2.37 2.93 2.68 1.35.31 2.87-.1 3.73-1.18.86-1.08.97-2.62.97-3.95V.02z"/>
                  </svg>
                </a>
              </div>
            </div>

            {/* Columns 2, 3, 4 (take 8 cols on desktop total) */}
            <div className="md:col-span-8 grid gap-8 grid-cols-1 sm:grid-cols-3 text-left">
              {/* Column 2: Navigation */}
              <div className="space-y-6">
                <h3 className="text-xs font-bold uppercase tracking-widest !text-white font-satoshi">Navigation</h3>
                <ul className="space-y-3.5 text-[15px] font-satoshi">
                  <li><Link to="/" className="!text-slate-400 hover:!text-white transition-colors">Home</Link></li>
                  <li><Link to="/about" className="!text-slate-400 hover:!text-white transition-colors">About Us</Link></li>
                  <li><Link to="/services" className="!text-slate-400 hover:!text-white transition-colors">Services</Link></li>
                  <li><Link to="/blog" className="!text-slate-400 hover:!text-white transition-colors">Blog</Link></li>
                  <li><Link to="/support" className="!text-slate-400 hover:!text-white transition-colors">Support</Link></li>
                </ul>
              </div>

              {/* Column 3: Resources & Tools */}
              <div className="space-y-6">
                <h3 className="text-xs font-bold uppercase tracking-widest !text-white font-satoshi">Resources & Tools</h3>
                <ul className="space-y-3.5 text-[15px] font-satoshi">
                  <li><Link to="/calculator" className="!text-slate-400 hover:!text-white transition-colors">Shipping Calculator</Link></li>
                  <li><Link to="/tracking" className="!text-slate-400 hover:!text-white transition-colors">Package Tracking</Link></li>
                  <li><Link to="/how-we-work" className="!text-slate-400 hover:!text-white transition-colors">How We Work</Link></li>
                  <li><Link to="/faq" className="!text-slate-400 hover:!text-white transition-colors">FAQs</Link></li>
                  <li><Link to="/join-us" className="!text-slate-400 hover:!text-white transition-colors">Careers</Link></li>
                </ul>
              </div>

              {/* Column 4: Contact */}
              <div className="space-y-6">
                <h3 className="text-xs font-bold uppercase tracking-widest !text-white font-satoshi">Contact</h3>
                <ul className="space-y-3.5 text-[14px] font-satoshi">
                  <li className="space-y-1">
                    <span className="font-semibold !text-white block">Lusaka HQ:</span>
                    <span className="text-xs !text-slate-400 leading-normal block">De la motte Zambia Ltd Building, Plot 26592, Kafue Road, Lusaka, Zambia, 10101</span>
                  </li>
                  <li className="space-y-1">
                    <span className="font-semibold !text-white block">Copperbelt Office:</span>
                    <span className="text-xs !text-slate-400 leading-normal block">Real masters complex, shinde street corner of kabelenga road</span>
                  </li>
                  <li className="space-y-1">
                    <span className="font-semibold !text-white block">Email:</span>
                    <a href="mailto:Support@xycargozm.com" className="text-xs !text-slate-400 hover:!text-white block transition-colors">Support@xycargozm.com</a>
                  </li>
                  <li className="space-y-1">
                    <span className="font-semibold !text-white block">Customer Care:</span>
                    <a href="tel:+260211220012" className="text-xs !text-slate-400 hover:!text-white block transition-colors">Lusaka: +260 211220012</a>
                    <a href="tel:0958977051" className="text-xs !text-slate-400 hover:!text-white block transition-colors">Copperbelt: 0958 977 051</a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom copyright & legal links */}
        <div className="border-t border-white/10 bg-slate-950/50 py-8">
          <div className="mx-auto max-w-7xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
            <span className="text-sm !text-slate-400 font-satoshi">
              © 2026 XY Cargo Zambia. All Rights Reserved. China to Zambia Shipping Specialists - Designed by{" "}
              <a
                href="https://platonyx.com"
                target="_blank"
                rel="noreferrer"
                className="font-semibold transition-colors !text-slate-400 hover:!text-white hover:underline"
              >
                Platonyx Technology
              </a>
            </span>
            <div className="flex items-center gap-6 text-sm font-satoshi">
              {footerLegalLinks.map((link) => (
                <Link key={link.to} to={link.to} className="transition-colors !text-slate-400 hover:!text-white">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </footer>

      <SupportFloatingActions />
    </div>
  );
};
