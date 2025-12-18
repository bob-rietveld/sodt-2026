import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { embedQuery } from "@/lib/voyage/client";
import { hybridSearch } from "@/lib/weaviate/client";

const anthropic = new Anthropic();

export async function POST(request: NextRequest) {
  try {
    const { message, sessionId } = await request.json();

    if (!message) {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Generate embedding for the query
    const queryEmbedding = await embedQuery(message);

    // Search for relevant chunks
    const relevantChunks = await hybridSearch(message, queryEmbedding, 5);

    // Build context from chunks
    const context = relevantChunks
      .map(
        (chunk, i) =>
          `[Source ${i + 1}: ${chunk.title}, Page ${chunk.pageNumber}]\n${chunk.content}`
      )
      .join("\n\n---\n\n");

    // Build sources for citation
    const sources = relevantChunks.map((chunk) => ({
      title: chunk.title,
      filename: chunk.filename,
      pageNumber: chunk.pageNumber,
      score: chunk.score,
    }));

    // Create streaming response with Claude
    const stream = await anthropic.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: `You are a helpful assistant that answers questions based on the provided document context.

When answering:
- Base your answers on the provided context
- If the context doesn't contain relevant information, say so
- Cite sources by referring to [Source N] when using information from that source
- Be concise but thorough`,
      messages: [
        {
          role: "user",
          content: `Context from documents:

${context}

---

Question: ${message}

Please answer based on the context above. Cite sources when applicable.`,
        },
      ],
    });

    // Create a ReadableStream for the response
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        // Send sources first
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "sources", sources })}\n\n`)
        );

        // Stream the response
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "text", content: event.delta.text })}\n\n`
              )
            );
          }
        }

        // Send done event
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
        controller.close();
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
