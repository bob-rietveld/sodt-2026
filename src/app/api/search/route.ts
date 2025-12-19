import { NextRequest, NextResponse } from "next/server";
import { agentSearch } from "@/lib/weaviate/client";

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    // Use Weaviate QueryAgent to search and generate answer
    const result = await agentSearch(query);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
