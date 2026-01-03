import { NextRequest, NextResponse } from "next/server";
import { listFiles } from "@/lib/pinecone/client";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const convexId = searchParams.get("convex_id");

    // Build filter if convex_id is provided
    const filter = convexId ? { convex_id: convexId } : undefined;

    const result = await listFiles(filter);

    return NextResponse.json({
      success: true,
      files: result.files,
      total: result.files.length,
    });
  } catch (error) {
    console.error("Pinecone list files error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list files" },
      { status: 500 }
    );
  }
}
