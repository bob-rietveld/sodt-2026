/**
 * Generate a thumbnail image from the first page of a PDF
 * Uses unpdf with @napi-rs/canvas for serverless-compatible rendering
 */

import { renderPageAsImage, definePDFJSModule } from "unpdf";

let pdfJsInitialized = false;

/**
 * Initialize PDF.js module (only needs to be done once)
 */
async function ensurePdfJsInitialized(): Promise<void> {
  if (!pdfJsInitialized) {
    await definePDFJSModule(() => import("pdfjs-dist"));
    pdfJsInitialized = true;
  }
}

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
    await ensurePdfJsInitialized();

    // Convert Buffer to Uint8Array for unpdf
    const uint8Array = new Uint8Array(pdfBuffer);

    // Render the first page as an image using @napi-rs/canvas
    const result = await renderPageAsImage(uint8Array, 1, {
      canvasImport: () => import("@napi-rs/canvas"),
      scale,
      toDataURL: true,
    });

    // result is a data URL string when toDataURL is true
    if (typeof result === "string") {
      return result;
    }

    // If ArrayBuffer was returned, convert to data URL
    const buffer = Buffer.from(result);
    const pngBase64 = buffer.toString("base64");
    return `data:image/png;base64,${pngBase64}`;
  } catch (error) {
    console.error("Error generating PDF thumbnail:", error);
    // Return null instead of throwing - thumbnail is optional
    return null;
  }
}

/**
 * Generate a thumbnail and return as a Buffer (for uploading to storage)
 * Returns null if generation fails
 */
export async function generatePdfThumbnailBuffer(
  pdfBuffer: Buffer,
  scale: number = 1.0
): Promise<Buffer | null> {
  try {
    await ensurePdfJsInitialized();

    // Convert Buffer to Uint8Array for unpdf
    const uint8Array = new Uint8Array(pdfBuffer);

    // Render the first page as an image using @napi-rs/canvas
    const result = await renderPageAsImage(uint8Array, 1, {
      canvasImport: () => import("@napi-rs/canvas"),
      scale,
    });

    // result is an ArrayBuffer
    return Buffer.from(result as ArrayBuffer);
  } catch (error) {
    console.error("Error generating PDF thumbnail buffer:", error);
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
