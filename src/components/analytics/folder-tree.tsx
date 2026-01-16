"use client";

import { useState } from "react";
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

interface FolderTreeProps {
  folders: SavedFolder[];
  views: SavedView[];
  isOwned: boolean;
  onLoadView: (view: SavedView) => void;
  onDeleteView: (viewId: Id<"savedAnalyticsViews">) => void;
  onDeleteFolder: (folderId: Id<"savedAnalyticsFolders">) => void;
  onRenameView: (viewId: Id<"savedAnalyticsViews">, name: string) => void;
  onRenameFolder: (folderId: Id<"savedAnalyticsFolders">, name: string) => void;
  onToggleShareView: (viewId: Id<"savedAnalyticsViews">, isShared: boolean) => void;
  onToggleShareFolder: (folderId: Id<"savedAnalyticsFolders">, isShared: boolean) => void;
  onMoveView: (viewId: Id<"savedAnalyticsViews">, folderId?: Id<"savedAnalyticsFolders">) => void;
  onAddToDashboard?: (viewId: Id<"savedAnalyticsViews">) => void;
}

export function FolderTree({
  folders,
  views,
  isOwned,
  onLoadView,
  onDeleteView,
  onDeleteFolder,
  onRenameView,
  onRenameFolder,
  onToggleShareView,
  onToggleShareFolder,
  onMoveView,
  onAddToDashboard,
}: FolderTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [editingViewId, setEditingViewId] = useState<Id<"savedAnalyticsViews"> | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<Id<"savedAnalyticsFolders"> | null>(null);
  const [editName, setEditName] = useState("");
  const [draggedViewId, setDraggedViewId] = useState<Id<"savedAnalyticsViews"> | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<Id<"savedAnalyticsFolders"> | null>(null);
  const [dragOverRoot, setDragOverRoot] = useState(false);

  const toggleFolder = (folderId: Id<"savedAnalyticsFolders">) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const getViewsInFolder = (folderId?: Id<"savedAnalyticsFolders">) => {
    return views.filter((v) =>
      folderId ? v.folderId === folderId : !v.folderId
    );
  };

  const handleViewDragStart = (e: React.DragEvent, viewId: Id<"savedAnalyticsViews">) => {
    setDraggedViewId(viewId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleViewDragEnd = () => {
    setDraggedViewId(null);
    setDragOverFolderId(null);
    setDragOverRoot(false);
  };

  const handleFolderDragOver = (e: React.DragEvent, folderId: Id<"savedAnalyticsFolders">) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(folderId);
    setDragOverRoot(false);
  };

  const handleFolderDragLeave = () => {
    setDragOverFolderId(null);
  };

  const handleFolderDrop = (e: React.DragEvent, folderId: Id<"savedAnalyticsFolders">) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedViewId) {
      onMoveView(draggedViewId, folderId);
    }
    setDraggedViewId(null);
    setDragOverFolderId(null);
  };

  const handleRootDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverRoot(true);
    setDragOverFolderId(null);
  };

  const handleRootDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedViewId) {
      onMoveView(draggedViewId, undefined);
    }
    setDraggedViewId(null);
    setDragOverRoot(false);
  };

  const handleStartEditView = (view: SavedView) => {
    setEditingViewId(view._id);
    setEditName(view.name);
  };

  const handleStartEditFolder = (folder: SavedFolder) => {
    setEditingFolderId(folder._id);
    setEditName(folder.name);
  };

  const handleSaveViewEdit = () => {
    if (editingViewId && editName.trim()) {
      onRenameView(editingViewId, editName.trim());
      setEditingViewId(null);
      setEditName("");
    }
  };

  const handleSaveFolderEdit = () => {
    if (editingFolderId && editName.trim()) {
      onRenameFolder(editingFolderId, editName.trim());
      setEditingFolderId(null);
      setEditName("");
    }
  };

  const handleCancelEdit = () => {
    setEditingViewId(null);
    setEditingFolderId(null);
    setEditName("");
  };

  const ViewItem = ({ view }: { view: SavedView }) => {
    const isEditing = editingViewId === view._id;
    const isDragging = draggedViewId === view._id;

    return (
      <div
        draggable={isOwned && !isEditing}
        onDragStart={(e) => handleViewDragStart(e, view._id)}
        onDragEnd={handleViewDragEnd}
        className={`group p-3 rounded-lg hover:bg-foreground/5 transition-colors ${
          isDragging ? "opacity-50" : ""
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          {isEditing ? (
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveViewEdit();
                if (e.key === "Escape") handleCancelEdit();
              }}
              className="flex-1 px-2 py-1 text-sm border border-foreground/20 rounded focus:outline-none focus:border-primary"
              autoFocus
            />
          ) : (
            <button
              onClick={() => onLoadView(view)}
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
                    onClick={handleSaveViewEdit}
                    className="p-1 text-green-600 hover:bg-green-100 rounded"
                    title="Save"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="p-1 text-foreground/50 hover:bg-foreground/10 rounded"
                    title="Cancel"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => handleStartEditView(view)}
                    className="p-1 text-foreground/50 hover:text-foreground hover:bg-foreground/10 rounded"
                    title="Rename"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => onToggleShareView(view._id, !view.isShared)}
                    className={`p-1 rounded ${
                      view.isShared
                        ? "text-primary hover:bg-primary/10"
                        : "text-foreground/50 hover:text-foreground hover:bg-foreground/10"
                    }`}
                    title={view.isShared ? "Unshare" : "Share with team"}
                  >
                    <svg className="w-4 h-4" fill={view.isShared ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </button>
                  {onAddToDashboard && (
                    <button
                      onClick={() => onAddToDashboard(view._id)}
                      className="p-1 text-foreground/50 hover:text-foreground hover:bg-foreground/10 rounded"
                      title="Add to Dashboard"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </button>
                  )}
                  <button
                    onClick={() => onDeleteView(view._id)}
                    className="p-1 text-foreground/50 hover:text-red-600 hover:bg-red-50 rounded"
                    title="Delete"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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

  const FolderItem = ({ folder }: { folder: SavedFolder }) => {
    const isExpanded = expandedFolders.has(folder._id);
    const folderViews = getViewsInFolder(folder._id);
    const isEditing = editingFolderId === folder._id;
    const isDragOver = dragOverFolderId === folder._id;

    return (
      <div className="mb-2">
        <div
          onDragOver={(e) => handleFolderDragOver(e, folder._id)}
          onDragLeave={handleFolderDragLeave}
          onDrop={(e) => handleFolderDrop(e, folder._id)}
          className={`group p-2 rounded-lg hover:bg-foreground/5 transition-colors ${
            isDragOver ? "bg-primary/10 border-2 border-primary border-dashed" : ""
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <button
                onClick={() => toggleFolder(folder._id)}
                className="p-0.5 hover:bg-foreground/10 rounded"
              >
                <svg
                  className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {folder.color && (
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: folder.color }}
                />
              )}

              {isEditing ? (
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveFolderEdit();
                    if (e.key === "Escape") handleCancelEdit();
                  }}
                  className="flex-1 px-2 py-1 text-sm border border-foreground/20 rounded focus:outline-none focus:border-primary"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <button
                  onClick={() => toggleFolder(folder._id)}
                  className="flex-1 text-left min-w-0"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                      📁 {folder.name}
                    </span>
                    <span className="text-xs text-foreground/40">
                      ({folderViews.length})
                    </span>
                  </div>
                </button>
              )}
            </div>

            {isOwned && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {isEditing ? (
                  <>
                    <button
                      onClick={handleSaveFolderEdit}
                      className="p-1 text-green-600 hover:bg-green-100 rounded"
                      title="Save"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="p-1 text-foreground/50 hover:bg-foreground/10 rounded"
                      title="Cancel"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleStartEditFolder(folder)}
                      className="p-1 text-foreground/50 hover:text-foreground hover:bg-foreground/10 rounded"
                      title="Rename"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onToggleShareFolder(folder._id, !folder.isShared)}
                      className={`p-1 rounded ${
                        folder.isShared
                          ? "text-primary hover:bg-primary/10"
                          : "text-foreground/50 hover:text-foreground hover:bg-foreground/10"
                      }`}
                      title={folder.isShared ? "Unshare" : "Share with team"}
                    >
                      <svg className="w-4 h-4" fill={folder.isShared ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete folder "${folder.name}"? Views will be moved to root.`)) {
                          onDeleteFolder(folder._id);
                        }
                      }}
                      className="p-1 text-foreground/50 hover:text-red-600 hover:bg-red-50 rounded"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {folder.isShared && (
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded ml-6 mt-1 inline-block">
              Shared
            </span>
          )}
        </div>

        {/* Views in folder */}
        {isExpanded && folderViews.length > 0 && (
          <div className="ml-6 mt-1 space-y-1">
            {folderViews.map((view) => (
              <ViewItem key={view._id} view={view} />
            ))}
          </div>
        )}
      </div>
    );
  };

  const rootViews = getViewsInFolder();

  return (
    <div>
      {/* Folders */}
      {folders.map((folder) => (
        <FolderItem key={folder._id} folder={folder} />
      ))}

      {/* Unfiled views (root level) */}
      {rootViews.length > 0 && (
        <div
          onDragOver={handleRootDragOver}
          onDragLeave={() => setDragOverRoot(false)}
          onDrop={handleRootDrop}
          className={`mt-3 ${
            dragOverRoot ? "bg-primary/5 border-2 border-primary border-dashed rounded-lg p-2" : ""
          }`}
        >
          <div className="text-xs font-medium text-foreground/50 px-3 py-2">
            Unfiled ({rootViews.length})
          </div>
          {rootViews.map((view) => (
            <ViewItem key={view._id} view={view} />
          ))}
        </div>
      )}
    </div>
  );
}
