// Dynamic import to avoid build-time issues
async function getPdfToImg() {
  const module = await import("pdf-to-img");
  return module.pdf;
}

/**
 * Generate a thumbnail image from the first page of a PDF
 * @param pdfBuffer - The PDF file as a Buffer
 * @param scale - Scale factor for the output image (default 1.0, higher = better quality)
 * @returns Base64-encoded PNG image data URL
 */
export async function generatePdfThumbnail(
  pdfBuffer: Buffer,
  scale: number = 1.0
): Promise<string> {
  try {
    const pdf = await getPdfToImg();

    // Convert buffer to base64 data URL for pdf-to-img
    const base64 = pdfBuffer.toString("base64");
    const dataUrl = `data:application/pdf;base64,${base64}`;

    // Get the PDF document
    const document = await pdf(dataUrl, { scale });

    // Get just the first page
    const firstPage = await document.getPage(1);

    // Convert to base64 PNG data URL
    const pngBase64 = firstPage.toString("base64");
    return `data:image/png;base64,${pngBase64}`;
  } catch (error) {
    console.error("Error generating PDF thumbnail:", error);
    throw error;
  }
}

/**
 * Generate a thumbnail and return as a Buffer (for uploading to storage)
 */
export async function generatePdfThumbnailBuffer(
  pdfBuffer: Buffer,
  scale: number = 1.0
): Promise<Buffer> {
  try {
    const pdf = await getPdfToImg();

    // Convert buffer to base64 data URL for pdf-to-img
    const base64 = pdfBuffer.toString("base64");
    const dataUrl = `data:application/pdf;base64,${base64}`;

    // Get the PDF document
    const document = await pdf(dataUrl, { scale });

    // Get just the first page as buffer
    const firstPage = await document.getPage(1);

    return firstPage;
  } catch (error) {
    console.error("Error generating PDF thumbnail buffer:", error);
    throw error;
  }
}
