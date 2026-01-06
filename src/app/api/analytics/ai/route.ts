import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  listTinybirdTools,
  callTinybirdTool,
  toAnthropicTools,
  parseToolResult,
} from "@/lib/analytics/mcp-client";
import {
  ANALYTICS_SYSTEM_PROMPT,
  type ChartSpec,
  type ToolCallInfo,
  type ConversationMessage,
} from "@/types/analytics-viz";

const MAX_TOOL_RETRIES = 2;

function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }
  return new Anthropic({ apiKey });
}

export async function POST(request: NextRequest) {
  try {
    // Check required environment variables
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("Analytics AI error: ANTHROPIC_API_KEY is not configured");
      return Response.json(
        { error: "ANTHROPIC_API_KEY is not configured" },
        { status: 500 }
      );
    }

    if (!process.env.TINYBIRD_ADMIN_TOKEN) {
      console.error("Analytics AI error: TINYBIRD_ADMIN_TOKEN is not configured");
      return Response.json(
        { error: "TINYBIRD_ADMIN_TOKEN is not configured" },
        { status: 500 }
      );
    }

    const { question, conversationHistory = [] } = await request.json();

    if (!question || typeof question !== "string") {
      return Response.json({ error: "Question is required" }, { status: 400 });
    }

    // Get available Tinybird tools
    let tinybirdTools;
    try {
      tinybirdTools = await listTinybirdTools();
    } catch (error) {
      console.error("Analytics AI error: Failed to list Tinybird tools:", error);
      return Response.json(
        {
          error:
            error instanceof Error
              ? `Failed to connect to Tinybird: ${error.message}`
              : "Failed to connect to Tinybird",
        },
        { status: 500 }
      );
    }

    const anthropicTools = toAnthropicTools(tinybirdTools);
    const anthropic = getAnthropicClient();

    // Build messages array
    const messages: Anthropic.MessageParam[] = [
      ...conversationHistory.map((msg: ConversationMessage) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      { role: "user", content: question },
    ];

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const toolCalls: ToolCallInfo[] = [];
        let fullResponse = "";
        let currentToolUse: {
          id: string;
          name: string;
          input: Record<string, unknown>;
        } | null = null;
        let inputJson = "";

        const sendEvent = (data: Record<string, unknown>) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          );
        };

        try {
          // Initial LLM call with tools
          let response = await anthropic.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 4096,
            system: ANALYTICS_SYSTEM_PROMPT,
            tools: anthropicTools,
            messages,
            stream: true,
          });

          let stopReason: string | null = null;
          const toolUseBlocks: Array<{
            id: string;
            name: string;
            input: Record<string, unknown>;
          }> = [];

          // Process streaming response
          for await (const event of response) {
            if (event.type === "content_block_start") {
              if (event.content_block.type === "tool_use") {
                currentToolUse = {
                  id: event.content_block.id,
                  name: event.content_block.name,
                  input: {},
                };
                inputJson = "";
              }
            } else if (event.type === "content_block_delta") {
              if (event.delta.type === "text_delta") {
                fullResponse += event.delta.text;
                sendEvent({ text: event.delta.text });
              } else if (event.delta.type === "input_json_delta") {
                inputJson += event.delta.partial_json;
              }
            } else if (event.type === "content_block_stop") {
              if (currentToolUse) {
                try {
                  currentToolUse.input = JSON.parse(inputJson || "{}");
                } catch {
                  currentToolUse.input = {};
                }
                toolUseBlocks.push(currentToolUse);
                currentToolUse = null;
                inputJson = "";
              }
            } else if (event.type === "message_delta") {
              stopReason = event.delta.stop_reason;
            }
          }

          // Handle tool calls if any
          if (stopReason === "tool_use" && toolUseBlocks.length > 0) {
            const toolResults: Anthropic.ToolResultBlockParam[] = [];

            for (const toolUse of toolUseBlocks) {
              sendEvent({
                toolCall: {
                  tool: toolUse.name,
                  args: toolUse.input,
                },
              });

              // Execute tool with retry logic
              let result: Awaited<ReturnType<typeof callTinybirdTool>>;
              let lastError: string | undefined;

              for (let attempt = 0; attempt <= MAX_TOOL_RETRIES; attempt++) {
                try {
                  result = await callTinybirdTool(toolUse.name, toolUse.input);

                  if (result.isError) {
                    lastError = result.content[0]?.text || "Unknown error";
                    if (attempt < MAX_TOOL_RETRIES) {
                      continue;
                    }
                  } else {
                    break;
                  }
                } catch (err) {
                  lastError = err instanceof Error ? err.message : "Tool call failed";
                  if (attempt === MAX_TOOL_RETRIES) {
                    result = {
                      content: [{ type: "text", text: `Error: ${lastError}` }],
                      isError: true,
                    };
                  }
                }
              }

              const parsed = parseToolResult(result!);
              toolCalls.push({
                tool: toolUse.name,
                args: toolUse.input,
                result: parsed.error ? undefined : JSON.stringify(parsed.data.slice(0, 10)),
                error: parsed.error,
              });

              toolResults.push({
                type: "tool_result",
                tool_use_id: toolUse.id,
                content: result!.content[0]?.text || "",
                is_error: result!.isError,
              });
            }

            // Continue conversation with tool results
            const continueMessages: Anthropic.MessageParam[] = [
              ...messages,
              {
                role: "assistant",
                content: toolUseBlocks.map((t) => ({
                  type: "tool_use" as const,
                  id: t.id,
                  name: t.name,
                  input: t.input,
                })),
              },
              {
                role: "user",
                content: toolResults,
              },
            ];

            // Get final response with analysis
            const finalResponse = await anthropic.messages.create({
              model: "claude-sonnet-4-20250514",
              max_tokens: 4096,
              system: ANALYTICS_SYSTEM_PROMPT,
              tools: anthropicTools,
              messages: continueMessages,
              stream: true,
            });

            for await (const event of finalResponse) {
              if (
                event.type === "content_block_delta" &&
                event.delta.type === "text_delta"
              ) {
                fullResponse += event.delta.text;
                sendEvent({ text: event.delta.text });
              }
            }
          }

          // Extract chart spec from response if present
          const chartSpec = extractChartSpec(fullResponse);

          // Send final event with chart and tool calls
          sendEvent({
            done: true,
            chart: chartSpec,
            toolCalls,
          });

          controller.close();
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          sendEvent({ error: errorMessage, done: true });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Analytics AI error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * Extract chart specification from LLM response
 */
function extractChartSpec(response: string): ChartSpec | null {
  // Look for ```chart ... ``` block
  const chartMatch = response.match(/```chart\s*([\s\S]*?)```/);
  if (!chartMatch) {
    return null;
  }

  try {
    const chartJson = chartMatch[1].trim();
    const spec = JSON.parse(chartJson) as ChartSpec;

    // Validate required fields
    if (!spec.type || !spec.title || !Array.isArray(spec.data)) {
      return null;
    }

    return spec;
  } catch {
    return null;
  }
}
