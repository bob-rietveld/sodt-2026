import { NextRequest, NextResponse } from "next/server";
import { getGoogleAuthUrl } from "@/lib/google/drive";

export async function POST(request: NextRequest) {
  try {
    const { clientId, clientSecret } = await request.json();

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: "Client ID and Client Secret are required" },
        { status: 400 }
      );
    }

    // Build the redirect URI based on the request origin
    const origin = request.headers.get("origin") || request.nextUrl.origin;
    const redirectUri = `${origin}/api/google-drive/callback`;

    const authUrl = getGoogleAuthUrl(clientId, clientSecret, redirectUri);

    return NextResponse.json({ authUrl, redirectUri });
  } catch (error) {
    console.error("Auth URL generation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate auth URL" },
      { status: 500 }
    );
  }
}
