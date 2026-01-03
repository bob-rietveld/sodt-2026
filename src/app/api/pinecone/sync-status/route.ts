import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { describeFile } from "@/lib/pinecone/client";

function getConvexClient(): ConvexHttpClient {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
  }
  return new ConvexHttpClient(url);
}

// Sync the Pinecone status for a single document or all documents with "Processing" status
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pdfId } = body;

    const convex = getConvexClient();

    if (pdfId) {
      // Sync single document
      const pdf = await convex.query(api.pdfs.get, { id: pdfId as Id<"pdfs"> });
      if (!pdf) {
        return NextResponse.json(
          { error: "PDF record not found" },
          { status: 404 }
        );
      }

      if (!pdf.pineconeFileId) {
        return NextResponse.json(
          { error: "PDF has no Pinecone file ID" },
          { status: 400 }
        );
      }

      const fileInfo = await describeFile(pdf.pineconeFileId);
      const newStatus = fileInfo.status === "Available" ? "Available"
                      : fileInfo.status === "Failed" || fileInfo.errorMessage ? "Failed"
                      : "Processing";

      await convex.mutation(api.pdfs.updatePineconeStatus, {
        id: pdfId as Id<"pdfs">,
        pineconeFileStatus: newStatus,
      });

      return NextResponse.json({
        success: true,
        pdfId,
        previousStatus: pdf.pineconeFileStatus,
        newStatus,
      });
    } else {
      // Sync all documents with "Processing" status
      const docs = await convex.query(api.pdfs.getDocumentsNeedingPinecone, { filter: "all" });
      const processingDocs = docs.filter(d => d.pineconeFileStatus === "Processing" && d.pineconeFileId);

      const results = [];
      for (const doc of processingDocs) {
        try {
          const fileInfo = await describeFile(doc.pineconeFileId!);
          const newStatus = fileInfo.status === "Available" ? "Available"
                          : fileInfo.status === "Failed" || fileInfo.errorMessage ? "Failed"
                          : "Processing";

          if (newStatus !== doc.pineconeFileStatus) {
            await convex.mutation(api.pdfs.updatePineconeStatus, {
              id: doc._id as Id<"pdfs">,
              pineconeFileStatus: newStatus,
            });
            results.push({
              pdfId: doc._id,
              title: doc.title,
              previousStatus: doc.pineconeFileStatus,
              newStatus,
            });
          }
        } catch (error) {
          console.error(`Error syncing status for ${doc._id}:`, error);
        }
      }

      return NextResponse.json({
        success: true,
        checked: processingDocs.length,
        updated: results.length,
        results,
      });
    }
  } catch (error) {
    console.error("Pinecone sync status error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    );
  }
}
