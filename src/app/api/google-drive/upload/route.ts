import { NextRequest, NextResponse } from "next/server";
import { uploadToDrive } from "@/lib/google/drive";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";

function getConvexClient(): ConvexHttpClient {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
  }
  return new ConvexHttpClient(url);
}

export async function POST(request: NextRequest) {
  try {
    const convex = getConvexClient();

    // Get credentials from settings
    const clientId = await convex.query(api.settings.get, { key: "google_client_id" });
    const clientSecret = await convex.query(api.settings.get, { key: "google_client_secret" });
    const refreshToken = await convex.query(api.settings.get, { key: "google_refresh_token" });
    const folderId = await convex.query(api.settings.get, { key: "google_drive_folder_id" });

    if (!clientId || !clientSecret || !refreshToken) {
      return NextResponse.json(
        { success: false, error: "Google Drive not configured" },
        { status: 400 }
      );
    }

    const credentials = { clientId, clientSecret, refreshToken };

    // Handle file upload
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await uploadToDrive(
      buffer,
      file.name,
      file.type || "application/pdf",
      folderId || undefined,
      credentials
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Upload to Drive error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}
