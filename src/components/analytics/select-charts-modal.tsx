"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Search, BarChart3, Loader2 } from "lucide-react";

interface SelectChartsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (viewIds: Id<"savedAnalyticsViews">[]) => Promise<void>;
  dashboardId: Id<"analyticsDashboards">;
}

export function SelectChartsModal({
  isOpen,
  onClose,
  onConfirm,
  dashboardId,
}: SelectChartsModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedViewIds, setSelectedViewIds] = useState<
    Set<Id<"savedAnalyticsViews">>
  >(new Set());
  const [isAdding, setIsAdding] = useState(false);

  const viewsData = useQuery(api.analyticsViews.listViews);
  const dashboardData = useQuery(api.analyticsDashboards.getDashboard, {
    dashboardId,
  });

  const handleToggleView = (viewId: Id<"savedAnalyticsViews">) => {
    setSelectedViewIds((prev) => {
      const next = new Set(prev);
      if (next.has(viewId)) {
        next.delete(viewId);
      } else {
        next.add(viewId);
      }
      return next;
    });
  };

  const handleConfirm = async () => {
    if (selectedViewIds.size === 0) return;

    setIsAdding(true);
    try {
      await onConfirm(Array.from(selectedViewIds));
      setSelectedViewIds(new Set());
      setSearchQuery("");
      onClose();
    } catch (error) {
      console.error("Failed to add charts:", error);
      alert("Failed to add charts. Please try again.");
    } finally {
      setIsAdding(false);
    }
  };

  const handleClose = () => {
    if (!isAdding) {
      setSelectedViewIds(new Set());
      setSearchQuery("");
      onClose();
    }
  };

  if (!isOpen) return null;

  // Get existing chart IDs in the dashboard
  const existingViewIds = new Set(
    dashboardData?.charts?.map((c) => c?.view._id).filter(Boolean) || []
  );

  // Filter views
  const allViews = [
    ...(viewsData?.userViews || []),
    ...(viewsData?.sharedViews || []),
  ];

  // Exclude views already in dashboard
  const availableViews = allViews.filter(
    (view) => !existingViewIds.has(view._id)
  );

  const filteredViews = availableViews.filter((view) => {
    const query = searchQuery.toLowerCase();
    return (
      view.name.toLowerCase().includes(query) ||
      view.question.toLowerCase().includes(query)
    );
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[80vh] shadow-lg flex flex-col">
        <div className="p-6 border-b border-foreground/10">
          <h2 className="text-xl font-semibold mb-4">Add Charts to Dashboard</h2>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search charts..."
              className="w-full pl-10 pr-4 py-2 border border-foreground/20 rounded-lg focus:outline-none focus:border-primary"
              autoFocus
            />
          </div>
        </div>

        {/* Charts List */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredViews.length === 0 ? (
            <div className="text-center py-8">
              {availableViews.length === 0 ? (
                <>
                  <BarChart3 className="h-12 w-12 text-foreground/20 mx-auto mb-3" />
                  <p className="text-sm text-foreground/60">
                    All available charts are already in this dashboard
                  </p>
                </>
              ) : (
                <>
                  <Search className="h-12 w-12 text-foreground/20 mx-auto mb-3" />
                  <p className="text-sm text-foreground/60">
                    No charts match your search
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredViews.map((view) => {
                const isSelected = selectedViewIds.has(view._id);
                let chartSpec;
                try {
                  chartSpec = JSON.parse(view.chartSpec);
                } catch {
                  return null;
                }

                return (
                  <button
                    key={view._id}
                    onClick={() => handleToggleView(view._id)}
                    className={`w-full flex items-start gap-3 p-3 border rounded-lg text-left transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-foreground/10 hover:bg-foreground/5"
                    }`}
                  >
                    <div
                      className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                        isSelected
                          ? "bg-primary border-primary"
                          : "border-foreground/20"
                      }`}
                    >
                      {isSelected && (
                        <svg
                          className="w-3 h-3 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm mb-1">
                        {chartSpec.title}
                      </div>
                      <div className="text-xs text-foreground/60 line-clamp-2">
                        {view.question}
                      </div>
                      <div className="mt-2 text-xs text-foreground/40">
                        {chartSpec.type} chart
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-foreground/10 flex items-center justify-between">
          <div className="text-sm text-foreground/60">
            {selectedViewIds.size > 0 && (
              <span>
                {selectedViewIds.size} chart{selectedViewIds.size !== 1 ? "s" : ""}{" "}
                selected
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm text-foreground/60 hover:text-foreground hover:bg-foreground/5 rounded-lg transition-colors"
              disabled={isAdding}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={selectedViewIds.size === 0 || isAdding}
              className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {isAdding && <Loader2 className="h-4 w-4 animate-spin" />}
              {isAdding
                ? "Adding..."
                : `Add ${selectedViewIds.size > 0 ? selectedViewIds.size : ""} Chart${selectedViewIds.size !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
