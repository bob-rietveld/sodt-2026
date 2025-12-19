import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/google/drive";
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
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    // Redirect to settings with error
    return NextResponse.redirect(
      new URL(`/admin/settings?error=${encodeURIComponent(error)}`, request.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/admin/settings?error=No authorization code received", request.url)
    );
  }

  try {
    const convex = getConvexClient();

    // Get stored client credentials
    const clientId = await convex.query(api.settings.get, { key: "google_client_id" });
    const clientSecret = await convex.query(api.settings.get, { key: "google_client_secret" });

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        new URL("/admin/settings?error=Client credentials not found", request.url)
      );
    }

    const origin = request.nextUrl.origin;
    const redirectUri = `${origin}/api/google-drive/callback`;

    // Exchange code for tokens
    const result = await exchangeCodeForTokens(code, clientId, clientSecret, redirectUri);

    if (result.error) {
      return NextResponse.redirect(
        new URL(`/admin/settings?error=${encodeURIComponent(result.error)}`, request.url)
      );
    }

    if (result.refreshToken) {
      // Store the refresh token
      await convex.mutation(api.settings.set, {
        key: "google_refresh_token",
        value: result.refreshToken,
      });
    }

    // Redirect to settings with success
    return NextResponse.redirect(
      new URL("/admin/settings?success=Google Drive connected successfully", request.url)
    );
  } catch (error) {
    console.error("OAuth callback error:", error);
    return NextResponse.redirect(
      new URL(
        `/admin/settings?error=${encodeURIComponent(
          error instanceof Error ? error.message : "Authentication failed"
        )}`,
        request.url
      )
    );
  }
}
