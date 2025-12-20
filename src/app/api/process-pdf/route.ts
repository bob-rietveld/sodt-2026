import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { processPdfFromUpload, reprocessPdf } from "@/lib/processing/pipeline";
import { extractPDFMetadataLocal } from "@/lib/pdf/extractor";
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
              // Fetch PDF buffer for both thumbnail and local text extraction
              const pdfResponse = await fetch(resolvedFileUrl);
              if (!pdfResponse.ok) {
                throw new Error(`Failed to fetch PDF: ${pdfResponse.status}`);
              }
              const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
              console.log("PDF fetched, size:", pdfBuffer.length, "bytes");

              // Generate thumbnail (graceful - returns null if unavailable)
              const thumbnailDataUrl = await tryGenerateThumbnail(pdfBuffer, 1.5);

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
                      const { storageId } = await uploadResponse.json();
                      await convex.mutation(api.pdfs.updateExtractedTextStorageId, {
                        id: pdfId as Id<"pdfs">,
                        extractedTextStorageId: storageId,
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
                  thumbnailUrl: thumbnailDataUrl || undefined,
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
        // Fetch PDF buffer for both thumbnail and local text extraction
        const pdfResponse = await fetch(resolvedFileUrl);
        if (!pdfResponse.ok) {
          throw new Error(`Failed to fetch PDF: ${pdfResponse.status}`);
        }
        const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
        console.log("PDF fetched, size:", pdfBuffer.length, "bytes");

        // Generate thumbnail (graceful - returns null if unavailable)
        const thumbnailDataUrl = await tryGenerateThumbnail(pdfBuffer, 1.5);
        if (thumbnailDataUrl) {
          console.log("Thumbnail generated successfully");
        }

        // Extract metadata using local PDF extraction (no Firecrawl)
        const extractResult = await extractPDFMetadataLocal(pdfBuffer);
        console.log("process-pdf: Extract result data:", JSON.stringify({
          documentType: extractResult.data?.documentType,
          documentTypeType: typeof extractResult.data?.documentType,
          authors: extractResult.data?.authors,
          authorsIsArray: Array.isArray(extractResult.data?.authors),
          keyFindings: extractResult.data?.keyFindings?.length,
          keywords: extractResult.data?.keywords?.length,
          technologyAreas: extractResult.data?.technologyAreas,
        }));

        // Build the metadata update object explicitly
        const metadataUpdate = {
          id: pdfId as Id<"pdfs">,
          title: extractResult.data?.title || pdf.title,
          company: extractResult.data?.company,
          dateOrYear: extractResult.data?.dateOrYear,
          topic: extractResult.data?.topic,
          summary: extractResult.data?.summary,
          thumbnailUrl: thumbnailDataUrl || undefined,
          continent: extractResult.data?.continent,
          industry: extractResult.data?.industry,
          documentType: extractResult.data?.documentType,
          authors: extractResult.data?.authors,
          keyFindings: extractResult.data?.keyFindings,
          keywords: extractResult.data?.keywords,
          technologyAreas: extractResult.data?.technologyAreas,
        };
        console.log("process-pdf: Calling updateExtractedMetadata with:", JSON.stringify(metadataUpdate, null, 2));

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
            thumbnailUrl: thumbnailDataUrl || undefined,
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
