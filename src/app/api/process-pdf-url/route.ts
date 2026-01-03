import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { createHash } from "crypto";
import { writeFile, unlink, mkdir } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { api } from "../../../../convex/_generated/api";
import { uploadFile, describeFile } from "@/lib/pinecone/client";
import { runWorkflow } from "@/lib/unstructured/workflow";
import { extractPDFMetadataFromUrl } from "@/lib/pdf/extractor";
import { tryGenerateThumbnail } from "@/lib/pdf/thumbnail";

// Calculate SHA-256 hash of buffer
function calculateBufferHash(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function getConvexClient(): ConvexHttpClient {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
  }
  return new ConvexHttpClient(url);
}

// Helper to write buffer to temp file
async function writeTempFile(
  buffer: Buffer,
  filename: string
): Promise<string> {
  const tempDir = join(tmpdir(), "pinecone-uploads");
  await mkdir(tempDir, { recursive: true });
  const tempPath = join(tempDir, `${Date.now()}-${filename}`);
  await writeFile(tempPath, buffer);
  return tempPath;
}

// Helper to clean up temp file
async function cleanupTempFile(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch {
    // Ignore cleanup errors
  }
}

// Poll for file processing completion
async function waitForFileProcessing(
  fileId: string,
  maxWaitMs: number = 300000
): Promise<boolean> {
  const startTime = Date.now();
  const pollInterval = 5000; // 5 seconds

  while (Date.now() - startTime < maxWaitMs) {
    const fileInfo = await describeFile(fileId);

    if (fileInfo.status === "Available") {
      return true;
    }

    if (fileInfo.status === "ProcessingFailed") {
      throw new Error(
        `File processing failed: ${fileInfo.errorMessage || "Unknown error"}`
      );
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new Error("File processing timed out");
}

export async function POST(request: NextRequest) {
  const convex = getConvexClient();
  let tempFilePath: string | null = null;

  try {
    const body = await request.json();
    const { url, workflowId } = body;

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 }
      );
    }

    // Extract filename from URL
    const pathname = parsedUrl.pathname;
    let filename = pathname.split("/").pop() || "document.pdf";
    if (!filename.endsWith(".pdf")) {
      filename = `${filename}.pdf`;
    }

    // Create title from filename
    const title = filename.replace(".pdf", "").replace(/[-_]/g, " ");

    // Step 1: Fetch PDF from URL first (to check for duplicates)
    console.log(`Fetching PDF from URL: ${url}`);
    const pdfResponse = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PDFBot/1.0)",
      },
    });

    if (!pdfResponse.ok) {
      throw new Error(
        `Failed to fetch PDF: ${pdfResponse.status} ${pdfResponse.statusText}`
      );
    }

    const contentType = pdfResponse.headers.get("content-type");
    if (
      contentType &&
      !contentType.includes("pdf") &&
      !contentType.includes("octet-stream")
    ) {
      console.warn(`Unexpected content type: ${contentType}, proceeding anyway`);
    }

    const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());

    // Step 2: Calculate file hash and check for duplicates
    const fileHash = calculateBufferHash(pdfBuffer);
    console.log(`Calculated file hash: ${fileHash.substring(0, 16)}...`);

    const duplicateCheck = await convex.query(api.pdfs.checkDuplicate, {
      fileHash,
    });
    if (duplicateCheck.isDuplicate) {
      return NextResponse.json(
        {
          error: `Duplicate file: This PDF has already been uploaded as "${duplicateCheck.existingPdf?.title}"`,
          isDuplicate: true,
          existingPdf: duplicateCheck.existingPdf,
        },
        { status: 409 }
      );
    }

    // Step 3: Create PDF record in Convex (with hash)
    const pdfId = await convex.mutation(api.pdfs.create, {
      title,
      filename,
      fileHash,
      sourceUrl: url,
      source: "url",
    });

    // Check if processing is enabled
    const processingEnabled = await convex.query(api.settings.get, {
      key: "processing_enabled",
    });

    // If processing is disabled, mark as completed but still extract metadata if enabled
    if (processingEnabled === "false") {
      console.log(
        "Processing disabled via settings, marking PDF as completed without indexing"
      );

      await convex.mutation(api.pdfs.updateStatus, {
        id: pdfId,
        status: "completed",
      });

      // Still extract metadata if enabled
      const metadataExtractionEnabled = await convex.query(api.settings.get, {
        key: "metadata_extraction_enabled",
      });

      if (metadataExtractionEnabled !== "false") {
        console.log("Extracting metadata for PDF (processing disabled):", pdfId);
        try {
          // Generate thumbnail (graceful - returns null if unavailable)
          const thumbnailDataUrl = await tryGenerateThumbnail(pdfBuffer, 1.5);

          // Extract metadata using local extraction (no Firecrawl)
          const extractResult = await extractPDFMetadataFromUrl(url);
          console.log(
            "process-pdf-url: Extract result:",
            JSON.stringify(extractResult.data, null, 2)
          );
          if (extractResult.success && extractResult.data) {
            console.log("process-pdf-url: Saving metadata with fields:", {
              documentType: extractResult.data.documentType,
              authors: extractResult.data.authors,
              keyFindings: extractResult.data.keyFindings?.length,
              keywords: extractResult.data.keywords?.length,
              technologyAreas: extractResult.data.technologyAreas,
            });
            await convex.mutation(api.pdfs.updateExtractedMetadata, {
              id: pdfId,
              title: extractResult.data.title || title,
              company: extractResult.data.company,
              dateOrYear: extractResult.data.dateOrYear,
              topic: extractResult.data.topic,
              summary: extractResult.data.summary,
              thumbnailUrl: thumbnailDataUrl || undefined,
              continent: extractResult.data.continent,
              industry: extractResult.data.industry,
              documentType: extractResult.data.documentType,
              authors: extractResult.data.authors,
              keyFindings: extractResult.data.keyFindings,
              keywords: extractResult.data.keywords,
              technologyAreas: extractResult.data.technologyAreas,
            });
          } else if (thumbnailDataUrl) {
            await convex.mutation(api.pdfs.updateExtractedMetadata, {
              id: pdfId,
              thumbnailUrl: thumbnailDataUrl,
            });
          }
        } catch (metadataError) {
          console.error("Metadata extraction error:", metadataError);
        }
      }

      return NextResponse.json({
        success: true,
        pdfId,
        skipped: true,
        message: "Processing is disabled. PDF stored but not indexed.",
      });
    }

    // Step 4: Create processing job
    const jobId = await convex.mutation(api.processing.createJob, {
      pdfId,
      stage: "extracting",
    });

    // Update status to processing
    await convex.mutation(api.pdfs.updateStatus, {
      id: pdfId,
      status: "processing",
    });

    // Step 3.5: Run Unstructured workflow if configured
    if (workflowId) {
      console.log(`Running Unstructured workflow: ${workflowId}`);
      const blob = new Blob([pdfBuffer], { type: "application/pdf" });
      const workflowResult = await runWorkflow(
        workflowId,
        blob,
        filename,
        "application/pdf"
      );

      if (workflowResult.success) {
        console.log(`Workflow started: ${workflowResult.workflowRunId}`);
      } else {
        console.error(`Workflow failed: ${workflowResult.error}`);
        // Continue anyway - workflow failure shouldn't block processing
      }
    }

    // Step 4: Write to temp file and upload to Pinecone Assistant
    console.log(`Uploading to Pinecone Assistant: ${filename}`);
    tempFilePath = await writeTempFile(pdfBuffer, filename);

    const uploadResult = await uploadFile(tempFilePath, {
      convexId: pdfId,
      title,
      filename,
      sourceUrl: url,
    });

    await convex.mutation(api.processing.updateJob, {
      jobId,
      stage: "storing",
      metadata: { pineconeFileId: uploadResult.id },
    });

    // Step 5: Wait for Pinecone to process the file
    console.log(`Waiting for Pinecone to process file: ${uploadResult.id}`);
    await waitForFileProcessing(uploadResult.id);

    // Step 6: Update job and PDF status
    await convex.mutation(api.processing.updateJob, {
      jobId,
      stage: "completed",
      metadata: { pineconeFileId: uploadResult.id },
    });

    await convex.mutation(api.pdfs.updateStatus, {
      id: pdfId,
      status: "completed",
      pineconeFileId: uploadResult.id,
    });

    // Check if metadata extraction is enabled
    const metadataExtractionEnabled = await convex.query(api.settings.get, {
      key: "metadata_extraction_enabled",
    });

    // Extract metadata if enabled
    if (metadataExtractionEnabled !== "false") {
      console.log("Extracting metadata for PDF:", pdfId);
      try {
        // Generate thumbnail (graceful - returns null if unavailable)
        const thumbnailDataUrl = await tryGenerateThumbnail(pdfBuffer, 1.5);
        if (thumbnailDataUrl) {
          console.log("Thumbnail generated successfully");
        }

        // Extract metadata using local extraction (no Firecrawl)
        const extractResult = await extractPDFMetadataFromUrl(url);
        if (extractResult.success && extractResult.data) {
          await convex.mutation(api.pdfs.updateExtractedMetadata, {
            id: pdfId,
            title: extractResult.data.title || title,
            company: extractResult.data.company,
            dateOrYear: extractResult.data.dateOrYear,
            topic: extractResult.data.topic,
            summary: extractResult.data.summary,
            thumbnailUrl: thumbnailDataUrl || undefined,
            continent: extractResult.data.continent,
            industry: extractResult.data.industry,
            documentType: extractResult.data.documentType,
            authors: extractResult.data.authors,
            keyFindings: extractResult.data.keyFindings,
            keywords: extractResult.data.keywords,
            technologyAreas: extractResult.data.technologyAreas,
          });
          console.log("Metadata extracted and saved:", extractResult.data);
        } else if (thumbnailDataUrl) {
          // Save thumbnail even if metadata extraction failed
          await convex.mutation(api.pdfs.updateExtractedMetadata, {
            id: pdfId,
            thumbnailUrl: thumbnailDataUrl,
          });
          console.log("Saved thumbnail without metadata");
        }
      } catch (metadataError) {
        console.error("Metadata extraction error:", metadataError);
        // Continue anyway - metadata extraction failure shouldn't fail the whole process
      }
    }

    return NextResponse.json({
      success: true,
      pdfId,
      pineconeFileId: uploadResult.id,
    });
  } catch (error) {
    console.error("Process PDF from URL error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  } finally {
    // Clean up temp file
    if (tempFilePath) {
      await cleanupTempFile(tempFilePath);
    }
  }
}
