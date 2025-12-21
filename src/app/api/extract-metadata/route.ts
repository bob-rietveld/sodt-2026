import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { extractPDFMetadataFromUrl } from "@/lib/pdf/extractor";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";

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
    const { url, pdfId } = body;

    console.log("extract-metadata: Received URL:", url, "pdfId:", pdfId);

    if (!url) {
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400 }
      );
    }

    // Check environment variables
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("extract-metadata: ANTHROPIC_API_KEY is not set");
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY is not configured" },
        { status: 500 }
      );
    }

    console.log("extract-metadata: Starting local PDF extraction...");
    const result = await extractPDFMetadataFromUrl(url);

    if (!result.success) {
      console.error("extract-metadata: Extraction failed:", result.error);
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    // Store extracted text in Convex storage if pdfId is provided
    if (pdfId && result.extractedText) {
      try {
        const convex = getConvexClient();
        const textUploadUrl = await convex.mutation(api.pdfs.generateUploadUrl, {});
        const textBlob = new Blob([result.extractedText], { type: "text/plain" });
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
          console.log("extract-metadata: Extracted text stored in Convex storage");
        }
      } catch (storageError) {
        console.error("extract-metadata: Failed to store extracted text:", storageError);
        // Continue anyway - text storage failure shouldn't block metadata extraction
      }
    }

    console.log("extract-metadata: Extraction successful:", result.data);
    return NextResponse.json({
      success: true,
      data: result.data,
      extractedTextLength: result.extractedText?.length,
      pageCount: result.pageCount,
    });
  } catch (error) {
    console.error("extract-metadata: Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
