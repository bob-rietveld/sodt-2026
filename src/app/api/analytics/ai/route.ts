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

const MAX_CONVERSATION_TURNS = 3; // Max turns to fix tool errors

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

    let body;
    try {
      body = await request.json();
    } catch (error) {
      console.error("Analytics AI error: Failed to parse request body:", error);
      return Response.json(
        { error: "Invalid request body. Expected JSON." },
        { status: 400 }
      );
    }

    const { question, conversationHistory = [] } = body;

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
          let currentMessages = [...messages];
          let conversationTurns = 0;
          let hasToolUse = true;

          // Allow multiple turns for the LLM to fix tool errors
          while (hasToolUse && conversationTurns < MAX_CONVERSATION_TURNS) {
            conversationTurns++;

            // Call LLM with tools
            const response = await anthropic.messages.create({
              model: "claude-sonnet-4-20250514",
              max_tokens: 4096,
              system: ANALYTICS_SYSTEM_PROMPT,
              tools: anthropicTools,
              messages: currentMessages,
              stream: true,
            });

            let stopReason: string | null = null;
            const toolUseBlocks: Array<{
              id: string;
              name: string;
              input: Record<string, unknown>;
            }> = [];
            const textBlocks: string[] = [];

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
                  textBlocks.push(event.delta.text);
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
              let hasErrors = false;

              for (const toolUse of toolUseBlocks) {
                sendEvent({
                  toolCall: {
                    tool: toolUse.name,
                    args: toolUse.input,
                  },
                });

                // Execute tool (no blind retries - let LLM fix errors)
                try {
                  const result = await callTinybirdTool(toolUse.name, toolUse.input);

                  const parsed = parseToolResult(result);
                  const hasError = result.isError || !!parsed.error;

                  if (hasError) {
                    hasErrors = true;
                  }

                  toolCalls.push({
                    tool: toolUse.name,
                    args: toolUse.input,
                    result: parsed.error ? undefined : JSON.stringify(parsed.data.slice(0, 10)),
                    error: parsed.error,
                  });

                  // Pass result back to LLM (with error if present)
                  toolResults.push({
                    type: "tool_result",
                    tool_use_id: toolUse.id,
                    content: hasError
                      ? `Error: ${parsed.error || result.content[0]?.text}\n\nPlease fix the parameters and try again. Consider: checking parameter names, date formats, required vs optional parameters, and valid parameter values.`
                      : result.content[0]?.text || "",
                    is_error: hasError,
                  });
                } catch (err) {
                  const errorMsg = err instanceof Error ? err.message : "Tool call failed";
                  hasErrors = true;

                  toolCalls.push({
                    tool: toolUse.name,
                    args: toolUse.input,
                    error: errorMsg,
                  });

                  toolResults.push({
                    type: "tool_result",
                    tool_use_id: toolUse.id,
                    content: `Error: ${errorMsg}\n\nPlease fix the parameters and try again.`,
                    is_error: true,
                  });
                }
              }

              // Build next message with tool results
              currentMessages = [
                ...currentMessages,
                {
                  role: "assistant",
                  content: [
                    ...textBlocks.filter(t => t.trim()).map(text => ({
                      type: "text" as const,
                      text,
                    })),
                    ...toolUseBlocks.map((t) => ({
                      type: "tool_use" as const,
                      id: t.id,
                      name: t.name,
                      input: t.input,
                    })),
                  ],
                },
                {
                  role: "user",
                  content: toolResults,
                },
              ];

              // If we have errors and haven't hit max turns, continue loop
              // Otherwise, get final response
              if (!hasErrors || conversationTurns >= MAX_CONVERSATION_TURNS) {
                hasToolUse = false;
              }

              // If max turns reached with errors, add a note
              if (hasErrors && conversationTurns >= MAX_CONVERSATION_TURNS) {
                const errorNote = "\n\nI've reached the maximum number of attempts to fix the Tinybird query. Please check the error messages above for details.";
                fullResponse += errorNote;
                sendEvent({ text: errorNote });
                hasToolUse = false;
              }
            } else {
              // No tool use, we're done
              hasToolUse = false;
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
          console.error("Analytics AI stream error:", error);
          console.error("Stream error stack:", error instanceof Error ? error.stack : "No stack trace");
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
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");
    console.error("Error details:", {
      message: error instanceof Error ? error.message : "Unknown error",
      name: error instanceof Error ? error.name : "Unknown",
      cause: error instanceof Error ? error.cause : undefined,
    });
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        details: process.env.NODE_ENV === "development" 
          ? (error instanceof Error ? error.stack : undefined)
          : undefined,
      },
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
