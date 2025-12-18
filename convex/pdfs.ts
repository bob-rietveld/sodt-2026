import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get all PDFs with optional filters
export const list = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("completed"),
        v.literal("failed")
      )
    ),
    approvedOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let pdfs;

    if (args.status) {
      pdfs = await ctx.db
        .query("pdfs")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .collect();
    } else if (args.approvedOnly) {
      pdfs = await ctx.db
        .query("pdfs")
        .withIndex("by_approved", (q) => q.eq("approved", true))
        .collect();
    } else {
      pdfs = await ctx.db.query("pdfs").collect();
    }

    return pdfs;
  },
});

// Get a single PDF by ID
export const get = query({
  args: { id: v.id("pdfs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Get PDF by Drive file ID
export const getByDriveFileId = query({
  args: { driveFileId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("pdfs")
      .withIndex("by_drive_file", (q) => q.eq("driveFileId", args.driveFileId))
      .first();
  },
});

// Search PDFs by title
export const search = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    if (!args.query.trim()) {
      return await ctx.db
        .query("pdfs")
        .withIndex("by_approved", (q) => q.eq("approved", true))
        .take(20);
    }

    return await ctx.db
      .query("pdfs")
      .withSearchIndex("search_title", (q) =>
        q.search("title", args.query).eq("approved", true)
      )
      .take(20);
  },
});

// Create a new PDF record
export const create = mutation({
  args: {
    title: v.string(),
    filename: v.string(),
    storageId: v.optional(v.id("_storage")),
    driveFileId: v.optional(v.string()),
    source: v.union(v.literal("upload"), v.literal("drive")),
    author: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const pdfId = await ctx.db.insert("pdfs", {
      title: args.title,
      filename: args.filename,
      storageId: args.storageId,
      driveFileId: args.driveFileId,
      source: args.source,
      author: args.author,
      description: args.description,
      uploadedAt: Date.now(),
      status: "pending",
      approved: false,
    });

    return pdfId;
  },
});

// Update PDF metadata
export const update = mutation({
  args: {
    id: v.id("pdfs"),
    title: v.optional(v.string()),
    author: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    await ctx.db.patch(id, filteredUpdates);
  },
});

// Update processing status
export const updateStatus = mutation({
  args: {
    id: v.id("pdfs"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    processingError: v.optional(v.string()),
    weaviateId: v.optional(v.string()),
    pageCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

// Approve a PDF
export const approve = mutation({
  args: {
    id: v.id("pdfs"),
    approvedBy: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      approved: true,
      approvedBy: args.approvedBy,
      approvedAt: Date.now(),
    });
  },
});

// Reject/unapprove a PDF
export const reject = mutation({
  args: { id: v.id("pdfs") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      approved: false,
      approvedBy: undefined,
      approvedAt: undefined,
    });
  },
});

// Delete a PDF
export const remove = mutation({
  args: { id: v.id("pdfs") },
  handler: async (ctx, args) => {
    const pdf = await ctx.db.get(args.id);
    if (!pdf) return;

    // Delete storage file if exists
    if (pdf.storageId) {
      await ctx.storage.delete(pdf.storageId);
    }

    // Delete processing jobs
    const jobs = await ctx.db
      .query("processingJobs")
      .withIndex("by_pdf", (q) => q.eq("pdfId", args.id))
      .collect();

    for (const job of jobs) {
      await ctx.db.delete(job._id);
    }

    // Delete the PDF record
    await ctx.db.delete(args.id);
  },
});

// Generate upload URL for Convex storage
export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

// Get file URL from storage
export const getFileUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});
