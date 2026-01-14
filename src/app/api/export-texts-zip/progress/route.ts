import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import archiver from "archiver";
import { PassThrough } from "stream";

function getConvexClient(): ConvexHttpClient {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
  }
  return new ConvexHttpClient(url);
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 200);
}

async function fetchWithRetry(
  url: string,
  retries = 3,
  timeout = 60000
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
      console.log(`[Export] Fetch failed with status ${response.status} for ${url.substring(0, 50)}...`);
    } catch (err) {
      console.log(`[Export] Fetch attempt ${i + 1} failed:`, err instanceof Error ? err.message : err);
      if (i === retries - 1) {
        return null;
      }
      await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
    }
  }
  return null;
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
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        console.log("[Export] Starting export process...");
        const convex = getConvexClient();

        sendEvent({ status: "fetching", message: "Fetching report list..." });

        let pdfs: Array<{
          _id: string;
          _creationTime: number;
          filename: string;
          title?: string;
          extractedTextUrl: string | null;
          documentType?: string;
          summary?: string;
          sourceUrl?: string;
          pageCount?: number;
        }> | undefined;
        const maxRetries = 3;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            console.log(`[Export] Fetching PDFs from Convex (attempt ${attempt}/${maxRetries})...`);
            pdfs = await convex.query(api.pdfs.getAllForExport, {});
            console.log(`[Export] Fetched ${pdfs.length} PDFs from Convex`);
            break;
          } catch (convexError) {
            console.error(`[Export] Convex query failed (attempt ${attempt}):`, convexError);
            if (attempt === maxRetries) {
              sendEvent({ status: "error", message: "Failed to fetch report list from database. Please try again." });
              controller.close();
              return;
            }
            // Wait before retry with exponential backoff
            await new Promise((r) => setTimeout(r, 2000 * attempt));
          }
        }

        if (!pdfs) {
          sendEvent({ status: "error", message: "Failed to fetch report list from database. Please try again." });
          controller.close();
          return;
        }

        const pdfsWithText = pdfs.filter((pdf) => pdf.extractedTextUrl);
        console.log(`[Export] ${pdfsWithText.length} PDFs have extracted text`);

        if (pdfsWithText.length === 0) {
          sendEvent({ status: "error", message: "No extracted text files found" });
          controller.close();
          return;
        }

        const total = pdfsWithText.length;
        sendEvent({
          status: "processing",
          message: `Found ${total} reports with text`,
          total,
          processed: 0,
        });

        // Create archive with promise-based stream handling
        const chunks: Buffer[] = [];
        const passThrough = new PassThrough();

        // Set up all event listeners BEFORE piping
        passThrough.on("data", (chunk) => chunks.push(Buffer.from(chunk)));

        const streamEndPromise = new Promise<void>((resolve, reject) => {
          passThrough.on("end", () => {
            console.log("[Export] PassThrough stream ended");
            resolve();
          });
          passThrough.on("error", (err) => {
            console.error("[Export] PassThrough error:", err);
            reject(err);
          });
        });

        const archive = archiver("zip", { zlib: { level: 5 } });

        archive.on("error", (err) => {
          console.error("[Export] Archiver error:", err);
        });

        archive.pipe(passThrough);

        const manifest: ManifestEntry[] = [];
        let processed = 0;
        let addedCount = 0;
        const usedFilenames = new Set<string>();

        // Helper to get unique filename
        const getUniqueFilename = (baseName: string): string => {
          let filename = sanitizeFilename(baseName) + ".txt";
          let counter = 1;
          while (usedFilenames.has(filename)) {
            filename = sanitizeFilename(baseName) + `_${counter}.txt`;
            counter++;
          }
          usedFilenames.add(filename);
          return filename;
        };

        // Process one at a time to avoid connection issues
        for (let i = 0; i < pdfsWithText.length; i++) {
          const pdf = pdfsWithText[i];
          console.log(`[Export] Processing file ${i + 1}/${pdfsWithText.length}: ${pdf.title}`);

          const filename = getUniqueFilename(pdf.title || pdf.filename.replace(".pdf", ""));

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

          if (pdf.extractedTextUrl) {
            try {
              const text = await fetchWithRetry(pdf.extractedTextUrl);
              if (text) {
                archive.append(text, { name: `texts/${filename}` });
                addedCount++;
              }
            } catch (err) {
              console.error(`[Export] Error fetching text for ${pdf.title}:`, err);
            }
          }

          processed++;
          sendEvent({
            status: "processing",
            message: `Processing reports...`,
            total,
            processed,
            currentFile: pdf.title || "Unknown",
          });

          // Small delay between files
          if (i < pdfsWithText.length - 1) {
            await new Promise((r) => setTimeout(r, 100));
          }
        }

        sendEvent({ status: "finalizing", message: "Creating ZIP file..." });
        console.log(`[Export] Finalizing archive with ${addedCount} files...`);

        // Add manifest
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

        try {
          await archive.finalize();
          console.log("[Export] Archive finalized, waiting for stream...");
        } catch (archiveError) {
          console.error("[Export] Archive finalize failed:", archiveError);
          sendEvent({ status: "error", message: "Failed to create ZIP archive" });
          controller.close();
          return;
        }

        // Wait for the stream to finish (using the promise created earlier)
        await streamEndPromise;

        const zipBuffer = Buffer.concat(chunks);
        console.log(`[Export] ZIP buffer size: ${zipBuffer.length} bytes`);
        const base64 = zipBuffer.toString("base64");

        const timestamp = new Date()
          .toISOString()
          .replace(/[:.]/g, "-")
          .slice(0, 19);
        const filename = `reports-export-${timestamp}.zip`;

        sendEvent({
          status: "complete",
          message: `Export complete! ${addedCount} reports exported.`,
          filename,
          data: base64,
          size: zipBuffer.length,
        });

        controller.close();
      } catch (error) {
        console.error("[Export] Error during export:", error);
        sendEvent({
          status: "error",
          message: error instanceof Error ? error.message : "Unknown error occurred during export",
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
