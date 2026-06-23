import type { ProductTypeOption } from "@/hooks/useProductTypes";

export const fallbackProductTypeOptions: Record<"air" | "sea", ProductTypeOption[]> = {
  air: [
    { id: "fallback-air-normal-goods", value: "Normal goods", label: "Normal goods" },
    { id: "fallback-air-wigs", value: "Wigs", label: "Wigs" },
    { id: "fallback-air-wigs-hair", value: "Wigs and Hair", label: "Wigs and Hair" },
    { id: "fallback-air-phones", value: "Phones", label: "Phones" },
    { id: "fallback-air-mobile-phones", value: "Mobile Phones", label: "Mobile Phones" },
    {
      id: "fallback-air-battery-cosmetics-toner-medicine",
      value: "Battery/Cosmetics/Toner/Medicine",
      label: "Battery/Cosmetics/Toner/Medicine",
    },
    { id: "fallback-air-laptops-ipads", value: "Laptops & iPads", label: "Laptops & iPads" },
  ],
  sea: [
    { id: "fallback-sea-general-goods", value: "General Goods", label: "General Goods" },
    { id: "fallback-sea-special-goods", value: "Special Goods", label: "Special Goods" },
  ],
};
