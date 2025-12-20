import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { createHash } from "crypto";
import { api } from "../../../../convex/_generated/api";
import { extractPdfFromBuffer, combineChunks } from "@/lib/unstructured/client";
import { embedDocuments } from "@/lib/voyage/client";
import { insertChunks, PDFChunk } from "@/lib/weaviate/client";
import { runWorkflow } from "@/lib/unstructured/workflow";
import { extractPDFMetadata } from "@/lib/firecrawl/client";
import { generatePdfThumbnailBuffer } from "@/lib/pdf/thumbnail";

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

export async function POST(request: NextRequest) {
  const convex = getConvexClient();

  try {
    const body = await request.json();
    const { url, workflowId } = body;

    if (!url) {
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400 }
      );
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
      throw new Error(`Failed to fetch PDF: ${pdfResponse.status} ${pdfResponse.statusText}`);
    }

    const contentType = pdfResponse.headers.get("content-type");
    if (contentType && !contentType.includes("pdf") && !contentType.includes("octet-stream")) {
      console.warn(`Unexpected content type: ${contentType}, proceeding anyway`);
    }

    const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());

    // Step 2: Calculate file hash and check for duplicates
    const fileHash = calculateBufferHash(pdfBuffer);
    console.log(`Calculated file hash: ${fileHash.substring(0, 16)}...`);

    const duplicateCheck = await convex.query(api.pdfs.checkDuplicate, { fileHash });
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
      console.log("Processing disabled via settings, marking PDF as completed without indexing");

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
          // Generate thumbnail
          let thumbnailDataUrl: string | undefined;
          try {
            const thumbnailBuffer = await generatePdfThumbnailBuffer(pdfBuffer, 1.5);
            const base64 = thumbnailBuffer.toString("base64");
            thumbnailDataUrl = `data:image/png;base64,${base64}`;
          } catch (thumbError) {
            console.error("Thumbnail generation error:", thumbError);
          }

          // Extract metadata using Firecrawl
          const extractResult = await extractPDFMetadata(url);
          if (extractResult.success && extractResult.data) {
            await convex.mutation(api.pdfs.updateExtractedMetadata, {
              id: pdfId,
              title: extractResult.data.title || title,
              company: extractResult.data.company,
              dateOrYear: extractResult.data.dateOrYear,
              topic: extractResult.data.topic,
              summary: extractResult.data.summary,
              thumbnailUrl: thumbnailDataUrl,
              continent: extractResult.data.continent,
              industry: extractResult.data.industry,
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
      const workflowResult = await runWorkflow(workflowId, blob, filename, "application/pdf");

      if (workflowResult.success) {
        console.log(`Workflow started: ${workflowResult.workflowRunId}`);
      } else {
        console.error(`Workflow failed: ${workflowResult.error}`);
        // Continue anyway - workflow failure shouldn't block processing
      }
    }

    // Step 4: Extract text using Unstructured
    console.log(`Extracting text from PDF: ${filename}`);
    const extraction = await extractPdfFromBuffer(pdfBuffer, filename);
    const combinedChunks = combineChunks(extraction.chunks);

    await convex.mutation(api.processing.updateJob, {
      jobId,
      stage: "embedding",
      metadata: { chunksExtracted: combinedChunks.length },
    });

    // Step 5: Generate embeddings
    console.log(`Generating embeddings for ${combinedChunks.length} chunks`);
    const texts = combinedChunks.map((c) => c.text);
    const embeddings = await embedDocuments(texts);

    await convex.mutation(api.processing.updateJob, {
      jobId,
      stage: "storing",
    });

    // Step 6: Store in Weaviate
    console.log("Storing chunks in Weaviate");
    const weaviateChunks: PDFChunk[] = combinedChunks.map((chunk, index) => ({
      content: chunk.text,
      chunkIndex: index,
      pageNumber: chunk.pageNumber,
      convexId: pdfId,
      filename,
      title,
    }));

    const weaviateIds = await insertChunks(weaviateChunks, embeddings);

    // Step 7: Update job and PDF status
    await convex.mutation(api.processing.updateJob, {
      jobId,
      stage: "completed",
      metadata: { chunksStored: weaviateIds.length },
    });

    await convex.mutation(api.pdfs.updateStatus, {
      id: pdfId,
      status: "completed",
      weaviateId: weaviateIds[0],
      pageCount: extraction.metadata.pageCount,
    });

    // Check if metadata extraction is enabled
    const metadataExtractionEnabled = await convex.query(api.settings.get, {
      key: "metadata_extraction_enabled",
    });

    // Extract metadata if enabled
    if (metadataExtractionEnabled !== "false") {
      console.log("Extracting metadata for PDF:", pdfId);
      try {
        // Generate thumbnail from already downloaded buffer
        let thumbnailDataUrl: string | undefined;
        try {
          const thumbnailBuffer = await generatePdfThumbnailBuffer(pdfBuffer, 1.5);
          const base64 = thumbnailBuffer.toString("base64");
          thumbnailDataUrl = `data:image/png;base64,${base64}`;
          console.log("Thumbnail generated successfully");
        } catch (thumbError) {
          console.error("Thumbnail generation error:", thumbError);
        }

        // Extract metadata using Firecrawl
        const extractResult = await extractPDFMetadata(url);
        if (extractResult.success && extractResult.data) {
          await convex.mutation(api.pdfs.updateExtractedMetadata, {
            id: pdfId,
            title: extractResult.data.title || title,
            company: extractResult.data.company,
            dateOrYear: extractResult.data.dateOrYear,
            topic: extractResult.data.topic,
            summary: extractResult.data.summary,
            thumbnailUrl: thumbnailDataUrl,
            continent: extractResult.data.continent,
            industry: extractResult.data.industry,
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
      chunksProcessed: weaviateIds.length,
    });
  } catch (error) {
    console.error("Process PDF from URL error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
