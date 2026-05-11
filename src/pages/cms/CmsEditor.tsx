import { useEffect, useMemo, useState } from "react";
import { useAuthContext } from "@/components/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  cmsDefaults,
  CmsHomeData,
  CmsServicesData,
  CmsSiteData,
  CmsAboutData,
  CmsSupportData,
  CmsFaqData,
  CmsHowWeWorkData,
  CmsBlogData,
  CmsPodcastData,
  CmsGalleryData,
} from "@/content/cmsDefaults";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, RotateCcw, Loader2, Eye, Settings, Home, Briefcase, Info, HeadphonesIcon, HelpCircle, Cog, Image, Mic, BookOpen } from "lucide-react";
import { HomeEditor } from "@/components/cms/editors/HomeEditor";
import { ServicesEditor } from "@/components/cms/editors/ServicesEditor";
import { SiteSettingsEditor } from "@/components/cms/editors/SiteSettingsEditor";
import { AboutEditor } from "@/components/cms/editors/AboutEditor";
import { SupportEditor } from "@/components/cms/editors/SupportEditor";
import { FaqEditor } from "@/components/cms/editors/FaqEditor";
import { HowWeWorkEditor } from "@/components/cms/editors/HowWeWorkEditor";
import { BlogEditor } from "@/components/cms/editors/BlogEditor";
import { PodcastEditor } from "@/components/cms/editors/PodcastEditor";
import { GalleryEditor } from "@/components/cms/editors/GalleryEditor";
import { Link, useSearchParams } from "react-router-dom";
import type { Json } from "@/integrations/supabase/types";
import { mergeCmsContent } from "@/lib/cmsContent";
import { useStaffPortals } from "@/hooks/useStaffPortals";

type PageSlug = "site" | "home" | "services" | "about" | "support" | "faq" | "how-we-work" | "gallery" | "podcast" | "blog";

const pageConfig: { slug: PageSlug; label: string; icon: React.ReactNode; previewPath?: string }[] = [
  { slug: "site", label: "Site Settings", icon: <Settings className="h-4 w-4" /> },
  { slug: "home", label: "Home", icon: <Home className="h-4 w-4" />, previewPath: "/" },
  { slug: "services", label: "Services", icon: <Briefcase className="h-4 w-4" />, previewPath: "/services" },
  { slug: "about", label: "About", icon: <Info className="h-4 w-4" />, previewPath: "/about" },
  { slug: "support", label: "Support", icon: <HeadphonesIcon className="h-4 w-4" />, previewPath: "/support" },
  { slug: "faq", label: "FAQ", icon: <HelpCircle className="h-4 w-4" />, previewPath: "/faq" },
  { slug: "how-we-work", label: "How We Work", icon: <Cog className="h-4 w-4" />, previewPath: "/how-we-work" },
  { slug: "gallery", label: "Gallery", icon: <Image className="h-4 w-4" />, previewPath: "/gallery" },
  { slug: "podcast", label: "Podcast", icon: <Mic className="h-4 w-4" />, previewPath: "/podcast" },
  { slug: "blog", label: "Blog", icon: <BookOpen className="h-4 w-4" />, previewPath: "/blog" },
];

const marketingCmsSlugs = new Set<PageSlug>(["gallery", "podcast", "blog"]);
const supportCmsSlugs = new Set<PageSlug>(["faq"]);
const financeCmsSlugs = new Set<PageSlug>(["home"]);

const initialPageData: Record<PageSlug, unknown> = {
  site: cmsDefaults.site,
  home: cmsDefaults.home,
  services: cmsDefaults.services,
  about: cmsDefaults.about,
  support: cmsDefaults.support,
  faq: cmsDefaults.faq,
  "how-we-work": cmsDefaults["how-we-work"],
  gallery: cmsDefaults.gallery,
  podcast: cmsDefaults.podcast,
  blog: cmsDefaults.blog,
};

const CmsEditor = () => {
  const { user, userRole } = useAuthContext();
  const normalizedRole = userRole.toLowerCase();
  const isAdmin = normalizedRole === "admin";
  const isStaff = normalizedRole === "staff";
  const { assignedPortals, isLoading: isPortalLoading } = useStaffPortals(isStaff ? user?.id : undefined);
  const isMarketingCmsUser = isStaff && assignedPortals.includes("marketing");
  const isSupportCmsUser = isStaff && assignedPortals.includes("support");
  const isFinanceCmsUser = isStaff && assignedPortals.includes("finance");
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<PageSlug>("home");
  const [pageData, setPageData] = useState<Record<PageSlug, unknown>>(initialPageData);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const selectedTab = searchParams.get("tab") as PageSlug | null;
  const isAccessLoading = isStaff && isPortalLoading;

  const visiblePages = useMemo(() => {
    if (isAdmin) {
      return pageConfig;
    }

    if (isMarketingCmsUser) {
      return pageConfig.filter((page) => marketingCmsSlugs.has(page.slug));
    }

    if (isSupportCmsUser) {
      return pageConfig.filter((page) => supportCmsSlugs.has(page.slug));
    }

    if (isFinanceCmsUser) {
      return pageConfig.filter((page) => financeCmsSlugs.has(page.slug));
    }

    return [];
  }, [isAdmin, isFinanceCmsUser, isMarketingCmsUser, isSupportCmsUser]);

  const defaultData = useMemo(() => {
    return (cmsDefaults as Record<string, unknown>)[activeTab];
  }, [activeTab]);

  useEffect(() => {
    if (isAccessLoading) {
      return;
    }

    if (visiblePages.length === 0) {
      setIsLoading(false);
      return;
    }

    const loadAllPages = async () => {
      setIsLoading(true);
      const newPageData: Record<PageSlug, unknown> = { ...initialPageData };

      for (const page of visiblePages) {
        const { data } = await supabase
          .from("cms_pages")
          .select("data")
          .eq("slug", page.slug)
          .maybeSingle();
        
        const defaultContent = initialPageData[page.slug];
        newPageData[page.slug] = mergeCmsContent(defaultContent, data?.data ?? null);
      }

      setPageData(newPageData);
      setIsLoading(false);
    };

    loadAllPages();
  }, [isAccessLoading, visiblePages]);

  useEffect(() => {
    if (isAccessLoading || visiblePages.length === 0) {
      return;
    }

    const nextTab =
      selectedTab && visiblePages.some((page) => page.slug === selectedTab)
        ? selectedTab
        : visiblePages.some((page) => page.slug === activeTab)
          ? activeTab
          : visiblePages[0].slug;

    if (activeTab !== nextTab) {
      setActiveTab(nextTab);
    }

    if (selectedTab !== nextTab) {
      setSearchParams({ tab: nextTab }, { replace: true });
    }
  }, [activeTab, isAccessLoading, selectedTab, setSearchParams, visiblePages]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Check if page exists first
      const { data: existing } = await supabase
        .from("cms_pages")
        .select("id")
        .eq("slug", activeTab)
        .maybeSingle();

      let error;
      const dataToSave = pageData[activeTab] as Json;
      
      if (existing) {
        // Update existing
        const result = await supabase
          .from("cms_pages")
          .update({ data: dataToSave })
          .eq("slug", activeTab);
        error = result.error;
      } else {
        // Insert new
        const result = await supabase
          .from("cms_pages")
          .insert([{ slug: activeTab, data: dataToSave }]);
        error = result.error;
      }

      if (error) {
        toast.error("Failed to save content.");
        return;
      }
      toast.success("Content saved successfully!");
    } catch (error) {
      toast.error("An error occurred while saving.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setPageData((prev) => ({
      ...prev,
      [activeTab]: defaultData,
    }));
    toast.info("Reset to default values. Save to apply.");
  };

  const updatePageData = (slug: PageSlug, data: unknown) => {
    setPageData((prev) => ({ ...prev, [slug]: data }));
  };

  const currentPage = visiblePages.find((p) => p.slug === activeTab);

  const handleTabChange = (value: string) => {
    const nextTab = value as PageSlug;
    setActiveTab(nextTab);
    setSearchParams({ tab: nextTab }, { replace: true });
  };

  if (isAccessLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin && !isMarketingCmsUser && !isSupportCmsUser && !isFinanceCmsUser) {
    return (
      <div className="space-y-4 animate-fade-in">
        <h1 className="page-title">Content Management</h1>
        <p className="text-sm text-muted-foreground">
          Only admin users and assigned marketing, support, or finance staff can edit website content.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Visual CMS Editor</h1>
          <p className="text-sm text-muted-foreground">
            Edit your website content with the visual editor. Changes apply after saving.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {currentPage?.previewPath && (
            <Button variant="outline" asChild>
              <Link to={currentPage.previewPath} target="_blank">
                <Eye className="mr-2 h-4 w-4" />
                Preview
              </Link>
            </Button>
          )}
          <Button variant="outline" onClick={handleReset} disabled={isLoading}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset
          </Button>
          <Button onClick={handleSave} disabled={isLoading || isSaving}>
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Changes
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="mb-6 flex-wrap h-auto gap-1">
            {visiblePages.map((page) => (
              <TabsTrigger
                key={page.slug}
                value={page.slug}
                className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                {page.icon}
                <span className="hidden sm:inline">{page.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="site" className="mt-0">
            <SiteSettingsEditor
              data={pageData.site as CmsSiteData}
              onChange={(data) => updatePageData("site", data)}
            />
          </TabsContent>

          <TabsContent value="home" className="mt-0">
            <HomeEditor
              data={pageData.home as CmsHomeData}
              onChange={(data) => updatePageData("home", data)}
            />
          </TabsContent>

          <TabsContent value="services" className="mt-0">
            <ServicesEditor
              data={pageData.services as CmsServicesData}
              onChange={(data) => updatePageData("services", data)}
            />
          </TabsContent>

          <TabsContent value="about" className="mt-0">
            <AboutEditor
              data={pageData.about as CmsAboutData}
              onChange={(data) => updatePageData("about", data)}
            />
          </TabsContent>

          <TabsContent value="support" className="mt-0">
            <SupportEditor
              data={pageData.support as CmsSupportData}
              onChange={(data) => updatePageData("support", data)}
            />
          </TabsContent>

          <TabsContent value="faq" className="mt-0">
            <FaqEditor
              data={pageData.faq as CmsFaqData}
              onChange={(data) => updatePageData("faq", data)}
            />
          </TabsContent>

          <TabsContent value="how-we-work" className="mt-0">
            <HowWeWorkEditor
              data={pageData["how-we-work"] as CmsHowWeWorkData}
              onChange={(data) => updatePageData("how-we-work", data)}
            />
          </TabsContent>

          <TabsContent value="gallery" className="mt-0">
            <GalleryEditor
              data={pageData.gallery as CmsGalleryData}
              onChange={(data) => updatePageData("gallery", data)}
            />
          </TabsContent>

          <TabsContent value="podcast" className="mt-0">
            <PodcastEditor
              data={pageData.podcast as CmsPodcastData}
              onChange={(data) => updatePageData("podcast", data)}
            />
          </TabsContent>

          <TabsContent value="blog" className="mt-0">
            <BlogEditor
              data={pageData.blog as CmsBlogData}
              onChange={(data) => updatePageData("blog", data)}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default CmsEditor;
