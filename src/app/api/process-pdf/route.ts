import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { processPdfFromUpload } from "@/lib/processing/pipeline";
import { extractPDFMetadataLocal, extractTextFromPdf } from "@/lib/pdf/extractor";
import { tryGenerateThumbnail } from "@/lib/pdf/thumbnail";
import { indexPdfToPineconeFromExtractedText } from "@/lib/processing/pinecone-index";
import { deleteFile } from "@/lib/pinecone/client";

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
    const { pdfId, storageId, fileUrl, filename, title, action } = body as {
      pdfId?: string;
      storageId?: string;
      fileUrl?: string;
      filename?: string;
      title?: string;
      action?: "reprocess";
    };

    const convex = getConvexClient();

    // Handle reprocessing (always allowed regardless of setting)
    if (action === "reprocess") {
      if (!pdfId) {
        return NextResponse.json(
          { error: "pdfId is required for reprocessing" },
          { status: 400 }
        );
      }

      // Delete existing Pinecone file (best-effort) and clear status
      const existing = await convex.query(api.pdfs.get, { id: pdfId as Id<"pdfs"> });
      if (existing?.pineconeFileId) {
        try {
          await deleteFile(existing.pineconeFileId);
        } catch (error) {
          console.warn("Failed to delete existing Pinecone file:", error);
        }
      }

      await convex.mutation(api.pdfs.updateStatus, {
        id: pdfId as Id<"pdfs">,
        status: "pending",
        processingError: undefined,
        pineconeFileId: undefined,
        pineconeFileStatus: undefined,
      });
    }

    // Check if processing is enabled
    const processingEnabled = await convex.query(api.settings.get, {
      key: "processing_enabled",
    });

    const textExtractionEnabled = await convex.query(api.settings.get, {
      key: "text_extraction_enabled",
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

        // Still extract text if enabled
        if (textExtractionEnabled !== "false") {
          try {
            const pdf = await convex.query(api.pdfs.get, { id: pdfId as Id<"pdfs"> });
            let resolvedFileUrl = fileUrl;
            if (!resolvedFileUrl && (storageId || pdf?.storageId)) {
              const sid = (storageId || pdf?.storageId) as Id<"_storage"> | undefined;
              if (sid) {
                resolvedFileUrl = (await convex.query(api.pdfs.getFileUrl, { storageId: sid })) ?? undefined;
              }
            }

            if (resolvedFileUrl && pdf) {
              const pdfResponse = await fetch(resolvedFileUrl);
              if (!pdfResponse.ok) throw new Error(`Failed to fetch PDF: ${pdfResponse.status}`);
              const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());

              const textResult = await extractTextFromPdf(pdfBuffer);
              if (textResult.success && textResult.text) {
                const textUploadUrl = await convex.mutation(api.pdfs.generateUploadUrl, {});
                const textBlob = new Blob([textResult.text], { type: "text/plain" });
                const uploadResponse = await fetch(textUploadUrl, {
                  method: "POST",
                  headers: { "Content-Type": "text/plain" },
                  body: textBlob,
                });
                if (uploadResponse.ok) {
                  const { storageId: extractedTextStorageId } = await uploadResponse.json();
                  await convex.mutation(api.pdfs.updateExtractedTextStorageId, {
                    id: pdfId as Id<"pdfs">,
                    extractedTextStorageId,
                  });
                  await convex.mutation(api.pdfs.updateStatus, {
                    id: pdfId as Id<"pdfs">,
                    status: "completed",
                    pageCount: textResult.pageCount,
                  });
                }
              }
            }
          } catch (error) {
            console.error("Text extraction error (processing disabled):", error);
          }
        }

        // Still extract metadata if enabled
        const metadataExtractionEnabled = await convex.query(api.settings.get, {
          key: "metadata_extraction_enabled",
        });

        // Get PDF record and file URL for metadata extraction
        const pdf = await convex.query(api.pdfs.get, { id: pdfId as Id<"pdfs"> });
        if (pdf && metadataExtractionEnabled !== "false" && !pdf.summary) {
          let resolvedFileUrl = fileUrl;
          if (!resolvedFileUrl && (storageId || pdf.storageId)) {
            const sid = (storageId || pdf.storageId) as Id<"_storage"> | undefined;
            if (sid) {
              resolvedFileUrl =
                (await convex.query(api.pdfs.getFileUrl, { storageId: sid })) ??
                undefined;
            }
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
      const sid = (storageId || pdf.storageId) as Id<"_storage"> | undefined;
      if (sid) {
        resolvedFileUrl =
          (await convex.query(api.pdfs.getFileUrl, { storageId: sid })) ??
          undefined;
      }
    }

    if (!resolvedFileUrl) {
      return NextResponse.json(
        { error: "Could not resolve file URL" },
        { status: 400 }
      );
    }

    // Mark as processing
    await convex.mutation(api.pdfs.updateStatus, {
      id: pdfId as Id<"pdfs">,
      status: "processing",
      processingError: undefined,
    });

    // Stage 1: Extract text (if enabled)
    let extractedText: string | null = null;
    let pageCount: number | undefined;
    let pdfBuffer: Buffer | null = null;

    if (textExtractionEnabled !== "false") {
      try {
        // Re-use cached extracted text if available
        if (pdf.extractedTextStorageId) {
          const textUrl = await convex.query(api.pdfs.getExtractedTextUrl, { id: pdfId as Id<"pdfs"> });
          if (textUrl) {
            const textResponse = await fetch(textUrl);
            if (textResponse.ok) {
              const cachedText = await textResponse.text();
              if (cachedText.trim().length > 0) extractedText = cachedText;
            }
          }
        }

        if (!extractedText) {
          const pdfResponse = await fetch(resolvedFileUrl);
          if (!pdfResponse.ok) throw new Error(`Failed to fetch PDF: ${pdfResponse.status}`);
          pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());

          const textResult = await extractTextFromPdf(pdfBuffer);
          if (!textResult.success || !textResult.text) {
            throw new Error(textResult.error || "Failed to extract text from PDF");
          }

          extractedText = textResult.text;
          pageCount = textResult.pageCount;

          const textUploadUrl = await convex.mutation(api.pdfs.generateUploadUrl, {});
          const textBlob = new Blob([textResult.text], { type: "text/plain" });
          const uploadResponse = await fetch(textUploadUrl, {
            method: "POST",
            headers: { "Content-Type": "text/plain" },
            body: textBlob,
          });
          if (uploadResponse.ok) {
            const { storageId: extractedTextStorageId } = await uploadResponse.json();
            await convex.mutation(api.pdfs.updateExtractedTextStorageId, {
              id: pdfId as Id<"pdfs">,
              extractedTextStorageId,
            });
          }
        }

        if (!extractedText || extractedText.trim().length === 0) {
          throw new Error("No text content extracted from PDF");
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown text extraction error";
        await convex.mutation(api.pdfs.updateStatus, {
          id: pdfId as Id<"pdfs">,
          status: "failed",
          processingError: errorMessage,
        });
        return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
      }
    }

    // Stage 2: Indexing
    let pineconeFileId: string | undefined;
    let pineconeFileStatus: "Available" | "Processing" | "Failed" | undefined;

    if (textExtractionEnabled !== "false") {
      // Index using extracted text (reliable for Pinecone Assistant)
      const indexResult = await indexPdfToPineconeFromExtractedText(
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
        extractedText!,
        { replaceExisting: true }
      );

      pineconeFileId = indexResult.pineconeFileId;
      pineconeFileStatus = indexResult.status;
    } else {
      // Fallback: upload the original PDF to Pinecone (may fail if the PDF has no extractable text)
      const legacy = await processPdfFromUpload(
        pdfId as Id<"pdfs">,
        resolvedFileUrl,
        filename || pdf.filename,
        title || pdf.title
      );
      if (!legacy.success) {
        return NextResponse.json(legacy, { status: 500 });
      }
      pineconeFileId = legacy.pineconeFileId;
      pineconeFileStatus = "Available";
    }

    // Check if metadata extraction is enabled
    const metadataExtractionEnabled = await convex.query(api.settings.get, {
      key: "metadata_extraction_enabled",
    });

    // Extract metadata if enabled and PDF doesn't already have metadata
    if (metadataExtractionEnabled !== "false" && !pdf.summary) {
      console.log("Extracting metadata for PDF:", pdfId);
      try {
        // Fetch PDF buffer for both thumbnail and local text extraction (re-use if already fetched)
        if (!pdfBuffer) {
          const pdfResponse = await fetch(resolvedFileUrl);
          if (!pdfResponse.ok) {
            throw new Error(`Failed to fetch PDF: ${pdfResponse.status}`);
          }
          pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
        }
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

    // Mark as completed (Pinecone status may still be Processing if it timed out)
    await convex.mutation(api.pdfs.updateStatus, {
      id: pdfId as Id<"pdfs">,
      status: "completed",
      pineconeFileId,
      pineconeFileStatus,
      pageCount,
    });

    return NextResponse.json({
      success: true,
      pineconeFileId,
      pineconeFileStatus,
    });
  } catch (error) {
    console.error("Process PDF error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
