import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { extractPdfFromBuffer, combineChunks } from "@/lib/unstructured/client";
import { embedDocuments } from "@/lib/voyage/client";
import { insertChunks, PDFChunk } from "@/lib/weaviate/client";

function getConvexClient(): ConvexHttpClient {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
  }
  return new ConvexHttpClient(url);
}

export async function POST(request: NextRequest) {
  const convex = getConvexClient();

  try {
    const body = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400 }
      );
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 }
      );
    }

    // Extract filename from URL
    const pathname = parsedUrl.pathname;
    let filename = pathname.split("/").pop() || "document.pdf";
    if (!filename.endsWith(".pdf")) {
      filename = `${filename}.pdf`;
    }

    // Create title from filename
    const title = filename.replace(".pdf", "").replace(/[-_]/g, " ");

    // Step 1: Create PDF record in Convex
    const pdfId = await convex.mutation(api.pdfs.create, {
      title,
      filename,
      sourceUrl: url,
      source: "url",
    });

    // Step 2: Create processing job
    const jobId = await convex.mutation(api.processing.createJob, {
      pdfId,
      stage: "extracting",
    });

    // Update status to processing
    await convex.mutation(api.pdfs.updateStatus, {
      id: pdfId,
      status: "processing",
    });

    // Step 3: Fetch PDF from URL
    console.log(`Fetching PDF from URL: ${url}`);
    const pdfResponse = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PDFBot/1.0)",
      },
    });

    if (!pdfResponse.ok) {
      throw new Error(`Failed to fetch PDF: ${pdfResponse.status} ${pdfResponse.statusText}`);
    }

    const contentType = pdfResponse.headers.get("content-type");
    if (contentType && !contentType.includes("pdf") && !contentType.includes("octet-stream")) {
      console.warn(`Unexpected content type: ${contentType}, proceeding anyway`);
    }

    const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());

    // Step 4: Extract text using Unstructured
    console.log(`Extracting text from PDF: ${filename}`);
    const extraction = await extractPdfFromBuffer(pdfBuffer, filename);
    const combinedChunks = combineChunks(extraction.chunks);

    await convex.mutation(api.processing.updateJob, {
      jobId,
      stage: "embedding",
      metadata: { chunksExtracted: combinedChunks.length },
    });

    // Step 5: Generate embeddings
    console.log(`Generating embeddings for ${combinedChunks.length} chunks`);
    const texts = combinedChunks.map((c) => c.text);
    const embeddings = await embedDocuments(texts);

    await convex.mutation(api.processing.updateJob, {
      jobId,
      stage: "storing",
    });

    // Step 6: Store in Weaviate
    console.log("Storing chunks in Weaviate");
    const weaviateChunks: PDFChunk[] = combinedChunks.map((chunk, index) => ({
      content: chunk.text,
      chunkIndex: index,
      pageNumber: chunk.pageNumber,
      convexId: pdfId,
      filename,
      title,
    }));

    const weaviateIds = await insertChunks(weaviateChunks, embeddings);

    // Step 7: Update job and PDF status
    await convex.mutation(api.processing.updateJob, {
      jobId,
      stage: "completed",
      metadata: { chunksStored: weaviateIds.length },
    });

    await convex.mutation(api.pdfs.updateStatus, {
      id: pdfId,
      status: "completed",
      weaviateId: weaviateIds[0],
      pageCount: extraction.metadata.pageCount,
    });

    return NextResponse.json({
      success: true,
      pdfId,
      chunksProcessed: weaviateIds.length,
    });
  } catch (error) {
    console.error("Process PDF from URL error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
