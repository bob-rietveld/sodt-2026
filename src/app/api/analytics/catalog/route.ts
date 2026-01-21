import { NextRequest } from "next/server";
import { listTinybirdTools } from "@/lib/analytics/mcp-client";

export async function GET(request: NextRequest) {
  try {
    // Check required environment variable
    if (!process.env.TINYBIRD_ADMIN_TOKEN) {
      console.error("Catalog error: TINYBIRD_ADMIN_TOKEN is not configured");
      return Response.json(
        { error: "TINYBIRD_ADMIN_TOKEN is not configured" },
        { status: 500 }
      );
    }

    // Fetch tools from Tinybird MCP
    const tools = await listTinybirdTools();

    // Transform to catalog format with categories
    const dataSources = tools.map((tool) => {
      // Infer category from description or name
      let category = "Other";
      const desc = tool.description.toLowerCase();
      const name = tool.name.toLowerCase();

      if (desc.includes("search") || name.includes("search")) {
        category = "Search Analytics";
      } else if (
        desc.includes("traffic") ||
        desc.includes("source") ||
        name.includes("source")
      ) {
        category = "Traffic Analytics";
      } else if (
        desc.includes("metric") ||
        desc.includes("summary") ||
        desc.includes("kpi") ||
        name.includes("summary") ||
        name.includes("analytics")
      ) {
        category = "Platform Metrics";
      }

      // Extract parameters from input schema
      const parameters: Array<{
        name: string;
        type: string;
        default?: string | number;
        description?: string;
      }> = [];

      if (tool.inputSchema?.properties) {
        Object.entries(tool.inputSchema.properties).forEach(([name, schema]) => {
          const schemaObj = schema as {
            type?: string;
            default?: string | number;
            description?: string;
          };
          parameters.push({
            name,
            type: schemaObj.type || "string",
            default: schemaObj.default,
            description: schemaObj.description,
          });
        });
      }

      // Generate example queries based on name and description
      const exampleQueries = generateExampleQueries(tool.name, tool.description);

      return {
        name: tool.name,
        description: tool.description,
        category,
        parameters: parameters.length > 0 ? parameters : undefined,
        exampleQueries,
      };
    });

    return Response.json({
      dataSources,
      fetchedAt: Date.now(),
    });
  } catch (error) {
    console.error("Catalog error:", error);
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * Generate example queries based on pipe name and description
 */
function generateExampleQueries(name: string, description: string): string[] {
  const queries: string[] = [];

  // Generate based on common patterns
  if (name.includes("popular_searches")) {
    queries.push(
      "What are the top 10 search queries?",
      "Show me the most popular searches in the last week",
      "What are users searching for most often?"
    );
  } else if (name.includes("searches_by_day")) {
    queries.push(
      "Show me search trends over the last 30 days",
      "How has search volume changed this month?",
      "Display daily search activity"
    );
  } else if (name.includes("no_result")) {
    queries.push(
      "Which searches returned no results?",
      "Show me failed searches",
      "What are users looking for that we don't have?"
    );
  } else if (name.includes("recent")) {
    queries.push(
      "Show me the latest searches",
      "What are people searching for right now?",
      "Display recent search activity"
    );
  } else if (name.includes("source")) {
    queries.push(
      "Which documents are most popular?",
      "Show me the most frequently cited content",
      "What are the top documents in search results?"
    );
  } else if (name.includes("summary") || name.includes("analytics")) {
    queries.push(
      "Give me a platform overview",
      "What are our key metrics?",
      "Show me overall platform stats"
    );
  } else {
    // Generic queries based on description
    const descLower = description.toLowerCase();
    if (descLower.includes("get") || descLower.includes("show")) {
      queries.push(`Show me ${name.replace(/_/g, " ")}`);
    }
    if (descLower.includes("trend") || descLower.includes("time")) {
      queries.push(`What is the trend for ${name.replace(/_/g, " ")}?`);
    }
    if (descLower.includes("popular") || descLower.includes("top")) {
      queries.push(`What are the top results for ${name.replace(/_/g, " ")}?`);
    }

    // Ensure at least one query
    if (queries.length === 0) {
      queries.push(
        `Analyze ${name.replace(/_/g, " ")}`,
        `Tell me about ${name.replace(/_/g, " ")}`
      );
    }
  }

  return queries.slice(0, 3); // Max 3 queries
}
