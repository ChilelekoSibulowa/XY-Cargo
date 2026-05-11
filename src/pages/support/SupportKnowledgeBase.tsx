import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, Column } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format } from "date-fns";

type CmsRow = {
  slug: string;
  updated_at: string;
};

const SupportKnowledgeBase = () => {
  const [pages, setPages] = useState<CmsRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPages = async () => {
      const { data, error } = await supabase
        .from("cms_pages")
        .select("slug, updated_at")
        .order("updated_at", { ascending: false });

      if (error) {
        toast.error("Failed to load knowledge base pages.");
        setPages([]);
      } else {
        setPages((data || []) as CmsRow[]);
      }
      setIsLoading(false);
    };

    fetchPages();
  }, []);

  const supportPages = useMemo(
    () =>
      pages.filter((page) => {
        const slug = page.slug.toLowerCase();
        return slug.includes("support") || slug.includes("faq") || slug.includes("help");
      }),
    [pages],
  );

  const columns: Column<CmsRow>[] = [
    { key: "slug", label: "Slug" },
    {
      key: "updated_at",
      label: "Last Updated",
      render: (item) => format(new Date(item.updated_at), "PP"),
    },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Knowledge Base"
        
        actions={
          <Button asChild>
            <Link to="/settings/content">Open CMS Editor</Link>
          </Button>
        }
      />
      <DataTable
        columns={columns}
        data={supportPages}
        isLoading={isLoading}
        searchPlaceholder="Search support pages..."
      />
    </div>
  );
};

export default SupportKnowledgeBase;

