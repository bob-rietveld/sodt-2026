import { NextRequest, NextResponse } from "next/server";
import { processPdfFromDrive } from "@/lib/processing/pipeline";
import { listPdfsInFolder, verifyWebhookHeaders } from "@/lib/google/drive";

export async function POST(request: NextRequest) {
  try {
    // Verify webhook headers
    if (!verifyWebhookHeaders(request.headers)) {
      return NextResponse.json({ error: "Invalid webhook" }, { status: 401 });
    }

    const resourceState = request.headers.get("x-goog-resource-state");

    // Handle sync message (initial setup)
    if (resourceState === "sync") {
      console.log("Drive webhook sync received");
      return NextResponse.json({ status: "sync acknowledged" });
    }

    // Handle change notification
    if (resourceState === "change") {
      const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
      if (!folderId) {
        throw new Error("GOOGLE_DRIVE_FOLDER_ID not configured");
      }

      // List PDFs in the folder and process new ones
      const files = await listPdfsInFolder(folderId);

      const results = [];
      for (const file of files) {
        try {
          const result = await processPdfFromDrive(file.id);
          results.push({ fileId: file.id, ...result });
        } catch (error) {
          results.push({
            fileId: file.id,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      return NextResponse.json({ processed: results.length, results });
    }

    return NextResponse.json({ status: "ignored", resourceState });
  } catch (error) {
    console.error("Drive webhook error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// Google sends a GET request to verify the webhook URL
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
