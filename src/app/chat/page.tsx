"use client";

import { useState, useRef, useEffect } from "react";
import { Header } from "@/components/ui/header";
import ReactMarkdown from "react-markdown";

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

function SourceBadge({ index, source }: { index: number; source: Source }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-primary/10 text-primary rounded border border-primary/20 cursor-help"
      title={`${source.title} - Page ${source.pageNumber}`}
    >
      <span className="font-medium">[{index}]</span>
    </span>
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
          // Style links
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
          // Style code blocks
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
          // Style blockquotes
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

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
        body: JSON.stringify({ message: userMessage }),
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
                  // Remove loading state when first content arrives
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
        // Remove loading message and add error
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
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header showAdmin={false} />

      {/* Chat Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 flex flex-col">
        <h1 className="text-2xl sm:text-3xl font-semibold mb-4 sm:mb-6">
          Chat with Documents
        </h1>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 sm:space-y-6 mb-4 sm:mb-6">
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

        {/* Input */}
        <form onSubmit={handleSubmit} className="flex gap-2 sm:gap-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question..."
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
      </main>
    </div>
  );
}
