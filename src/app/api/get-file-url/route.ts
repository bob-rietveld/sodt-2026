import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

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
    const { storageId, sourceUrl } = body;

    console.log("get-file-url: Received storageId:", storageId, "sourceUrl:", sourceUrl);

    // If sourceUrl is provided directly, return it
    if (sourceUrl) {
      return NextResponse.json({ url: sourceUrl });
    }

    if (!storageId) {
      return NextResponse.json(
        { error: "Storage ID or source URL is required" },
        { status: 400 }
      );
    }

    const convex = getConvexClient();
    console.log("get-file-url: Querying Convex for file URL...");

    const fileUrl = await convex.query(api.pdfs.getFileUrl, {
      storageId: storageId as Id<"_storage">,
    });

    console.log("get-file-url: Received fileUrl:", fileUrl ? fileUrl.substring(0, 100) + "..." : "null");

    if (!fileUrl) {
      return NextResponse.json(
        { error: "File not found in Convex storage" },
        { status: 404 }
      );
    }

    return NextResponse.json({ url: fileUrl });
  } catch (error) {
    console.error("Get file URL error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
