import { useEffect } from "react";
import { exportHtmlTableToExcel, exportHtmlTableToPdf } from "@/lib/tableExport";

const TOOLBAR_CLASS = "global-table-export-toolbar";

const makeButton = (label: string) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className =
    "inline-flex items-center whitespace-nowrap rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent hover:text-accent-foreground";
  button.textContent = label;
  return button;
};

const findHeaderHost = (tableParent: HTMLElement) => {
  const previous = tableParent.previousElementSibling as HTMLElement | null;
  if (!previous) return null;

  if (previous.querySelector("h1, h2, h3, h4, h5, h6")) {
    return previous;
  }

  return null;
};

const findHeaderTitle = (headerHost: HTMLElement) =>
  (headerHost.querySelector("h1, h2, h3, h4, h5, h6") as HTMLElement | null);

const deriveFileName = (table: HTMLTableElement, index: number) => {
  const nearestHeading = table
    .closest("section, article, main, div")
    ?.querySelector("h1, h2, h3, h4")
    ?.textContent
    ?.trim();

  const base = nearestHeading || document.title || "table-export";
  return `${base}-table-${index + 1}`;
};

export const AutoTableExportButtons = () => {
  useEffect(() => {
    let rafId = 0;

    const injectButtons = () => {
      // Rebuild toolbars each pass to avoid stale duplicates after table re-renders.
      document.querySelectorAll(`.${TOOLBAR_CLASS}`).forEach((node) => node.remove());
      document.querySelectorAll("table[data-export-attached='true']").forEach((table) => {
        table.removeAttribute("data-export-attached");
      });

      const tables = Array.from(document.querySelectorAll("table"));

      tables.forEach((table, index) => {
        if (!(table instanceof HTMLTableElement)) return;
        if (table.dataset.exportAttached === "true") return;
        if (table.dataset.exportManaged === "datatable") return;
        if (table.closest("[data-table-export-ignore='true']")) return;
        if (table.getClientRects().length === 0) return;

        const parent = table.parentElement;
        if (!parent) return;

        const toolbar = document.createElement("div");
        toolbar.className = `${TOOLBAR_CLASS} ml-auto flex items-center justify-end gap-2 whitespace-nowrap`;

        const pdfButton = makeButton("Export PDF");
        const excelButton = makeButton("Export Excel");

        pdfButton.addEventListener("click", () => {
          const fileName = deriveFileName(table, index);
          exportHtmlTableToPdf(table, fileName);
        });

        excelButton.addEventListener("click", () => {
          const fileName = deriveFileName(table, index);
          exportHtmlTableToExcel(table, fileName);
        });

        toolbar.appendChild(pdfButton);
        toolbar.appendChild(excelButton);

        const headerHost = findHeaderHost(parent);

        const hostOutsideTableBox =
          parent.className.includes("rounded") ||
          parent.className.includes("border") ||
          parent.className.includes("overflow-hidden") ||
          parent.className.includes("overflow-x-auto") ||
          parent.className.includes("overflow-y-auto") ||
          parent.className.includes("overflow-auto");

        if (headerHost) {
          headerHost.classList.add("flex", "flex-row", "items-center", "justify-between", "gap-2", "w-full", "whitespace-nowrap");
          headerHost.style.display = "flex";
          headerHost.style.justifyContent = "space-between";
          headerHost.style.alignItems = "center";
          headerHost.style.flexWrap = "nowrap";

          const headerTitle = findHeaderTitle(headerHost);
          if (headerTitle) {
            headerTitle.classList.add("text-left");
            headerTitle.style.textAlign = "left";
            headerTitle.style.marginRight = "auto";
            headerTitle.style.whiteSpace = "nowrap";
          }

          headerHost.appendChild(toolbar);
        } else if (hostOutsideTableBox && parent.parentElement) {
          parent.parentElement.insertBefore(toolbar, parent);
        } else {
          parent.insertBefore(toolbar, table);
        }
        table.dataset.exportAttached = "true";
      });
    };

    const observer = new MutationObserver(() => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(injectButtons);
    });

    injectButtons();
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
      document.querySelectorAll(`.${TOOLBAR_CLASS}`).forEach((node) => node.remove());
      document.querySelectorAll("table[data-export-attached='true']").forEach((table) => {
        table.removeAttribute("data-export-attached");
      });
    };
  }, []);

  return null;
};
