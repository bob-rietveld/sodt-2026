"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery } from "convex/react";
import { Header } from "@/components/ui/header";
import ReactMarkdown from "react-markdown";
import { api } from "../../../convex/_generated/api";

interface Source {
  title: string;
  filename: string;
  pageNumber: number;
  score?: number;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  isLoading?: boolean;
}

interface ChatFilters {
  continent?: string;
  industry?: string;
  year?: number;
}

const continentLabels: Record<string, string> = {
  us: "United States",
  eu: "Europe",
  asia: "Asia",
  global: "Global",
  other: "Other",
};

const industryLabels: Record<string, string> = {
  semicon: "Semiconductor",
  deeptech: "Deep Tech",
  biotech: "Biotech",
  fintech: "Fintech",
  cleantech: "Clean Tech",
  other: "Other",
};

function LoadingIndicator() {
  return (
    <div className="flex items-center gap-2 text-foreground/50">
      <div className="flex gap-1">
        <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.3s]" />
        <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.15s]" />
        <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" />
      </div>
      <span className="text-sm">Searching documents and generating response...</span>
    </div>
  );
}

function SourcesList({ sources }: { sources: Source[] }) {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-4 pt-4 border-t border-foreground/10">
      <p className="text-xs font-medium text-foreground/50 mb-2">References:</p>
      <div className="space-y-1.5">
        {sources.map((source, i) => (
          <div
            key={i}
            className="text-xs text-foreground/70 flex items-start gap-2 p-2 bg-foreground/[0.02] rounded-lg"
          >
            <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium flex-shrink-0">
              [{i + 1}]
            </span>
            <div className="flex-1 min-w-0">
              <span className="font-medium block break-words">{source.title}</span>
              <span className="text-foreground/50">Page {source.pageNumber}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-2 prose-headings:my-3 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-blockquote:my-2 prose-pre:my-2">
      <ReactMarkdown
        components={{
          a: ({ children, href }) => (
            <a
              href={href}
              className="text-primary hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
          code: ({ children, className }) => {
            const isInline = !className;
            return isInline ? (
              <code className="bg-foreground/5 px-1.5 py-0.5 rounded text-sm font-mono">
                {children}
              </code>
            ) : (
              <code className={className}>{children}</code>
            );
          },
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-primary/30 pl-4 italic text-foreground/70">
              {children}
            </blockquote>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function FilterBar({
  filters,
  setFilters,
  options,
  documentCount,
}: {
  filters: ChatFilters;
  setFilters: (filters: ChatFilters) => void;
  options: {
    continents: string[];
    industries: string[];
    years: number[];
  } | undefined;
  documentCount: number | undefined;
}) {
  const hasActiveFilters = filters.continent || filters.industry || filters.year;

  return (
    <div className="bg-white rounded-lg border border-foreground/10 p-3 mb-4">
      <div className="flex flex-wrap items-center gap-3">
        {/* Filter Icon & Label */}
        <div className="flex items-center gap-2 text-sm text-foreground/60">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          <span className="font-medium">Filter documents:</span>
        </div>

        {/* Region Filter */}
        <select
          value={filters.continent ?? ""}
          onChange={(e) =>
            setFilters({ ...filters, continent: e.target.value || undefined })
          }
          className="px-2.5 py-1.5 text-sm border border-foreground/15 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 bg-white min-w-[120px]"
        >
          <option value="">All Regions</option>
          {options?.continents.map((c) => (
            <option key={c} value={c}>
              {continentLabels[c] ?? c}
            </option>
          ))}
        </select>

        {/* Industry Filter */}
        <select
          value={filters.industry ?? ""}
          onChange={(e) =>
            setFilters({ ...filters, industry: e.target.value || undefined })
          }
          className="px-2.5 py-1.5 text-sm border border-foreground/15 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 bg-white min-w-[120px]"
        >
          <option value="">All Industries</option>
          {options?.industries.map((i) => (
            <option key={i} value={i}>
              {industryLabels[i] ?? i}
            </option>
          ))}
        </select>

        {/* Year Filter */}
        <select
          value={filters.year?.toString() ?? ""}
          onChange={(e) => {
            const value = e.target.value;
            setFilters({
              ...filters,
              year: value ? parseInt(value, 10) : undefined,
            });
          }}
          className="px-2.5 py-1.5 text-sm border border-foreground/15 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 bg-white min-w-[100px]"
        >
          <option value="">All Years</option>
          {options?.years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <button
            onClick={() => setFilters({})}
            className="text-sm text-primary hover:underline"
          >
            Clear
          </button>
        )}

        {/* Document Count */}
        <div className="ml-auto text-xs text-foreground/50">
          {documentCount !== undefined ? (
            <span>
              Searching {documentCount} document{documentCount !== 1 ? "s" : ""}
            </span>
          ) : (
            <span>Loading...</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [filters, setFilters] = useState<ChatFilters>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch filter options from Convex
  const filterOptions = useQuery(api.pdfs.getFilterOptions);

  // Fetch Pinecone file IDs based on current filters
  const filteredFiles = useQuery(api.pdfs.getPineconeFileIdsByFilters, {
    continent: filters.continent,
    industry: filters.industry,
    year: filters.year,
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    // Add loading message
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "", isLoading: true },
    ]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          fileIds: filteredFiles?.fileIds,
        }),
      });

      if (!response.ok) throw new Error("Chat request failed");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      let assistantMessage = "";
      let sources: Source[] = [];
      let receivedFirstChunk = false;

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === "sources") {
                sources = data.sources;
                setMessages((prev) => {
                  const newMessages = [...prev];
                  const lastMessage = newMessages[newMessages.length - 1];
                  if (lastMessage.role === "assistant") {
                    lastMessage.sources = sources;
                  }
                  return newMessages;
                });
              } else if (data.type === "text") {
                if (!receivedFirstChunk) {
                  receivedFirstChunk = true;
                  setMessages((prev) => {
                    const newMessages = [...prev];
                    const lastMessage = newMessages[newMessages.length - 1];
                    if (lastMessage.role === "assistant") {
                      lastMessage.isLoading = false;
                    }
                    return newMessages;
                  });
                }
                assistantMessage += data.content;
                setMessages((prev) => {
                  const newMessages = [...prev];
                  const lastMessage = newMessages[newMessages.length - 1];
                  if (lastMessage.role === "assistant") {
                    lastMessage.content = assistantMessage;
                  }
                  return newMessages;
                });
              }
            } catch {
              // Ignore parsing errors
            }
          }
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => {
        const filtered = prev.filter((m) => !m.isLoading);
        return [
          ...filtered,
          {
            role: "assistant",
            content:
              "Sorry, there was an error processing your request. Please try again.",
          },
        ];
      });
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleReset = () => {
    setMessages([]);
    inputRef.current?.focus();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header showAdmin={false} />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 flex flex-col">
        {/* Header with title and reset button */}
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-semibold">
            Chat with Documents
          </h1>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleReset}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-foreground/60 hover:text-foreground hover:bg-foreground/5 rounded-lg transition-colors disabled:opacity-50"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
              New chat
            </button>
          )}
        </div>

        {/* Filter Bar */}
        <FilterBar
          filters={filters}
          setFilters={setFilters}
          options={filterOptions}
          documentCount={filteredFiles?.count}
        />

        {/* Input at the top */}
        <form onSubmit={handleSubmit} className="flex gap-2 sm:gap-4 mb-6">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question about the State of Dutch Tech..."
            disabled={isLoading}
            className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg border border-foreground/20 bg-white focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 text-sm sm:text-base"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-4 sm:px-6 py-2.5 sm:py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 text-sm sm:text-base flex-shrink-0"
          >
            {isLoading ? "..." : "Send"}
          </button>
        </form>

        {/* Messages below input */}
        <div className="flex-1 overflow-y-auto space-y-4 sm:space-y-6">
          {messages.length === 0 ? (
            <div className="text-center py-8 sm:py-12 text-foreground/50">
              <p className="text-base sm:text-lg mb-2">
                Ask a question about the State of Dutch Tech
              </p>
              <p className="text-sm">
                I&apos;ll search through the documents and provide answers with
                source references.
              </p>
            </div>
          ) : (
            messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[90%] sm:max-w-[85%] p-3 sm:p-4 rounded-2xl ${
                    message.role === "user"
                      ? "bg-primary text-white"
                      : "bg-white border border-foreground/10 shadow-sm"
                  }`}
                >
                  {message.role === "assistant" && message.isLoading ? (
                    <LoadingIndicator />
                  ) : message.role === "assistant" ? (
                    <>
                      <MarkdownContent content={message.content} />
                      <SourcesList sources={message.sources || []} />
                    </>
                  ) : (
                    <p className="whitespace-pre-wrap text-sm sm:text-base">
                      {message.content}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>
    </div>
  );
}
