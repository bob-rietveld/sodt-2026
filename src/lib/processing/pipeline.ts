import { ConvexHttpClient } from "convex/browser";
import { createHash } from "crypto";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { extractPdfFromUrl, extractPdfFromBuffer, combineChunks } from "../unstructured/client";
import { embedDocuments } from "../voyage/client";
import { insertChunks, deleteByConvexId, PDFChunk } from "../weaviate/client";
import { downloadFile, getFile } from "../google/drive";

// Calculate SHA-256 hash of buffer
function calculateBufferHash(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

let convexClient: ConvexHttpClient | null = null;

function getConvexClient(): ConvexHttpClient {
  if (!convexClient) {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) {
      throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
    }
    convexClient = new ConvexHttpClient(url);
  }
  return convexClient;
}

export interface ProcessingResult {
  success: boolean;
  error?: string;
  chunksProcessed?: number;
  weaviateIds?: string[];
}

export async function processPdfFromUpload(
  pdfId: Id<"pdfs">,
  fileUrl: string,
  filename: string,
  title: string
): Promise<ProcessingResult> {
  let jobId: Id<"processingJobs"> | null = null;

  try {
    const convex = getConvexClient();

    // Create processing job
    jobId = await convex.mutation(api.processing.createJob, {
      pdfId,
      stage: "extracting",
    });

    // Update PDF status
    await convex.mutation(api.pdfs.updateStatus, {
      id: pdfId,
      status: "processing",
    });

    // Stage 1: Extract text from PDF
    console.log(`Extracting PDF: ${filename}`);
    const extraction = await extractPdfFromUrl(fileUrl, filename);
    const combinedChunks = combineChunks(extraction.chunks);

    await convex.mutation(api.processing.updateJob, {
      jobId,
      stage: "embedding",
      metadata: { chunksExtracted: combinedChunks.length },
    });

    // Stage 2: Generate embeddings
    console.log(`Generating embeddings for ${combinedChunks.length} chunks`);
    const texts = combinedChunks.map((c) => c.text);
    const embeddings = await embedDocuments(texts);

    await convex.mutation(api.processing.updateJob, {
      jobId,
      stage: "storing",
    });

    // Stage 3: Store in Weaviate
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

    // Update job and PDF status
    await convex.mutation(api.processing.updateJob, {
      jobId,
      stage: "completed",
      metadata: { chunksStored: weaviateIds.length },
    });

    await convex.mutation(api.pdfs.updateStatus, {
      id: pdfId,
      status: "completed",
      weaviateId: weaviateIds[0], // Store first chunk ID as reference
      pageCount: extraction.metadata.pageCount,
    });

    return {
      success: true,
      chunksProcessed: weaviateIds.length,
      weaviateIds,
    };
  } catch (error) {
    const convex = getConvexClient();
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`Processing failed for ${pdfId}:`, errorMessage);

    if (jobId) {
      await convex.mutation(api.processing.updateJob, {
        jobId,
        stage: "failed",
        error: errorMessage,
      });
    }

    await convex.mutation(api.pdfs.updateStatus, {
      id: pdfId,
      status: "failed",
      processingError: errorMessage,
    });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

export async function processPdfFromDrive(
  driveFileId: string
): Promise<ProcessingResult> {
  try {
    const convex = getConvexClient();

    // Get file info from Drive
    const fileInfo = await getFile(driveFileId);
    if (!fileInfo) {
      throw new Error(`File not found in Drive: ${driveFileId}`);
    }

    // Check if already processed by Drive file ID
    const existingByDriveId = await convex.query(api.pdfs.getByDriveFileId, {
      driveFileId,
    });
    if (existingByDriveId) {
      console.log(`File already processed (by Drive ID): ${driveFileId}`);
      return { success: true, chunksProcessed: 0 };
    }

    // Download the file first to check for content-based duplicates
    console.log(`Downloading from Drive: ${fileInfo.name}`);
    const fileBuffer = await downloadFile(driveFileId);

    // Calculate file hash and check for duplicates by content
    const fileHash = calculateBufferHash(fileBuffer);
    console.log(`Calculated file hash: ${fileHash.substring(0, 16)}...`);

    const duplicateCheck = await convex.query(api.pdfs.checkDuplicate, { fileHash });
    if (duplicateCheck.isDuplicate) {
      console.log(`Duplicate content found: ${fileInfo.name} matches "${duplicateCheck.existingPdf?.title}"`);
      return {
        success: false,
        error: `Duplicate file: This PDF has already been uploaded as "${duplicateCheck.existingPdf?.title}"`,
      };
    }

    // Create PDF record in Convex with hash
    const pdfId = await convex.mutation(api.pdfs.create, {
      title: fileInfo.name.replace(".pdf", ""),
      filename: fileInfo.name,
      fileHash,
      driveFileId,
      source: "drive",
    });

    // Create processing job
    const jobId = await convex.mutation(api.processing.createJob, {
      pdfId,
      stage: "extracting",
    });

    await convex.mutation(api.pdfs.updateStatus, {
      id: pdfId,
      status: "processing",
    });

    // Extract text from already downloaded buffer
    const extraction = await extractPdfFromBuffer(fileBuffer, fileInfo.name);
    const combinedChunks = combineChunks(extraction.chunks);

    await convex.mutation(api.processing.updateJob, {
      jobId,
      stage: "embedding",
    });

    // Generate embeddings
    console.log(`Generating embeddings for ${combinedChunks.length} chunks`);
    const texts = combinedChunks.map((c) => c.text);
    const embeddings = await embedDocuments(texts);

    await convex.mutation(api.processing.updateJob, {
      jobId,
      stage: "storing",
    });

    // Store in Weaviate
    const weaviateChunks: PDFChunk[] = combinedChunks.map((chunk, index) => ({
      content: chunk.text,
      chunkIndex: index,
      pageNumber: chunk.pageNumber,
      convexId: pdfId,
      filename: fileInfo.name,
      title: fileInfo.name.replace(".pdf", ""),
    }));

    const weaviateIds = await insertChunks(weaviateChunks, embeddings);

    // Finalize
    await convex.mutation(api.processing.updateJob, {
      jobId,
      stage: "completed",
    });

    await convex.mutation(api.pdfs.updateStatus, {
      id: pdfId,
      status: "completed",
      weaviateId: weaviateIds[0],
      pageCount: extraction.metadata.pageCount,
    });

    return {
      success: true,
      chunksProcessed: weaviateIds.length,
      weaviateIds,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`Drive processing failed:`, errorMessage);
    return { success: false, error: errorMessage };
  }
}

export async function reprocessPdf(pdfId: Id<"pdfs">): Promise<ProcessingResult> {
  const convex = getConvexClient();
  const pdf = await convex.query(api.pdfs.get, { id: pdfId });
  if (!pdf) {
    return { success: false, error: "PDF not found" };
  }

  // Delete existing Weaviate data
  await deleteByConvexId(pdfId);

  // Re-process based on source
  if (pdf.source === "drive" && pdf.driveFileId) {
    // Reset the PDF record first
    await convex.mutation(api.pdfs.updateStatus, {
      id: pdfId,
      status: "pending",
      processingError: undefined,
      weaviateId: undefined,
    });

    return processPdfFromDrive(pdf.driveFileId);
  } else if (pdf.storageId) {
    const fileUrl = await convex.query(api.pdfs.getFileUrl, {
      storageId: pdf.storageId,
    });

    if (!fileUrl) {
      return { success: false, error: "File not found in storage" };
    }

    return processPdfFromUpload(pdfId, fileUrl, pdf.filename, pdf.title);
  }

  return { success: false, error: "No file source available" };
}
