export type MarketingCampaignMetricSource = {
  id: string;
  name: string;
  channel: string;
  status?: string;
  budget: number;
  spend: number;
  leads: number;
  revenue_attributed: number;
};

export type MarketingLeadMetricSource = {
  status: string;
  source?: string | null;
};

export type CampaignPerformanceRow = MarketingCampaignMetricSource & {
  cost: number;
  leadCount: number;
  costPerLead: number;
  roi: number;
  conversionRate: number;
  revenue: number;
  budgetAmount: number;
  convertedLeadCount: number;
};

const normalizeMarketingValue = (value: string | null | undefined) =>
  (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const sourceMatches = (source: string, target: string) =>
  !!source &&
  !!target &&
  (source === target || source.includes(target) || target.includes(source));

const getCampaignScopedLeads = (
  campaign: Pick<MarketingCampaignMetricSource, "name" | "channel">,
  leads: MarketingLeadMetricSource[],
) => {
  const normalizedName = normalizeMarketingValue(campaign.name);
  const normalizedChannel = normalizeMarketingValue(campaign.channel);

  const nameMatches = leads.filter((lead) =>
    sourceMatches(normalizeMarketingValue(lead.source), normalizedName),
  );

  if (nameMatches.length > 0) return nameMatches;

  return leads.filter((lead) =>
    sourceMatches(normalizeMarketingValue(lead.source), normalizedChannel),
  );
};

export const buildCampaignPerformanceRows = (
  campaigns: MarketingCampaignMetricSource[],
  leads: MarketingLeadMetricSource[],
): CampaignPerformanceRow[] => {
  const overallConvertedLeadCount = leads.filter((lead) => lead.status === "converted").length;
  const overallConversionRate = leads.length > 0 ? overallConvertedLeadCount / leads.length : 0;

  return campaigns.map((campaign) => {
    const scopedLeads = getCampaignScopedLeads(campaign, leads);
    const storedLeadCount = Number(campaign.leads || 0);
    const leadCount = storedLeadCount > 0 ? storedLeadCount : scopedLeads.length;
    const scopedConvertedLeadCount = scopedLeads.filter((lead) => lead.status === "converted").length;

    // Fall back to the overall conversion rate when lead sources are not tied to a campaign.
    const convertedLeadCount =
      scopedLeads.length > 0
        ? Math.min(scopedConvertedLeadCount, leadCount)
        : Math.min(Math.round(overallConversionRate * leadCount), leadCount);

    const cost = Number(campaign.spend || 0);
    const revenue = Number(campaign.revenue_attributed || 0);
    const budgetAmount = Number(campaign.budget || 0);
    const costPerLead = leadCount > 0 ? cost / leadCount : 0;
    const roi = cost > 0 ? ((revenue - cost) / cost) * 100 : 0;
    const conversionRate = leadCount > 0 ? (convertedLeadCount / leadCount) * 100 : 0;

    return {
      ...campaign,
      cost,
      leadCount,
      costPerLead,
      roi,
      conversionRate,
      revenue,
      budgetAmount,
      convertedLeadCount,
    };
  });
};

export const formatDurationFromSeconds = (value: number | null | undefined) => {
  const totalSeconds = Math.max(0, Math.round(Number(value || 0)));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};
