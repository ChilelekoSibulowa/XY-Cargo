export const toCurrencyNumber = (value: unknown, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

export const roundCurrencyAmount = (value: unknown) => {
  const numeric = toCurrencyNumber(value);
  return Math.round((numeric + Number.EPSILON) * 100) / 100;
};

export const removeMinorWholeAmountDrift = (value: unknown) => {
  const numeric = roundCurrencyAmount(value);
  const nearestWhole = Math.round(numeric);

  return Math.abs(numeric - nearestWhole) <= 0.25 ? nearestWhole : numeric;
};

export const formatCurrencyDisplay = (
  amount: unknown,
  currencyCode: string,
  currencySymbol: string,
) => {
  const rounded = roundCurrencyAmount(amount);
  const hasDecimals = Math.abs(rounded - Math.trunc(rounded)) > 0.000001;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  })
    .format(rounded)
    .replace(currencyCode, currencySymbol);
};
