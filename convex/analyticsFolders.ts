import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Create a new folder
 */
export const createFolder = mutation({
  args: {
    name: v.string(),
    parentId: v.optional(v.id("savedAnalyticsFolders")),
    color: v.optional(v.string()),
    isShared: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Validate parent folder exists and user has access
    if (args.parentId) {
      const parentFolder = await ctx.db.get(args.parentId);
      if (!parentFolder) {
        throw new Error("Parent folder not found");
      }
      if (
        parentFolder.createdBy !== identity.subject &&
        !parentFolder.isShared
      ) {
        throw new Error("Not authorized to create folder in this parent");
      }
    }

    const now = Date.now();
    const folderId = await ctx.db.insert("savedAnalyticsFolders", {
      name: args.name,
      createdBy: identity.subject,
      createdAt: now,
      updatedAt: now,
      parentId: args.parentId,
      isShared: args.isShared ?? false,
      color: args.color,
    });

    return folderId;
  },
});

/**
 * List all folders for the current user and shared folders
 */
export const listFolders = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { userFolders: [], sharedFolders: [] };
    }

    // Get user's own folders
    const userFolders = await ctx.db
      .query("savedAnalyticsFolders")
      .withIndex("by_user", (q) => q.eq("createdBy", identity.subject))
      .order("desc")
      .collect();

    // Get shared folders from other users
    const sharedFolders = await ctx.db
      .query("savedAnalyticsFolders")
      .withIndex("by_shared", (q) => q.eq("isShared", true))
      .order("desc")
      .collect();

    // Filter out user's own folders from shared
    const filteredSharedFolders = sharedFolders.filter(
      (folder) => folder.createdBy !== identity.subject
    );

    return {
      userFolders,
      sharedFolders: filteredSharedFolders,
    };
  },
});

/**
 * Get a single folder by ID
 */
export const getFolder = query({
  args: {
    folderId: v.id("savedAnalyticsFolders"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const folder = await ctx.db.get(args.folderId);
    if (!folder) {
      return null;
    }

    // Check access - user must own the folder or it must be shared
    if (folder.createdBy !== identity.subject && !folder.isShared) {
      return null;
    }

    return folder;
  },
});

/**
 * Update a folder (name, color, sharing status)
 */
export const updateFolder = mutation({
  args: {
    folderId: v.id("savedAnalyticsFolders"),
    name: v.optional(v.string()),
    color: v.optional(v.string()),
    isShared: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const folder = await ctx.db.get(args.folderId);
    if (!folder) {
      throw new Error("Folder not found");
    }

    // Only owner can update
    if (folder.createdBy !== identity.subject) {
      throw new Error("Not authorized to update this folder");
    }

    const updates: Partial<typeof folder> = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) {
      updates.name = args.name;
    }
    if (args.color !== undefined) {
      updates.color = args.color;
    }
    if (args.isShared !== undefined) {
      updates.isShared = args.isShared;
    }

    await ctx.db.patch(args.folderId, updates);

    return args.folderId;
  },
});

/**
 * Delete a folder (moves all views to root by default)
 */
export const deleteFolder = mutation({
  args: {
    folderId: v.id("savedAnalyticsFolders"),
    deleteViews: v.optional(v.boolean()), // If true, delete all views in folder
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const folder = await ctx.db.get(args.folderId);
    if (!folder) {
      throw new Error("Folder not found");
    }

    // Only owner can delete
    if (folder.createdBy !== identity.subject) {
      throw new Error("Not authorized to delete this folder");
    }

    // Handle views in this folder
    const viewsInFolder = await ctx.db
      .query("savedAnalyticsViews")
      .withIndex("by_folder", (q) => q.eq("folderId", args.folderId))
      .collect();

    if (args.deleteViews) {
      // Delete all views in the folder
      for (const view of viewsInFolder) {
        if (view.createdBy === identity.subject) {
          await ctx.db.delete(view._id);
        }
      }
    } else {
      // Move views to root (remove folderId)
      for (const view of viewsInFolder) {
        if (view.createdBy === identity.subject) {
          await ctx.db.patch(view._id, { folderId: undefined });
        }
      }
    }

    // Delete subfolders (recursive)
    const subfolders = await ctx.db
      .query("savedAnalyticsFolders")
      .withIndex("by_parent", (q) => q.eq("parentId", args.folderId))
      .collect();

    for (const subfolder of subfolders) {
      if (subfolder.createdBy === identity.subject) {
        // Recursively delete subfolder
        await ctx.runMutation(
          "analyticsFolders:deleteFolder" as any,
          {
            folderId: subfolder._id,
            deleteViews: args.deleteViews,
          }
        );
      }
    }

    await ctx.db.delete(args.folderId);

    return true;
  },
});

/**
 * Get view count for a folder
 */
export const getFolderViewCount = query({
  args: {
    folderId: v.id("savedAnalyticsFolders"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return 0;
    }

    const views = await ctx.db
      .query("savedAnalyticsViews")
      .withIndex("by_folder", (q) => q.eq("folderId", args.folderId))
      .collect();

    return views.length;
  },
});
