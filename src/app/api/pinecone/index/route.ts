import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { indexPdfToPineconeFromExtractedText } from "@/lib/processing/pinecone-index";

function getConvexClient(): ConvexHttpClient {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
  }
  return new ConvexHttpClient(url);
}

export async function POST(request: NextRequest) {
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

    if (!extractedText || extractedText.trim().length === 0) {
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

    const { pineconeFileId, status } = await indexPdfToPineconeFromExtractedText(
      convex,
      {
        _id: pdfId as Id<"pdfs">,
        title: pdf.title,
        filename: pdf.filename,
        company: pdf.company,
        dateOrYear: pdf.dateOrYear,
        continent: pdf.continent,
        industry: pdf.industry,
        documentType: pdf.documentType,
        source: pdf.source,
        author: pdf.author,
        keywords: pdf.keywords,
        technologyAreas: pdf.technologyAreas,
        summary: pdf.summary,
        keyFindings: pdf.keyFindings,
        pineconeFileId: pdf.pineconeFileId,
      },
      extractedText,
      { replaceExisting: true }
    );

    return NextResponse.json({
      success: status === "Available",
      pineconeFileId,
      status,
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
  }
}
