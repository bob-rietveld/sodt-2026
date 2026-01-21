import { NextRequest } from "next/server";
import { resetTinybirdClient } from "@/lib/analytics/mcp-client";

export async function POST(request: NextRequest) {
  try {
    // Clear the MCP client cache
    resetTinybirdClient();

    return Response.json({
      success: true,
      message: "Catalog cache cleared successfully",
      clearedAt: Date.now(),
    });
  } catch (error) {
    console.error("Catalog refresh error:", error);
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
