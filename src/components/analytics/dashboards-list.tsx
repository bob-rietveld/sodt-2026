"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  LayoutDashboard,
  Plus,
  MoreVertical,
  Share2,
  Edit2,
  Trash2,
} from "lucide-react";
import { CreateDashboardModal } from "./create-dashboard-modal";

interface DashboardsListProps {
  onSelectDashboard: (dashboardId: Id<"analyticsDashboards">) => void;
  selectedDashboardId: Id<"analyticsDashboards"> | null;
}

export function DashboardsList({
  onSelectDashboard,
  selectedDashboardId,
}: DashboardsListProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingDashboard, setEditingDashboard] = useState<{
    id: Id<"analyticsDashboards">;
    name: string;
    description?: string;
  } | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<Id<"analyticsDashboards"> | null>(null);

  const dashboardsData = useQuery(api.analyticsDashboards.listDashboards);
  const createDashboard = useMutation(api.analyticsDashboards.createDashboard);
  const updateDashboard = useMutation(api.analyticsDashboards.updateDashboard);
  const deleteDashboard = useMutation(api.analyticsDashboards.deleteDashboard);

  const handleCreateDashboard = async (
    name: string,
    description?: string
  ) => {
    await createDashboard({ name, description, isShared: false });
  };

  const handleUpdateDashboard = async (
    name: string,
    description?: string
  ) => {
    if (!editingDashboard) return;
    await updateDashboard({
      dashboardId: editingDashboard.id,
      name,
      description,
    });
    setEditingDashboard(null);
  };

  const handleDeleteDashboard = async (
    dashboardId: Id<"analyticsDashboards">
  ) => {
    if (
      !confirm(
        "Are you sure you want to delete this dashboard? This action cannot be undone."
      )
    ) {
      return;
    }
    await deleteDashboard({ dashboardId });
    setActiveMenuId(null);
    // If the deleted dashboard was selected, clear selection
    if (selectedDashboardId === dashboardId) {
      onSelectDashboard(null as any);
    }
  };

  const handleToggleShare = async (
    dashboardId: Id<"analyticsDashboards">,
    currentIsShared: boolean
  ) => {
    await updateDashboard({
      dashboardId,
      isShared: !currentIsShared,
    });
    setActiveMenuId(null);
  };

  const userDashboards = dashboardsData?.userDashboards || [];
  const sharedDashboards = dashboardsData?.sharedDashboards || [];

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between px-2 py-1.5">
        <h3 className="text-sm font-medium text-foreground/60 flex items-center gap-2">
          <LayoutDashboard className="h-4 w-4" />
          Dashboards
        </h3>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="p-1 hover:bg-foreground/5 rounded transition-colors"
          title="Create dashboard"
        >
          <Plus className="h-4 w-4 text-foreground/60" />
        </button>
      </div>

      {/* User's Dashboards */}
      <div className="space-y-0.5">
        {userDashboards.map((dashboard) => (
          <div key={dashboard._id} className="relative group">
            <button
              onClick={() => onSelectDashboard(dashboard._id)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                selectedDashboardId === dashboard._id
                  ? "bg-primary/10 text-primary"
                  : "text-foreground/80 hover:bg-foreground/5"
              }`}
            >
              <LayoutDashboard className="h-4 w-4 flex-shrink-0" />
              <span className="flex-1 text-left truncate">{dashboard.name}</span>
              {dashboard.isShared && (
                <Share2 className="h-3 w-3 text-foreground/40" />
              )}
            </button>

            {/* Actions Menu */}
            <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveMenuId(
                    activeMenuId === dashboard._id ? null : dashboard._id
                  );
                }}
                className="p-1 hover:bg-foreground/10 rounded transition-colors"
              >
                <MoreVertical className="h-4 w-4 text-foreground/60" />
              </button>

              {activeMenuId === dashboard._id && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-foreground/10 rounded-lg shadow-lg py-1 z-10 min-w-[160px]">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingDashboard({
                        id: dashboard._id,
                        name: dashboard.name,
                        description: dashboard.description,
                      });
                      setActiveMenuId(null);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-foreground/5 transition-colors"
                  >
                    <Edit2 className="h-4 w-4" />
                    Edit
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleShare(dashboard._id, dashboard.isShared);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-foreground/5 transition-colors"
                  >
                    <Share2 className="h-4 w-4" />
                    {dashboard.isShared ? "Unshare" : "Share"}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteDashboard(dashboard._id);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {userDashboards.length === 0 && (
          <div className="px-3 py-2 text-sm text-foreground/40 italic">
            No dashboards yet
          </div>
        )}
      </div>

      {/* Shared Dashboards */}
      {sharedDashboards.length > 0 && (
        <>
          <div className="px-3 py-2 text-xs font-medium text-foreground/40 uppercase tracking-wide mt-4">
            Shared Dashboards
          </div>
          <div className="space-y-0.5">
            {sharedDashboards.map((dashboard) => (
              <button
                key={dashboard._id}
                onClick={() => onSelectDashboard(dashboard._id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedDashboardId === dashboard._id
                    ? "bg-primary/10 text-primary"
                    : "text-foreground/80 hover:bg-foreground/5"
                }`}
              >
                <LayoutDashboard className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1 text-left truncate">
                  {dashboard.name}
                </span>
                <Share2 className="h-3 w-3 text-foreground/40" />
              </button>
            ))}
          </div>
        </>
      )}

      {/* Create Dashboard Modal */}
      <CreateDashboardModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onConfirm={handleCreateDashboard}
      />

      {/* Edit Dashboard Modal */}
      <CreateDashboardModal
        isOpen={!!editingDashboard}
        onClose={() => setEditingDashboard(null)}
        onConfirm={handleUpdateDashboard}
        editMode={
          editingDashboard
            ? {
                name: editingDashboard.name,
                description: editingDashboard.description,
              }
            : undefined
        }
      />
    </div>
  );
}
