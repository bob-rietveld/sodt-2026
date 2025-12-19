import { Workpool, WorkId } from "@convex-dev/workpool";
import { components } from "./_generated/api";
import { v } from "convex/values";
import { action, internalAction, query } from "./_generated/server";
import { internal } from "./_generated/api";

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
