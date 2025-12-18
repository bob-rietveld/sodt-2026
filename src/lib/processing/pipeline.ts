import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { extractPdfFromUrl, extractPdfFromBuffer, combineChunks } from "../unstructured/client";
import { embedDocuments } from "../voyage/client";
import { insertChunks, deleteByConvexId, PDFChunk } from "../weaviate/client";
import { downloadFile, getFile } from "../google/drive";

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

    // Check if already processed
    const existing = await convex.query(api.pdfs.getByDriveFileId, {
      driveFileId,
    });
    if (existing) {
      console.log(`File already processed: ${driveFileId}`);
      return { success: true, chunksProcessed: 0 };
    }

    // Create PDF record in Convex
    const pdfId = await convex.mutation(api.pdfs.create, {
      title: fileInfo.name.replace(".pdf", ""),
      filename: fileInfo.name,
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

    // Download and extract
    console.log(`Downloading from Drive: ${fileInfo.name}`);
    const fileBuffer = await downloadFile(driveFileId);
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
