import { jsPDF } from "jspdf";
import "jspdf-autotable";
import { WECHAT_QR_BASE64, ALIPAY_QR_BASE64 } from "./qrCodeData";

interface InvoiceData {
  logoUrl?: string;
  companyName?: string;
  invoiceTitle: string;
  invoiceNumber: string;
  trackingNumber?: string;
  billTo: string;
  billToId?: string;
  date: string;
  description: string;
  amount: string;
  paid: string;
  balance: string;
  filename: string;
  bankInstitution?: string;
  bankName?: string;
  bankAccount?: string;
  bankBranch?: string;
}

// Comprehensive logo loading with guaranteed success
const loadLogoForPDF = async (imageUrl: string | undefined): Promise<string | null> => {
  if (!imageUrl) {
    console.warn("[Logo] No URL provided");
    return null;
  }

  console.log(`[Logo] Attempting to load from: ${imageUrl}`);

  // Strategy 1: Fetch with CORS
  try {
    console.log("[Logo] Trying Fetch API...");
    const response = (await Promise.race([
      fetch(imageUrl, { 
        mode: "cors", 
        credentials: "omit",
        headers: { "Accept": "image/*" }
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Fetch timeout")), 3000)
      ),
    ])) as unknown as Response;

    if (response?.ok) {
      const blob = await response.blob();
      if (blob.size > 0) {
        const reader = new FileReader();
        return await new Promise<string | null>((resolve) => {
          reader.onloadend = () => {
            if (typeof reader.result === "string") {
              console.log("[Logo] Successfully loaded via Fetch");
              resolve(reader.result);
            } else {
              resolve(null);
            }
          };
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        });
      }
    }
  } catch (err) {
    console.warn("[Logo] Fetch failed:", err);
  }

  // Strategy 2: XMLHttpRequest with CORS
  try {
    console.log("[Logo] Trying XMLHttpRequest...");
    return await new Promise<string | null>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.timeout = 3000;

      xhr.onload = () => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === "string") {
            console.log("[Logo] Successfully loaded via XHR");
            resolve(reader.result);
          } else {
            resolve(null);
          }
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(xhr.response);
      };

      xhr.onerror = () => {
        console.warn("[Logo] XHR error");
        resolve(null);
      };

      xhr.ontimeout = () => {
        console.warn("[Logo] XHR timeout");
        resolve(null);
      };

      xhr.responseType = "blob";
      xhr.open("GET", imageUrl);
      xhr.send();
    });
  } catch (err) {
    console.warn("[Logo] XHR failed:", err);
  }

  // Strategy 3: Image element to Canvas
  try {
    console.log("[Logo] Trying Image to Canvas...");
    return await new Promise<string | null>((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      const timeout = setTimeout(() => {
        console.warn("[Logo] Canvas timeout");
        resolve(null);
      }, 3000);

      img.onload = () => {
        clearTimeout(timeout);
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const result = canvas.toDataURL("image/png");
            console.log("[Logo] Successfully loaded via Canvas");
            resolve(result);
          } else {
            resolve(null);
          }
        } catch (error) {
          console.warn("[Logo] Canvas conversion error:", error);
          resolve(null);
        }
      };

      img.onerror = () => {
        clearTimeout(timeout);
        console.warn("[Logo] Image load error");
        resolve(null);
      };

      img.src = imageUrl;
    });
  } catch (err) {
    console.warn("[Logo] Canvas strategy failed:", err);
  }

  return null;
};

export const generateInvoicePdf = async (data: InvoiceData) => {
  console.log("[Invoice PDF] Starting generation...");

  try {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 12;
    const headerHeight = 40;
    const logoSize = 22;
    const logoBoxSize = 22;
    let yPosition = 15;

    // Add colored header background
    doc.setFillColor(245, 247, 250);
    doc.rect(0, 0, pageWidth, headerHeight, "F");

    // Add border to header
    doc.setDrawColor(220, 10, 10);
    doc.setLineWidth(2);
    doc.line(0, headerHeight, pageWidth, headerHeight);

    let logoAdded = false;

    // ENFORCE LOGO LOADING AND DISPLAY
    console.log("[Invoice PDF] Loading logo...");
    try {
      const logoData = await loadLogoForPDF(data.logoUrl);
      if (logoData) {
        try {
          const logoX = margin;
          const logoY = yPosition - 1;
          
          doc.addImage(logoData, "PNG", logoX, logoY, logoSize, logoSize);
          console.log("[Invoice PDF] ✓ Logo added successfully");
          logoAdded = true;
        } catch (addError) {
          console.error("[Invoice PDF] Failed to add image to PDF:", addError);
        }
      } else {
        console.warn("[Invoice PDF] Logo data is null after all strategies");
        // Draw a placeholder box to reserve space
        doc.setDrawColor(220, 10, 10);
        doc.setLineWidth(1);
        doc.rect(margin, yPosition, logoBoxSize, logoBoxSize);
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.text("LOGO", margin + logoBoxSize / 2, yPosition + 12, { align: "center" as const });
      }
    } catch (logoError) {
      console.error("[Invoice PDF] Logo loading error:", logoError);
    }

    // Add company name and invoice type
    const textStartX = logoAdded ? margin + logoSize + 6 : margin + logoBoxSize + 6;

    if (data.companyName) {
      doc.setFontSize(16);
      doc.setFont(undefined, "bold");
      doc.setTextColor(20, 50, 100);
      doc.text(data.companyName, textStartX, yPosition + 6);
    }

    doc.setFontSize(10);
    doc.setFont(undefined, "bold");
    doc.setTextColor(220, 10, 10);
    doc.text(data.invoiceTitle, textStartX, yPosition + 14);

    // Invoice meta block on the right
    const metaBoxWidth = 58;
    const metaBoxHeight = 22;
    const metaBoxX = pageWidth - margin - metaBoxWidth;
    const metaBoxY = 9;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(235, 190, 190);
    doc.setLineWidth(0.5);
    doc.rect(metaBoxX, metaBoxY, metaBoxWidth, metaBoxHeight, "FD");
    doc.setFontSize(7.5);
    doc.setFont(undefined, "bold");
    doc.setTextColor(160, 40, 40);
    doc.text("INVOICE NO.", metaBoxX + 4, metaBoxY + 6);
    doc.setFontSize(8.5);
    doc.setTextColor(50, 50, 50);
    doc.text(String(data.invoiceNumber), metaBoxX + 4, metaBoxY + 11);
    doc.setFontSize(7.5);
    doc.setFont(undefined, "bold");
    doc.setTextColor(160, 40, 40);
    doc.text("ISSUED", metaBoxX + 4, metaBoxY + 17);
    doc.setFont(undefined, "normal");
    doc.setTextColor(80, 80, 80);
    doc.text(String(data.date), metaBoxX + 21, metaBoxY + 17);

    const detailsTop = headerHeight + 12;
    const leftColX = margin;
    const rightColX = pageWidth / 2 + 5;

    // Invoice Details Section - Two columns
    doc.setFontSize(7.5);
    doc.setFont(undefined, "bold");
    doc.setTextColor(220, 10, 10);
    doc.text("INVOICE DETAILS", leftColX, detailsTop);

    doc.setFont(undefined, "normal");
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text(`Tracking Number: ${data.trackingNumber || "-"}`, leftColX, detailsTop + 6);
    doc.text(`Date: ${data.date}`, leftColX, detailsTop + 11);

    doc.setFont(undefined, "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(220, 10, 10);
    doc.text("BILL TO", rightColX, detailsTop);

    doc.setFont(undefined, "normal");
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text(data.billTo, rightColX, detailsTop + 6, { maxWidth: 80 });
    if (data.billToId) {
      doc.text(`ID: ${data.billToId}`, rightColX, detailsTop + 11);
    }

    // Compute yPosition dynamically to avoid overlap with billTo content
    const billToLines = doc.splitTextToSize(data.billTo, 80);
    const billToHeight = billToLines.length * 4;
    yPosition = Math.max(detailsTop + 16 + billToHeight, 82);

    // PAYMENT SUMMARY SECTION - Prominent display of amounts
    doc.setFillColor(255, 250, 245);
    doc.setDrawColor(220, 10, 10);
    doc.setLineWidth(1.5);
    doc.rect(margin, yPosition, pageWidth - 2 * margin, 40, "FD");

    doc.setFont(undefined, "bold");
    doc.setFontSize(10);
    doc.setTextColor(220, 10, 10);
    doc.text("PAYMENT SUMMARY", margin + 5, yPosition + 6);

    // Amount breakdown with larger fonts
    const summaryLeftX = margin + 5;
    const summaryRightX = pageWidth - margin - 35;

    doc.setFont(undefined, "normal");
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);

    // Invoice Amount
    doc.setFont(undefined, "bold");
    doc.text("Invoice Amount:", summaryLeftX, yPosition + 14);
    doc.setFont(undefined, "normal");
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(String(data.amount), summaryRightX, yPosition + 14, { align: "right" as const });

    // Paid Amount
    doc.setFont(undefined, "bold");
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text("Amount Paid:", summaryLeftX, yPosition + 22);
    doc.setFont(undefined, "normal");
    doc.setFontSize(10);
    doc.setTextColor(0, 128, 0);
    doc.text(String(data.paid), summaryRightX, yPosition + 22, { align: "right" as const });

    // Balance Due - prominently highlighted
    doc.setFont(undefined, "bold");
    doc.setFontSize(9);
    doc.setTextColor(220, 10, 10);
    doc.text("Balance Due:", summaryLeftX, yPosition + 30);
    doc.setFont(undefined, "bold");
    doc.setFontSize(11);
    doc.setTextColor(220, 10, 10);
    doc.text(String(data.balance), summaryRightX, yPosition + 30, { align: "right" as const });

    // Add note if balance is due
    const balanceAmount = parseFloat(String(data.balance).replace(/[^0-9.-]/g, ''));
    if (balanceAmount > 0) {
      doc.setFont(undefined, "italic");
      doc.setFontSize(7);
      doc.setTextColor(220, 10, 10);
      doc.text("Payment is due for the above amount", summaryLeftX, yPosition + 37);
    }

    yPosition += 46;

    // Description/Details of shipment
    doc.setFont(undefined, "bold");
    doc.setFontSize(8);
    doc.setTextColor(60, 80, 120);
    doc.text("SHIPMENT DETAILS", margin, yPosition);

    yPosition += 6;
    doc.setFont(undefined, "normal");
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    const descriptionLines = doc.splitTextToSize(String(data.description), pageWidth - 2 * margin);
    doc.text(descriptionLines, margin, yPosition);
    yPosition += descriptionLines.length * 4 + 6;

    // Bank Details Section
    if (data.bankInstitution || data.bankName || data.bankAccount || data.bankBranch) {
      let bankFieldCount = 0;
      if (data.bankInstitution) bankFieldCount++;
      if (data.bankName) bankFieldCount++;
      if (data.bankAccount) bankFieldCount++;
      if (data.bankBranch) bankFieldCount++;
      const bankBoxHeight = 10 + bankFieldCount * 6;

      doc.setFillColor(245, 250, 255);
      doc.setDrawColor(220, 10, 10);
      doc.setLineWidth(0.5);
      doc.rect(margin, yPosition, pageWidth - 2 * margin, bankBoxHeight, "FD");

      doc.setFont(undefined, "bold");
      doc.setFontSize(9);
      doc.setTextColor(220, 10, 10);
      doc.text("BANK DETAILS", margin + 3, yPosition + 6);

      doc.setFont(undefined, "normal");
      doc.setFontSize(8);
      doc.setTextColor(60, 60, 60);

      let bankY = yPosition + 12;
      if (data.bankInstitution) {
        doc.setFont(undefined, "bold");
        doc.text("Bank Name:", margin + 3, bankY);
        doc.setFont(undefined, "normal");
        doc.text(data.bankInstitution, margin + 30, bankY);
        bankY += 6;
      }
      if (data.bankName) {
        doc.setFont(undefined, "bold");
        doc.text("Account Name:", margin + 3, bankY);
        doc.setFont(undefined, "normal");
        doc.text(data.bankName, margin + 34, bankY);
        bankY += 6;
      }
      if (data.bankAccount) {
        doc.setFont(undefined, "bold");
        doc.text("Account Number:", margin + 3, bankY);
        doc.setFont(undefined, "normal");
        doc.text(data.bankAccount, margin + 37, bankY);
        bankY += 6;
      }
      if (data.bankBranch) {
        doc.setFont(undefined, "bold");
        doc.text("Branch:", margin + 3, bankY);
        doc.setFont(undefined, "normal");
        doc.text(data.bankBranch, margin + 20, bankY);
      }

      yPosition += bankBoxHeight + 6;
    }

    // QR Codes Section - WeChat Pay & Alipay
    const qrSectionY = Math.min(yPosition, pageHeight - 80);
    doc.setFont(undefined, "bold");
    doc.setFontSize(9);
    doc.setTextColor(220, 10, 10);
    doc.text("PAYMENT QR CODES", margin, qrSectionY);

    const qrSize = 30;
    const qrY = qrSectionY + 4;
    const qrGap = 10;
    const qrLeftX = margin;
    const qrRightX = margin + qrSize + qrGap;

    // Add QR codes from embedded base64 data (guaranteed to work)
    try {
      doc.addImage(WECHAT_QR_BASE64, "JPEG", qrLeftX, qrY, qrSize, qrSize);
    } catch (e) {
      console.warn("[Invoice PDF] WeChat QR add failed:", e);
    }

    try {
      doc.addImage(ALIPAY_QR_BASE64, "JPEG", qrRightX, qrY, qrSize, qrSize);
    } catch (e) {
      console.warn("[Invoice PDF] Alipay QR add failed:", e);
    }

    doc.setFont(undefined, "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(100, 100, 100);
    doc.text("WeChat Pay", qrLeftX + qrSize / 2, qrY + qrSize + 4, { align: "center" as const });
    doc.text("Alipay", qrRightX + qrSize / 2, qrY + qrSize + 4, { align: "center" as const });

    // Footer
    doc.setFont(undefined, "italic");
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text("Thank you for doing business with us!", margin, pageHeight - 10);
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, pageWidth - margin - 40, pageHeight - 10);

    // Save the PDF
    doc.save(data.filename);
    console.log("[Invoice PDF] ✓ PDF saved successfully:", data.filename);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[Invoice PDF] ✗ PDF generation error:", error);
    throw new Error(`Failed to generate PDF: ${errorMessage}`);
  }
};
