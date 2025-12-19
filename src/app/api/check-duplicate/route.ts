import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";

function getConvexClient() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
  }
  return new ConvexHttpClient(url);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileHash } = body;

    if (!fileHash) {
      return NextResponse.json(
        { error: "File hash is required" },
        { status: 400 }
      );
    }

    const convex = getConvexClient();
    const result = await convex.query(api.pdfs.checkDuplicate, { fileHash });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Check duplicate error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
