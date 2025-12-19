import { NextRequest, NextResponse } from "next/server";
import { listDriveFolders, testDriveConnection } from "@/lib/google/drive";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";

function getConvexClient(): ConvexHttpClient {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
  }
  return new ConvexHttpClient(url);
}

export async function GET(request: NextRequest) {
  try {
    const convex = getConvexClient();
    const searchParams = request.nextUrl.searchParams;
    const parentId = searchParams.get("parentId") || undefined;

    // Get credentials from settings
    const clientId = await convex.query(api.settings.get, { key: "google_client_id" });
    const clientSecret = await convex.query(api.settings.get, { key: "google_client_secret" });
    const refreshToken = await convex.query(api.settings.get, { key: "google_refresh_token" });

    if (!clientId || !clientSecret || !refreshToken) {
      return NextResponse.json(
        { error: "Google Drive not configured", folders: [] },
        { status: 400 }
      );
    }

    const credentials = { clientId, clientSecret, refreshToken };

    const folders = await listDriveFolders(credentials, parentId);

    return NextResponse.json({ folders });
  } catch (error) {
    console.error("List folders error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list folders", folders: [] },
      { status: 500 }
    );
  }
}

// Test connection endpoint
export async function POST(request: NextRequest) {
  try {
    const convex = getConvexClient();

    // Get credentials from settings
    const clientId = await convex.query(api.settings.get, { key: "google_client_id" });
    const clientSecret = await convex.query(api.settings.get, { key: "google_client_secret" });
    const refreshToken = await convex.query(api.settings.get, { key: "google_refresh_token" });

    if (!clientId || !clientSecret || !refreshToken) {
      return NextResponse.json(
        { success: false, error: "Google Drive not configured" },
        { status: 400 }
      );
    }

    const credentials = { clientId, clientSecret, refreshToken };
    const result = await testDriveConnection(credentials);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Test connection error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Connection test failed" },
      { status: 500 }
    );
  }
}
