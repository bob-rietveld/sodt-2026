import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Create a new dashboard
 */
export const createDashboard = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    isShared: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const now = Date.now();
    const dashboardId = await ctx.db.insert("analyticsDashboards", {
      name: args.name,
      description: args.description,
      createdBy: identity.subject,
      createdAt: now,
      updatedAt: now,
      isShared: args.isShared ?? false,
    });

    return dashboardId;
  },
});

/**
 * List all dashboards for the current user and shared dashboards
 */
export const listDashboards = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { userDashboards: [], sharedDashboards: [] };
    }

    // Get user's own dashboards
    const userDashboards = await ctx.db
      .query("analyticsDashboards")
      .withIndex("by_user", (q) => q.eq("createdBy", identity.subject))
      .order("desc")
      .collect();

    // Get shared dashboards from other users
    const sharedDashboards = await ctx.db
      .query("analyticsDashboards")
      .withIndex("by_shared", (q) => q.eq("isShared", true))
      .order("desc")
      .collect();

    // Filter out user's own dashboards from shared
    const filteredSharedDashboards = sharedDashboards.filter(
      (dashboard) => dashboard.createdBy !== identity.subject
    );

    return {
      userDashboards,
      sharedDashboards: filteredSharedDashboards,
    };
  },
});

/**
 * Get a single dashboard by ID with all its charts
 */
export const getDashboard = query({
  args: {
    dashboardId: v.id("analyticsDashboards"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const dashboard = await ctx.db.get(args.dashboardId);
    if (!dashboard) {
      return null;
    }

    // Check access - user must own the dashboard or it must be shared
    if (dashboard.createdBy !== identity.subject && !dashboard.isShared) {
      return null;
    }

    // Get all chart associations for this dashboard
    const chartAssociations = await ctx.db
      .query("dashboardCharts")
      .withIndex("by_dashboard", (q) => q.eq("dashboardId", args.dashboardId))
      .collect();

    // Sort by position
    chartAssociations.sort((a, b) => a.position - b.position);

    // Fetch the actual view data for each chart
    const charts = await Promise.all(
      chartAssociations.map(async (assoc) => {
        const view = await ctx.db.get(assoc.viewId);
        if (!view) return null;

        // Check if user has access to this view
        if (view.createdBy !== identity.subject && !view.isShared) {
          return null;
        }

        return {
          associationId: assoc._id,
          position: assoc.position,
          view,
        };
      })
    );

    // Filter out null entries (views that don't exist or user doesn't have access to)
    const validCharts = charts.filter((chart) => chart !== null);

    return {
      ...dashboard,
      charts: validCharts,
    };
  },
});

/**
 * Update a dashboard (name, description, sharing status)
 */
export const updateDashboard = mutation({
  args: {
    dashboardId: v.id("analyticsDashboards"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    isShared: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const dashboard = await ctx.db.get(args.dashboardId);
    if (!dashboard) {
      throw new Error("Dashboard not found");
    }

    // Only owner can update
    if (dashboard.createdBy !== identity.subject) {
      throw new Error("Not authorized to update this dashboard");
    }

    const updates: Partial<typeof dashboard> = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) {
      updates.name = args.name;
    }
    if (args.description !== undefined) {
      updates.description = args.description;
    }
    if (args.isShared !== undefined) {
      updates.isShared = args.isShared;
    }

    await ctx.db.patch(args.dashboardId, updates);

    return args.dashboardId;
  },
});

/**
 * Delete a dashboard and all its chart associations
 */
export const deleteDashboard = mutation({
  args: {
    dashboardId: v.id("analyticsDashboards"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const dashboard = await ctx.db.get(args.dashboardId);
    if (!dashboard) {
      throw new Error("Dashboard not found");
    }

    // Only owner can delete
    if (dashboard.createdBy !== identity.subject) {
      throw new Error("Not authorized to delete this dashboard");
    }

    // Delete all chart associations
    const chartAssociations = await ctx.db
      .query("dashboardCharts")
      .withIndex("by_dashboard", (q) => q.eq("dashboardId", args.dashboardId))
      .collect();

    for (const assoc of chartAssociations) {
      await ctx.db.delete(assoc._id);
    }

    // Delete the dashboard
    await ctx.db.delete(args.dashboardId);

    return true;
  },
});

/**
 * Add a chart to a dashboard
 */
export const addChartToDashboard = mutation({
  args: {
    dashboardId: v.id("analyticsDashboards"),
    viewId: v.id("savedAnalyticsViews"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Validate dashboard exists and user has access
    const dashboard = await ctx.db.get(args.dashboardId);
    if (!dashboard) {
      throw new Error("Dashboard not found");
    }
    if (dashboard.createdBy !== identity.subject) {
      throw new Error("Not authorized to modify this dashboard");
    }

    // Validate view exists and user has access
    const view = await ctx.db.get(args.viewId);
    if (!view) {
      throw new Error("View not found");
    }
    if (view.createdBy !== identity.subject && !view.isShared) {
      throw new Error("Not authorized to add this view");
    }

    // Check if chart is already in dashboard
    const existingAssoc = await ctx.db
      .query("dashboardCharts")
      .withIndex("by_dashboard", (q) => q.eq("dashboardId", args.dashboardId))
      .collect();

    const alreadyExists = existingAssoc.some(
      (assoc) => assoc.viewId === args.viewId
    );

    if (alreadyExists) {
      throw new Error("Chart is already in this dashboard");
    }

    // Get the next position (max position + 1)
    const maxPosition = existingAssoc.reduce(
      (max, assoc) => Math.max(max, assoc.position),
      -1
    );

    // Add the chart
    const associationId = await ctx.db.insert("dashboardCharts", {
      dashboardId: args.dashboardId,
      viewId: args.viewId,
      position: maxPosition + 1,
      addedAt: Date.now(),
    });

    // Update dashboard's updatedAt
    await ctx.db.patch(args.dashboardId, {
      updatedAt: Date.now(),
    });

    return associationId;
  },
});

/**
 * Remove a chart from a dashboard
 */
export const removeChartFromDashboard = mutation({
  args: {
    dashboardId: v.id("analyticsDashboards"),
    viewId: v.id("savedAnalyticsViews"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Validate dashboard exists and user has access
    const dashboard = await ctx.db.get(args.dashboardId);
    if (!dashboard) {
      throw new Error("Dashboard not found");
    }
    if (dashboard.createdBy !== identity.subject) {
      throw new Error("Not authorized to modify this dashboard");
    }

    // Find the association
    const associations = await ctx.db
      .query("dashboardCharts")
      .withIndex("by_dashboard", (q) => q.eq("dashboardId", args.dashboardId))
      .collect();

    const assoc = associations.find((a) => a.viewId === args.viewId);
    if (!assoc) {
      throw new Error("Chart not found in dashboard");
    }

    // Delete the association
    await ctx.db.delete(assoc._id);

    // Reorder remaining charts to fill the gap
    const remainingAssocs = associations.filter((a) => a._id !== assoc._id);
    remainingAssocs.sort((a, b) => a.position - b.position);

    for (let i = 0; i < remainingAssocs.length; i++) {
      if (remainingAssocs[i].position !== i) {
        await ctx.db.patch(remainingAssocs[i]._id, { position: i });
      }
    }

    // Update dashboard's updatedAt
    await ctx.db.patch(args.dashboardId, {
      updatedAt: Date.now(),
    });

    return true;
  },
});

/**
 * Reorder charts in a dashboard
 */
export const reorderCharts = mutation({
  args: {
    dashboardId: v.id("analyticsDashboards"),
    viewId: v.id("savedAnalyticsViews"),
    newPosition: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Validate dashboard exists and user has access
    const dashboard = await ctx.db.get(args.dashboardId);
    if (!dashboard) {
      throw new Error("Dashboard not found");
    }
    if (dashboard.createdBy !== identity.subject) {
      throw new Error("Not authorized to modify this dashboard");
    }

    // Get all chart associations
    const associations = await ctx.db
      .query("dashboardCharts")
      .withIndex("by_dashboard", (q) => q.eq("dashboardId", args.dashboardId))
      .collect();

    // Find the chart to move
    const chartToMove = associations.find((a) => a.viewId === args.viewId);
    if (!chartToMove) {
      throw new Error("Chart not found in dashboard");
    }

    const oldPosition = chartToMove.position;
    const newPosition = Math.max(
      0,
      Math.min(args.newPosition, associations.length - 1)
    );

    if (oldPosition === newPosition) {
      return true; // No change needed
    }

    // Reorder all charts
    for (const assoc of associations) {
      if (assoc._id === chartToMove._id) {
        // Update the moved chart
        await ctx.db.patch(assoc._id, { position: newPosition });
      } else if (
        oldPosition < newPosition &&
        assoc.position > oldPosition &&
        assoc.position <= newPosition
      ) {
        // Shift charts down
        await ctx.db.patch(assoc._id, { position: assoc.position - 1 });
      } else if (
        oldPosition > newPosition &&
        assoc.position >= newPosition &&
        assoc.position < oldPosition
      ) {
        // Shift charts up
        await ctx.db.patch(assoc._id, { position: assoc.position + 1 });
      }
    }

    // Update dashboard's updatedAt
    await ctx.db.patch(args.dashboardId, {
      updatedAt: Date.now(),
    });

    return true;
  },
});

/**
 * Get chart count for a dashboard
 */
export const getDashboardChartCount = query({
  args: {
    dashboardId: v.id("analyticsDashboards"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return 0;
    }

    const charts = await ctx.db
      .query("dashboardCharts")
      .withIndex("by_dashboard", (q) => q.eq("dashboardId", args.dashboardId))
      .collect();

    return charts.length;
  },
});

/**
 * Get all dashboards that contain a specific view
 */
export const getDashboardsForView = query({
  args: {
    viewId: v.id("savedAnalyticsViews"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    // Get all chart associations for this view
    const associations = await ctx.db
      .query("dashboardCharts")
      .collect();

    // Filter for this specific viewId
    const viewAssociations = associations.filter(
      (assoc) => assoc.viewId === args.viewId
    );

    // Get dashboard IDs
    const dashboardIds = viewAssociations.map((assoc) => assoc.dashboardId);

    return dashboardIds;
  },
});

/**
 * Set a dashboard as the default for the current user
 */
export const setDefaultDashboard = mutation({
  args: {
    dashboardId: v.id("analyticsDashboards"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Verify the dashboard exists and user has access
    const dashboard = await ctx.db.get(args.dashboardId);
    if (!dashboard) {
      throw new Error("Dashboard not found");
    }
    if (dashboard.createdBy !== identity.subject && !dashboard.isShared) {
      throw new Error("Not authorized to access this dashboard");
    }

    // Find existing preference
    const existing = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .first();

    if (existing) {
      // Update existing preference
      await ctx.db.patch(existing._id, {
        defaultDashboardId: args.dashboardId,
        updatedAt: Date.now(),
      });
    } else {
      // Create new preference
      await ctx.db.insert("userPreferences", {
        userId: identity.subject,
        defaultDashboardId: args.dashboardId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    return true;
  },
});

/**
 * Get the default dashboard for the current user
 */
export const getDefaultDashboard = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const preference = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .first();

    if (!preference || !preference.defaultDashboardId) {
      return null;
    }

    // Verify the dashboard still exists and user has access
    const dashboard = await ctx.db.get(preference.defaultDashboardId);
    if (!dashboard) {
      return null;
    }
    if (dashboard.createdBy !== identity.subject && !dashboard.isShared) {
      return null;
    }

    return preference.defaultDashboardId;
  },
});
