import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { extractPDFMetadataLocal } from "@/lib/pdf/extractor";
import { generatePdfThumbnailBuffer } from "@/lib/pdf/thumbnail";

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

    // Get PDF record
    const pdf = await convex.query(api.pdfs.get, { id: pdfId as Id<"pdfs"> });
    if (!pdf) {
      return NextResponse.json(
        { error: "PDF record not found" },
        { status: 404 }
      );
    }

    // Get file URL
    let fileUrl: string | null = null;
    if (pdf.storageId) {
      fileUrl = await convex.query(api.pdfs.getFileUrl, {
        storageId: pdf.storageId as Id<"_storage">,
      });
    } else if (pdf.sourceUrl) {
      fileUrl = pdf.sourceUrl;
    }

    if (!fileUrl) {
      return NextResponse.json(
        { error: "Could not resolve file URL" },
        { status: 400 }
      );
    }

    // Fetch PDF buffer for both thumbnail and local text extraction
    const pdfResponse = await fetch(fileUrl);
    if (!pdfResponse.ok) {
      return NextResponse.json(
        { error: `Failed to fetch PDF: ${pdfResponse.status}` },
        { status: 500 }
      );
    }
    const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
    console.log("PDF fetched, size:", pdfBuffer.length, "bytes");

    // Generate new thumbnail if missing
    let thumbnailDataUrl = pdf.thumbnailUrl;
    if (!thumbnailDataUrl) {
      try {
        const thumbnailBuffer = await generatePdfThumbnailBuffer(pdfBuffer, 1.5);
        const base64 = thumbnailBuffer.toString("base64");
        thumbnailDataUrl = `data:image/png;base64,${base64}`;
      } catch (thumbError) {
        console.error("Thumbnail generation error:", thumbError);
      }
    }

    // Extract metadata using local PDF extraction (no Firecrawl)
    const extractResult = await extractPDFMetadataLocal(pdfBuffer);

    if (extractResult.success && extractResult.data) {
      // Store extracted text in Convex storage
      if (extractResult.extractedText) {
        try {
          const textUploadUrl = await convex.mutation(api.pdfs.generateUploadUrl, {});
          const textBlob = new Blob([extractResult.extractedText], { type: "text/plain" });
          const uploadResponse = await fetch(textUploadUrl, {
            method: "POST",
            headers: { "Content-Type": "text/plain" },
            body: textBlob,
          });
          if (uploadResponse.ok) {
            const { storageId: textStorageId } = await uploadResponse.json();
            await convex.mutation(api.pdfs.updateExtractedTextStorageId, {
              id: pdfId as Id<"pdfs">,
              extractedTextStorageId: textStorageId,
            });
            console.log("Extracted text stored in Convex storage");
          }
        } catch (storageError) {
          console.error("Failed to store extracted text:", storageError);
        }
      }

      await convex.mutation(api.pdfs.updateExtractedMetadata, {
        id: pdfId as Id<"pdfs">,
        title: extractResult.data.title || pdf.title,
        company: extractResult.data.company,
        dateOrYear: extractResult.data.dateOrYear,
        topic: extractResult.data.topic,
        summary: extractResult.data.summary,
        thumbnailUrl: thumbnailDataUrl,
        continent: extractResult.data.continent,
        industry: extractResult.data.industry,
        documentType: extractResult.data.documentType,
        authors: extractResult.data.authors,
        keyFindings: extractResult.data.keyFindings,
        keywords: extractResult.data.keywords,
        technologyAreas: extractResult.data.technologyAreas,
      });

      return NextResponse.json({
        success: true,
        pdfId,
        extractedFields: Object.keys(extractResult.data),
        extractedTextLength: extractResult.extractedText?.length,
        pageCount: extractResult.pageCount,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: extractResult.error || "Extraction failed",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Reprocess metadata error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
