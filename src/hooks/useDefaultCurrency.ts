import { useCurrency } from "@/hooks/useCurrencyContext";

/**
 * Returns the currently selected currency (code + symbol) and a format helper.
 * Delegates to the global CurrencyProvider so switching currencies
 * updates the symbol AND converts values everywhere in the system.
 */
export const useDefaultCurrency = () => {
  const {
    selectedCurrency,
    defaultCurrency,
    convert,
    convertFromSelected,
    formatAmount,
  } = useCurrency();

  const safeSelectedCurrency = selectedCurrency ?? { code: "USD", symbol: "$", exchange_rate: 1 };
  const safeDefaultCurrency = defaultCurrency ?? safeSelectedCurrency;

  return {
    code: safeSelectedCurrency.code,
    symbol: safeSelectedCurrency.symbol,
    defaultCode: safeDefaultCurrency.code,
    /** Convert an amount from base currency to selected currency */
    convert,
    /** Convert an amount from the selected currency back to the default/base currency */
    convertFromSelected,
    /** Format an amount with the selected currency symbol */
    formatAmount,
  };
};
