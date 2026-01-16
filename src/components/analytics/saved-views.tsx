"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { ChartSpec } from "@/types/analytics-viz";
import { FolderTree } from "./folder-tree";
import { CreateFolderModal } from "./create-folder-modal";

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
  folderId?: Id<"savedAnalyticsFolders">;
}

interface SavedFolder {
  _id: Id<"savedAnalyticsFolders">;
  name: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  parentId?: Id<"savedAnalyticsFolders">;
  isShared: boolean;
  color?: string;
}

interface SavedViewsProps {
  onLoadView: (view: {
    question: string;
    chartSpec: ChartSpec;
    toolName?: string;
    toolArgs?: Record<string, unknown>;
    isRefreshing?: boolean;
  }) => void;
}

export function SavedViews({ onLoadView }: SavedViewsProps) {
  const viewsData = useQuery(api.analyticsViews.listViews);
  const foldersData = useQuery(api.analyticsFolders.listFolders);

  const deleteView = useMutation(api.analyticsViews.deleteView);
  const updateView = useMutation(api.analyticsViews.updateView);
  const moveViewToFolder = useMutation(api.analyticsViews.moveViewToFolder);

  const createFolder = useMutation(api.analyticsFolders.createFolder);
  const deleteFolder = useMutation(api.analyticsFolders.deleteFolder);
  const updateFolder = useMutation(api.analyticsFolders.updateFolder);

  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);

  if (!viewsData || !foldersData) {
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

  const { userFolders, sharedFolders } = foldersData as {
    userFolders: SavedFolder[];
    sharedFolders: SavedFolder[];
  };

  const handleLoad = async (view: SavedView) => {
    try {
      const chartSpec = JSON.parse(view.chartSpec) as ChartSpec;
      const toolArgs = view.toolArgs
        ? (JSON.parse(view.toolArgs) as Record<string, unknown>)
        : undefined;

      // Immediately show cached data
      onLoadView({
        question: view.question,
        chartSpec,
        toolName: view.toolName,
        toolArgs,
        isRefreshing: !!view.toolName && !!toolArgs,
      });

      // If we have tool info, refresh the data in the background
      if (view.toolName && toolArgs) {
        try {
          const response = await fetch("/api/analytics/refresh-view", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              toolName: view.toolName,
              toolArgs,
            }),
          });

          const result = await response.json();

          if (result.error) {
            console.error("Failed to refresh view data:", result.error);
            // Notify parent with error but keep cached data
            onLoadView({
              question: view.question,
              chartSpec,
              toolName: view.toolName,
              toolArgs,
              isRefreshing: false,
            });
          } else if (result.data) {
            // Update chart with fresh data
            const refreshedChartSpec = {
              ...chartSpec,
              data: result.data,
            };

            onLoadView({
              question: view.question,
              chartSpec: refreshedChartSpec,
              toolName: view.toolName,
              toolArgs,
              isRefreshing: false,
            });
          }
        } catch (error) {
          console.error("Failed to refresh view:", error);
          // Keep showing cached data on error
          onLoadView({
            question: view.question,
            chartSpec,
            toolName: view.toolName,
            toolArgs,
            isRefreshing: false,
          });
        }
      }
    } catch (error) {
      console.error("Failed to parse view:", error);
    }
  };

  const handleDeleteView = async (viewId: Id<"savedAnalyticsViews">) => {
    if (confirm("Delete this saved view?")) {
      await deleteView({ viewId });
    }
  };

  const handleRenameView = async (
    viewId: Id<"savedAnalyticsViews">,
    name: string
  ) => {
    await updateView({ viewId, name });
  };

  const handleToggleShareView = async (
    viewId: Id<"savedAnalyticsViews">,
    isShared: boolean
  ) => {
    await updateView({ viewId, isShared });
  };

  const handleMoveView = async (
    viewId: Id<"savedAnalyticsViews">,
    folderId?: Id<"savedAnalyticsFolders">
  ) => {
    await moveViewToFolder({ viewId, folderId });
  };

  const handleCreateFolder = async (name: string, color?: string) => {
    await createFolder({ name, color });
  };

  const handleDeleteFolder = async (
    folderId: Id<"savedAnalyticsFolders">
  ) => {
    await deleteFolder({ folderId, deleteViews: false });
  };

  const handleRenameFolder = async (
    folderId: Id<"savedAnalyticsFolders">,
    name: string
  ) => {
    await updateFolder({ folderId, name });
  };

  const handleToggleShareFolder = async (
    folderId: Id<"savedAnalyticsFolders">,
    isShared: boolean
  ) => {
    await updateFolder({ folderId, isShared });
  };

  const hasContent =
    userViews.length > 0 ||
    sharedViews.length > 0 ||
    userFolders.length > 0 ||
    sharedFolders.length > 0;

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-foreground/10">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold">Saved Views</h2>
          <button
            onClick={() => setIsCreateFolderOpen(true)}
            className="p-1.5 text-primary hover:bg-primary/10 rounded transition-colors"
            title="New Folder"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
          </button>
        </div>
        <p className="text-xs text-foreground/50">
          Organize and access your saved analytics
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* User's views and folders */}
        {(userViews.length > 0 || userFolders.length > 0) && (
          <div className="p-2">
            <div className="text-xs font-medium text-foreground/50 px-3 py-2">
              My Views
            </div>
            <FolderTree
              folders={userFolders}
              views={userViews}
              isOwned={true}
              onLoadView={handleLoad}
              onDeleteView={handleDeleteView}
              onDeleteFolder={handleDeleteFolder}
              onRenameView={handleRenameView}
              onRenameFolder={handleRenameFolder}
              onToggleShareView={handleToggleShareView}
              onToggleShareFolder={handleToggleShareFolder}
              onMoveView={handleMoveView}
            />
          </div>
        )}

        {/* Shared views and folders */}
        {(sharedViews.length > 0 || sharedFolders.length > 0) && (
          <div className="p-2 border-t border-foreground/10">
            <div className="text-xs font-medium text-foreground/50 px-3 py-2">
              Shared by Team
            </div>
            <FolderTree
              folders={sharedFolders}
              views={sharedViews}
              isOwned={false}
              onLoadView={handleLoad}
              onDeleteView={handleDeleteView}
              onDeleteFolder={handleDeleteFolder}
              onRenameView={handleRenameView}
              onRenameFolder={handleRenameFolder}
              onToggleShareView={handleToggleShareView}
              onToggleShareFolder={handleToggleShareFolder}
              onMoveView={handleMoveView}
            />
          </div>
        )}

        {/* Empty state */}
        {!hasContent && (
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

      <CreateFolderModal
        isOpen={isCreateFolderOpen}
        onClose={() => setIsCreateFolderOpen(false)}
        onConfirm={handleCreateFolder}
      />
    </div>
  );
}
