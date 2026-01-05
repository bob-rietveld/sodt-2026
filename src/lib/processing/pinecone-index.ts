import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { uploadFile, describeFile, deleteFile } from "@/lib/pinecone/client";
import { writeFile, unlink, mkdir } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

async function waitForPineconeAvailable(
  fileId: string,
  maxWaitMs: number = 60000,
  pollIntervalMs: number = 2000
): Promise<"Available" | "Processing" | "Failed"> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const fileInfo = await describeFile(fileId);

      if (fileInfo.status === "Available") return "Available";
      if (fileInfo.status === "Failed" || fileInfo.errorMessage) return "Failed";

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    } catch (error) {
      console.error("Error polling Pinecone file status:", error);
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  }

  return "Processing";
}

async function writeTempFile(buffer: Buffer, filename: string): Promise<string> {
  const tempDir = join(tmpdir(), "pinecone-uploads");
  await mkdir(tempDir, { recursive: true });
  const tempPath = join(tempDir, `${Date.now()}-${filename}`);
  await writeFile(tempPath, buffer);
  return tempPath;
}

async function cleanupTempFile(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch {
    // Ignore cleanup errors
  }
}

export type PdfForIndexing = {
  _id: Id<"pdfs">;
  title: string;
  filename: string;
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
  pineconeFileId?: string;
};

export async function indexPdfToPineconeFromExtractedText(
  convex: ConvexHttpClient,
  pdf: PdfForIndexing,
  extractedText: string,
  options?: { replaceExisting?: boolean }
): Promise<{ pineconeFileId: string; status: "Available" | "Processing" | "Failed" }> {
  let tempFilePath: string | null = null;

  try {
    if (options?.replaceExisting && pdf.pineconeFileId) {
      try {
        await deleteFile(pdf.pineconeFileId);
      } catch (error) {
        console.warn("Failed to delete existing Pinecone file:", error);
      }
    }

    const metadata: Record<string, string | string[]> = {
      convex_id: String(pdf._id),
      title: pdf.title || "",
      filename: pdf.filename || "",
    };

    if (pdf.company) metadata.company = pdf.company;
    if (pdf.dateOrYear) metadata.year = String(pdf.dateOrYear);
    if (pdf.continent) metadata.continent = pdf.continent;
    if (pdf.industry) metadata.industry = pdf.industry;
    if (pdf.documentType) metadata.document_type = String(pdf.documentType);
    if (pdf.source) metadata.source = pdf.source;
    if (pdf.author) metadata.author = pdf.author;
    // Store as arrays for proper $in filtering in Pinecone
    if (pdf.keywords?.length) metadata.keywords = pdf.keywords;
    if (pdf.technologyAreas?.length) metadata.technology_areas = pdf.technologyAreas;

    let enrichedContent = "";
    if (pdf.summary) enrichedContent += `SUMMARY:\n${pdf.summary}\n\n`;
    if (pdf.keyFindings && pdf.keyFindings.length > 0) {
      enrichedContent += `KEY FINDINGS:\n${pdf.keyFindings
        .map((f: string, i: number) => `${i + 1}. ${f}`)
        .join("\n")}\n\n`;
    }
    enrichedContent += "DOCUMENT CONTENT:\n" + extractedText;

    const textFilename = (pdf.filename || "document").replace(/\.pdf$/i, ".txt");
    tempFilePath = await writeTempFile(Buffer.from(enrichedContent, "utf-8"), textFilename);

    await convex.mutation(api.pdfs.updatePineconeStatus, {
      id: pdf._id,
      pineconeFileStatus: "Processing",
    });

    const uploadResult = await uploadFile(tempFilePath, metadata);

    await convex.mutation(api.pdfs.updatePineconeStatus, {
      id: pdf._id,
      pineconeFileId: uploadResult.id,
      pineconeFileStatus: "Processing",
    });

    const finalStatus = await waitForPineconeAvailable(uploadResult.id, 60000, 2000);

    await convex.mutation(api.pdfs.updatePineconeStatus, {
      id: pdf._id,
      pineconeFileStatus: finalStatus,
    });

    return { pineconeFileId: uploadResult.id, status: finalStatus };
  } finally {
    if (tempFilePath) {
      await cleanupTempFile(tempFilePath);
    }
  }
}

