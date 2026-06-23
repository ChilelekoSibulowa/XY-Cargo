import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CurrencyInfo = {
  code: string;
  symbol: string;
  exchange_rate: number;
};

type CurrencyContextType = {
  currencies: CurrencyInfo[];
  selectedCurrency: CurrencyInfo;
  defaultCurrency: CurrencyInfo;
  setSelectedCurrency: (currency: CurrencyInfo) => void;
  convert: (amount: number, fromCode?: string) => number;
  convertFromSelected: (amount: number, toCode?: string) => number;
  formatAmount: (amount: number, fromCode?: string) => string;
  isLoading: boolean;
};

const fallbackCurrency: CurrencyInfo = { code: "USD", symbol: "$", exchange_rate: 1 };

const safeReadStoredCurrencyCode = () => {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

const safeWriteStoredCurrencyCode = (code: string) => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // Ignore storage failures so the app keeps working.
  }
};

const CurrencyContext = createContext<CurrencyContextType>({
  currencies: [fallbackCurrency],
  selectedCurrency: fallbackCurrency,
  defaultCurrency: fallbackCurrency,
  setSelectedCurrency: () => {},
  convert: (amount) => amount,
  convertFromSelected: (amount) => amount,
  formatAmount: (amount) => `$${amount.toFixed(2)}`,
  isLoading: true,
});

export const useCurrency = () => useContext(CurrencyContext);

const STORAGE_KEY = "selected_currency_code";

export const CurrencyProvider = ({ children }: { children: ReactNode }) => {
  const [currencies, setCurrencies] = useState<CurrencyInfo[]>([fallbackCurrency]);
  const [selectedCurrency, setSelectedCurrencyState] = useState<CurrencyInfo>(fallbackCurrency);
  const [defaultCurrency, setDefaultCurrency] = useState<CurrencyInfo>(fallbackCurrency);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadCurrencies = async () => {
      try {
        const { data } = await supabase
          .from("currencies")
          .select("code, symbol, exchange_rate, is_default, is_active")
          .eq("is_active", true)
          .order("code");

        if (data && data.length > 0) {
          const mapped: CurrencyInfo[] = data.map((row) => ({
            code: row.code,
            symbol: row.symbol || row.code,
            exchange_rate: row.exchange_rate || 1,
          }));

          setCurrencies(mapped);

          const defaultRow = data.find((row) => row.is_default);
          const defaultCurr = defaultRow
            ? { code: defaultRow.code, symbol: defaultRow.symbol || "$", exchange_rate: defaultRow.exchange_rate || 1 }
            : mapped[0];
          setDefaultCurrency(defaultCurr);

          const savedCode = safeReadStoredCurrencyCode();
          const savedCurrency = savedCode ? mapped.find((c) => c.code === savedCode) : null;
          setSelectedCurrencyState(savedCurrency || defaultCurr);
        }
      } catch {
        // Fall back to the default in-memory currency to avoid startup crashes.
      } finally {
        setIsLoading(false);
      }
    };

    loadCurrencies();
  }, []);

  const setSelectedCurrency = (currency: CurrencyInfo) => {
    setSelectedCurrencyState(currency);
    safeWriteStoredCurrencyCode(currency.code);
  };

  const convertBetween = (amount: number, fromCode: string, toCode: string): number => {
    if (fromCode === toCode) {
      return amount;
    }

    const fromCurrency = currencies.find((c) => c.code === fromCode) || defaultCurrency;
    const toCurrency = currencies.find((c) => c.code === toCode) || selectedCurrency;

    // If exchange rates are identical, don't perform math to avoid floating point drift
    if (fromCurrency.exchange_rate === toCurrency.exchange_rate) {
      return amount;
    }

    const amountInBase = amount / fromCurrency.exchange_rate;
    return amountInBase * toCurrency.exchange_rate;
  };

  const convert = (amount: number, fromCode?: string): number => {
    return convertBetween(amount, fromCode || defaultCurrency.code, selectedCurrency.code);
  };

  const convertFromSelected = (amount: number, toCode?: string): number => {
    return convertBetween(amount, selectedCurrency.code, toCode || defaultCurrency.code);
  };

  const formatAmount = (amount: number, fromCode?: string): string => {
    const converted = convert(amount, fromCode);
    
    // Use Intl.NumberFormat for proper thousands separators and consistent decimals
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: selectedCurrency.code,
      currencyDisplay: "narrowSymbol",
    }).format(converted).replace(selectedCurrency.code, selectedCurrency.symbol);
  };

  return (
    <CurrencyContext.Provider
      value={{
        currencies,
        selectedCurrency,
        defaultCurrency,
        setSelectedCurrency,
        convert,
        convertFromSelected,
        formatAmount,
        isLoading,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
};
