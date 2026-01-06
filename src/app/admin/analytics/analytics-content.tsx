"use client";

import { useState, useCallback } from "react";
import { AnalyticsChat } from "@/components/analytics/analytics-chat";
import { SavedViews } from "@/components/analytics/saved-views";
import { DynamicChart } from "@/components/analytics/dynamic-chart";
import type { ChartSpec } from "@/types/analytics-viz";

export default function AnalyticsContent() {
  const [loadedView, setLoadedView] = useState<{
    question: string;
    chartSpec: ChartSpec;
  } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLoadView = useCallback(
    (view: {
      question: string;
      chartSpec: ChartSpec;
      toolName?: string;
      toolArgs?: Record<string, unknown>;
    }) => {
      setLoadedView({
        question: view.question,
        chartSpec: view.chartSpec,
      });
    },
    []
  );

  const handleClearLoaded = () => {
    setLoadedView(null);
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold">Analytics</h1>
          <p className="text-foreground/60 mt-1">
            Ask questions about your platform data using natural language
          </p>
        </div>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="flex items-center gap-2 px-3 py-2 text-sm border border-foreground/20 rounded-lg hover:bg-foreground/5 transition-colors"
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
          {sidebarOpen ? "Hide" : "Show"} Saved Views
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex gap-6 min-h-0">
        {/* Chat area */}
        <div
          className={`flex-1 flex flex-col bg-white rounded-xl border border-foreground/10 overflow-hidden ${
            sidebarOpen ? "" : "max-w-full"
          }`}
        >
          {loadedView ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Loaded view header */}
              <div className="flex items-center justify-between p-4 border-b border-foreground/10">
                <div>
                  <h2 className="font-semibold">{loadedView.chartSpec.title}</h2>
                  <p className="text-sm text-foreground/50 mt-1">
                    &quot;{loadedView.question}&quot;
                  </p>
                </div>
                <button
                  onClick={handleClearLoaded}
                  className="flex items-center gap-1 px-3 py-2 text-sm text-foreground/60 hover:text-foreground hover:bg-foreground/5 rounded-lg transition-colors"
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
                      d="M10 19l-7-7m0 0l7-7m-7 7h18"
                    />
                  </svg>
                  Back to chat
                </button>
              </div>

              {/* Chart display */}
              <div className="flex-1 overflow-y-auto p-6">
                <DynamicChart spec={loadedView.chartSpec} />

                <div className="mt-6 p-4 bg-foreground/5 rounded-lg">
                  <h3 className="text-sm font-medium mb-2">
                    About this visualization
                  </h3>
                  <p className="text-sm text-foreground/60">
                    This chart was generated from the question: &quot;
                    {loadedView.question}&quot;
                  </p>
                  {loadedView.chartSpec.description && (
                    <p className="text-sm text-foreground/60 mt-2">
                      {loadedView.chartSpec.description}
                    </p>
                  )}
                  <p className="text-xs text-foreground/40 mt-3">
                    Data refreshed when view was loaded. Click the view again to
                    refresh.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <AnalyticsChat />
          )}
        </div>

        {/* Saved views sidebar */}
        {sidebarOpen && (
          <div className="w-80 flex-shrink-0 bg-white rounded-xl border border-foreground/10 overflow-hidden">
            <SavedViews onLoadView={handleLoadView} />
          </div>
        )}
      </div>
    </div>
  );
}
