import { useCurrency } from "@/hooks/useCurrencyContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DollarSign } from "lucide-react";

export const CurrencySwitcher = () => {
  const { currencies, selectedCurrency, setSelectedCurrency, isLoading } = useCurrency();

  const isInactive = isLoading || currencies.length <= 1;

  const handleChange = (code: string) => {
    const currency = currencies.find((c) => c.code === code);
    if (currency) {
      setSelectedCurrency(currency);
    }
  };

  return (
    <Select 
      value={selectedCurrency?.code || ""} 
      onValueChange={handleChange}
      disabled={isInactive}
    >
      <SelectTrigger className="w-fit min-w-[65px] h-8 px-2 text-[10px] font-bold border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors rounded-md flex items-center justify-between gap-1">
        <div className="truncate text-slate-700">
          {isLoading ? "..." : selectedCurrency?.code || "USD"}
        </div>
      </SelectTrigger>
      <SelectContent>
        {currencies.map((currency) => (
          <SelectItem key={currency.code} value={currency.code}>
            <span className="flex items-center gap-2">
              <span className="font-bold text-xs">{currency.symbol}</span>
              <span className="text-xs">{currency.code}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
