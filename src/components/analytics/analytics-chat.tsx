"use client";

import { useState, useRef, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { DynamicChart } from "./dynamic-chart";
import type {
  ChartSpec,
  ToolCallInfo,
  ConversationMessage,
} from "@/types/analytics-viz";

interface AnalyticsChatProps {
  onChartGenerated?: (chart: ChartSpec, question: string) => void;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  chart?: ChartSpec;
  toolCalls?: ToolCallInfo[];
  isStreaming?: boolean;
}

const EXAMPLE_QUESTIONS = [
  "What are the top 10 search queries this month?",
  "Show me searches over time for the last 30 days",
  "Which searches returned no results?",
  "What's the average response time for queries?",
  "Show me traffic sources breakdown",
];

export function AnalyticsChat({ onChartGenerated }: AnalyticsChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const saveView = useMutation(api.analyticsViews.saveView);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (question: string) => {
    if (!question.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: question };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // Build conversation history for context
    const conversationHistory: ConversationMessage[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Add streaming assistant message
    const assistantMessage: Message = {
      role: "assistant",
      content: "",
      isStreaming: true,
    };
    setMessages((prev) => [...prev, assistantMessage]);

    try {
      const response = await fetch("/api/analytics/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, conversationHistory }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";
      let finalChart: ChartSpec | undefined;
      let finalToolCalls: ToolCallInfo[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process SSE events
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.text) {
                fullContent += data.text;
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last.role === "assistant") {
                    last.content = fullContent;
                  }
                  return updated;
                });
              }

              if (data.toolCall) {
                finalToolCalls.push(data.toolCall);
              }

              if (data.done) {
                if (data.chart) {
                  finalChart = data.chart;
                }
                if (data.toolCalls) {
                  finalToolCalls = data.toolCalls;
                }
              }

              if (data.error) {
                fullContent += `\n\nError: ${data.error}`;
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last.role === "assistant") {
                    last.content = fullContent;
                  }
                  return updated;
                });
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }

      // Update final message with chart and tool calls
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last.role === "assistant") {
          last.isStreaming = false;
          last.chart = finalChart;
          last.toolCalls = finalToolCalls;
        }
        return updated;
      });

      // Notify parent of chart generation
      if (finalChart && onChartGenerated) {
        onChartGenerated(finalChart, question);
      }
    } catch (error) {
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last.role === "assistant") {
          last.content =
            "Sorry, I encountered an error processing your request. Please try again.";
          last.isStreaming = false;
        }
        return updated;
      });
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleSaveChart = async (
    chart: ChartSpec,
    question: string,
    toolCalls?: ToolCallInfo[]
  ) => {
    try {
      // Find the first successful tool call (has result, no error)
      const successfulToolCall = toolCalls?.find(
        (tc) => tc.result && !tc.error
      );

      await saveView({
        name: chart.title,
        question,
        chartSpec: JSON.stringify(chart),
        toolName: successfulToolCall?.tool,
        toolArgs: successfulToolCall?.args
          ? JSON.stringify(successfulToolCall.args)
          : undefined,
      });
    } catch (error) {
      console.error("Failed to save view:", error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(input);
    }
  };

  // Strip chart JSON from displayed content
  const cleanContent = (content: string) => {
    return content.replace(/```chart[\s\S]*?```/g, "").trim();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold mb-2">Analytics Assistant</h2>
            <p className="text-foreground/60 mb-6">
              Ask questions about your platform analytics in natural language
            </p>
            <div className="space-y-2">
              <p className="text-sm text-foreground/50">Try asking:</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {EXAMPLE_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleSubmit(q)}
                    className="text-sm px-3 py-2 bg-foreground/5 hover:bg-foreground/10 rounded-lg transition-colors text-left"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((message, index) => (
            <div key={index} className="space-y-3">
              <div
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-xl px-4 py-3 ${
                    message.role === "user"
                      ? "bg-primary text-white"
                      : "bg-foreground/5"
                  }`}
                >
                  <div className="whitespace-pre-wrap">
                    {cleanContent(message.content)}
                    {message.isStreaming && (
                      <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse" />
                    )}
                  </div>
                </div>
              </div>

              {/* Tool calls indicator */}
              {message.toolCalls && message.toolCalls.length > 0 && (
                <div className="flex justify-start">
                  <div className="text-xs text-foreground/50 px-4">
                    <details>
                      <summary className="cursor-pointer hover:text-foreground/70">
                        {message.toolCalls.length} tool call
                        {message.toolCalls.length > 1 ? "s" : ""} made
                      </summary>
                      <ul className="mt-2 space-y-1 pl-4">
                        {message.toolCalls.map((tc, i) => (
                          <li key={i} className="font-mono">
                            {tc.tool}({JSON.stringify(tc.args)})
                            {tc.error && (
                              <span className="text-red-500 ml-2">
                                Error: {tc.error}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </details>
                  </div>
                </div>
              )}

              {/* Chart */}
              {message.chart && (
                <div className="space-y-2">
                  <DynamicChart spec={message.chart} />
                  <div className="flex justify-end">
                    <button
                      onClick={() =>
                        handleSaveChart(
                          message.chart!,
                          messages[index - 1]?.content || "",
                          message.toolCalls
                        )
                      }
                      className="text-sm text-primary hover:text-primary/80 flex items-center gap-1"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                        />
                      </svg>
                      Save view
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-foreground/10 p-4">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your analytics..."
            className="flex-1 px-4 py-3 rounded-xl border border-foreground/20 bg-white focus:outline-none focus:border-primary"
            disabled={isLoading}
          />
          <button
            onClick={() => handleSubmit(input)}
            disabled={!input.trim() || isLoading}
            className="px-6 py-3 bg-primary text-white rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <svg
                className="w-5 h-5 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            ) : (
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
