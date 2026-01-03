import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { extractTextFromPdf } from "@/lib/pdf/extractor";

function getConvexClient(): ConvexHttpClient {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
  }
  return new ConvexHttpClient(url);
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { pdfId?: string; force?: boolean };
    const { pdfId, force } = body;

    if (!pdfId) {
      return NextResponse.json({ error: "pdfId is required" }, { status: 400 });
    }

    const convex = getConvexClient();
    const pdf = await convex.query(api.pdfs.get, { id: pdfId as Id<"pdfs"> });
    if (!pdf) {
      return NextResponse.json({ error: "PDF record not found" }, { status: 404 });
    }

    if (!force && pdf.extractedTextStorageId) {
      const textUrl = await convex.query(api.pdfs.getExtractedTextUrl, { id: pdfId as Id<"pdfs"> });
      if (textUrl) {
        const textResponse = await fetch(textUrl);
        if (textResponse.ok) {
          const cachedText = await textResponse.text();
          if (cachedText.trim().length > 0) {
            return NextResponse.json({
              success: true,
              pdfId,
              usedCachedText: true,
              extractedTextLength: cachedText.length,
            });
          }
        }
      }
    }

    let fileUrl: string | null = null;
    if (pdf.storageId) {
      fileUrl = await convex.query(api.pdfs.getFileUrl, { storageId: pdf.storageId as Id<"_storage"> });
    } else if (pdf.sourceUrl) {
      fileUrl = pdf.sourceUrl;
    }

    if (!fileUrl) {
      return NextResponse.json({ error: "Could not resolve file URL" }, { status: 400 });
    }

    const pdfResponse = await fetch(fileUrl);
    if (!pdfResponse.ok) {
      return NextResponse.json({ error: `Failed to fetch PDF: ${pdfResponse.status}` }, { status: 500 });
    }

    const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
    const textResult = await extractTextFromPdf(pdfBuffer);
    if (!textResult.success || !textResult.text) {
      return NextResponse.json(
        { success: false, error: textResult.error || "Failed to extract text from PDF" },
        { status: 500 }
      );
    }

    const textUploadUrl = await convex.mutation(api.pdfs.generateUploadUrl, {});
    const textBlob = new Blob([textResult.text], { type: "text/plain" });
    const uploadResponse = await fetch(textUploadUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: textBlob,
    });

    if (!uploadResponse.ok) {
      return NextResponse.json({ error: "Failed to store extracted text" }, { status: 500 });
    }

    const { storageId: extractedTextStorageId } = await uploadResponse.json();
    await convex.mutation(api.pdfs.updateExtractedTextStorageId, {
      id: pdfId as Id<"pdfs">,
      extractedTextStorageId,
    });

    return NextResponse.json({
      success: true,
      pdfId,
      usedCachedText: false,
      extractedTextLength: textResult.text.length,
      pageCount: textResult.pageCount,
      extractedTextStorageId,
    });
  } catch (error) {
    console.error("Extract text error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

