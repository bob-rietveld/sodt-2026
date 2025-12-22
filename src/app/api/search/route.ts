import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { agentSearch } from "@/lib/weaviate/client";
import { api } from "../../../../convex/_generated/api";
import crypto from "crypto";

function getConvexClient(): ConvexHttpClient {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
  }
  return new ConvexHttpClient(url);
}

function hashIP(ip: string | null): string | undefined {
  if (!ip) return undefined;
  return crypto.createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { query } = await request.json();

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    // Use Weaviate QueryAgent to search and generate answer
    const result = await agentSearch(query);
    const responseTimeMs = Date.now() - startTime;

    // Log search query to analytics (fire and forget)
    try {
      const convex = getConvexClient();
      const userAgent = request.headers.get("user-agent") || undefined;
      const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip");

      await convex.mutation(api.searchAnalytics.logSearch, {
        query,
        searchType: "agent",
        responseTimeMs,
        answer: result.answer,
        sources: result.sources?.map((s) => ({
          convexId: s.convexId,
          title: s.title,
          filename: s.filename,
          pageNumber: s.pageNumber,
        })),
        resultCount: result.sources?.length ?? 0,
        userAgent,
        ipHash: hashIP(ip),
      });
    } catch (logError) {
      // Don't fail the search if logging fails
      console.error("Failed to log search query:", logError);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
