/**
 * Generate a thumbnail image from the first page of a PDF
 * Uses unpdf/pdfjs for serverless-compatible rendering
 *
 * Note: In serverless environments, thumbnail generation may fail
 * due to canvas/worker limitations. The caller should handle this gracefully.
 */

/**
 * Generate a thumbnail and return as a data URL
 * @param pdfBuffer - The PDF file as a Buffer
 * @param scale - Scale factor for the output image (default 1.0, higher = better quality)
 * @returns Base64-encoded PNG image data URL, or null if generation fails
 */
export async function generatePdfThumbnail(
  pdfBuffer: Buffer,
  scale: number = 1.0
): Promise<string | null> {
  try {
    // Try using pdf-to-img first (works in environments with canvas support)
    const thumbnailBuffer = await generatePdfThumbnailBuffer(pdfBuffer, scale);
    if (thumbnailBuffer) {
      const pngBase64 = thumbnailBuffer.toString("base64");
      return `data:image/png;base64,${pngBase64}`;
    }
    return null;
  } catch (error) {
    console.error("Error generating PDF thumbnail:", error);
    // Return null instead of throwing - thumbnail is optional
    return null;
  }
}

/**
 * Generate a thumbnail and return as a Buffer (for uploading to storage)
 * Returns null if generation fails (e.g., in serverless environments without canvas)
 */
export async function generatePdfThumbnailBuffer(
  pdfBuffer: Buffer,
  scale: number = 1.0
): Promise<Buffer | null> {
  try {
    // Dynamic import to avoid build-time issues
    const pdfToImg = await import("pdf-to-img");
    const pdf = pdfToImg.pdf;

    // Convert buffer to base64 data URL for pdf-to-img
    const base64 = pdfBuffer.toString("base64");
    const dataUrl = `data:application/pdf;base64,${base64}`;

    // Get the PDF document - returns an async iterable in pdf-to-img v5
    const document = await pdf(dataUrl, { scale });

    // Get just the first page as buffer using the async iterator (v5 API)
    for await (const page of document) {
      return page;
    }

    console.warn("PDF has no pages for thumbnail generation");
    return null;
  } catch (error) {
    // Log the error but don't throw - thumbnail generation is optional
    console.error("Error generating PDF thumbnail buffer:", error);

    // Check for common serverless environment errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (
      errorMessage.includes("worker") ||
      errorMessage.includes("canvas") ||
      errorMessage.includes("path")
    ) {
      console.warn(
        "Thumbnail generation failed due to serverless environment limitations. " +
        "This is expected in some deployment environments."
      );
    }

    return null;
  }
}

/**
 * Try to generate a thumbnail, with fallback to null
 * This is the recommended function to use as it handles all error cases gracefully
 *
 * Note: Scale is limited to 0.3 max to keep thumbnail size under Convex's 1MB limit
 * For display purposes, 0.3 scale is sufficient for card/list thumbnails
 */
export async function tryGenerateThumbnail(
  pdfBuffer: Buffer,
  scale: number = 0.3
): Promise<string | null> {
  // Clamp scale to max 0.3 to avoid exceeding Convex's 1MB value limit
  // A scale of 0.3 typically produces thumbnails around 50-150KB
  const clampedScale = Math.min(scale, 0.3);

  try {
    return await generatePdfThumbnail(pdfBuffer, clampedScale);
  } catch {
    // Silently fail - thumbnail is not critical
    return null;
  }
}
