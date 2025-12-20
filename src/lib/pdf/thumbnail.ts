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

    // Get the PDF document - returns an async iterable in pdf-to-img v5
    const document = await pdf(dataUrl, { scale });

    // Get just the first page using the async iterator (v5 API)
    for await (const page of document) {
      // First page is a Buffer containing PNG image
      const pngBase64 = page.toString("base64");
      return `data:image/png;base64,${pngBase64}`;
    }

    throw new Error("PDF has no pages");
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

    // Get the PDF document - returns an async iterable in pdf-to-img v5
    const document = await pdf(dataUrl, { scale });

    // Get just the first page as buffer using the async iterator (v5 API)
    for await (const page of document) {
      return page;
    }

    throw new Error("PDF has no pages");
  } catch (error) {
    console.error("Error generating PDF thumbnail buffer:", error);
    throw error;
  }
}
