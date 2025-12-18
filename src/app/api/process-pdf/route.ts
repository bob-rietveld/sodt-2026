import { NextRequest, NextResponse } from "next/server";
import { processPdfFromUpload, reprocessPdf } from "@/lib/processing/pipeline";
import { Id } from "../../../../convex/_generated/dataModel";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pdfId, fileUrl, filename, title, action } = body;

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

    // Handle new upload processing
    if (!pdfId || !fileUrl || !filename || !title) {
      return NextResponse.json(
        { error: "pdfId, fileUrl, filename, and title are required" },
        { status: 400 }
      );
    }

    const result = await processPdfFromUpload(
      pdfId as Id<"pdfs">,
      fileUrl,
      filename,
      title
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
