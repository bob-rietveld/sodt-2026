"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

interface AddToDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (dashboardIds: Id<"analyticsDashboards">[]) => Promise<void>;
  viewId: Id<"savedAnalyticsViews">;
}

export function AddToDashboardModal({
  isOpen,
  onClose,
  onConfirm,
  viewId,
}: AddToDashboardModalProps) {
  const [selectedDashboardIds, setSelectedDashboardIds] = useState<
    Set<Id<"analyticsDashboards">>
  >(new Set());
  const [isAdding, setIsAdding] = useState(false);

  const dashboardsData = useQuery(api.analyticsDashboards.listDashboards);

  const handleToggleDashboard = (dashboardId: Id<"analyticsDashboards">) => {
    setSelectedDashboardIds((prev) => {
      const next = new Set(prev);
      if (next.has(dashboardId)) {
        next.delete(dashboardId);
      } else {
        next.add(dashboardId);
      }
      return next;
    });
  };

  const handleConfirm = async () => {
    if (selectedDashboardIds.size === 0) return;

    setIsAdding(true);
    try {
      await onConfirm(Array.from(selectedDashboardIds));
      setSelectedDashboardIds(new Set());
      onClose();
    } catch (error) {
      console.error("Failed to add to dashboards:", error);
      alert("Failed to add to dashboards. Please try again.");
    } finally {
      setIsAdding(false);
    }
  };

  const handleClose = () => {
    if (!isAdding) {
      setSelectedDashboardIds(new Set());
      onClose();
    }
  };

  if (!isOpen) return null;

  const userDashboards = dashboardsData?.userDashboards || [];
  const sharedDashboards = dashboardsData?.sharedDashboards || [];
  const allDashboards = [...userDashboards, ...sharedDashboards];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-md max-h-[80vh] shadow-lg flex flex-col">
        <div className="p-6 border-b border-foreground/10">
          <h2 className="text-xl font-semibold">Add to Dashboard</h2>
          <p className="text-sm text-foreground/60 mt-1">
            Select which dashboards to add this chart to
          </p>
        </div>

        {/* Dashboards List */}
        <div className="flex-1 overflow-y-auto p-6">
          {allDashboards.length === 0 ? (
            <div className="text-center py-8">
              <svg className="h-12 w-12 text-foreground/20 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-sm text-foreground/60 mb-4">
                No dashboards available
              </p>
              <p className="text-xs text-foreground/40">
                Create a dashboard first to add charts to it
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {userDashboards.length > 0 && (
                <>
                  <div className="text-xs font-medium text-foreground/40 uppercase tracking-wide mb-2">
                    Your Dashboards
                  </div>
                  {userDashboards.map((dashboard) => {
                    const isSelected = selectedDashboardIds.has(dashboard._id);
                    return (
                      <button
                        key={dashboard._id}
                        onClick={() => handleToggleDashboard(dashboard._id)}
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
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">
                              {dashboard.name}
                            </span>
                            {dashboard.isShared && (
                              <svg className="h-3 w-3 text-foreground/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                              </svg>
                            )}
                          </div>
                          {dashboard.description && (
                            <div className="text-xs text-foreground/60 mt-1 line-clamp-2">
                              {dashboard.description}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </>
              )}

              {sharedDashboards.length > 0 && (
                <>
                  <div className="text-xs font-medium text-foreground/40 uppercase tracking-wide mb-2 mt-4">
                    Shared Dashboards
                  </div>
                  {sharedDashboards.map((dashboard) => {
                    const isSelected = selectedDashboardIds.has(dashboard._id);
                    return (
                      <button
                        key={dashboard._id}
                        onClick={() => handleToggleDashboard(dashboard._id)}
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
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">
                              {dashboard.name}
                            </span>
                            <svg className="h-3 w-3 text-foreground/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                          </div>
                          {dashboard.description && (
                            <div className="text-xs text-foreground/60 mt-1 line-clamp-2">
                              {dashboard.description}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-foreground/10 flex items-center justify-between">
          <div className="text-sm text-foreground/60">
            {selectedDashboardIds.size > 0 && (
              <span>
                {selectedDashboardIds.size} dashboard
                {selectedDashboardIds.size !== 1 ? "s" : ""} selected
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
              disabled={selectedDashboardIds.size === 0 || isAdding}
              className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {isAdding && (
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              {isAdding ? "Adding..." : "Add to Dashboard"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
