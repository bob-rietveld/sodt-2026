import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { processPdfFromUpload, reprocessPdf } from "@/lib/processing/pipeline";

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

    // Handle reprocessing
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

    // Validate pdfId
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

    // Process the PDF
    const result = await processPdfFromUpload(
      pdfId as Id<"pdfs">,
      resolvedFileUrl,
      filename || pdf.filename,
      title || pdf.title
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Process PDF error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
