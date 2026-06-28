export function parsePdfPageNumber(evidence = {}) {
  const hasPdfPage = evidence.pdfPage != null && String(evidence.pdfPage).trim() !== "";
  const rawPage = hasPdfPage ? evidence.pdfPage : evidence.page;
  if (rawPage == null || String(rawPage).trim() === "要確認") return null;

  const firstPage = String(rawPage).trim().split(/[-–—]/, 1)[0];
  const pageNumber = Number.parseInt(firstPage, 10);
  return Number.isFinite(pageNumber) && pageNumber >= 1 ? pageNumber : null;
}
