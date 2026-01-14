import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import archiver from "archiver";
import { PassThrough } from "stream";

function getConvexClient(): ConvexHttpClient {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
  }
  return new ConvexHttpClient(url);
}

// Sanitize filename to be safe for file systems
function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 200);
}

// Fetch with retry and timeout
async function fetchWithRetry(
  url: string,
  retries = 3,
  timeout = 30000
): Promise<string | null> {
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) {
        return await response.text();
      }
    } catch (err) {
      if (i === retries - 1) {
        console.error(`Failed to fetch after ${retries} retries:`, err);
        return null;
      }
      // Wait before retry with exponential backoff
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  return null;
}

// Process files in batches to avoid connection overload
async function processBatch<T, R>(
  items: T[],
  batchSize: number,
  processor: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);
  }
  return results;
}

interface ManifestEntry {
  id: string;
  filename: string;
  originalFilename: string;
  title: string;
  documentType?: string;
  summary?: string;
  createdAt: string;
  sourceUrl?: string;
  pageCount?: number;
  hasExtractedText: boolean;
}

export async function GET() {
  try {
    const convex = getConvexClient();

    // Get all PDFs with extracted text URLs
    const pdfs = await convex.query(api.pdfs.getAllForExport, {});

    // Filter to only PDFs with extracted text
    const pdfsWithText = pdfs.filter((pdf) => pdf.extractedTextUrl);

    if (pdfsWithText.length === 0) {
      return NextResponse.json(
        { error: "No extracted text files found" },
        { status: 404 }
      );
    }

    // Create a buffer to hold the zip content
    const chunks: Buffer[] = [];
    const passThrough = new PassThrough();

    passThrough.on("data", (chunk) => {
      chunks.push(Buffer.from(chunk));
    });

    // Create the archive
    const archive = archiver("zip", {
      zlib: { level: 5 },
    });

    archive.pipe(passThrough);

    // Build manifest and fetch text files in batches
    const manifest: ManifestEntry[] = [];
    const BATCH_SIZE = 5;

    const textFiles = await processBatch(
      pdfsWithText,
      BATCH_SIZE,
      async (pdf) => {
        const filename =
          sanitizeFilename(pdf.title || pdf.filename.replace(".pdf", "")) +
          ".txt";

        // Add to manifest regardless of fetch success
        manifest.push({
          id: pdf._id,
          filename,
          originalFilename: pdf.filename,
          title: pdf.title || pdf.filename,
          documentType: pdf.documentType,
          summary: pdf.summary,
          createdAt: pdf._creationTime
            ? new Date(pdf._creationTime).toISOString()
            : new Date().toISOString(),
          sourceUrl: pdf.sourceUrl,
          pageCount: pdf.pageCount,
          hasExtractedText: !!pdf.extractedTextUrl,
        });

        if (!pdf.extractedTextUrl) {
          return null;
        }

        const text = await fetchWithRetry(pdf.extractedTextUrl);
        if (text) {
          return { filename, text };
        }
        return null;
      }
    );

    // Add text files to archive
    let addedCount = 0;
    for (const file of textFiles) {
      if (file) {
        archive.append(file.text, { name: `texts/${file.filename}` });
        addedCount++;
      }
    }

    // Add manifest to archive
    const manifestJson = JSON.stringify(
      {
        exportDate: new Date().toISOString(),
        totalReports: pdfs.length,
        reportsWithText: pdfsWithText.length,
        successfullyExported: addedCount,
        reports: manifest,
      },
      null,
      2
    );
    archive.append(manifestJson, { name: "manifest.json" });

    // Finalize the archive
    await archive.finalize();

    // Wait for the stream to finish
    await new Promise<void>((resolve, reject) => {
      passThrough.on("end", resolve);
      passThrough.on("error", reject);
    });

    // Combine all chunks into a single buffer
    const zipBuffer = Buffer.concat(chunks);

    // Generate filename with timestamp
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, 19);
    const filename = `reports-export-${timestamp}.zip`;

    // Return ZIP as downloadable file
    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": zipBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("ZIP export error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
