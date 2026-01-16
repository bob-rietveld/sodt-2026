"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { DynamicChart } from "./dynamic-chart";
import { CreateDashboardModal } from "./create-dashboard-modal";

interface DashboardViewProps {
  dashboardId: Id<"analyticsDashboards">;
  onAddChart: () => void;
}

export function DashboardView({
  dashboardId,
  onAddChart,
}: DashboardViewProps) {
  const [editingDashboard, setEditingDashboard] = useState(false);
  const [refreshingCharts, setRefreshingCharts] = useState<Set<string>>(
    new Set()
  );

  const dashboardData = useQuery(api.analyticsDashboards.getDashboard, {
    dashboardId,
  });
  const updateDashboard = useMutation(api.analyticsDashboards.updateDashboard);
  const removeChart = useMutation(
    api.analyticsDashboards.removeChartFromDashboard
  );

  const handleUpdateDashboard = async (
    name: string,
    description?: string
  ) => {
    await updateDashboard({
      dashboardId,
      name,
      description,
    });
    setEditingDashboard(false);
  };

  const handleRemoveChart = async (viewId: Id<"savedAnalyticsViews">) => {
    if (!confirm("Remove this chart from the dashboard?")) {
      return;
    }
    await removeChart({ dashboardId, viewId });
  };

  const handleRefreshChart = async (
    viewId: Id<"savedAnalyticsViews">,
    toolName?: string,
    toolArgs?: string
  ) => {
    if (!toolName || !toolArgs) return;

    const chartKey = viewId;
    setRefreshingCharts((prev) => new Set(prev).add(chartKey));

    try {
      const response = await fetch("/api/analytics/refresh-view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toolName,
          toolArgs: JSON.parse(toolArgs),
        }),
      });

      const result = await response.json();

      if (!result.error && result.data) {
        // In a real implementation, we would update the chart data here
        // For now, we'll just show that refresh completed
        console.log("Chart refreshed:", result);
      }
    } catch (error) {
      console.error("Failed to refresh chart:", error);
    } finally {
      setRefreshingCharts((prev) => {
        const next = new Set(prev);
        next.delete(chartKey);
        return next;
      });
    }
  };

  const handleToggleShare = async () => {
    if (!dashboardData) return;
    await updateDashboard({
      dashboardId,
      isShared: !dashboardData.isShared,
    });
  };

  if (!dashboardData) {
    return (
      <div className="flex items-center justify-center h-full">
        <svg className="h-8 w-8 animate-spin text-foreground/20" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  const isOwner = true; // We can only view dashboards we own or are shared
  const hasCharts = dashboardData.charts && dashboardData.charts.length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Dashboard Header */}
      <div className="border-b border-foreground/10 bg-white">
        <div className="px-6 py-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <svg className="h-6 w-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <h1 className="text-2xl font-semibold">
                  {dashboardData.name}
                </h1>
                {dashboardData.isShared && (
                  <span className="flex items-center gap-1 px-2 py-1 bg-foreground/5 rounded text-xs text-foreground/60">
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Shared
                  </span>
                )}
              </div>
              {dashboardData.description && (
                <p className="mt-2 text-sm text-foreground/60">
                  {dashboardData.description}
                </p>
              )}
            </div>

            {isOwner && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditingDashboard(true)}
                  className="flex items-center gap-2 px-3 py-2 text-sm border border-foreground/20 rounded-lg hover:bg-foreground/5 transition-colors"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit
                </button>
                <button
                  onClick={handleToggleShare}
                  className="flex items-center gap-2 px-3 py-2 text-sm border border-foreground/20 rounded-lg hover:bg-foreground/5 transition-colors"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  {dashboardData.isShared ? "Unshare" : "Share"}
                </button>
                <button
                  onClick={onAddChart}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Chart
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dashboard Content */}
      <div className="flex-1 overflow-auto bg-gray-50/50 p-6">
        {!hasCharts ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <svg className="h-16 w-16 text-foreground/20 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h3 className="text-lg font-medium text-foreground/60 mb-2">
              No charts yet
            </h3>
            <p className="text-sm text-foreground/40 mb-4">
              Add your first chart to get started
            </p>
            {isOwner && (
              <button
                onClick={onAddChart}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Chart
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 auto-rows-max">
            {dashboardData.charts.map((chart) => {
              if (!chart) return null;

              let chartSpec;
              try {
                chartSpec = JSON.parse(chart.view.chartSpec);
              } catch (error) {
                console.error("Failed to parse chart spec:", error);
                return null;
              }

              const isRefreshing = refreshingCharts.has(chart.view._id);
              const canRefresh = chart.view.toolName && chart.view.toolArgs;

              return (
                <div
                  key={chart.associationId}
                  className="bg-white border border-foreground/10 rounded-xl p-4 hover:shadow-md transition-shadow"
                >
                  {/* Chart Header */}
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-medium text-sm flex-1 line-clamp-2">
                      {chartSpec.title}
                    </h3>
                    <div className="flex items-center gap-1 ml-2">
                      {canRefresh && (
                        <button
                          onClick={() =>
                            handleRefreshChart(
                              chart.view._id,
                              chart.view.toolName,
                              chart.view.toolArgs
                            )
                          }
                          disabled={isRefreshing}
                          className="p-1.5 hover:bg-foreground/5 rounded transition-colors disabled:opacity-50"
                          title="Refresh chart data"
                        >
                          <svg className={`h-4 w-4 text-foreground/60 ${isRefreshing ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </button>
                      )}
                      {isOwner && (
                        <button
                          onClick={() => handleRemoveChart(chart.view._id)}
                          className="p-1.5 hover:bg-red-50 rounded transition-colors group"
                          title="Remove from dashboard"
                        >
                          <svg className="h-4 w-4 text-foreground/40 group-hover:text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Chart Visualization */}
                  <div className="relative">
                    {isRefreshing && (
                      <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10 rounded">
                        <svg className="h-6 w-6 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      </div>
                    )}
                    <div className="h-[400px]">
                      <DynamicChart spec={chartSpec} />
                    </div>
                  </div>

                  {/* Chart Footer */}
                  {chart.view.question && (
                    <div className="mt-3 pt-3 border-t border-foreground/10">
                      <p className="text-xs text-foreground/60 line-clamp-2">
                        {chart.view.question}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Dashboard Modal */}
      <CreateDashboardModal
        isOpen={editingDashboard}
        onClose={() => setEditingDashboard(false)}
        onConfirm={handleUpdateDashboard}
        editMode={{
          name: dashboardData.name,
          description: dashboardData.description,
        }}
      />
    </div>
  );
}
