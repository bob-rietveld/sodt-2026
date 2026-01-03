import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { uploadFile } from "@/lib/pinecone/client";
import { writeFile, unlink, mkdir } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

function getConvexClient(): ConvexHttpClient {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
  }
  return new ConvexHttpClient(url);
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

export async function POST(request: NextRequest) {
  let tempFilePath: string | null = null;

  try {
    const body = await request.json();
    const { pdfId } = body;

    if (!pdfId) {
      return NextResponse.json(
        { error: "pdfId is required" },
        { status: 400 }
      );
    }

    const convex = getConvexClient();

    // Get PDF record from Convex
    const pdf = await convex.query(api.pdfs.get, { id: pdfId as Id<"pdfs"> });
    if (!pdf) {
      return NextResponse.json(
        { error: "PDF record not found" },
        { status: 404 }
      );
    }

    // Get extracted text
    let extractedText: string | null = null;
    if (pdf.extractedTextStorageId) {
      const textUrl = await convex.query(api.pdfs.getExtractedTextUrl, { id: pdfId as Id<"pdfs"> });
      if (textUrl) {
        const textResponse = await fetch(textUrl);
        if (textResponse.ok) {
          extractedText = await textResponse.text();
        }
      }
    }

    if (!extractedText) {
      // Mark as failed if no extracted text
      await convex.mutation(api.pdfs.updatePineconeStatus, {
        id: pdfId as Id<"pdfs">,
        pineconeFileStatus: "Failed",
      });
      return NextResponse.json(
        { error: "No extracted text available for this PDF" },
        { status: 400 }
      );
    }

    // Build metadata for Pinecone
    const metadata: Record<string, string> = {
      convex_id: pdfId,
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

    // Prepend summary and key findings to content if available
    let enrichedContent = "";
    if (pdf.summary) {
      enrichedContent += `SUMMARY:\n${pdf.summary}\n\n`;
    }
    if (pdf.keyFindings && pdf.keyFindings.length > 0) {
      enrichedContent += `KEY FINDINGS:\n${pdf.keyFindings.map((f: string, i: number) => `${i + 1}. ${f}`).join("\n")}\n\n`;
    }
    enrichedContent += "DOCUMENT CONTENT:\n" + extractedText;

    // Write content to temp file for Pinecone upload
    const textFilename = (pdf.filename || "document").replace(".pdf", ".txt");
    tempFilePath = await writeTempFile(Buffer.from(enrichedContent, "utf-8"), textFilename);

    // Update status to Processing
    await convex.mutation(api.pdfs.updatePineconeStatus, {
      id: pdfId as Id<"pdfs">,
      pineconeFileStatus: "Processing",
    });

    // Upload to Pinecone Assistant
    const uploadResult = await uploadFile(tempFilePath, metadata);

    // Update PDF with Pinecone file ID and status
    await convex.mutation(api.pdfs.updatePineconeStatus, {
      id: pdfId as Id<"pdfs">,
      pineconeFileId: uploadResult.id,
      pineconeFileStatus: uploadResult.status === "Available" ? "Available" : "Processing",
    });

    return NextResponse.json({
      success: true,
      pineconeFileId: uploadResult.id,
      status: uploadResult.status,
    });
  } catch (error) {
    console.error("Pinecone index error:", error);

    // Try to update status to Failed
    try {
      const body = await request.clone().json();
      if (body.pdfId) {
        const convex = getConvexClient();
        await convex.mutation(api.pdfs.updatePineconeStatus, {
          id: body.pdfId as Id<"pdfs">,
          pineconeFileStatus: "Failed",
        });
      }
    } catch {
      // Ignore update errors
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Indexing failed" },
      { status: 500 }
    );
  } finally {
    if (tempFilePath) {
      await cleanupTempFile(tempFilePath);
    }
  }
}
