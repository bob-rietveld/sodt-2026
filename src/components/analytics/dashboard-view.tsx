"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  LayoutDashboard,
  Plus,
  X,
  RefreshCw,
  Share2,
  Edit2,
  Loader2,
} from "lucide-react";
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
        <Loader2 className="h-8 w-8 animate-spin text-foreground/20" />
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
                <LayoutDashboard className="h-6 w-6 text-primary" />
                <h1 className="text-2xl font-semibold">
                  {dashboardData.name}
                </h1>
                {dashboardData.isShared && (
                  <span className="flex items-center gap-1 px-2 py-1 bg-foreground/5 rounded text-xs text-foreground/60">
                    <Share2 className="h-3 w-3" />
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
                  <Edit2 className="h-4 w-4" />
                  Edit
                </button>
                <button
                  onClick={handleToggleShare}
                  className="flex items-center gap-2 px-3 py-2 text-sm border border-foreground/20 rounded-lg hover:bg-foreground/5 transition-colors"
                >
                  <Share2 className="h-4 w-4" />
                  {dashboardData.isShared ? "Unshare" : "Share"}
                </button>
                <button
                  onClick={onAddChart}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                >
                  <Plus className="h-4 w-4" />
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
            <LayoutDashboard className="h-16 w-16 text-foreground/20 mb-4" />
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
                <Plus className="h-4 w-4" />
                Add Chart
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 auto-rows-max">
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
                          <RefreshCw
                            className={`h-4 w-4 text-foreground/60 ${isRefreshing ? "animate-spin" : ""}`}
                          />
                        </button>
                      )}
                      {isOwner && (
                        <button
                          onClick={() => handleRemoveChart(chart.view._id)}
                          className="p-1.5 hover:bg-red-50 rounded transition-colors group"
                          title="Remove from dashboard"
                        >
                          <X className="h-4 w-4 text-foreground/40 group-hover:text-red-600" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Chart Visualization */}
                  <div className="relative">
                    {isRefreshing && (
                      <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10 rounded">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    )}
                    <div className="h-[300px]">
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
