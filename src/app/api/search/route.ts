import { NextRequest, NextResponse } from "next/server";
import { chat, type ChatMessage } from "@/lib/pinecone/client";
import { logSearchEvent } from "@/lib/analytics";

export interface SearchResult {
  answer: string;
  sources: Array<{
    content?: string;
    title: string;
    filename: string;
    pageNumber: number;
    convexId: string;
  }>;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { query } = await request.json();

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    // Use Pinecone Assistant to search and generate answer
    const messages: ChatMessage[] = [{ role: "user", content: query }];
    const response = await chat(messages);

    // Extract sources from citations
    const sources: SearchResult["sources"] = [];
    if (response.citations) {
      for (const citation of response.citations) {
        for (const ref of citation.references) {
          sources.push({
            convexId: ref.file.id,
            title: ref.file.name.replace(/\.[^/.]+$/, ""),
            filename: ref.file.name,
            pageNumber: ref.pages?.[0] ?? 0,
          });
        }
      }
    }

    const result: SearchResult = {
      answer: response.content,
      sources,
    };

    const responseTimeMs = Date.now() - startTime;

    // Log search query to Tinybird analytics (fire and forget)
    const userAgent = request.headers.get("user-agent") || undefined;
    const ip =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip");

    logSearchEvent({
      eventName: "search_query",
      query,
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
      ip: ip || undefined,
    }).catch((err) => console.error("Failed to log search query:", err));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
