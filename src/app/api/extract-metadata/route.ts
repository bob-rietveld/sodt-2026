import { NextRequest, NextResponse } from "next/server";
import { extractPDFMetadata } from "@/lib/firecrawl/client";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    console.log("extract-metadata: Received URL:", url);

    if (!url) {
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400 }
      );
    }

    // Check environment variables
    if (!process.env.FIRECRAWL_API_KEY) {
      console.error("extract-metadata: FIRECRAWL_API_KEY is not set");
      return NextResponse.json(
        { error: "FIRECRAWL_API_KEY is not configured" },
        { status: 500 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("extract-metadata: ANTHROPIC_API_KEY is not set");
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY is not configured" },
        { status: 500 }
      );
    }

    console.log("extract-metadata: Starting extraction...");
    const result = await extractPDFMetadata(url);

    if (!result.success) {
      console.error("extract-metadata: Extraction failed:", result.error);
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    console.log("extract-metadata: Extraction successful:", result.data);
    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error("extract-metadata: Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
