import type { ProductTypeOption } from "@/hooks/useProductTypes";

export type PublicShippingRate = {
  id: string;
  name: string;
  service_type: "air" | "sea";
  rate_per_kg: number | null;
  rate_per_cbm: number | null;
  minimum_charge: number | null;
};

const normalizeText = (value: string | null | undefined) =>
  (value || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const productAliases: Record<string, string[]> = {
  "mobile phones": ["phones", "mobile phones", "phone", "smartphones"],
  phones: ["phones", "mobile phones", "phone", "smartphones"],
  "wigs and hair": ["wigs", "wigs and hair", "wigs and hair products", "hair products"],
  "wigs and hair products": ["wigs", "wigs and hair", "wigs and hair products", "hair products"],
  "normal goods": ["normal goods", "normal good", "normal"],
  "general goods": ["general goods", "general"],
  "special goods": ["special goods", "special"],
  "light goods": ["light goods", "light"],
};

const getProductOptionKey = (label: string) => {
  const normalizedLabel = normalizeText(label);

  const aliasGroup = Object.entries(productAliases).find(([canonical, aliases]) => {
    const normalizedAliases = [canonical, ...aliases].map(normalizeText);
    return normalizedAliases.includes(normalizedLabel);
  });

  return aliasGroup ? normalizeText(aliasGroup[0]) : normalizedLabel;
};

export const getDestinationKey = (destination: string) => {
  const normalized = normalizeText(destination);
  if (normalized.includes("ndola") || normalized.includes("kitwe")) return "kitwe-ndola";
  if (normalized.includes("livingstone")) return "livingstone";
  return "lusaka";
};

export const getRateProductLabel = (rateName: string) =>
  rateName
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();

export const rateMatchesDestination = (rate: PublicShippingRate, destination: string) => {
  const destinationKey = getDestinationKey(destination);
  const normalizedName = normalizeText(rate.name);

  if (destinationKey === "kitwe-ndola") {
    return normalizedName.includes("kitwe") || normalizedName.includes("ndola");
  }

  return normalizedName.includes(destinationKey);
};

export const getRateBasis = (
  rate: PublicShippingRate | null | undefined,
  serviceType: "air" | "sea",
): "kg" | "cbm" => {
  if (serviceType === "air") {
    return "kg";
  }

  return (rate?.rate_per_cbm || 0) > 0 ? "cbm" : "kg";
};

export const getRateValue = (rate: PublicShippingRate | null | undefined, serviceType: "air" | "sea") => {
  const basis = getRateBasis(rate, serviceType);
  return basis === "cbm" ? rate?.rate_per_cbm || 0 : rate?.rate_per_kg || 0;
};

const hasUsableRate = (rate: PublicShippingRate, serviceType: "air" | "sea") => {
  if (serviceType === "air") {
    return (rate.rate_per_kg || 0) > 0;
  }

  return (rate.rate_per_kg || 0) > 0 || (rate.rate_per_cbm || 0) > 0;
};

const productMatchesRate = (rate: PublicShippingRate, productType: string) => {
  const selectedProduct = normalizeText(productType);
  const rateProduct = normalizeText(getRateProductLabel(rate.name));

  if (!selectedProduct) return false;
  if (selectedProduct === rateProduct) return true;
  if (selectedProduct.includes(rateProduct) || rateProduct.includes(selectedProduct)) return true;

  const selectedAliases = new Set([selectedProduct, ...(productAliases[selectedProduct] || [])].map(normalizeText));
  const rateAliases = new Set([rateProduct, ...(productAliases[rateProduct] || [])].map(normalizeText));

  return [...selectedAliases].some((alias) => rateAliases.has(alias));
};

export const getSystemProductTypeOptions = (
  rates: PublicShippingRate[],
  serviceType: "air" | "sea",
) => {
  const seen = new Set<string>();
  const serviceRates = rates.filter((rate) => rate.service_type === serviceType);

  return serviceRates
    .filter((rate) => hasUsableRate(rate, serviceType))
    .reduce<ProductTypeOption[]>((options, rate) => {
      const label = getRateProductLabel(rate.name);
      const key = normalizeText(label);

      if (!key || seen.has(key)) {
        return options;
      }

      seen.add(key);
      options.push({ id: rate.id, value: label, label });
      return options;
    }, []);
};

export const mergeProductTypeOptions = (...optionGroups: ProductTypeOption[][]) => {
  const seenExact = new Set<string>();
  const seenAlias = new Set<string>();
  const [primaryOptions = [], ...extraGroups] = optionGroups;
  const mergedOptions: ProductTypeOption[] = [];

  const addOption = (option: ProductTypeOption, dedupeAliases: boolean) => {
    const exactKey = normalizeText(option.label || option.value);
    const aliasKey = getProductOptionKey(option.label || option.value);

    if (!exactKey || seenExact.has(exactKey) || (dedupeAliases && seenAlias.has(aliasKey))) {
      return;
    }

    seenExact.add(exactKey);
    seenAlias.add(aliasKey);
    mergedOptions.push(option);
  };

  primaryOptions.forEach((option) => addOption(option, false));
  extraGroups.flat().forEach((option) => addOption(option, true));

  return mergedOptions;
};

export const selectSystemShippingRate = (
  rates: PublicShippingRate[],
  serviceType: "air" | "sea",
  destination: string,
  productType: string,
) => {
  const serviceRates = rates
    .filter((rate) => rate.service_type === serviceType)
    .filter((rate) => hasUsableRate(rate, serviceType));
  const destinationRates = serviceRates.filter((rate) => rateMatchesDestination(rate, destination));
  const scopedRates = destinationRates.length > 0 ? destinationRates : serviceRates;

  if (!productType) {
    return scopedRates[0] || null;
  }

  return scopedRates.find((rate) => productMatchesRate(rate, productType)) || null;
};
