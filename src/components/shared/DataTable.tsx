import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Pencil, Trash2, Eye, Search, Inbox, FileText, FileSpreadsheet } from "lucide-react";
import { Link } from "react-router-dom";
import { ReactNode, isValidElement, useEffect, useMemo, useState } from "react";
import { exportDataToExcel, exportDataToPdf } from "@/lib/tableExport";


export interface Column<T> {
  key: keyof T | string;
  label: string;
  render?: (item: T) => React.ReactNode;
  align?: "left" | "center" | "right";
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  onFilteredDataChange?: (filteredData: T[]) => void;
  viewLink?: (item: T) => string;
  editLink?: (item: T) => string;
  onDelete?: (item: T) => void;
  keyField?: keyof T;
  enablePagination?: boolean;
  pageSize?: number;
  exportFileName?: string;
  customActions?: (item: T) => ReactNode;
  emptyMessage?: string;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  isLoading = false,
  searchable = true,
  searchPlaceholder = "Search...",
  onFilteredDataChange,
  viewLink,
  editLink,
  onDelete,
  keyField = "id" as keyof T,
  enablePagination = true,
  pageSize = 10,
  exportFileName = "table-export",
  customActions,
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const safePageSize = Math.max(1, pageSize);

  const filteredData = useMemo(
    () =>
      searchable
        ? data.filter((item) =>
          columns.some((col) => {
            const value = item[col.key as keyof T];
            if (typeof value === "string") {
              return value.toLowerCase().includes(search.toLowerCase());
            }
            return false;
          })
        )
        : data,
    [columns, data, search, searchable]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [search, searchable]);

  useEffect(() => {
    onFilteredDataChange?.(filteredData);
  }, [filteredData, onFilteredDataChange]);

  const totalPages = enablePagination ? Math.max(1, Math.ceil(filteredData.length / safePageSize)) : 1;

  useEffect(() => {
    if (!enablePagination) return;
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, enablePagination, totalPages]);

  const pagedData = useMemo(() => {
    if (!enablePagination) return filteredData;
    const start = (currentPage - 1) * safePageSize;
    return filteredData.slice(start, start + safePageSize);
  }, [currentPage, enablePagination, filteredData, safePageSize]);

  const rangeStart = filteredData.length === 0 ? 0 : (currentPage - 1) * safePageSize + 1;
  const rangeEnd = enablePagination
    ? Math.min(filteredData.length, currentPage * safePageSize)
    : filteredData.length;

  const getValue = (item: T, key: string) => {
    const keys = key.split(".");
    let value: any = item;
    for (const k of keys) {
      value = value?.[k];
    }
    return value;
  };

  const hasActions = viewLink || editLink || onDelete || customActions;

  const toPlainText = (value: ReactNode): string => {
    if (value === null || value === undefined || typeof value === "boolean") return "";
    if (typeof value === "string" || typeof value === "number") return String(value);
    if (Array.isArray(value)) {
      return value.map((entry) => toPlainText(entry)).join(" ").trim();
    }
    if (isValidElement(value)) {
      return toPlainText((value.props as { children?: ReactNode })?.children);
    }
    return "";
  };

  const exportHeaders = columns.map((col) => col.label);
  const exportRows = filteredData.map((item) =>
    columns.map((col) => {
      if (col.render) {
        return toPlainText(col.render(item));
      }
      const value = getValue(item, String(col.key));
      return value === null || value === undefined ? "-" : String(value);
    }),
  );

  const handleExportExcel = () => {
    exportDataToExcel({ headers: exportHeaders, rows: exportRows }, exportFileName);
  };

  const handleExportPdf = () => {
    exportDataToPdf({ headers: exportHeaders, rows: exportRows }, exportFileName);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        {searchable ? (
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
            <Input
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        ) : (
          <div />
        )}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportPdf}
            disabled={exportRows.length === 0}
            className="gap-1.5"
          >
            <FileText className="h-4 w-4" />
            PDF
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            disabled={exportRows.length === 0}
            className="gap-1.5"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Excel
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border/50 bg-card overflow-hidden shadow-[0_1px_3px_0_rgba(0,0,0,0.04)]">
        <Table data-export-managed="datatable">
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30 border-b border-border/50">
              {columns.map((col) => (
                <TableHead key={String(col.key)} className={col.align === "center" ? "text-center" : col.align === "right" ? "text-right" : undefined}>{col.label}</TableHead>
              ))}
              {hasActions && (
                <TableHead className="w-28">Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={`skeleton-${i}`}>
                  {columns.map((col) => (
                    <TableCell key={String(col.key)}>
                      <Skeleton className="h-4 w-[80%]" />
                    </TableCell>
                  ))}
                  {hasActions && (
                    <TableCell>
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                  )}
                </TableRow>
              ))
            ) : filteredData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (hasActions ? 1 : 0)}
                  className="h-40 text-center"
                >
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Inbox className="w-10 h-10 opacity-30" />
                    <p className="text-sm font-medium">No data found</p>
                    <p className="text-xs">Try adjusting your search or filters</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              pagedData.map((item) => (
                <TableRow key={String(item[keyField])}>
                  {columns.map((col) => (
                    <TableCell key={String(col.key)} className={col.align === "center" ? "text-center" : col.align === "right" ? "text-right" : undefined}>
                      {col.render
                        ? col.render(item)
                        : getValue(item, String(col.key)) ?? "-"}
                    </TableCell>
                  ))}
                  {hasActions && (
                    <TableCell>
                      <div className="flex items-center gap-1 whitespace-nowrap">
                        {customActions && customActions(item)}
                        {viewLink && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 p-0" asChild>
                            <Link to={viewLink(item)}>
                              <Eye className="w-4 h-4 text-blue-600" />
                            </Link>
                          </Button>
                        )}
                        {editLink && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 p-0" asChild>
                            <Link to={editLink(item)}>
                              <Pencil className="w-4 h-4 text-blue-600" />
                            </Link>
                          </Button>
                        )}
                        {onDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            onClick={() => onDelete(item)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {filteredData.length > 0 && (
        <div className="flex items-center justify-between gap-3 overflow-x-auto">
          <p className="text-xs text-muted-foreground">
            Showing {rangeStart}-{rangeEnd} of {filteredData.length} entries
          </p>
          {enablePagination && totalPages > 1 && (
            <div className="flex items-center gap-2 whitespace-nowrap">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <p className="text-xs text-muted-foreground">
                Page {currentPage} of {totalPages}
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
