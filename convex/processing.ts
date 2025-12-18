import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Create a processing job
export const createJob = mutation({
  args: {
    pdfId: v.id("pdfs"),
    stage: v.union(
      v.literal("extracting"),
      v.literal("embedding"),
      v.literal("storing"),
      v.literal("completed"),
      v.literal("failed")
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("processingJobs", {
      pdfId: args.pdfId,
      stage: args.stage,
      startedAt: Date.now(),
    });
  },
});

// Update job status
export const updateJob = mutation({
  args: {
    jobId: v.id("processingJobs"),
    stage: v.union(
      v.literal("extracting"),
      v.literal("embedding"),
      v.literal("storing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    error: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const updates: Record<string, unknown> = { stage: args.stage };

    if (args.stage === "completed" || args.stage === "failed") {
      updates.completedAt = Date.now();
    }

    if (args.error) {
      updates.error = args.error;
    }

    if (args.metadata) {
      updates.metadata = args.metadata;
    }

    await ctx.db.patch(args.jobId, updates);
  },
});

// Get jobs for a PDF
export const getJobsForPdf = query({
  args: { pdfId: v.id("pdfs") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("processingJobs")
      .withIndex("by_pdf", (q) => q.eq("pdfId", args.pdfId))
      .collect();
  },
});

// Get latest job for a PDF
export const getLatestJob = query({
  args: { pdfId: v.id("pdfs") },
  handler: async (ctx, args) => {
    const jobs = await ctx.db
      .query("processingJobs")
      .withIndex("by_pdf", (q) => q.eq("pdfId", args.pdfId))
      .order("desc")
      .first();

    return jobs;
  },
});

// Get all active processing jobs
export const getActiveJobs = query({
  handler: async (ctx) => {
    const allJobs = await ctx.db.query("processingJobs").collect();

    // Filter for active jobs (not completed or failed)
    return allJobs.filter(
      (job) => job.stage !== "completed" && job.stage !== "failed"
    );
  },
});

// Get failed jobs for retry
export const getFailedJobs = query({
  handler: async (ctx) => {
    const allJobs = await ctx.db.query("processingJobs").collect();
    return allJobs.filter((job) => job.stage === "failed");
  },
});
