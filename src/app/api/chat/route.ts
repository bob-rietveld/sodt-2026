import { NextRequest } from "next/server";
import { chatStream, type ChatMessage, type ChatFilter } from "@/lib/pinecone/client";
import { logSearchEvent } from "@/lib/analytics";

export async function POST(request: NextRequest) {
  console.log("[Chat API] POST request received");
  const startTime = Date.now();

  try {
    const { message, sessionId, filters, fileIds, history } = await request.json();
    console.log("[Chat API] Processing message:", message?.slice(0, 50));

    if (!message) {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get user context for logging
    const userAgent = request.headers.get("user-agent") || undefined;
    const ip =
      request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip");

    // Prepare messages for Pinecone Assistant with conversation history
    // History is an array of previous messages to maintain conversation context
    const previousMessages: ChatMessage[] = (history || [])
      .slice(-10) // Limit to last 10 messages to manage token usage
      .map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    const messages: ChatMessage[] = [
      ...previousMessages,
      { role: "user", content: message },
    ];

    // Build filter from metadata parameters (preferred) or legacy fileIds
    const filter: ChatFilter | undefined = filters
      ? {
          continent: filters.continent,
          industry: filters.industry,
          year: filters.year,
          company: filters.company,
          keywords: filters.keywords,
          technologyAreas: filters.technologyAreas,
          // Legacy fallback for old documents without array metadata
          fileIds: fileIds?.length ? fileIds : undefined,
        }
      : fileIds?.length
        ? { fileIds }
        : undefined;

    // Create a ReadableStream for the response
    const encoder = new TextEncoder();
    let fullResponse = "";
    // Track citation groups by their character offset in the message.
    // Pinecone Assistant citations provide a `position` which is an offset into the generated content.
    const citationsByOffset: Map<number, Map<string, {
      fileId: string;
      title: string;
      filename: string;
      pageNumbers: Set<number>;
      convexId?: string;
    }>> = new Map();

    function upsertCitation(offset: number, fileId: string, filename: string, title: string | undefined, pages: number[] | undefined, convexId?: string) {
      const clampedOffset = Math.max(0, offset);
      let refs = citationsByOffset.get(clampedOffset);
      if (!refs) {
        refs = new Map();
        citationsByOffset.set(clampedOffset, refs);
      }

      const existing = refs.get(fileId);
      const pageNumbers = existing?.pageNumbers ?? new Set<number>();
      for (const page of pages ?? []) pageNumbers.add(page);

      // Use title from Pinecone metadata, fall back to cleaned filename
      const displayTitle = title || existing?.title || filename.replace(/\.[^/.]+$/, "").replace(/^\d+-/, "");

      refs.set(fileId, {
        fileId,
        title: displayTitle,
        filename,
        pageNumbers,
        convexId: convexId || existing?.convexId,
      });
    }

    function insertCitationLinks(content: string, offsets: Array<{ offset: number; index: number }>) {
      // If the model already produced inline citations like [1], keep them as-is and
      // let the client linkify them (prevents double-citations).
      if (/\[\d+\]/.test(content)) return content;

      let updated = content;
      // Insert from the end to preserve offsets.
      const descending = [...offsets].sort((a, b) => b.offset - a.offset);
      for (const { offset, index } of descending) {
        const safeOffset = Math.min(Math.max(0, offset), updated.length);
        updated =
          updated.slice(0, safeOffset) +
          ` [[${index}]](#source-${index})` +
          updated.slice(safeOffset);
      }
      return updated;
    }

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          // Stream the response from Pinecone Assistant
          for await (const chunk of chatStream(messages, filter)) {
            // Debug: log all chunk types
            console.log("[Chat API] Chunk type:", chunk.type, JSON.stringify(chunk).slice(0, 200));

            if (chunk.type === "content_chunk" && chunk.delta?.content) {
              fullResponse += chunk.delta.content;
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "text", content: chunk.delta.content })}\n\n`
                )
              );
            } else if (chunk.type === "citation") {
              // Citation chunks contain file references with metadata
              const citation = (chunk as any).citation;
              if (citation) {
                console.log("[Chat API] Citation received:", JSON.stringify(citation).slice(0, 300));
                const offset = citation.position ?? fullResponse.length;
                for (const ref of citation.references ?? []) {
                  const file = ref.file;
                  if (!file?.id || !file?.name) continue;
                  // Extract title and convexId from file metadata if available
                  const title = file.metadata?.title;
                  const convexId = file.metadata?.convexId;
                  upsertCitation(offset, file.id, file.name, title, ref.pages, convexId);
                }
              }
            }
          }

          console.log("[Chat API] Total citations collected:", citationsByOffset.size);

          // Convert citation offsets to stable citation indices [1..n]
          const offsetsSorted = Array.from(citationsByOffset.entries()).sort(
            ([a], [b]) => a - b
          );

          const offsetsWithIndex = offsetsSorted.map(([offset], i) => ({
            offset,
            index: i + 1,
          }));

          const contentWithCitations = insertCitationLinks(fullResponse, offsetsWithIndex);

          // Build sources array - convexId is already in the citation metadata from Pinecone
          const sources = offsetsSorted.map(([offset, refs], i) => ({
            index: i + 1,
            offset,
            references: Array.from(refs.values())
              .map((r) => ({
                fileId: r.fileId,
                title: r.title,
                filename: r.filename,
                pageNumbers: Array.from(r.pageNumbers).sort((a, b) => a - b),
                convexId: r.convexId,
                documentUrl: r.convexId ? `/reports/${r.convexId}` : undefined,
              }))
              .sort((a, b) => a.title.localeCompare(b.title)),
          }));

          console.log("[Chat API] Sources built:", JSON.stringify(sources).slice(0, 500));

          // Log search query to Tinybird analytics (fire and forget)
          const responseTimeMs = Date.now() - startTime;
          logSearchEvent({
            eventName: "chat_query",
            query: message,
            sessionId,
            responseTimeMs,
            answer: contentWithCitations,
            sources: sources.flatMap((s) =>
              s.references.map((r) => ({
                convexId: r.fileId,
                title: r.title,
                filename: r.filename,
                pageNumber: r.pageNumbers[0] ?? 0,
              }))
            ),
            resultCount: sources.reduce((acc, s) => acc + s.references.length, 0),
            userAgent,
            ip: ip || undefined,
          }).catch((err) => console.error("Failed to log chat query:", err));

          // Send a final event with the complete content + structured sources.
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "final", content: contentWithCitations, sources })}\n\n`
            )
          );

          // Send done event
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`)
          );
          controller.close();
        } catch (error) {
          console.error("Stream error:", error);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "error", error: error instanceof Error ? error.message : "Stream error" })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
