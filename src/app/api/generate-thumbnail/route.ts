import { NextRequest, NextResponse } from "next/server";
import { generatePdfThumbnailBuffer } from "@/lib/pdf/thumbnail";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pdfUrl } = body;

    console.log("generate-thumbnail: Received PDF URL");

    if (!pdfUrl) {
      return NextResponse.json(
        { error: "PDF URL is required" },
        { status: 400 }
      );
    }

    // Fetch the PDF file
    console.log("generate-thumbnail: Fetching PDF...");
    const pdfResponse = await fetch(pdfUrl);

    if (!pdfResponse.ok) {
      return NextResponse.json(
        { error: `Failed to fetch PDF: ${pdfResponse.status}` },
        { status: 500 }
      );
    }

    const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
    console.log("generate-thumbnail: PDF fetched, size:", pdfBuffer.length);

    // Generate thumbnail (scale 1.5 for good quality thumbnails)
    console.log("generate-thumbnail: Generating thumbnail...");
    const thumbnailBuffer = await generatePdfThumbnailBuffer(pdfBuffer, 1.5);
    console.log("generate-thumbnail: Thumbnail generated, size:", thumbnailBuffer.length);

    // Convert to base64 data URL
    const base64 = thumbnailBuffer.toString("base64");
    const dataUrl = `data:image/png;base64,${base64}`;

    return NextResponse.json({
      success: true,
      thumbnailDataUrl: dataUrl,
    });
  } catch (error) {
    console.error("generate-thumbnail: Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
