import { NextRequest } from "next/server";
import { callTinybirdTool, parseToolResult } from "@/lib/analytics/mcp-client";

export async function POST(request: NextRequest) {
  try {
    // Check required environment variable
    if (!process.env.TINYBIRD_ADMIN_TOKEN) {
      console.error(
        "Refresh view error: TINYBIRD_ADMIN_TOKEN is not configured"
      );
      return Response.json(
        { error: "TINYBIRD_ADMIN_TOKEN is not configured" },
        { status: 500 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch (error) {
      console.error("Refresh view error: Failed to parse request body:", error);
      return Response.json(
        { error: "Invalid request body. Expected JSON." },
        { status: 400 }
      );
    }

    const { toolName, toolArgs } = body;

    if (!toolName || typeof toolName !== "string") {
      return Response.json(
        { error: "toolName is required and must be a string" },
        { status: 400 }
      );
    }

    if (!toolArgs || typeof toolArgs !== "object") {
      return Response.json(
        { error: "toolArgs is required and must be an object" },
        { status: 400 }
      );
    }

    // Call the Tinybird tool
    try {
      const result = await callTinybirdTool(toolName, toolArgs);
      const parsed = parseToolResult(result);

      if (result.isError || parsed.error) {
        return Response.json(
          {
            error: parsed.error || "Tool call failed",
            data: [],
          },
          { status: 200 } // Still return 200 to distinguish from server errors
        );
      }

      return Response.json({
        data: parsed.data,
        refreshedAt: Date.now(),
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Refresh view error: Tool call failed:", error);

      return Response.json(
        {
          error: `Failed to refresh data: ${errorMessage}`,
          data: [],
        },
        { status: 200 } // Still return 200 to distinguish from server errors
      );
    }
  } catch (error) {
    console.error("Refresh view error:", error);
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
