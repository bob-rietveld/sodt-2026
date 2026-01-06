"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { ChartSpec } from "@/types/analytics-viz";

interface SavedView {
  _id: Id<"savedAnalyticsViews">;
  name: string;
  question: string;
  chartSpec: string;
  toolName?: string;
  toolArgs?: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  isShared: boolean;
}

interface SavedViewsProps {
  onLoadView: (view: {
    question: string;
    chartSpec: ChartSpec;
    toolName?: string;
    toolArgs?: Record<string, unknown>;
  }) => void;
}

export function SavedViews({ onLoadView }: SavedViewsProps) {
  const viewsData = useQuery(api.analyticsViews.listViews);
  const deleteView = useMutation(api.analyticsViews.deleteView);
  const updateView = useMutation(api.analyticsViews.updateView);

  const [editingId, setEditingId] = useState<Id<"savedAnalyticsViews"> | null>(
    null
  );
  const [editName, setEditName] = useState("");

  if (!viewsData) {
    return (
      <div className="p-4 text-center text-foreground/50">
        Loading saved views...
      </div>
    );
  }

  const { userViews, sharedViews } = viewsData as {
    userViews: SavedView[];
    sharedViews: SavedView[];
  };

  const handleLoad = (view: SavedView) => {
    try {
      const chartSpec = JSON.parse(view.chartSpec) as ChartSpec;
      const toolArgs = view.toolArgs
        ? (JSON.parse(view.toolArgs) as Record<string, unknown>)
        : undefined;

      onLoadView({
        question: view.question,
        chartSpec,
        toolName: view.toolName,
        toolArgs,
      });
    } catch (error) {
      console.error("Failed to parse view:", error);
    }
  };

  const handleDelete = async (viewId: Id<"savedAnalyticsViews">) => {
    if (confirm("Delete this saved view?")) {
      await deleteView({ viewId });
    }
  };

  const handleToggleShare = async (
    viewId: Id<"savedAnalyticsViews">,
    currentlyShared: boolean
  ) => {
    await updateView({ viewId, isShared: !currentlyShared });
  };

  const handleStartEdit = (view: SavedView) => {
    setEditingId(view._id);
    setEditName(view.name);
  };

  const handleSaveEdit = async () => {
    if (editingId && editName.trim()) {
      await updateView({ viewId: editingId, name: editName.trim() });
      setEditingId(null);
      setEditName("");
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName("");
  };

  const ViewItem = ({
    view,
    isOwned,
  }: {
    view: SavedView;
    isOwned: boolean;
  }) => {
    const isEditing = editingId === view._id;

    return (
      <div className="group p-3 rounded-lg hover:bg-foreground/5 transition-colors">
        <div className="flex items-start justify-between gap-2">
          {isEditing ? (
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveEdit();
                if (e.key === "Escape") handleCancelEdit();
              }}
              className="flex-1 px-2 py-1 text-sm border border-foreground/20 rounded focus:outline-none focus:border-primary"
              autoFocus
            />
          ) : (
            <button
              onClick={() => handleLoad(view)}
              className="flex-1 text-left"
            >
              <div className="font-medium text-sm truncate">{view.name}</div>
              <div className="text-xs text-foreground/50 truncate mt-1">
                {view.question}
              </div>
            </button>
          )}

          {isOwned && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {isEditing ? (
                <>
                  <button
                    onClick={handleSaveEdit}
                    className="p-1 text-green-600 hover:bg-green-100 rounded"
                    title="Save"
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
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="p-1 text-foreground/50 hover:bg-foreground/10 rounded"
                    title="Cancel"
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
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => handleStartEdit(view)}
                    className="p-1 text-foreground/50 hover:text-foreground hover:bg-foreground/10 rounded"
                    title="Rename"
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
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleToggleShare(view._id, view.isShared)}
                    className={`p-1 rounded ${
                      view.isShared
                        ? "text-primary hover:bg-primary/10"
                        : "text-foreground/50 hover:text-foreground hover:bg-foreground/10"
                    }`}
                    title={view.isShared ? "Unshare" : "Share with team"}
                  >
                    <svg
                      className="w-4 h-4"
                      fill={view.isShared ? "currentColor" : "none"}
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(view._id)}
                    className="p-1 text-foreground/50 hover:text-red-600 hover:bg-red-50 rounded"
                    title="Delete"
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
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-foreground/40">
            {new Date(view.createdAt).toLocaleDateString()}
          </span>
          {view.isShared && (
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
              Shared
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-foreground/10">
        <h2 className="font-semibold">Saved Views</h2>
        <p className="text-xs text-foreground/50 mt-1">
          Click to load and refresh with current data
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* User's views */}
        {userViews.length > 0 && (
          <div className="p-2">
            <div className="text-xs font-medium text-foreground/50 px-3 py-2">
              My Views ({userViews.length})
            </div>
            {userViews.map((view) => (
              <ViewItem key={view._id} view={view} isOwned={true} />
            ))}
          </div>
        )}

        {/* Shared views */}
        {sharedViews.length > 0 && (
          <div className="p-2 border-t border-foreground/10">
            <div className="text-xs font-medium text-foreground/50 px-3 py-2">
              Shared by Team ({sharedViews.length})
            </div>
            {sharedViews.map((view) => (
              <ViewItem key={view._id} view={view} isOwned={false} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {userViews.length === 0 && sharedViews.length === 0 && (
          <div className="p-8 text-center text-foreground/50">
            <svg
              className="w-12 h-12 mx-auto mb-3 opacity-50"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
              />
            </svg>
            <p className="text-sm">No saved views yet</p>
            <p className="text-xs mt-1">
              Ask questions and save the generated charts
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
