import { NextRequest, NextResponse } from "next/server";
import { embedQuery } from "@/lib/voyage/client";
import { hybridSearch } from "@/lib/weaviate/client";

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    // Generate embedding for the query
    const queryEmbedding = await embedQuery(query);

    // Search Weaviate with hybrid search
    const results = await hybridSearch(query, queryEmbedding, 10);

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
