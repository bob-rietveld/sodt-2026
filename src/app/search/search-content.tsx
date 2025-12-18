"use client";

import { useState, useCallback } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import Link from "next/link";
import { PDF } from "@/types";

interface SearchResult {
  content: string;
  title: string;
  filename: string;
  pageNumber: number;
  score: number;
}

export default function SearchContent() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Also show PDFs from Convex for basic search
  const convexResults = useQuery(api.pdfs.search, { query });

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;

    setIsSearching(true);
    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      if (response.ok) {
        const data = await response.json();
        setResults(data.results || []);
      }
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsSearching(false);
    }
  }, [query]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-foreground/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-semibold text-primary">
            Techleap
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/search" className="text-primary font-medium">
              Search
            </Link>
            <Link href="/chat" className="text-foreground hover:text-primary transition-colors">
              Chat
            </Link>
            <Link href="/upload" className="text-foreground hover:text-primary transition-colors">
              Upload
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-semibold mb-8">Search Documents</h1>

        {/* Search Input */}
        <div className="flex gap-4 mb-8">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search for documents..."
            className="flex-1 px-4 py-3 rounded-lg border border-foreground/20 bg-white focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <button
            onClick={handleSearch}
            disabled={isSearching}
            className="px-6 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isSearching ? "Searching..." : "Search"}
          </button>
        </div>

        {/* Results */}
        <div className="space-y-4">
          {results.length > 0 ? (
            <>
              <h2 className="text-lg font-medium text-foreground/70">
                Semantic Search Results
              </h2>
              {results.map((result, index) => (
                <div
                  key={index}
                  className="bg-white p-6 rounded-xl border border-foreground/10 hover:border-primary/20 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-lg">{result.title}</h3>
                    <span className="text-sm text-foreground/50 bg-foreground/5 px-2 py-1 rounded">
                      Score: {(result.score * 100).toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-foreground/70 mb-3 line-clamp-3">
                    {result.content}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-foreground/50">
                    <span>{result.filename}</span>
                    <span>Page {result.pageNumber}</span>
                  </div>
                </div>
              ))}
            </>
          ) : convexResults && convexResults.length > 0 ? (
            <>
              <h2 className="text-lg font-medium text-foreground/70">
                Available Documents
              </h2>
              {convexResults.map((pdf: PDF) => (
                <div
                  key={pdf._id}
                  className="bg-white p-6 rounded-xl border border-foreground/10 hover:border-primary/20 transition-colors"
                >
                  <h3 className="font-semibold text-lg mb-2">{pdf.title}</h3>
                  {pdf.description && (
                    <p className="text-foreground/70 mb-3">{pdf.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-foreground/50">
                    <span>{pdf.filename}</span>
                    {pdf.pageCount && <span>{pdf.pageCount} pages</span>}
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${
                        pdf.status === "completed"
                          ? "bg-success/10 text-success"
                          : pdf.status === "failed"
                            ? "bg-danger/10 text-danger"
                            : "bg-warning/10 text-warning"
                      }`}
                    >
                      {pdf.status}
                    </span>
                  </div>
                </div>
              ))}
            </>
          ) : query ? (
            <div className="text-center py-12 text-foreground/50">
              No results found. Try a different search term.
            </div>
          ) : (
            <div className="text-center py-12 text-foreground/50">
              Enter a search query to find relevant documents.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
