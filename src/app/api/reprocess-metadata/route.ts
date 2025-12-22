import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { extractPDFMetadataLocal, extractMetadataFromText, extractTextFromPdf } from "@/lib/pdf/extractor";
import { tryGenerateThumbnail } from "@/lib/pdf/thumbnail";

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

    // Check if we have cached extracted text
    let extractedText: string | null = null;
    let pageCount: number | undefined;
    let usedCachedText = false;

    if (pdf.extractedTextStorageId) {
      console.log("Found cached extracted text, fetching from storage...");
      try {
        const textUrl = await convex.query(api.pdfs.getExtractedTextUrl, { id: pdfId as Id<"pdfs"> });
        if (textUrl) {
          const textResponse = await fetch(textUrl);
          if (textResponse.ok) {
            extractedText = await textResponse.text();
            usedCachedText = true;
            console.log(`Using cached text: ${extractedText.length} chars`);
          }
        }
      } catch (cacheError) {
        console.error("Failed to fetch cached text:", cacheError);
      }
    }

    // If no cached text, extract from PDF
    let pdfBuffer: Buffer | null = null;
    if (!extractedText) {
      if (!fileUrl) {
        return NextResponse.json(
          { error: "Could not resolve file URL" },
          { status: 400 }
        );
      }

      console.log("No cached text found, extracting from PDF...");
      const pdfResponse = await fetch(fileUrl);
      if (!pdfResponse.ok) {
        return NextResponse.json(
          { error: `Failed to fetch PDF: ${pdfResponse.status}` },
          { status: 500 }
        );
      }
      pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
      console.log("PDF fetched, size:", pdfBuffer.length, "bytes");

      // Extract text from PDF
      const textResult = await extractTextFromPdf(pdfBuffer);
      if (textResult.success && textResult.text) {
        extractedText = textResult.text;
        pageCount = textResult.pageCount;
        console.log(`Text extracted: ${extractedText.length} chars, ${pageCount} pages`);

        // Store extracted text in Convex storage for future use
        try {
          const textUploadUrl = await convex.mutation(api.pdfs.generateUploadUrl, {});
          const textBlob = new Blob([extractedText], { type: "text/plain" });
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
            console.log("Extracted text stored in Convex storage for future use");
          }
        } catch (storageError) {
          console.error("Failed to store extracted text:", storageError);
        }
      } else {
        return NextResponse.json(
          { success: false, error: textResult.error || "Failed to extract text from PDF" },
          { status: 500 }
        );
      }
    }

    // Generate thumbnail if missing and we have the PDF buffer
    let thumbnailDataUrl: string | undefined = pdf.thumbnailUrl;
    if (!thumbnailDataUrl && pdfBuffer) {
      console.log("Attempting thumbnail generation...");
      const generatedThumbnail = await tryGenerateThumbnail(pdfBuffer, 1.5);
      if (generatedThumbnail) {
        thumbnailDataUrl = generatedThumbnail;
        console.log("Thumbnail generated successfully");
      } else {
        console.log("Thumbnail generation skipped (not available in this environment)");
      }
    }

    // Fetch existing keywords and technology areas for consistency
    console.log("Fetching existing keywords and technology areas for context...");
    const extractionContext = await convex.query(api.pdfs.getExtractionContext, {});
    console.log(`Found ${extractionContext.existingKeywords.length} existing keywords and ${extractionContext.existingTechnologyAreas.length} existing technology areas`);

    // Extract metadata from text using Claude
    console.log("Extracting metadata using Claude...");
    const metadataResult = await extractMetadataFromText(extractedText, {
      existingKeywords: extractionContext.existingKeywords,
      existingTechnologyAreas: extractionContext.existingTechnologyAreas,
    });

    if (metadataResult.success && metadataResult.data) {
      // Log the extracted data in detail
      console.log("reprocess-metadata: Extracted data:", JSON.stringify({
        documentType: metadataResult.data.documentType,
        documentTypeType: typeof metadataResult.data.documentType,
        authors: metadataResult.data.authors,
        authorsIsArray: Array.isArray(metadataResult.data.authors),
        authorsLength: metadataResult.data.authors?.length,
        keyFindingsLength: metadataResult.data.keyFindings?.length,
        keywordsLength: metadataResult.data.keywords?.length,
        technologyAreas: metadataResult.data.technologyAreas,
      }));

      const metadataUpdate = {
        id: pdfId as Id<"pdfs">,
        title: metadataResult.data.title || pdf.title,
        company: metadataResult.data.company,
        dateOrYear: metadataResult.data.dateOrYear,
        topic: metadataResult.data.topic,
        summary: metadataResult.data.summary,
        thumbnailUrl: thumbnailDataUrl || undefined,
        continent: metadataResult.data.continent,
        industry: metadataResult.data.industry,
        documentType: metadataResult.data.documentType,
        authors: metadataResult.data.authors,
        keyFindings: metadataResult.data.keyFindings,
        keywords: metadataResult.data.keywords,
        technologyAreas: metadataResult.data.technologyAreas,
      };
      console.log("reprocess-metadata: Calling updateExtractedMetadata with:", JSON.stringify(metadataUpdate, null, 2));

      try {
        await convex.mutation(api.pdfs.updateExtractedMetadata, metadataUpdate);
        console.log("reprocess-metadata: Mutation completed successfully");
      } catch (mutationError) {
        console.error("reprocess-metadata: Mutation error:", mutationError);
        throw mutationError;
      }

      return NextResponse.json({
        success: true,
        pdfId,
        usedCachedText,
        extractedFields: Object.keys(metadataResult.data),
        extractedTextLength: extractedText.length,
        pageCount,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: metadataResult.error || "Metadata extraction failed",
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
