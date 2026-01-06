import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Save a new analytics view
 */
export const saveView = mutation({
  args: {
    name: v.string(),
    question: v.string(),
    chartSpec: v.string(),
    toolName: v.optional(v.string()),
    toolArgs: v.optional(v.string()),
    isShared: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const now = Date.now();
    const viewId = await ctx.db.insert("savedAnalyticsViews", {
      name: args.name,
      question: args.question,
      chartSpec: args.chartSpec,
      toolName: args.toolName,
      toolArgs: args.toolArgs,
      createdBy: identity.subject,
      createdAt: now,
      updatedAt: now,
      isShared: args.isShared ?? false,
    });

    return viewId;
  },
});

/**
 * List views for the current user and shared views
 */
export const listViews = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { userViews: [], sharedViews: [] };
    }

    // Get user's own views
    const userViews = await ctx.db
      .query("savedAnalyticsViews")
      .withIndex("by_user", (q) => q.eq("createdBy", identity.subject))
      .order("desc")
      .collect();

    // Get shared views from other users
    const sharedViews = await ctx.db
      .query("savedAnalyticsViews")
      .withIndex("by_shared", (q) => q.eq("isShared", true))
      .order("desc")
      .collect();

    // Filter out user's own views from shared
    const filteredSharedViews = sharedViews.filter(
      (view) => view.createdBy !== identity.subject
    );

    return {
      userViews,
      sharedViews: filteredSharedViews,
    };
  },
});

/**
 * Get a single view by ID
 */
export const getView = query({
  args: {
    viewId: v.id("savedAnalyticsViews"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const view = await ctx.db.get(args.viewId);
    if (!view) {
      return null;
    }

    // Check access - user must own the view or it must be shared
    if (view.createdBy !== identity.subject && !view.isShared) {
      return null;
    }

    return view;
  },
});

/**
 * Update a view (name, sharing status)
 */
export const updateView = mutation({
  args: {
    viewId: v.id("savedAnalyticsViews"),
    name: v.optional(v.string()),
    isShared: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const view = await ctx.db.get(args.viewId);
    if (!view) {
      throw new Error("View not found");
    }

    // Only owner can update
    if (view.createdBy !== identity.subject) {
      throw new Error("Not authorized to update this view");
    }

    const updates: Partial<typeof view> = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) {
      updates.name = args.name;
    }
    if (args.isShared !== undefined) {
      updates.isShared = args.isShared;
    }

    await ctx.db.patch(args.viewId, updates);

    return args.viewId;
  },
});

/**
 * Delete a view
 */
export const deleteView = mutation({
  args: {
    viewId: v.id("savedAnalyticsViews"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const view = await ctx.db.get(args.viewId);
    if (!view) {
      throw new Error("View not found");
    }

    // Only owner can delete
    if (view.createdBy !== identity.subject) {
      throw new Error("Not authorized to delete this view");
    }

    await ctx.db.delete(args.viewId);

    return true;
  },
});
