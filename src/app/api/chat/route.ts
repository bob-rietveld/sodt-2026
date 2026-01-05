import { NextRequest } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { chatStream, type ChatMessage, type ChatFilter } from "@/lib/pinecone/client";
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
    const { message, sessionId, filters, fileIds } = await request.json();

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

    // Prepare messages for Pinecone Assistant
    const messages: ChatMessage[] = [{ role: "user", content: message }];

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
    }>> = new Map();

    function upsertCitation(offset: number, fileId: string, filename: string, pages: number[] | undefined) {
      const clampedOffset = Math.max(0, offset);
      let refs = citationsByOffset.get(clampedOffset);
      if (!refs) {
        refs = new Map();
        citationsByOffset.set(clampedOffset, refs);
      }

      const existing = refs.get(fileId);
      const pageNumbers = existing?.pageNumbers ?? new Set<number>();
      for (const page of pages ?? []) pageNumbers.add(page);

      refs.set(fileId, {
        fileId,
        title: filename.replace(/\.[^/.]+$/, ""),
        filename,
        pageNumbers,
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
            if (chunk.type === "content_chunk" && chunk.delta?.content) {
              fullResponse += chunk.delta.content;
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "text", content: chunk.delta.content })}\n\n`
                )
              );
            } else if (chunk.type === "citation" && chunk.citation) {
              const offset = chunk.citation.position ?? fullResponse.length;
              for (const ref of chunk.citation.references ?? []) {
                if (!ref.file?.id || !ref.file?.name) continue;
                upsertCitation(offset, ref.file.id, ref.file.name, ref.pages);
              }
            }
          }

          // Convert citation offsets to stable citation indices [1..n]
          const offsetsSorted = Array.from(citationsByOffset.entries()).sort(
            ([a], [b]) => a - b
          );

          const offsetsWithIndex = offsetsSorted.map(([offset], i) => ({
            offset,
            index: i + 1,
          }));

          const contentWithCitations = insertCitationLinks(fullResponse, offsetsWithIndex);

          const sources = offsetsSorted.map(([offset, refs], i) => ({
            index: i + 1,
            offset,
            references: Array.from(refs.values())
              .map((r) => ({
                fileId: r.fileId,
                title: r.title,
                filename: r.filename,
                pageNumbers: Array.from(r.pageNumbers).sort((a, b) => a - b),
              }))
              .sort((a, b) => a.title.localeCompare(b.title)),
          }));

          // Log search query to analytics after stream completes
          const responseTimeMs = Date.now() - startTime;
          try {
            const convex = getConvexClient();
            await convex.mutation(api.searchAnalytics.logSearch, {
              query: message,
              searchType: "chat",
              sessionId,
              responseTimeMs,
              answer: contentWithCitations.slice(0, 2000),
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
              ipHash: hashIP(ip),
            });
          } catch (logError) {
            console.error("Failed to log chat query:", logError);
          }

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
