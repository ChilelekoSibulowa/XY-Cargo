import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, Column } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { cmsDefaults, CmsBlogData, CmsGalleryData, CmsPodcastData } from "@/content/cmsDefaults";
import { mergeCmsContent } from "@/lib/cmsContent";

type CmsPageRow = {
  slug: string;
  updated_at: string;
  data: unknown;
};

type ContentSummary = {
  slug: "blog" | "podcast" | "gallery";
  title: string;
  description: string;
  itemLabel: string;
  entryCount: number;
  updated_at: string | null;
  manageTo: string;
};

const contentAreas: Omit<ContentSummary, "entryCount" | "updated_at">[] = [
  {
    slug: "blog",
    title: "Blogs",
    description: "Create blog titles, featured images, and full story content.",
    itemLabel: "Posts",
    manageTo: "/settings/content?tab=blog",
  },
  {
    slug: "podcast",
    title: "Podcasts",
    description: "Publish podcast entries with a title, description, and YouTube embed URL.",
    itemLabel: "Episodes",
    manageTo: "/settings/content?tab=podcast",
  },
  {
    slug: "gallery",
    title: "Gallery",
    description: "Upload gallery images with titles and captions for the live website.",
    itemLabel: "Images",
    manageTo: "/settings/content?tab=gallery",
  },
];

const MarketingContent = () => {
  const [pages, setPages] = useState<ContentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPages = async () => {
      const { data } = await supabase
        .from("cms_pages")
        .select("slug, updated_at, data")
        .in("slug", contentAreas.map((area) => area.slug))
        .order("updated_at", { ascending: false });

      const rowMap = new Map(
        ((data || []) as CmsPageRow[]).map((row) => [row.slug, row])
      );

      const summaries = contentAreas.map((area) => {
        const row = rowMap.get(area.slug);

        let entryCount = 0;

        if (area.slug === "blog") {
          const content = mergeCmsContent(cmsDefaults.blog, row?.data) as CmsBlogData;
          entryCount = content.posts.length;
        } else if (area.slug === "podcast") {
          const content = mergeCmsContent(cmsDefaults.podcast, row?.data) as CmsPodcastData;
          entryCount = content.episodes.length;
        } else {
          const content = mergeCmsContent(cmsDefaults.gallery, row?.data) as CmsGalleryData;
          entryCount = content.items.length;
        }

        return {
          ...area,
          entryCount,
          updated_at: row?.updated_at ?? null,
        };
      });

      setPages(summaries);
      setIsLoading(false);
    };

    fetchPages();
  }, []);

  const columns: Column<ContentSummary>[] = [
    { key: "title", label: "Content Type" },
    {
      key: "entryCount",
      label: "Published Items",
      render: (item) => `${item.entryCount} ${item.itemLabel.toLowerCase()}`,
    },
    {
      key: "updated_at",
      label: "Last Updated",
      render: (item) => (item.updated_at ? format(new Date(item.updated_at), "PP") : "Not published yet"),
    },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Content"
        
        actions={
          <Button asChild>
            <Link to="/settings/content?tab=blog">Open CMS Editor</Link>
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        {pages.map((area) => (
          <Card key={area.slug}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{area.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{area.description}</p>
              <div className="mt-4 flex items-end justify-between gap-3">
                <div>
                  <p className="text-2xl font-semibold">{area.entryCount}</p>
                  <p className="text-xs text-muted-foreground">{area.itemLabel}</p>
                </div>
                <p className="text-xs text-muted-foreground text-right">
                  {area.updated_at ? `Updated ${format(new Date(area.updated_at), "PP")}` : "No entries yet"}
                </p>
              </div>
              <div className="mt-3">
                <Button asChild size="sm" variant="outline">
                  <Link to={area.manageTo}>Manage</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Live Content Status</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={pages}
            isLoading={isLoading}
            searchPlaceholder="Search content..."
            editLink={(item) => item.manageTo}
            keyField="slug"
            enablePagination={false}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default MarketingContent;

