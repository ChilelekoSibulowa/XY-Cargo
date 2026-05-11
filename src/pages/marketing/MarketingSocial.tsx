import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DeleteDialog } from "@/components/shared/DeleteDialog";
import { CalendarClock, MessageSquare, Users, TrendingUp, Globe, Plus, Pencil, Trash2, RefreshCw, Send } from "lucide-react";
import { TablePagination, paginate } from "@/components/shared/TablePagination";
import { toast } from "sonner";

interface SocialPost {
  id: string;
  platform: string;
  content: string;
  scheduled_at: string | null;
  status: string;
  engagement_count: number;
  inquiry_count: number;
  link: string | null;
  image_url: string | null;
}

interface InfluencerRow {
  id: string;
  name: string;
  platform: string;
  status: string;
  notes: string | null;
}

interface SocialMetric {
  id: string;
  platform: string;
  followers: number;
  views: number | null;
  likes: number | null;
  reach: number | null;
  leads: number | null;
  engagements: number | null;
  clicks: number | null;
  engagement_rate: number;
  growth_rate: number;
  recorded_at: string;
}

const postFormDefaults = {
  platform: "Facebook",
  content: "",
  scheduled_at: "",
  status: "draft",
  engagement_count: "0",
  inquiry_count: "0",
  link: "",
  image_url: "",
};

const influencerDefaults = {
  name: "",
  platform: "Facebook",
  status: "active",
  notes: "",
};

const metricDefaults = {
  platform: "Facebook",
  followers: "0",
  views: "0",
  likes: "0",
  reach: "0",
  leads: "0",
  engagements: "0",
  clicks: "0",
  engagement_rate: "0",
  growth_rate: "0",
  recorded_at: "",
};

const platforms = ["Facebook", "Instagram", "TikTok", "LinkedIn", "X"];

const MarketingSocial = () => {
  const sb = supabase as any;
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [influencers, setInfluencers] = useState<InfluencerRow[]>([]);
  const [metrics, setMetrics] = useState<SocialMetric[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [postDialog, setPostDialog] = useState(false);
  const [postForm, setPostForm] = useState(postFormDefaults);
  const [editingPost, setEditingPost] = useState<SocialPost | null>(null);

  const [influencerDialog, setInfluencerDialog] = useState(false);
  const [influencerForm, setInfluencerForm] = useState(influencerDefaults);
  const [editingInfluencer, setEditingInfluencer] = useState<InfluencerRow | null>(null);

  const [metricDialog, setMetricDialog] = useState(false);
  const [metricForm, setMetricForm] = useState(metricDefaults);
  const [editingMetric, setEditingMetric] = useState<SocialMetric | null>(null);

  const [deleteItem, setDeleteItem] = useState<{ type: "post" | "influencer" | "metric"; id: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPublishing, setIsPublishing] = useState<string | null>(null);
  const [postsPage, setPostsPage] = useState(1);
  const [influencersPage, setInfluencersPage] = useState(1);
  const [metricsPage, setMetricsPage] = useState(1);

  const fetchAll = async () => {
    setIsLoading(true);
    const [postRes, influencerRes, metricRes] = await Promise.all([
      sb.from("marketing_social_posts").select("*").order("scheduled_at", { ascending: false }),
      sb.from("marketing_influencer_collaborations").select("*").order("created_at", { ascending: false }),
      sb.from("marketing_social_metrics").select("*").order("recorded_at", { ascending: false }),
    ]);

    setPosts((postRes.data || []) as SocialPost[]);
    setInfluencers((influencerRes.data || []) as InfluencerRow[]);
    setMetrics((metricRes.data || []) as SocialMetric[]);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchAll();
    // Auto-sync metrics from Meta on page load (silent, no toast on failure)
    supabase.functions.invoke("sync-social-metrics").then(({ error }) => {
      if (!error) fetchAll();
    }).catch(() => {});
  }, []);

  const scheduledPosts = posts.filter((post) => post.status === "scheduled").length;
  // Use synced metrics engagements (automatic from Meta), fall back to post-level counts
  const metricsEngagement = metrics.reduce((sum, row) => sum + Number(row.engagements || 0), 0);
  const postEngagement = posts.reduce((sum, post) => sum + (post.engagement_count || 0), 0);
  const engagementTotal = metricsEngagement > 0 ? metricsEngagement : postEngagement;
  // Use synced metrics leads as inquiries (automatic from Meta), fall back to post-level counts
  const metricsLeads = metrics.reduce((sum, row) => sum + Number(row.leads || 0), 0);
  const postInquiries = posts.reduce((sum, post) => sum + (post.inquiry_count || 0), 0);
  const inquiryTotal = metricsLeads > 0 ? metricsLeads : postInquiries;
  const activeInfluencers = influencers.filter((row) => row.status === "active").length;
  const totalFollowers = metrics.reduce((sum, row) => sum + Number(row.followers || 0), 0);
  const totalReach = metrics.reduce((sum, row) => sum + Number(row.reach || 0), 0);
  const totalWebsiteClicks = metrics.reduce((sum, row) => sum + Number(row.clicks || 0), 0);
  const totalLeads = metrics.reduce((sum, row) => sum + Number(row.leads || 0), 0);

  const growthRateAvg = metrics.length
    ? metrics.reduce((sum, row) => sum + (row.growth_rate || 0), 0) / metrics.length
    : 0;

  const handleSavePost = async () => {
    if (!postForm.content.trim()) {
      toast.error("Please enter post content");
      return;
    }

    const payload = {
      platform: postForm.platform,
      content: postForm.content.trim(),
      scheduled_at: postForm.scheduled_at ? new Date(postForm.scheduled_at).toISOString() : null,
      status: postForm.status,
      engagement_count: Number(postForm.engagement_count) || 0,
      inquiry_count: Number(postForm.inquiry_count) || 0,
      link: postForm.link.trim() || null,
      image_url: postForm.image_url.trim() || null,
    };

    const { error } = editingPost
      ? await sb.from("marketing_social_posts").update(payload).eq("id", editingPost.id)
      : await sb.from("marketing_social_posts").insert(payload);

    if (error) {
      toast.error(error.message || "Failed to save post");
    } else {
      toast.success(editingPost ? "Post updated" : "Post created");
      setPostDialog(false);
      setEditingPost(null);
      setPostForm(postFormDefaults);
      fetchAll();
    }
  };

  const handleSaveInfluencer = async () => {
    if (!influencerForm.name.trim()) {
      toast.error("Please enter influencer name");
      return;
    }

    const payload = {
      name: influencerForm.name.trim(),
      platform: influencerForm.platform,
      status: influencerForm.status,
      notes: influencerForm.notes.trim() ? influencerForm.notes.trim() : null,
    };

    const { error } = editingInfluencer
      ? await sb.from("marketing_influencer_collaborations").update(payload).eq("id", editingInfluencer.id)
      : await sb.from("marketing_influencer_collaborations").insert(payload);

    if (error) {
      toast.error(error.message || "Failed to save influencer");
    } else {
      toast.success(editingInfluencer ? "Influencer updated" : "Influencer created");
      setInfluencerDialog(false);
      setEditingInfluencer(null);
      setInfluencerForm(influencerDefaults);
      fetchAll();
    }
  };

  const handleSaveMetric = async () => {
    const payload = {
      platform: metricForm.platform,
      followers: Number(metricForm.followers) || 0,
      views: Number(metricForm.views) || 0,
      likes: Number(metricForm.likes) || 0,
      reach: Number(metricForm.reach) || 0,
      leads: Number(metricForm.leads) || 0,
      engagements: Number(metricForm.engagements) || 0,
      clicks: Number(metricForm.clicks) || 0,
      engagement_rate: Number(metricForm.engagement_rate) || 0,
      growth_rate: Number(metricForm.growth_rate) || 0,
      recorded_at: metricForm.recorded_at || new Date().toISOString().split("T")[0],
    };

    const { error } = editingMetric
      ? await sb.from("marketing_social_metrics").update(payload).eq("id", editingMetric.id)
      : await sb.from("marketing_social_metrics").insert(payload);

    if (error) {
      toast.error(error.message || "Failed to save metrics");
    } else {
      toast.success(editingMetric ? "Metrics updated" : "Metrics created");
      setMetricDialog(false);
      setEditingMetric(null);
      setMetricForm(metricDefaults);
      fetchAll();
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    setIsDeleting(true);

    const tableMap = {
      post: "marketing_social_posts",
      influencer: "marketing_influencer_collaborations",
      metric: "marketing_social_metrics",
    } as const;

    const { error } = await sb.from(tableMap[deleteItem.type]).delete().eq("id", deleteItem.id);

    if (error) {
      toast.error(error.message || "Failed to delete item");
    } else {
      toast.success("Item deleted");
      fetchAll();
    }
    setIsDeleting(false);
    setDeleteItem(null);
  };

  const handleSyncFromMeta = async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-social-metrics");
      if (error) {
        toast.error(error.message || "Failed to sync social metrics.");
      } else {
        const results = data?.results || [];
        toast.success(results.length > 0 ? results.join("; ") : "Sync completed.");
        fetchAll();
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to sync social metrics.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePublishPost = async (post: SocialPost) => {
    if (post.status === "posted") {
      toast.info("This post has already been published.");
      return;
    }
    if (!["Facebook", "Instagram"].includes(post.platform)) {
      toast.error(`Publishing to ${post.platform} is not supported yet. Only Facebook and Instagram are available.`);
      return;
    }

    setIsPublishing(post.id);
    try {
      const { data, error } = await supabase.functions.invoke("publish-social-post", {
        body: {
          post_id: post.id,
          platform: post.platform,
          content: post.content,
          link: post.link || undefined,
          image_url: post.image_url || undefined,
        },
      });

      if (error) {
        toast.error(error.message || "Failed to publish post.");
      } else if (data?.success) {
        toast.success(data.results?.join("; ") || "Post published successfully!");
        fetchAll();
      } else {
        toast.error(data?.results?.join("; ") || data?.error || "Failed to publish post.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to publish post.");
    } finally {
      setIsPublishing(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Social Media"  />
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 break-words [overflow-wrap:anywhere]"><CalendarClock className="h-4 w-4" /> Post Scheduler</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold break-all">{isLoading ? "..." : scheduledPosts}</p><p className="text-xs text-muted-foreground">Scheduled posts</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 break-words [overflow-wrap:anywhere]"><Users className="h-4 w-4" /> Total Followers</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold break-all">{isLoading ? "..." : totalFollowers.toLocaleString()}</p><p className="text-xs text-muted-foreground">Across all platforms</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 break-words [overflow-wrap:anywhere]"><TrendingUp className="h-4 w-4" /> Total Reach</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold break-all">{isLoading ? "..." : totalReach.toLocaleString()}</p><p className="text-xs text-muted-foreground">Audience reached</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 break-words [overflow-wrap:anywhere]"><Globe className="h-4 w-4" /> Website Clicks</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold break-all">{isLoading ? "..." : totalWebsiteClicks.toLocaleString()}</p><p className="text-xs text-muted-foreground">From social channels</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 break-words [overflow-wrap:anywhere]"><MessageSquare className="h-4 w-4" /> Total Leads</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold break-all">{isLoading ? "..." : totalLeads.toLocaleString()}</p><p className="text-xs text-muted-foreground">Generated from social</p></CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Total Engagement</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{isLoading ? "..." : engagementTotal.toLocaleString()}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Inquiries</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{isLoading ? "..." : inquiryTotal.toLocaleString()}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Active Influencers</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{isLoading ? "..." : activeInfluencers}</p><p className="text-xs text-muted-foreground">Average growth {growthRateAvg.toFixed(1)}%</p></CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Post Scheduler</CardTitle>
            <Button size="sm" variant="outline" onClick={() => { setEditingPost(null); setPostForm(postFormDefaults); setPostDialog(true); }}>
              <Plus className="mr-2 h-4 w-4" /> Add Post
            </Button>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3">Platform</th>
                  <th className="text-left p-3">Content</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Scheduled</th>
                  <th className="text-left p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginate(posts, postsPage).map((post) => (
                  <tr key={post.id} className="border-b hover:bg-muted/30">
                    <td className="p-3">{post.platform}</td>
                    <td className="p-3 text-muted-foreground">{post.content}</td>
                    <td className="p-3">{post.status}</td>
                    <td className="p-3 text-muted-foreground">{post.scheduled_at ? new Date(post.scheduled_at).toLocaleDateString() : "-"}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {["Facebook", "Instagram"].includes(post.platform) && post.status !== "posted" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-primary"
                            title={`Publish to ${post.platform}`}
                            disabled={isPublishing === post.id}
                            onClick={() => handlePublishPost(post)}
                          >
                            <Send className={`h-4 w-4 ${isPublishing === post.id ? "animate-pulse" : ""}`} />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" onClick={() => { setEditingPost(post); setPostForm({
                          platform: post.platform,
                          content: post.content,
                          scheduled_at: post.scheduled_at ? post.scheduled_at.slice(0, 16) : "",
                          status: post.status,
                          engagement_count: String(post.engagement_count ?? 0),
                          inquiry_count: String(post.inquiry_count ?? 0),
                          link: post.link || "",
                          image_url: post.image_url || "",
                        }); setPostDialog(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setDeleteItem({ type: "post", id: post.id })}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {posts.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-muted-foreground">No posts scheduled yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
            <TablePagination currentPage={postsPage} totalPages={Math.max(1, Math.ceil(posts.length / 20))} onPageChange={setPostsPage} totalItems={posts.length} pageSize={20} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Influencer Collaborations</CardTitle>
            <Button size="sm" variant="outline" onClick={() => { setEditingInfluencer(null); setInfluencerForm(influencerDefaults); setInfluencerDialog(true); }}>
              <Plus className="mr-2 h-4 w-4" /> Add Influencer
            </Button>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3">Name</th>
                  <th className="text-left p-3">Platform</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginate(influencers, influencersPage).map((row) => (
                  <tr key={row.id} className="border-b hover:bg-muted/30">
                    <td className="p-3 font-medium">{row.name}</td>
                    <td className="p-3">{row.platform}</td>
                    <td className="p-3">{row.status}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Button size="icon" variant="ghost" onClick={() => { setEditingInfluencer(row); setInfluencerForm({
                          name: row.name,
                          platform: row.platform,
                          status: row.status,
                          notes: row.notes || "",
                        }); setInfluencerDialog(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setDeleteItem({ type: "influencer", id: row.id })}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {influencers.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-muted-foreground">No influencers yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
            <TablePagination currentPage={influencersPage} totalPages={Math.max(1, Math.ceil(influencers.length / 20))} onPageChange={setInfluencersPage} totalItems={influencers.length} pageSize={20} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Social Growth Metrics</CardTitle>
          <Button size="sm" variant="outline" onClick={handleSyncFromMeta} disabled={isSyncing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} /> {isSyncing ? "Syncing..." : "Sync from Meta"}
          </Button>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full min-w-[1600px] text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3">Platform</th>
                <th className="text-left p-3">Followers</th>
                <th className="text-left p-3">Views</th>
                <th className="text-left p-3">Likes</th>
                <th className="text-left p-3">Reach</th>
                <th className="text-left p-3">Leads</th>
                <th className="text-left p-3">Engagement</th>
                <th className="text-left p-3">Engagement Rate</th>
                <th className="text-left p-3">Clicks</th>
                <th className="text-left p-3">Growth Rate</th>
                <th className="text-left p-3">Date</th>
                <th className="text-left p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginate(metrics, metricsPage).map((metric) => (
                <tr key={metric.id} className="border-b hover:bg-muted/30">
                  <td className="p-3">{metric.platform}</td>
                  <td className="p-3">{metric.followers}</td>
                  <td className="p-3">{metric.views ?? 0}</td>
                  <td className="p-3">{metric.likes ?? 0}</td>
                  <td className="p-3">{metric.reach ?? 0}</td>
                  <td className="p-3">{metric.leads ?? 0}</td>
                  <td className="p-3">{metric.engagements ?? 0}</td>
                  <td className="p-3">{metric.engagement_rate}%</td>
                  <td className="p-3">{metric.clicks ?? 0}</td>
                  <td className="p-3">{metric.growth_rate}%</td>
                  <td className="p-3 text-muted-foreground">{metric.recorded_at}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <Button size="icon" variant="ghost" onClick={() => { setEditingMetric(metric); setMetricForm({
                        platform: metric.platform,
                        followers: String(metric.followers ?? 0),
                        views: String(metric.views ?? 0),
                        likes: String(metric.likes ?? 0),
                        reach: String(metric.reach ?? 0),
                        leads: String(metric.leads ?? 0),
                        engagements: String(metric.engagements ?? 0),
                        clicks: String(metric.clicks ?? 0),
                        engagement_rate: String(metric.engagement_rate ?? 0),
                        growth_rate: String(metric.growth_rate ?? 0),
                        recorded_at: metric.recorded_at,
                      }); setMetricDialog(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setDeleteItem({ type: "metric", id: metric.id })}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {metrics.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={12} className="p-6 text-center text-muted-foreground">No metrics captured yet.</td>
                </tr>
              )}
            </tbody>
          </table>
          <TablePagination currentPage={metricsPage} totalPages={Math.max(1, Math.ceil(metrics.length / 20))} onPageChange={setMetricsPage} totalItems={metrics.length} pageSize={20} />
        </CardContent>
      </Card>

      <Dialog open={postDialog} onOpenChange={setPostDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPost ? "Edit Post" : "Add Post"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Platform</Label>
              <Select value={postForm.platform} onValueChange={(value) => setPostForm({ ...postForm, platform: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {platforms.map((platform) => (
                    <SelectItem key={platform} value={platform}>{platform}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Content</Label>
              <Textarea value={postForm.content} onChange={(e) => setPostForm({ ...postForm, content: e.target.value })} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Scheduled At</Label>
                <Input type="datetime-local" value={postForm.scheduled_at} onChange={(e) => setPostForm({ ...postForm, scheduled_at: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={postForm.status} onValueChange={(value) => setPostForm({ ...postForm, status: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="posted">Posted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Engagement Count</Label>
                <Input type="number" min="0" value={postForm.engagement_count} onChange={(e) => setPostForm({ ...postForm, engagement_count: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Inquiry Count</Label>
                <Input type="number" min="0" value={postForm.inquiry_count} onChange={(e) => setPostForm({ ...postForm, inquiry_count: e.target.value })} />
              </div>
            </div>
            {["Facebook", "Instagram"].includes(postForm.platform) && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Link URL (Facebook)</Label>
                  <Input placeholder="https://..." value={postForm.link} onChange={(e) => setPostForm({ ...postForm, link: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Image URL (required for Instagram)</Label>
                  <Input placeholder="https://..." value={postForm.image_url} onChange={(e) => setPostForm({ ...postForm, image_url: e.target.value })} />
                </div>
              </div>
            )}
            <Button onClick={handleSavePost}>{editingPost ? "Update Post" : "Create Post"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={influencerDialog} onOpenChange={setInfluencerDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingInfluencer ? "Edit Influencer" : "Add Influencer"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={influencerForm.name} onChange={(e) => setInfluencerForm({ ...influencerForm, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Platform</Label>
              <Select value={influencerForm.platform} onValueChange={(value) => setInfluencerForm({ ...influencerForm, platform: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {platforms.map((platform) => (
                    <SelectItem key={platform} value={platform}>{platform}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={influencerForm.status} onValueChange={(value) => setInfluencerForm({ ...influencerForm, status: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={influencerForm.notes} onChange={(e) => setInfluencerForm({ ...influencerForm, notes: e.target.value })} />
            </div>
            <Button onClick={handleSaveInfluencer}>{editingInfluencer ? "Update Influencer" : "Create Influencer"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={metricDialog} onOpenChange={setMetricDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingMetric ? "Edit Metric" : "Add Metric"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Platform</Label>
              <Select value={metricForm.platform} onValueChange={(value) => setMetricForm({ ...metricForm, platform: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {platforms.map((platform) => (
                    <SelectItem key={platform} value={platform}>{platform}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Followers</Label>
                <Input type="number" min="0" value={metricForm.followers} onChange={(e) => setMetricForm({ ...metricForm, followers: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Views</Label>
                <Input type="number" min="0" value={metricForm.views} onChange={(e) => setMetricForm({ ...metricForm, views: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Likes</Label>
                <Input type="number" min="0" value={metricForm.likes} onChange={(e) => setMetricForm({ ...metricForm, likes: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Reach</Label>
                <Input type="number" min="0" value={metricForm.reach} onChange={(e) => setMetricForm({ ...metricForm, reach: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Leads</Label>
                <Input type="number" min="0" value={metricForm.leads} onChange={(e) => setMetricForm({ ...metricForm, leads: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Engagement</Label>
                <Input type="number" min="0" value={metricForm.engagements} onChange={(e) => setMetricForm({ ...metricForm, engagements: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Clicks</Label>
                <Input type="number" min="0" value={metricForm.clicks} onChange={(e) => setMetricForm({ ...metricForm, clicks: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Engagement Rate</Label>
                <Input type="number" min="0" max="100" value={metricForm.engagement_rate} onChange={(e) => setMetricForm({ ...metricForm, engagement_rate: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Growth Rate</Label>
                <Input type="number" min="0" max="100" value={metricForm.growth_rate} onChange={(e) => setMetricForm({ ...metricForm, growth_rate: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={metricForm.recorded_at} onChange={(e) => setMetricForm({ ...metricForm, recorded_at: e.target.value })} />
              </div>
            </div>
            <Button onClick={handleSaveMetric}>{editingMetric ? "Update Metric" : "Create Metric"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <DeleteDialog
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        title="Delete Item"
        description="Are you sure you want to delete this item?"
      />
    </div>
  );
};

export default MarketingSocial;

