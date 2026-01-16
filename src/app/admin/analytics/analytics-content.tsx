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
    toolName?: string;
    toolArgs?: Record<string, unknown>;
    refreshedAt?: number;
  } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLoadView = useCallback(
    (view: {
      question: string;
      chartSpec: ChartSpec;
      toolName?: string;
      toolArgs?: Record<string, unknown>;
      isRefreshing?: boolean;
    }) => {
      setLoadedView({
        question: view.question,
        chartSpec: view.chartSpec,
        toolName: view.toolName,
        toolArgs: view.toolArgs,
        refreshedAt: view.isRefreshing === false ? Date.now() : undefined,
      });
      setIsRefreshing(view.isRefreshing ?? false);
    },
    []
  );

  const handleRefreshView = useCallback(async () => {
    if (!loadedView?.toolName || !loadedView?.toolArgs) return;

    setIsRefreshing(true);
    try {
      const response = await fetch("/api/analytics/refresh-view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toolName: loadedView.toolName,
          toolArgs: loadedView.toolArgs,
        }),
      });

      const result = await response.json();

      if (result.error) {
        console.error("Failed to refresh view:", result.error);
        alert(`Failed to refresh: ${result.error}`);
      } else if (result.data) {
        setLoadedView({
          ...loadedView,
          chartSpec: {
            ...loadedView.chartSpec,
            data: result.data,
          },
          refreshedAt: Date.now(),
        });
      }
    } catch (error) {
      console.error("Failed to refresh view:", error);
      alert("Failed to refresh view. Please try again.");
    } finally {
      setIsRefreshing(false);
    }
  }, [loadedView]);

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
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold">
                      {loadedView.chartSpec.title}
                    </h2>
                    {isRefreshing && (
                      <span className="flex items-center gap-1 text-xs text-primary">
                        <svg
                          className="w-3 h-3 animate-spin"
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
                        Refreshing...
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-foreground/50 mt-1">
                    &quot;{loadedView.question}&quot;
                  </p>
                  {loadedView.refreshedAt && (
                    <p className="text-xs text-foreground/40 mt-1">
                      Last refreshed:{" "}
                      {new Date(loadedView.refreshedAt).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {loadedView.toolName && loadedView.toolArgs && (
                    <button
                      onClick={handleRefreshView}
                      disabled={isRefreshing}
                      className="flex items-center gap-1 px-3 py-2 text-sm text-primary hover:text-primary/80 hover:bg-primary/5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Refresh data"
                    >
                      <svg
                        className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                      {isRefreshing ? "Refreshing..." : "Refresh"}
                    </button>
                  )}
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
                  {loadedView.toolName && loadedView.toolArgs ? (
                    <p className="text-xs text-foreground/40 mt-3">
                      This view automatically refreshes with live data when
                      loaded. Use the refresh button to get the latest data.
                    </p>
                  ) : (
                    <p className="text-xs text-foreground/40 mt-3">
                      This view uses static data. Re-save the chart from the
                      chat to enable auto-refresh.
                    </p>
                  )}
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
