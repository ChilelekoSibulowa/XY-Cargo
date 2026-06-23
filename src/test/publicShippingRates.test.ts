import { describe, expect, it } from "vitest";
import {
  getRateBasis,
  getRateValue,
  getSystemProductTypeOptions,
  mergeProductTypeOptions,
  PublicShippingRate,
  selectSystemShippingRate,
} from "@/lib/publicShippingRates";

const rates: PublicShippingRate[] = [
  {
    id: "motorcycle-lusaka",
    name: "Motorcycle(Lusaka)",
    service_type: "air",
    rate_per_kg: null,
    rate_per_cbm: 330,
    minimum_charge: 4,
  },
  {
    id: "normal-lusaka",
    name: "Normal Goods (Lusaka)",
    service_type: "air",
    rate_per_kg: 14.5,
    rate_per_cbm: null,
    minimum_charge: 4,
  },
  {
    id: "normal-ndola",
    name: "Normal Goods (Kitwe/Ndola)",
    service_type: "air",
    rate_per_kg: 16.5,
    rate_per_cbm: null,
    minimum_charge: 4,
  },
  {
    id: "wigs-ndola",
    name: "Wigs & Hair Products (Kitwe/Ndola)",
    service_type: "air",
    rate_per_kg: 18,
    rate_per_cbm: null,
    minimum_charge: 4,
  },
  {
    id: "general-lusaka",
    name: "General Goods (Lusaka)",
    service_type: "sea",
    rate_per_kg: null,
    rate_per_cbm: 340,
    minimum_charge: 4,
  },
  {
    id: "phones-lusaka",
    name: "Phones (Lusaka)",
    service_type: "sea",
    rate_per_kg: 16,
    rate_per_cbm: null,
    minimum_charge: 4,
  },
  {
    id: "special-lusaka",
    name: "Special Goods (Lusaka)",
    service_type: "sea",
    rate_per_kg: null,
    rate_per_cbm: 370,
    minimum_charge: 4,
  },
];

describe("public shipping rate selection", () => {
  it("selects the configured air product rate instead of the first destination row", () => {
    const selected = selectSystemShippingRate(rates, "air", "zambia-lusaka", "Normal Goods");

    expect(selected?.id).toBe("normal-lusaka");
    expect(getRateBasis(selected, "air")).toBe("kg");
    expect(getRateValue(selected, "air")).toBe(14.5);
  });

  it("matches product and destination for air rates", () => {
    const selected = selectSystemShippingRate(rates, "air", "zambia-ndola", "Wigs and Hair");

    expect(selected?.id).toBe("wigs-ndola");
    expect(getRateValue(selected, "air")).toBe(18);
  });

  it("uses CBM for sea products configured with a CBM rate", () => {
    const selected = selectSystemShippingRate(rates, "sea", "zambia-lusaka", "Special Goods");

    expect(selected?.id).toBe("special-lusaka");
    expect(getRateBasis(selected, "sea")).toBe("cbm");
    expect(getRateValue(selected, "sea")).toBe(370);
  });

  it("uses KG for sea products configured with a KG rate", () => {
    const selected = selectSystemShippingRate(rates, "sea", "zambia-lusaka", "Mobile Phones");

    expect(selected?.id).toBe("phones-lusaka");
    expect(getRateBasis(selected, "sea")).toBe("kg");
    expect(getRateValue(selected, "sea")).toBe(16);
  });

  it("does not reuse another product rate when the selected product has no matching system rate", () => {
    const selected = selectSystemShippingRate(rates, "air", "zambia-lusaka", "Laptops & iPads");

    expect(selected).toBeNull();
  });

  it("builds product options only from usable rates for the selected service type", () => {
    const options = getSystemProductTypeOptions(rates, "air").map((option) => option.label);

    expect(options).toContain("Normal Goods");
    expect(options).toContain("Wigs & Hair Products");
    expect(options).not.toContain("Motorcycle");
    expect(options).not.toContain("General Goods");
  });

  it("merges configured and system product options without duplicating product aliases", () => {
    const configuredOptions = [
      { id: "configured-normal", value: "Normal Goods", label: "Normal Goods" },
      { id: "configured-mobile", value: "Mobile Phones", label: "Mobile Phones" },
      { id: "configured-laptops", value: "Laptops & iPads", label: "Laptops & iPads" },
    ];
    const systemOptions = getSystemProductTypeOptions(rates, "sea");
    const options = mergeProductTypeOptions(configuredOptions, systemOptions).map((option) => option.label);

    expect(options).toContain("Mobile Phones");
    expect(options).toContain("Laptops & iPads");
    expect(options).toContain("General Goods");
    expect(options).toContain("Special Goods");
    expect(options).not.toContain("Phones");
  });

  it("keeps configured options even when configured labels are aliases of each other", () => {
    const options = mergeProductTypeOptions([
      { id: "configured-wigs", value: "Wigs", label: "Wigs" },
      { id: "configured-wigs-hair", value: "Wigs and Hair", label: "Wigs and Hair" },
    ]).map((option) => option.label);

    expect(options).toEqual(["Wigs", "Wigs and Hair"]);
  });
});
