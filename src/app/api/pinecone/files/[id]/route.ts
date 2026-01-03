import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../../convex/_generated/api";
import { Id } from "../../../../../../convex/_generated/dataModel";
import { describeFile, deleteFile } from "@/lib/pinecone/client";

function getConvexClient(): ConvexHttpClient {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
  }
  return new ConvexHttpClient(url);
}

// GET /api/pinecone/files/[id] - Get file status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "File ID is required" },
        { status: 400 }
      );
    }

    const fileInfo = await describeFile(id);

    return NextResponse.json({
      success: true,
      file: fileInfo,
    });
  } catch (error) {
    console.error("Pinecone describe file error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get file info" },
      { status: 500 }
    );
  }
}

// DELETE /api/pinecone/files/[id] - Delete file from Pinecone
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "File ID is required" },
        { status: 400 }
      );
    }

    // Get convex_id from query params to update the PDF record
    const searchParams = request.nextUrl.searchParams;
    const convexId = searchParams.get("convex_id");

    // Delete from Pinecone
    await deleteFile(id);

    // Update Convex record if convex_id provided
    if (convexId) {
      const convex = getConvexClient();
      await convex.mutation(api.pdfs.updateStatus, {
        id: convexId as Id<"pdfs">,
        status: "pending",
        pineconeFileId: undefined,
        pineconeFileStatus: undefined,
      });
    }

    return NextResponse.json({
      success: true,
      message: "File deleted successfully",
    });
  } catch (error) {
    console.error("Pinecone delete file error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete file" },
      { status: 500 }
    );
  }
}
