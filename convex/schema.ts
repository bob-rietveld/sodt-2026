import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  pdfs: defineTable({
    // Core fields
    title: v.string(),
    filename: v.string(),
    fileHash: v.optional(v.string()),          // SHA-256 hash of file content for duplicate detection
    storageId: v.optional(v.id("_storage")),  // Convex storage ID
    extractedTextStorageId: v.optional(v.id("_storage")),  // Storage ID for extracted text file
    driveFileId: v.optional(v.string()),       // Google Drive file ID
    sourceUrl: v.optional(v.string()),         // Original URL for URL-sourced PDFs

    // Metadata
    author: v.optional(v.string()),
    description: v.optional(v.string()),
    pageCount: v.optional(v.number()),
    uploadedAt: v.number(),

    // Extracted metadata from Firecrawl
    company: v.optional(v.string()),
    dateOrYear: v.optional(v.union(v.number(), v.string())),  // Year of publication (accepts string for migration, normalized to integer)
    topic: v.optional(v.string()),
    summary: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    continent: v.optional(v.union(
      v.literal("us"),
      v.literal("eu"),
      v.literal("asia"),
      v.literal("global"),
      v.literal("other")
    )),
    industry: v.optional(v.union(
      v.literal("semicon"),
      v.literal("deeptech"),
      v.literal("biotech"),
      v.literal("fintech"),
      v.literal("cleantech"),
      v.literal("other")
    )),

    // Extended metadata (v2.0)
    documentType: v.optional(v.union(
      v.literal("pitch_deck"),
      v.literal("market_research"),
      v.literal("financial_report"),
      v.literal("white_paper"),
      v.literal("case_study"),
      v.literal("annual_report"),
      v.literal("investor_update"),
      v.literal("other")
    )),
    authors: v.optional(v.array(v.string())),
    keyFindings: v.optional(v.array(v.string())),
    keywords: v.optional(v.array(v.string())),
    technologyAreas: v.optional(v.array(v.string())),
    extractedAt: v.optional(v.number()),
    extractionVersion: v.optional(v.string()),

    // Processing status
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    processingError: v.optional(v.string()),
    pineconeFileId: v.optional(v.string()),  // Reference to Pinecone Assistant file
    pineconeFileStatus: v.optional(v.union(
      v.literal("Processing"),
      v.literal("Available"),
      v.literal("Failed")
    )),

    // Admin workflow
    approved: v.boolean(),
    approvedBy: v.optional(v.string()),
    approvedAt: v.optional(v.number()),

    // Source tracking
    source: v.union(v.literal("upload"), v.literal("drive"), v.literal("url"), v.literal("user-contributed")),
  })
    .index("by_status", ["status"])
    .index("by_approved", ["approved"])
    .index("by_drive_file", ["driveFileId"])
    .index("by_file_hash", ["fileHash"])
    .index("by_public_browse", ["approved", "status"])
    .index("by_document_type", ["documentType"])
    .index("by_pinecone_file", ["pineconeFileId"])
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["status", "approved"],
    })
    .searchIndex("search_summary", {
      searchField: "summary",
      filterFields: ["status", "approved"],
    })
    .searchIndex("search_author", {
      searchField: "author",
      filterFields: ["status", "approved"],
    })
    .searchIndex("search_company", {
      searchField: "company",
      filterFields: ["status", "approved"],
    }),

  processingJobs: defineTable({
    pdfId: v.id("pdfs"),
    stage: v.union(
      v.literal("extracting"),
      v.literal("embedding"),
      v.literal("storing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    error: v.optional(v.string()),
    metadata: v.optional(v.any()),
  }).index("by_pdf", ["pdfId"]),

  // Store chat sessions for context
  chatSessions: defineTable({
    messages: v.array(
      v.object({
        role: v.union(v.literal("user"), v.literal("assistant")),
        content: v.string(),
        sources: v.optional(v.array(v.string())),
        timestamp: v.number(),
      })
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  }),

  // App settings (key-value store)
  settings: defineTable({
    key: v.string(),
    value: v.string(),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  // Track metadata reprocessing jobs from workpool
  metadataReprocessingJobs: defineTable({
    pdfId: v.id("pdfs"),
    pdfTitle: v.string(),
    workId: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed")
    ),
    enqueuedAt: v.number(),
    completedAt: v.optional(v.number()),
    error: v.optional(v.string()),
  })
    .index("by_status", ["status"])
    .index("by_work_id", ["workId"]),

  // Search analytics - track user search queries and results
  searchQueries: defineTable({
    // Query details
    query: v.string(),
    searchType: v.union(v.literal("agent"), v.literal("chat")),
    sessionId: v.optional(v.string()),

    // Timing
    timestamp: v.number(),
    responseTimeMs: v.optional(v.number()),

    // Results
    answer: v.optional(v.string()),
    sources: v.optional(v.array(v.object({
      convexId: v.optional(v.string()),
      title: v.optional(v.string()),
      filename: v.optional(v.string()),
      pageNumber: v.optional(v.number()),
    }))),
    resultCount: v.number(),

    // User context (anonymous)
    userAgent: v.optional(v.string()),
    ipHash: v.optional(v.string()),  // Hashed for privacy
  })
    .index("by_timestamp", ["timestamp"])
    .index("by_search_type", ["searchType"])
    .searchIndex("search_query", {
      searchField: "query",
    }),

  // Saved analytics views for AI-generated charts
  savedAnalyticsViews: defineTable({
    name: v.string(),
    question: v.string(),
    chartSpec: v.string(),  // JSON stringified ChartSpec
    toolName: v.optional(v.string()),
    toolArgs: v.optional(v.string()),  // JSON stringified args
    createdBy: v.string(),  // Clerk user ID
    createdAt: v.number(),
    updatedAt: v.number(),
    isShared: v.boolean(),
    folderId: v.optional(v.id("savedAnalyticsFolders")),  // null = root level
  })
    .index("by_user", ["createdBy"])
    .index("by_shared", ["isShared"])
    .index("by_folder", ["folderId"])
    .index("by_user_and_folder", ["createdBy", "folderId"]),

  // Folders for organizing analytics views
  savedAnalyticsFolders: defineTable({
    name: v.string(),
    createdBy: v.string(),  // Clerk user ID
    createdAt: v.number(),
    updatedAt: v.number(),
    parentId: v.optional(v.id("savedAnalyticsFolders")),  // For nested folders
    isShared: v.boolean(),
    color: v.optional(v.string()),  // Optional folder color (hex)
  })
    .index("by_user", ["createdBy"])
    .index("by_shared", ["isShared"])
    .index("by_parent", ["parentId"])
    .index("by_user_and_parent", ["createdBy", "parentId"]),
});
