import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

export type ExportTableData = {
  headers: string[];
  rows: string[][];
};

const sanitizeFileName = (name: string) => {
  const clean = name.trim().replace(/[^a-z0-9-_]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return clean || "table-export";
};

const normalizeCellText = (value: string) => value.replace(/\s+/g, " ").trim();

export const exportDataToExcel = (data: ExportTableData, fileName: string) => {
  const worksheetRows = [data.headers, ...data.rows];
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Table");
  XLSX.writeFile(workbook, `${sanitizeFileName(fileName)}.xlsx`);
};

export const exportDataToPdf = (data: ExportTableData, fileName: string) => {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setFontSize(12);
  doc.text(fileName, 40, 36);

  autoTable(doc, {
    head: [data.headers],
    body: data.rows,
    startY: 48,
    styles: {
      fontSize: 8,
      cellPadding: 4,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [30, 41, 59],
    },
    margin: { top: 48, right: 24, bottom: 24, left: 24 },
    theme: "striped",
  });

  doc.save(`${sanitizeFileName(fileName)}.pdf`);
};

export const getHtmlTableData = (table: HTMLTableElement): ExportTableData => {
  const headerCells = Array.from(table.querySelectorAll("thead th"));
  const headers = headerCells.map((th) => normalizeCellText(th.textContent || ""));

  const bodyRows = Array.from(table.querySelectorAll("tbody tr"));
  const rows = bodyRows
    .map((row) =>
      Array.from(row.querySelectorAll("td")).map((cell) => normalizeCellText(cell.textContent || "")),
    )
    .filter((cells) => cells.some((cell) => cell.length > 0));

  return {
    headers,
    rows,
  };
};

export const exportHtmlTableToExcel = (table: HTMLTableElement, fileName: string) => {
  const data = getHtmlTableData(table);
  if (data.headers.length === 0 || data.rows.length === 0) return;
  exportDataToExcel(data, fileName);
};

export const exportHtmlTableToPdf = (table: HTMLTableElement, fileName: string) => {
  const data = getHtmlTableData(table);
  if (data.headers.length === 0 || data.rows.length === 0) return;
  exportDataToPdf(data, fileName);
};
