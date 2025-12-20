"use client";

import { useState, useRef, useEffect } from "react";
import { Header } from "@/components/ui/header";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Array<{
    title: string;
    filename: string;
    pageNumber: number;
    score: number;
  }>;
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
      let sources: Message["sources"] = [];

      // Add empty assistant message
      setMessages((prev) => [...prev, { role: "assistant", content: "", sources: [] }]);

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
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, there was an error processing your request. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header showAdmin={false} />

      {/* Chat Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 flex flex-col">
        <h1 className="text-2xl sm:text-3xl font-semibold mb-4 sm:mb-6">Chat with Documents</h1>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 sm:space-y-6 mb-4 sm:mb-6">
          {messages.length === 0 ? (
            <div className="text-center py-8 sm:py-12 text-foreground/50">
              <p className="text-base sm:text-lg mb-2">Ask a question about your documents</p>
              <p className="text-sm">
                I&apos;ll search through the document library and provide answers with sources.
              </p>
            </div>
          ) : (
            messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[90%] sm:max-w-[80%] p-3 sm:p-4 rounded-2xl ${
                    message.role === "user"
                      ? "bg-primary text-white"
                      : "bg-white border border-foreground/10"
                  }`}
                >
                  <p className="whitespace-pre-wrap text-sm sm:text-base">{message.content}</p>

                  {/* Sources */}
                  {message.sources && message.sources.length > 0 && (
                    <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-foreground/10">
                      <p className="text-xs font-medium text-foreground/50 mb-2">
                        Sources:
                      </p>
                      <div className="space-y-1">
                        {message.sources.map((source, i) => (
                          <div
                            key={i}
                            className="text-xs text-foreground/60 flex items-start sm:items-center gap-2 flex-wrap sm:flex-nowrap"
                          >
                            <span className="bg-foreground/5 px-1.5 py-0.5 rounded flex-shrink-0">
                              {i + 1}
                            </span>
                            <span className="break-words">{source.title}</span>
                            <span className="text-foreground/40 flex-shrink-0">
                              p.{source.pageNumber}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
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
