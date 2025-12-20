import { Workpool, WorkId, vOnCompleteArgs, vResultValidator } from "@convex-dev/workpool";
import { components } from "./_generated/api";
import { v } from "convex/values";
import { action, internalAction, internalMutation, mutation, query } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// Create workpool instance with max 3 parallel jobs
// (to avoid overwhelming external APIs)
export const pool = new Workpool(components.pdfWorkpool, {
  maxParallelism: 3,
});

// The action handler that processes a single PDF
export const processPdfAction = internalAction({
  args: {
    pdfId: v.id("pdfs"),
    storageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    // APP_URL must be set in Convex environment variables
    // Set it via: npx convex env set APP_URL https://your-app-url.com
    const baseUrl = process.env.APP_URL;
    if (!baseUrl) {
      throw new Error("APP_URL environment variable is not set in Convex. Run: npx convex env set APP_URL https://your-app-url.com");
    }

    const url = baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`;

    // Call the process-pdf API endpoint
    const response = await fetch(`${url}/api/process-pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pdfId: args.pdfId,
        storageId: args.storageId,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Processing failed with status ${response.status}`);
    }

    const result = await response.json();
    return result;
  },
});

// Enqueue a PDF for processing
export const enqueuePdfProcessing = action({
  args: {
    pdfId: v.id("pdfs"),
    storageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args): Promise<string> => {
    const handle: WorkId = await pool.enqueueAction(
      ctx,
      internal.pdfWorkpool.processPdfAction,
      { pdfId: args.pdfId, storageId: args.storageId }
    );
    return handle as string;
  },
});

// Batch enqueue multiple PDFs
export const enqueueBatch = action({
  args: {
    items: v.array(
      v.object({
        pdfId: v.id("pdfs"),
        storageId: v.optional(v.id("_storage")),
      })
    ),
  },
  handler: async (ctx, args): Promise<string[]> => {
    const handles: string[] = [];
    for (const item of args.items) {
      const handle: WorkId = await pool.enqueueAction(
        ctx,
        internal.pdfWorkpool.processPdfAction,
        {
          pdfId: item.pdfId,
          storageId: item.storageId,
        }
      );
      handles.push(handle as string);
    }
    return handles;
  },
});

// Get status of a specific work item
export const getWorkStatus = query({
  args: { workId: v.string() },
  handler: async (ctx, args) => {
    return await pool.status(ctx, args.workId as WorkId);
  },
});

// Action handler for reprocessing metadata only (not full PDF processing)
export const reprocessMetadataAction = internalAction({
  args: {
    pdfId: v.id("pdfs"),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    const baseUrl = process.env.APP_URL;
    if (!baseUrl) {
      throw new Error(
        "APP_URL environment variable is not set in Convex. Run: npx convex env set APP_URL https://your-app-url.com"
      );
    }

    const url = baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`;

    const response = await fetch(`${url}/api/reprocess-metadata`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pdfId: args.pdfId }),
    });

    // Get the response text first to handle HTML error pages
    const responseText = await response.text();

    if (!response.ok) {
      // Try to parse as JSON, but handle HTML error pages gracefully
      let errorMessage: string;
      try {
        const errorJson = JSON.parse(responseText);
        errorMessage = errorJson.error || `Reprocessing failed with status ${response.status}`;
      } catch {
        // Response is not JSON (likely an HTML error page)
        if (responseText.includes("<!DOCTYPE") || responseText.includes("<html")) {
          errorMessage = `Server returned HTML error page (status ${response.status}). Make sure the app is deployed with the /api/reprocess-metadata endpoint.`;
        } else {
          errorMessage = `Reprocessing failed with status ${response.status}: ${responseText.slice(0, 200)}`;
        }
      }
      throw new Error(errorMessage);
    }

    // Parse successful response
    try {
      return JSON.parse(responseText);
    } catch {
      throw new Error(`Invalid JSON response from server: ${responseText.slice(0, 200)}`);
    }
  },
});

// Mutation to create a reprocessing job record
export const createReprocessingJob = internalMutation({
  args: {
    pdfId: v.id("pdfs"),
    pdfTitle: v.string(),
    workId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("metadataReprocessingJobs", {
      pdfId: args.pdfId,
      pdfTitle: args.pdfTitle,
      workId: args.workId,
      status: "pending",
      enqueuedAt: Date.now(),
    });
  },
});

// Mutation to update reprocessing job status
export const updateReprocessingJobStatus = internalMutation({
  args: {
    workId: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed")
    ),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db
      .query("metadataReprocessingJobs")
      .withIndex("by_work_id", (q) => q.eq("workId", args.workId))
      .unique();

    if (job) {
      const updates: {
        status: "pending" | "running" | "completed" | "failed";
        completedAt?: number;
        error?: string;
      } = { status: args.status };

      if (args.status === "completed" || args.status === "failed") {
        updates.completedAt = Date.now();
      }
      if (args.error) {
        updates.error = args.error;
      }

      await ctx.db.patch(job._id, updates);
    }
  },
});

// OnComplete handler for metadata reprocessing - use workpool's defineOnComplete
export const onReprocessingComplete = pool.defineOnComplete({
  context: v.object({ pdfId: v.id("pdfs") }),
  handler: async (ctx, { workId, result }) => {
    const job = await ctx.db
      .query("metadataReprocessingJobs")
      .withIndex("by_work_id", (q) => q.eq("workId", workId))
      .unique();

    if (job) {
      const jobId = job._id as Id<"metadataReprocessingJobs">;
      if (result.kind === "success") {
        await ctx.db.patch(jobId, {
          status: "completed" as const,
          completedAt: Date.now(),
        });
      } else {
        const errorMsg = result.kind === "failed" ? result.error : "Canceled";
        await ctx.db.patch(jobId, {
          status: "failed" as const,
          completedAt: Date.now(),
          error: errorMsg,
        });
      }
    }
  },
});

// Query to get pending/running reprocessing jobs
export const getActiveReprocessingJobs = query({
  handler: async (ctx) => {
    const pendingJobs = await ctx.db
      .query("metadataReprocessingJobs")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    const runningJobs = await ctx.db
      .query("metadataReprocessingJobs")
      .withIndex("by_status", (q) => q.eq("status", "running"))
      .collect();

    return [...pendingJobs, ...runningJobs];
  },
});

// Query to get recent reprocessing jobs (for status display)
export const getRecentReprocessingJobs = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const jobs = await ctx.db
      .query("metadataReprocessingJobs")
      .order("desc")
      .take(limit);
    return jobs;
  },
});

// Batch enqueue for metadata reprocessing
export const enqueueBatchMetadataReprocessing = action({
  args: {
    pdfIds: v.array(v.id("pdfs")),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ enqueuedCount: number; workIds: string[] }> => {
    const workIds: string[] = [];

    for (const pdfId of args.pdfIds) {
      // Get PDF info for tracking
      const pdf = await ctx.runQuery(api.pdfs.get, { id: pdfId });
      const pdfTitle = pdf?.title || "Unknown";

      // Enqueue with onComplete handler
      const handle: WorkId = await pool.enqueueAction(
        ctx,
        internal.pdfWorkpool.reprocessMetadataAction,
        { pdfId },
        {
          onComplete: internal.pdfWorkpool.onReprocessingComplete,
          context: { pdfId },
        }
      );

      // Create tracking record
      await ctx.runMutation(internal.pdfWorkpool.createReprocessingJob, {
        pdfId,
        pdfTitle,
        workId: handle as string,
      });

      workIds.push(handle as string);
    }
    return { enqueuedCount: workIds.length, workIds };
  },
});
