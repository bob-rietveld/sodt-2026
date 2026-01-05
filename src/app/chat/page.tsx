"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery } from "convex/react";
import { Header } from "@/components/ui/header";
import { MultiSelectDropdown, type FilterOption } from "@/components/ui/multi-select-dropdown";
import ReactMarkdown from "react-markdown";
import { api } from "../../../convex/_generated/api";

interface Source {
  index: number;
  references: Array<{
    fileId: string;
    title: string;
    filename: string;
    pageNumbers: number[];
  }>;
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
  technologyAreas?: string[];
  keywords?: string[];
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

  // Format page numbers (e.g., "Pages 1, 3, 5" or "Page 2")
  const formatPages = (pageNumbers: number[]) => {
    if (pageNumbers.length === 0) return null;
    if (pageNumbers.length === 1) return `Page ${pageNumbers[0]}`;
    return `Pages ${pageNumbers.join(", ")}`;
  };

  return (
    <div className="mt-4 pt-4 border-t border-foreground/10">
      <p className="text-xs font-medium text-foreground/50 mb-2">Sources:</p>
      <div className="space-y-1.5">
        {sources.map((source) => (
          <div
            key={source.index}
            id={`source-${source.index}`}
            className="text-xs text-foreground/70 flex items-start gap-2 p-2 bg-foreground/[0.02] rounded-lg"
          >
            <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium flex-shrink-0">
              [{source.index}]
            </span>
            <div className="flex-1 min-w-0">
              {source.references.map((ref) => (
                <div key={`${source.index}:${ref.fileId}`} className="mb-1 last:mb-0">
                  <span className="font-medium block break-words">{ref.title}</span>
                  {ref.pageNumbers.length > 0 && (
                    <span className="text-foreground/50">{formatPages(ref.pageNumbers)}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function linkifyInlineCitations(content: string, sources: Source[]) {
  if (!sources || sources.length === 0) return content;
  const valid = new Set(sources.map((s) => String(s.index)));
  // Replace `[n]` with `[[n]](#source-n)` unless it's already `[[n]]...`.
  return content.replace(/(^|[^\[])\[(\d+)\]/g, (match, prefix, n) => {
    if (!valid.has(String(n))) return match;
    return `${prefix}[[${n}]](#source-${n})`;
  });
}

function MarkdownContent({ content, sources }: { content: string; sources: Source[] }) {
  const linked = linkifyInlineCitations(content, sources);
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
        {linked}
      </ReactMarkdown>
    </div>
  );
}

function FilterPanel({
  filters,
  setFilters,
  options,
  documentCount,
  isLoading,
}: {
  filters: ChatFilters;
  setFilters: (filters: ChatFilters) => void;
  options: {
    continents: string[];
    industries: string[];
    years: number[];
    technologyAreas: FilterOption[];
    keywords: FilterOption[];
  } | undefined;
  documentCount: number | undefined;
  isLoading: boolean;
}) {
  const hasActiveFilters =
    filters.continent ||
    filters.industry ||
    filters.year ||
    (filters.technologyAreas && filters.technologyAreas.length > 0) ||
    (filters.keywords && filters.keywords.length > 0);

  return (
    <div className="bg-white rounded-xl border border-foreground/10 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-foreground/10 bg-foreground/[0.02]">
        <h2 className="font-semibold text-lg">Filters</h2>
        {hasActiveFilters && (
          <button
            onClick={() => setFilters({})}
            disabled={isLoading}
            className="text-sm text-primary hover:underline disabled:opacity-50"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="p-5 space-y-5">
        {/* Document Count */}
        <div className="text-sm text-foreground/60 flex items-center gap-2">
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
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          {documentCount !== undefined ? (
            <span>
              {documentCount} document{documentCount !== 1 ? "s" : ""} available
            </span>
          ) : (
            <span>Loading...</span>
          )}
        </div>

        {/* Technology Areas Filter */}
        {options?.technologyAreas && options.technologyAreas.length > 0 && (
          <MultiSelectDropdown
            label="Technology Areas"
            placeholder="Search technologies..."
            options={options.technologyAreas}
            selected={filters.technologyAreas ?? []}
            onChange={(selected) =>
              setFilters({ ...filters, technologyAreas: selected.length > 0 ? selected : undefined })
            }
          />
        )}

        {/* Keywords Filter */}
        {options?.keywords && options.keywords.length > 0 && (
          <MultiSelectDropdown
            label="Keywords"
            placeholder="Search keywords..."
            options={options.keywords}
            selected={filters.keywords ?? []}
            onChange={(selected) =>
              setFilters({ ...filters, keywords: selected.length > 0 ? selected : undefined })
            }
          />
        )}

        {/* Region Filter */}
        <div>
          <label className="block text-sm font-medium text-foreground/70 mb-2">
            Region
          </label>
          <select
            value={filters.continent ?? ""}
            onChange={(e) =>
              setFilters({ ...filters, continent: e.target.value || undefined })
            }
            disabled={isLoading}
            className="w-full px-3 py-2.5 border border-foreground/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 bg-white disabled:opacity-50"
          >
            <option value="">All Regions</option>
            {options?.continents.map((c) => (
              <option key={c} value={c}>
                {continentLabels[c] ?? c}
              </option>
            ))}
          </select>
        </div>

        {/* Industry Filter */}
        <div>
          <label className="block text-sm font-medium text-foreground/70 mb-2">
            Industry
          </label>
          <select
            value={filters.industry ?? ""}
            onChange={(e) =>
              setFilters({ ...filters, industry: e.target.value || undefined })
            }
            disabled={isLoading}
            className="w-full px-3 py-2.5 border border-foreground/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 bg-white disabled:opacity-50"
          >
            <option value="">All Industries</option>
            {options?.industries.map((i) => (
              <option key={i} value={i}>
                {industryLabels[i] ?? i}
              </option>
            ))}
          </select>
        </div>

        {/* Year Filter */}
        <div>
          <label className="block text-sm font-medium text-foreground/70 mb-2">
            Year
          </label>
          <select
            value={filters.year?.toString() ?? ""}
            onChange={(e) => {
              const value = e.target.value;
              setFilters({
                ...filters,
                year: value ? parseInt(value, 10) : undefined,
              });
            }}
            disabled={isLoading}
            className="w-full px-3 py-2.5 border border-foreground/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 bg-white disabled:opacity-50"
          >
            <option value="">All Years</option>
            {options?.years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
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
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch filter options from Convex
  const filterOptions = useQuery(api.pdfs.getFilterOptions);

  // Fetch Pinecone file IDs based on current filters
  const filteredFiles = useQuery(api.pdfs.getPineconeFileIdsByFilters, {
    continent: filters.continent,
    industry: filters.industry,
    year: filters.year,
    technologyAreas: filters.technologyAreas,
    keywords: filters.keywords,
  });

  const hasActiveFilters =
    filters.continent ||
    filters.industry ||
    filters.year ||
    (filters.technologyAreas && filters.technologyAreas.length > 0) ||
    (filters.keywords && filters.keywords.length > 0);

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

    // Scroll to bottom after adding messages
    setTimeout(scrollToBottom, 100);

    try {
      // All filters are now sent directly to Pinecone as metadata filters
      // Array fields (keywords, technologyAreas) are stored as arrays in Pinecone
      // and can be filtered with $in queries
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          // Send all filters directly to Pinecone
          filters: hasActiveFilters
            ? {
                continent: filters.continent,
                industry: filters.industry,
                year: filters.year,
                keywords: filters.keywords,
                technologyAreas: filters.technologyAreas,
              }
            : undefined,
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

              if (data.type === "final") {
                assistantMessage = data.content ?? assistantMessage;
                sources = data.sources ?? sources;
                setMessages((prev) => {
                  const newMessages = [...prev];
                  const lastMessage = newMessages[newMessages.length - 1];
                  if (lastMessage.role === "assistant") {
                    lastMessage.isLoading = false;
                    lastMessage.content = assistantMessage;
                    lastMessage.sources = sources;
                  }
                  return newMessages;
                });
              } else if (data.type === "sources") {
                // Back-compat if the API sends sources separately.
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
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-semibold">Chat with Documents</h1>

          <div className="flex items-center gap-3">
            {/* Reset Button */}
            {messages.length > 0 && (
              <button
                type="button"
                onClick={handleReset}
                disabled={isLoading}
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-sm text-foreground/60 hover:text-foreground hover:bg-foreground/5 rounded-lg transition-colors disabled:opacity-50"
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

            {/* Mobile Filter Toggle */}
            <button
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className="lg:hidden flex items-center gap-2 px-4 py-2 bg-white border border-foreground/20 rounded-lg text-sm font-medium hover:bg-foreground/5 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filters
              {hasActiveFilters && (
                <span className="w-2 h-2 bg-primary rounded-full"></span>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Filter Panel */}
        {isFilterOpen && (
          <div className="lg:hidden mb-6">
            {filterOptions ? (
              <FilterPanel
                filters={filters}
                setFilters={setFilters}
                options={filterOptions}
                documentCount={filteredFiles?.count}
                isLoading={isLoading}
              />
            ) : (
              <div className="bg-white p-6 rounded-xl border border-foreground/10">
                <div className="animate-pulse space-y-4">
                  <div className="h-6 bg-foreground/10 rounded w-20"></div>
                  <div className="h-10 bg-foreground/10 rounded"></div>
                  <div className="h-10 bg-foreground/10 rounded"></div>
                  <div className="h-10 bg-foreground/10 rounded"></div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Main Content */}
        <div className="flex gap-6 lg:gap-8">
          {/* Desktop Filter Sidebar */}
          <aside className="hidden lg:block w-72 flex-shrink-0">
            {filterOptions ? (
              <div className="sticky top-24">
                <FilterPanel
                  filters={filters}
                  setFilters={setFilters}
                  options={filterOptions}
                  documentCount={filteredFiles?.count}
                  isLoading={isLoading}
                />
              </div>
            ) : (
              <div className="bg-white p-6 rounded-xl border border-foreground/10">
                <div className="animate-pulse space-y-4">
                  <div className="h-6 bg-foreground/10 rounded w-20"></div>
                  <div className="h-10 bg-foreground/10 rounded"></div>
                  <div className="h-10 bg-foreground/10 rounded"></div>
                  <div className="h-10 bg-foreground/10 rounded"></div>
                </div>
              </div>
            )}
          </aside>

          {/* Chat Content Area */}
          <div className="flex-1 min-w-0">
            {/* Chat Container */}
            <div className="bg-white rounded-xl border border-foreground/10 overflow-hidden flex flex-col" style={{ minHeight: "calc(100vh - 220px)" }}>
              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center py-12 text-foreground/50">
                    <svg
                      className="w-12 h-12 mb-4 text-foreground/20"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                      />
                    </svg>
                    <p className="text-base sm:text-lg mb-2">
                      Ask a question about the State of Dutch Tech
                    </p>
                    <p className="text-sm max-w-md">
                      I&apos;ll search through the documents and provide answers with
                      source references. Use the filters to narrow down your search.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((message, index) => (
                      <div
                        key={index}
                        className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[85%] p-4 rounded-2xl ${
                            message.role === "user"
                              ? "bg-primary text-white"
                              : "bg-foreground/[0.03] border border-foreground/10"
                          }`}
                        >
                          {message.role === "assistant" && message.isLoading ? (
                            <LoadingIndicator />
                          ) : message.role === "assistant" ? (
                            <>
                              <MarkdownContent content={message.content} sources={message.sources || []} />
                              <SourcesList sources={message.sources || []} />
                            </>
                          ) : (
                            <p className="whitespace-pre-wrap text-sm sm:text-base">
                              {message.content}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Input Area */}
              <div className="border-t border-foreground/10 bg-foreground/[0.02] p-4">
                <form onSubmit={handleSubmit} className="flex gap-3">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask a question about the State of Dutch Tech..."
                    disabled={isLoading}
                    className="flex-1 px-4 py-3 rounded-xl border border-foreground/20 bg-white focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 text-sm sm:text-base"
                  />
                  <button
                    type="submit"
                    disabled={isLoading || !input.trim()}
                    className="px-6 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 text-sm sm:text-base flex-shrink-0"
                  >
                    {isLoading ? "..." : "Send"}
                  </button>
                </form>

                {/* Mobile Reset Button */}
                {messages.length > 0 && (
                  <div className="sm:hidden mt-3 text-center">
                    <button
                      type="button"
                      onClick={handleReset}
                      disabled={isLoading}
                      className="text-sm text-foreground/50 hover:text-foreground transition-colors disabled:opacity-50"
                    >
                      Start new chat
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
