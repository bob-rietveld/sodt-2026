import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export interface TinybirdTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface TinybirdToolResult {
  content: Array<{
    type: "text";
    text: string;
  }>;
  isError?: boolean;
}

let clientInstance: Client | null = null;
let toolsCache: TinybirdTool[] | null = null;

/**
 * Get or create a Tinybird MCP client connection
 */
export async function getTinybirdClient(): Promise<Client> {
  if (clientInstance) {
    return clientInstance;
  }

  const token = process.env.TINYBIRD_ADMIN_TOKEN;
  if (!token) {
    throw new Error("TINYBIRD_ADMIN_TOKEN is not configured");
  }

  const mcpUrl = `https://mcp.tinybird.co?token=${token}`;

  const transport = new StreamableHTTPClientTransport(new URL(mcpUrl));

  clientInstance = new Client(
    {
      name: "sodt-analytics-agent",
      version: "1.0.0",
    },
    {
      capabilities: {},
    }
  );

  await clientInstance.connect(transport);

  return clientInstance;
}

/**
 * List all available Tinybird tools (pipes become tools)
 */
export async function listTinybirdTools(): Promise<TinybirdTool[]> {
  if (toolsCache) {
    return toolsCache;
  }

  const client = await getTinybirdClient();
  const result = await client.listTools();

  toolsCache = result.tools.map((tool) => ({
    name: tool.name,
    description: tool.description || "",
    inputSchema: tool.inputSchema as TinybirdTool["inputSchema"],
  }));

  return toolsCache;
}

/**
 * Call a Tinybird tool (pipe) with arguments
 */
export async function callTinybirdTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<TinybirdToolResult> {
  const client = await getTinybirdClient();

  const result = await client.callTool({
    name: toolName,
    arguments: args,
  });

  return {
    content: result.content as TinybirdToolResult["content"],
    isError: result.isError as boolean | undefined,
  };
}

/**
 * Convert Tinybird tools to Anthropic tool format
 */
export function toAnthropicTools(
  tools: TinybirdTool[]
): Array<{
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}> {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: {
      type: "object" as const,
      properties: tool.inputSchema.properties || {},
      required: tool.inputSchema.required,
    },
  }));
}

/**
 * Parse tool result data - handles CSV format from Tinybird
 */
export function parseToolResult(result: TinybirdToolResult): {
  data: Record<string, unknown>[];
  raw: string;
  error?: string;
} {
  if (result.isError === true) {
    const errorText = result.content[0]?.text || "Unknown error";
    return { data: [], raw: errorText, error: errorText };
  }

  const rawText = result.content[0]?.text || "";

  // Tinybird MCP returns CSV format by default
  const lines = rawText.trim().split("\n");
  if (lines.length < 2) {
    return { data: [], raw: rawText };
  }

  const headers = lines[0].split(",").map((h) => h.trim());
  const data: Record<string, unknown>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === headers.length) {
      const row: Record<string, unknown> = {};
      headers.forEach((header, idx) => {
        row[header] = parseValue(values[idx]);
      });
      data.push(row);
    }
  }

  return { data, raw: rawText };
}

/**
 * Parse a CSV line handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current.trim());

  return values;
}

/**
 * Parse a string value to appropriate type
 */
function parseValue(value: string): unknown {
  if (value === "" || value === "null" || value === "NULL") {
    return null;
  }
  // Check for number
  const num = Number(value);
  if (!isNaN(num) && value !== "") {
    return num;
  }
  // Check for boolean
  if (value.toLowerCase() === "true") return true;
  if (value.toLowerCase() === "false") return false;

  return value;
}

/**
 * Reset client connection (useful for reconnection)
 */
export function resetTinybirdClient(): void {
  clientInstance = null;
  toolsCache = null;
}
