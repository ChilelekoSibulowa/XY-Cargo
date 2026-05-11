import type { FinanceDateFilter } from "@/lib/financePortal";
import { financeDateFilterOptions } from "@/lib/financePortal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type DateRangeFilterProps = {
  value: FinanceDateFilter;
  onValueChange: (value: FinanceDateFilter) => void;
  startDate: string;
  endDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  label?: string;
};

export const DateRangeFilter = ({
  value,
  onValueChange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  label = "Date filter",
}: DateRangeFilterProps) => (
  <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
    <div className="w-full space-y-2 sm:w-56">
      <Label>{label}</Label>
      <Select value={value} onValueChange={(next) => onValueChange(next as FinanceDateFilter)}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {financeDateFilterOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
    {value === "custom" && (
      <>
        <div className="space-y-2">
          <Label>From</Label>
          <Input type="date" value={startDate} onChange={(event) => onStartDateChange(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>To</Label>
          <Input type="date" value={endDate} onChange={(event) => onEndDateChange(event.target.value)} />
        </div>
      </>
    )}
  </div>
);
