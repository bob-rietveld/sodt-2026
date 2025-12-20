import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { processPdfFromUpload, reprocessPdf } from "@/lib/processing/pipeline";
import { extractPDFMetadata } from "@/lib/firecrawl/client";
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
    const { pdfId, storageId, fileUrl, filename, title, action } = body;

    const convex = getConvexClient();

    // Handle reprocessing (always allowed regardless of setting)
    if (action === "reprocess") {
      if (!pdfId) {
        return NextResponse.json(
          { error: "pdfId is required for reprocessing" },
          { status: 400 }
        );
      }

      const result = await reprocessPdf(pdfId as Id<"pdfs">);
      return NextResponse.json(result);
    }

    // Check if processing is enabled
    const processingEnabled = await convex.query(api.settings.get, {
      key: "processing_enabled",
    });

    // If processing is disabled (setting is "false"), skip processing but still extract metadata if enabled
    if (processingEnabled === "false") {
      console.log("Processing disabled via settings, marking PDF as completed without indexing");

      if (pdfId) {
        // Mark the PDF as completed without processing
        await convex.mutation(api.pdfs.updateStatus, {
          id: pdfId as Id<"pdfs">,
          status: "completed",
        });

        // Still extract metadata if enabled
        const metadataExtractionEnabled = await convex.query(api.settings.get, {
          key: "metadata_extraction_enabled",
        });

        // Get PDF record and file URL for metadata extraction
        const pdf = await convex.query(api.pdfs.get, { id: pdfId as Id<"pdfs"> });
        if (pdf && metadataExtractionEnabled !== "false" && !pdf.summary) {
          let resolvedFileUrl = fileUrl;
          if (!resolvedFileUrl && (storageId || pdf.storageId)) {
            const sid = storageId || pdf.storageId;
            resolvedFileUrl = await convex.query(api.pdfs.getFileUrl, { storageId: sid });
          }

          if (resolvedFileUrl) {
            console.log("Extracting metadata for PDF (processing disabled):", pdfId);
            try {
              // Generate thumbnail
              let thumbnailDataUrl: string | undefined;
              try {
                const pdfResponse = await fetch(resolvedFileUrl);
                if (pdfResponse.ok) {
                  const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
                  const thumbnailBuffer = await generatePdfThumbnailBuffer(pdfBuffer, 1.5);
                  const base64 = thumbnailBuffer.toString("base64");
                  thumbnailDataUrl = `data:image/png;base64,${base64}`;
                }
              } catch (thumbError) {
                console.error("Thumbnail generation error:", thumbError);
              }

              // Extract metadata using Firecrawl
              const extractResult = await extractPDFMetadata(resolvedFileUrl);
              if (extractResult.success && extractResult.data) {
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
              } else if (thumbnailDataUrl) {
                await convex.mutation(api.pdfs.updateExtractedMetadata, {
                  id: pdfId as Id<"pdfs">,
                  thumbnailUrl: thumbnailDataUrl,
                });
              }
            } catch (metadataError) {
              console.error("Metadata extraction error:", metadataError);
            }
          }
        }
      }

      return NextResponse.json({
        success: true,
        skipped: true,
        message: "Processing is disabled. PDF stored but not indexed.",
      });
    }

    // Validate pdfId
    if (!pdfId) {
      return NextResponse.json(
        { error: "pdfId is required" },
        { status: 400 }
      );
    }

    // Get PDF record from Convex
    const pdf = await convex.query(api.pdfs.get, { id: pdfId as Id<"pdfs"> });
    if (!pdf) {
      return NextResponse.json(
        { error: "PDF record not found" },
        { status: 404 }
      );
    }

    // Determine the file URL
    let resolvedFileUrl = fileUrl;
    if (!resolvedFileUrl && (storageId || pdf.storageId)) {
      const sid = storageId || pdf.storageId;
      resolvedFileUrl = await convex.query(api.pdfs.getFileUrl, { storageId: sid });
    }

    if (!resolvedFileUrl) {
      return NextResponse.json(
        { error: "Could not resolve file URL" },
        { status: 400 }
      );
    }

    // Process the PDF (text extraction, embedding, Weaviate storage)
    const result = await processPdfFromUpload(
      pdfId as Id<"pdfs">,
      resolvedFileUrl,
      filename || pdf.filename,
      title || pdf.title
    );

    // Check if metadata extraction is enabled
    const metadataExtractionEnabled = await convex.query(api.settings.get, {
      key: "metadata_extraction_enabled",
    });

    // Extract metadata if enabled and PDF doesn't already have metadata
    if (metadataExtractionEnabled !== "false" && !pdf.summary) {
      console.log("Extracting metadata for PDF:", pdfId);
      try {
        // Generate thumbnail
        let thumbnailDataUrl: string | undefined;
        try {
          const pdfResponse = await fetch(resolvedFileUrl);
          if (pdfResponse.ok) {
            const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
            const thumbnailBuffer = await generatePdfThumbnailBuffer(pdfBuffer, 1.5);
            const base64 = thumbnailBuffer.toString("base64");
            thumbnailDataUrl = `data:image/png;base64,${base64}`;
            console.log("Thumbnail generated successfully");
          }
        } catch (thumbError) {
          console.error("Thumbnail generation error:", thumbError);
        }

        // Extract metadata using Firecrawl
        const extractResult = await extractPDFMetadata(resolvedFileUrl);
        if (extractResult.success && extractResult.data) {
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
          console.log("Metadata extracted and saved:", extractResult.data);
        } else if (thumbnailDataUrl) {
          // Save thumbnail even if metadata extraction failed
          await convex.mutation(api.pdfs.updateExtractedMetadata, {
            id: pdfId as Id<"pdfs">,
            thumbnailUrl: thumbnailDataUrl,
          });
          console.log("Saved thumbnail without metadata");
        }
      } catch (metadataError) {
        console.error("Metadata extraction error:", metadataError);
        // Continue anyway - metadata extraction failure shouldn't fail the whole process
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Process PDF error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
