import { ConvexHttpClient } from "convex/browser";
import { createHash } from "crypto";
import { writeFile, unlink, mkdir } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { uploadFile, deleteFile, describeFile, FileMetadata } from "../pinecone/client";
import { downloadFile, getFile } from "../google/drive";

// Build comprehensive metadata for Pinecone upload
interface PdfRecord {
  title?: string;
  filename?: string;
  company?: string;
  dateOrYear?: number | string;
  continent?: string;
  industry?: string;
  documentType?: string;
  source?: string;
  author?: string;
  keywords?: string[];
  technologyAreas?: string[];
  summary?: string;
  keyFindings?: string[];
}

function buildPineconeMetadata(
  convexId: string,
  pdf: PdfRecord,
  additionalMetadata?: Record<string, string>
): FileMetadata {
  const metadata: FileMetadata = {
    convex_id: convexId,
    title: pdf.title || "",
    filename: pdf.filename || "",
  };

  // Add optional metadata fields
  if (pdf.company) metadata.company = pdf.company;
  if (pdf.dateOrYear) metadata.year = String(pdf.dateOrYear);
  if (pdf.continent) metadata.continent = pdf.continent;
  if (pdf.industry) metadata.industry = pdf.industry;
  if (pdf.documentType) metadata.document_type = pdf.documentType;
  if (pdf.source) metadata.source = pdf.source;
  if (pdf.author) metadata.author = pdf.author;
  if (pdf.keywords) metadata.keywords = pdf.keywords.join(", ");
  if (pdf.technologyAreas) metadata.technology_areas = pdf.technologyAreas.join(", ");

  // Merge additional metadata
  if (additionalMetadata) {
    Object.assign(metadata, additionalMetadata);
  }

  return metadata;
}

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

// Helper to write buffer to temp file
async function writeTempFile(buffer: Buffer, filename: string): Promise<string> {
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

export interface ProcessingResult {
  success: boolean;
  error?: string;
  pineconeFileId?: string;
}

export async function processPdfFromUpload(
  pdfId: Id<"pdfs">,
  fileUrl: string,
  filename: string,
  title: string
): Promise<ProcessingResult> {
  let jobId: Id<"processingJobs"> | null = null;
  let tempFilePath: string | null = null;

  try {
    const convex = getConvexClient();

    // Get full PDF record for metadata
    const pdf = await convex.query(api.pdfs.get, { id: pdfId });

    // Create processing job
    jobId = await convex.mutation(api.processing.createJob, {
      pdfId,
      stage: "extracting",
    });

    // Update PDF status
    await convex.mutation(api.pdfs.updateStatus, {
      id: pdfId,
      status: "processing",
      pineconeFileStatus: "Processing",
    });

    // Stage 1: Download PDF
    console.log(`Downloading PDF: ${filename}`);
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to download PDF: ${response.status}`);
    }
    const pdfBuffer = Buffer.from(await response.arrayBuffer());

    await convex.mutation(api.processing.updateJob, {
      jobId,
      stage: "embedding",
    });

    // Stage 2: Write to temp file and upload to Pinecone with comprehensive metadata
    console.log(`Uploading to Pinecone Assistant: ${filename}`);
    tempFilePath = await writeTempFile(pdfBuffer, filename);

    // Build comprehensive metadata from PDF record
    const metadata = buildPineconeMetadata(pdfId, pdf || { title, filename });

    const uploadResult = await uploadFile(tempFilePath, metadata);

    // Update status to show file is uploaded but still processing
    await convex.mutation(api.pdfs.updateStatus, {
      id: pdfId,
      status: "processing",
      pineconeFileId: uploadResult.id,
      pineconeFileStatus: "Processing",
    });

    await convex.mutation(api.processing.updateJob, {
      jobId,
      stage: "storing",
    });

    // Stage 3: Wait for processing to complete
    console.log(`Waiting for Pinecone to process file: ${uploadResult.id}`);
    await waitForFileProcessing(uploadResult.id);

    // Update job and PDF status
    await convex.mutation(api.processing.updateJob, {
      jobId,
      stage: "completed",
      metadata: { pineconeFileId: uploadResult.id },
    });

    await convex.mutation(api.pdfs.updateStatus, {
      id: pdfId,
      status: "completed",
      pineconeFileId: uploadResult.id,
      pineconeFileStatus: "Available",
    });

    return {
      success: true,
      pineconeFileId: uploadResult.id,
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
      pineconeFileStatus: "Failed",
    });

    return {
      success: false,
      error: errorMessage,
    };
  } finally {
    // Clean up temp file
    if (tempFilePath) {
      await cleanupTempFile(tempFilePath);
    }
  }
}

export async function processPdfFromDrive(
  driveFileId: string
): Promise<ProcessingResult> {
  let tempFilePath: string | null = null;

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
      return { success: true };
    }

    // Download the file first to check for content-based duplicates
    console.log(`Downloading from Drive: ${fileInfo.name}`);
    const fileBuffer = await downloadFile(driveFileId);

    // Calculate file hash and check for duplicates by content
    const fileHash = calculateBufferHash(fileBuffer);
    console.log(`Calculated file hash: ${fileHash.substring(0, 16)}...`);

    const duplicateCheck = await convex.query(api.pdfs.checkDuplicate, {
      fileHash,
    });
    if (duplicateCheck.isDuplicate) {
      console.log(
        `Duplicate content found: ${fileInfo.name} matches "${duplicateCheck.existingPdf?.title}"`
      );
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
      pineconeFileStatus: "Processing",
    });

    // Write to temp file and upload to Pinecone with metadata
    console.log(`Uploading to Pinecone Assistant: ${fileInfo.name}`);
    tempFilePath = await writeTempFile(fileBuffer, fileInfo.name);

    // Get the PDF record for metadata
    const pdf = await convex.query(api.pdfs.get, { id: pdfId });
    const metadata = buildPineconeMetadata(pdfId, pdf || {
      title: fileInfo.name.replace(".pdf", ""),
      filename: fileInfo.name,
    }, { driveFileId });

    const uploadResult = await uploadFile(tempFilePath, metadata);

    // Update with Pinecone file ID while processing
    await convex.mutation(api.pdfs.updateStatus, {
      id: pdfId,
      status: "processing",
      pineconeFileId: uploadResult.id,
      pineconeFileStatus: "Processing",
    });

    await convex.mutation(api.processing.updateJob, {
      jobId,
      stage: "storing",
    });

    // Wait for processing to complete
    console.log(`Waiting for Pinecone to process file: ${uploadResult.id}`);
    await waitForFileProcessing(uploadResult.id);

    // Finalize
    await convex.mutation(api.processing.updateJob, {
      jobId,
      stage: "completed",
      metadata: { pineconeFileId: uploadResult.id },
    });

    await convex.mutation(api.pdfs.updateStatus, {
      id: pdfId,
      status: "completed",
      pineconeFileId: uploadResult.id,
      pineconeFileStatus: "Available",
    });

    return {
      success: true,
      pineconeFileId: uploadResult.id,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`Drive processing failed:`, errorMessage);
    return { success: false, error: errorMessage };
  } finally {
    // Clean up temp file
    if (tempFilePath) {
      await cleanupTempFile(tempFilePath);
    }
  }
}

export async function reprocessPdf(pdfId: Id<"pdfs">): Promise<ProcessingResult> {
  const convex = getConvexClient();
  const pdf = await convex.query(api.pdfs.get, { id: pdfId });
  if (!pdf) {
    return { success: false, error: "PDF not found" };
  }

  // Delete existing Pinecone file if it exists
  if (pdf.pineconeFileId) {
    try {
      await deleteFile(pdf.pineconeFileId);
    } catch (error) {
      console.warn(`Failed to delete Pinecone file: ${error}`);
      // Continue anyway - file might not exist
    }
  }

  // Re-process based on source
  if (pdf.source === "drive" && pdf.driveFileId) {
    // Reset the PDF record first
    await convex.mutation(api.pdfs.updateStatus, {
      id: pdfId,
      status: "pending",
      processingError: undefined,
      pineconeFileId: undefined,
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
