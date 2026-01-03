import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";

function getConvexClient(): ConvexHttpClient {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
  }
  return new ConvexHttpClient(url);
}

export async function POST(request: NextRequest) {
  const convex = getConvexClient();
  try {
    const body = (await request.json()) as { pdfId?: string };
    const { pdfId } = body;

    if (!pdfId) {
      return NextResponse.json({ error: "pdfId is required" }, { status: 400 });
    }

    await convex.mutation(api.pdfs.updateStatus, {
      id: pdfId as Id<"pdfs">,
      status: "processing",
      processingError: undefined,
    });

    const origin = request.nextUrl.origin;

    // 1) Text extraction (force refresh)
    const textRes = await fetch(`${origin}/api/extract-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pdfId, force: true }),
    });
    const textJson = await textRes.json();
    if (!textRes.ok || !textJson.success) {
      await convex.mutation(api.pdfs.updateStatus, {
        id: pdfId as Id<"pdfs">,
        status: "failed",
        processingError: textJson.error || "Text extraction failed",
      });
      return NextResponse.json({ success: false, step: "text", error: textJson.error }, { status: 500 });
    }

    // 2) Metadata extraction
    const metaRes = await fetch(`${origin}/api/reprocess-metadata`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pdfId }),
    });
    const metaJson = await metaRes.json();
    if (!metaRes.ok || !metaJson.success) {
      await convex.mutation(api.pdfs.updateStatus, {
        id: pdfId as Id<"pdfs">,
        status: "failed",
        processingError: metaJson.error || "Metadata extraction failed",
      });
      return NextResponse.json(
        { success: false, step: "metadata", error: metaJson.error || "Metadata extraction failed" },
        { status: 500 }
      );
    }

    // 3) Pinecone indexing (from extracted text)
    const indexRes = await fetch(`${origin}/api/pinecone/index`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pdfId }),
    });
    const indexJson = await indexRes.json();
    if (!indexRes.ok) {
      await convex.mutation(api.pdfs.updateStatus, {
        id: pdfId as Id<"pdfs">,
        status: "failed",
        processingError: indexJson.error || "Pinecone indexing failed",
      });
      return NextResponse.json(
        { success: false, step: "index", error: indexJson.error || "Pinecone indexing failed" },
        { status: 500 }
      );
    }

    await convex.mutation(api.pdfs.updateStatus, {
      id: pdfId as Id<"pdfs">,
      status: "completed",
    });

    return NextResponse.json({
      success: true,
      pdfId,
      steps: {
        text: textJson,
        metadata: metaJson,
        index: indexJson,
      },
    });
  } catch (error) {
    console.error("Full pipeline error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

