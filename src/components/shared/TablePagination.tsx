import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface TablePaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  pageSize: number;
}

export const TablePagination = ({ currentPage, totalPages, onPageChange, totalItems, pageSize }: TablePaginationProps) => {
  if (totalPages <= 1) return null;
  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
      <span className="text-muted-foreground">
        {start}–{end} of {totalItems}
      </span>
      <div className="flex items-center gap-1">
        <Button size="icon" variant="ghost" disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .filter((page) => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
          .reduce<(number | "ellipsis")[]>((acc, page, idx, arr) => {
            if (idx > 0 && page - (arr[idx - 1] as number) > 1) acc.push("ellipsis");
            acc.push(page);
            return acc;
          }, [])
          .map((item, idx) =>
            item === "ellipsis" ? (
              <span key={`e${idx}`} className="px-1 text-muted-foreground">…</span>
            ) : (
              <Button
                key={item}
                size="sm"
                variant={item === currentPage ? "default" : "ghost"}
                className="h-8 w-8 p-0"
                onClick={() => onPageChange(item as number)}
              >
                {item}
              </Button>
            ),
          )}
        <Button size="icon" variant="ghost" disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export const usePagination = <T,>(items: T[], pageSize = 20) => {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  return { totalPages, pageSize, totalItems: items.length };
};

export const paginate = <T,>(items: T[], currentPage: number, pageSize = 20): T[] => {
  const start = (currentPage - 1) * pageSize;
  return items.slice(start, start + pageSize);
};
