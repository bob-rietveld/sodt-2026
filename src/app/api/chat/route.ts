import { NextRequest } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { chatStream, type ChatMessage } from "@/lib/pinecone/client";
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
    const { message, sessionId } = await request.json();

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

    // Create a ReadableStream for the response
    const encoder = new TextEncoder();
    let fullResponse = "";
    const sources: Array<{
      convexId: string;
      title: string;
      filename: string;
      pageNumber: number;
    }> = [];

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          // Stream the response from Pinecone Assistant
          for await (const chunk of chatStream(messages)) {
            if (chunk.type === "content_chunk" && chunk.delta?.content) {
              fullResponse += chunk.delta.content;
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "text", content: chunk.delta.content })}\n\n`
                )
              );
            } else if (chunk.type === "citation" && chunk.citation) {
              // Collect citation info for sources
              for (const ref of chunk.citation.references) {
                if (ref.file) {
                  sources.push({
                    convexId: ref.file.id,
                    title: ref.file.name.replace(/\.[^/.]+$/, ""),
                    filename: ref.file.name,
                    pageNumber: ref.pages?.[0] ?? 0,
                  });
                }
              }
            }
          }

          // Send sources after streaming is complete
          if (sources.length > 0) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "sources", sources })}\n\n`
              )
            );
          }

          // Log search query to analytics after stream completes
          const responseTimeMs = Date.now() - startTime;
          try {
            const convex = getConvexClient();
            await convex.mutation(api.searchAnalytics.logSearch, {
              query: message,
              searchType: "chat",
              sessionId,
              responseTimeMs,
              answer: fullResponse.slice(0, 2000),
              sources: sources.map((s) => ({
                convexId: s.convexId,
                title: s.title,
                filename: s.filename,
                pageNumber: s.pageNumber,
              })),
              resultCount: sources.length,
              userAgent,
              ipHash: hashIP(ip),
            });
          } catch (logError) {
            console.error("Failed to log chat query:", logError);
          }

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
