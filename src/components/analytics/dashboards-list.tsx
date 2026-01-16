"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
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
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Dashboards
        </h3>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="p-1 hover:bg-foreground/5 rounded transition-colors"
          title="Create dashboard"
        >
          <svg className="h-4 w-4 text-foreground/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
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
              <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="flex-1 text-left truncate">{dashboard.name}</span>
              {dashboard.isShared && (
                <svg className="h-3 w-3 text-foreground/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
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
                <svg className="h-4 w-4 text-foreground/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
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
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleShare(dashboard._id, dashboard.isShared);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-foreground/5 transition-colors"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    {dashboard.isShared ? "Unshare" : "Share"}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteDashboard(dashboard._id);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
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
                <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span className="flex-1 text-left truncate">
                  {dashboard.name}
                </span>
                <svg className="h-3 w-3 text-foreground/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
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
