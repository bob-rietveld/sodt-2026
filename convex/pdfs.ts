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

// Get a single PDF with its file URL for viewing
export const getWithFileUrl = query({
  args: { id: v.id("pdfs") },
  handler: async (ctx, args) => {
    const pdf = await ctx.db.get(args.id);
    if (!pdf) return null;

    let fileUrl: string | null = null;

    // Get file URL based on source type
    if (pdf.storageId) {
      fileUrl = await ctx.storage.getUrl(pdf.storageId);
    } else if (pdf.sourceUrl) {
      fileUrl = pdf.sourceUrl;
    }
    // Note: Google Drive files would need OAuth, handled separately

    return {
      ...pdf,
      fileUrl,
    };
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

// Check if a PDF with the same file hash already exists
export const checkDuplicate = query({
  args: { fileHash: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("pdfs")
      .withIndex("by_file_hash", (q) => q.eq("fileHash", args.fileHash))
      .first();

    if (existing) {
      return {
        isDuplicate: true,
        existingPdf: {
          id: existing._id,
          title: existing.title,
          filename: existing.filename,
          uploadedAt: existing.uploadedAt,
        },
      };
    }

    return { isDuplicate: false };
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

// Full-text search across title, summary, author, and company
export const fullTextSearch = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const searchQuery = args.query.trim();
    const limit = args.limit ?? 50;

    // If no query, return all approved completed reports
    if (!searchQuery) {
      return await ctx.db
        .query("pdfs")
        .withIndex("by_public_browse", (q) =>
          q.eq("approved", true).eq("status", "completed")
        )
        .take(limit);
    }

    // Search across all four fields in parallel
    const [titleResults, summaryResults, authorResults, companyResults] = await Promise.all([
      ctx.db
        .query("pdfs")
        .withSearchIndex("search_title", (q) =>
          q.search("title", searchQuery).eq("approved", true)
        )
        .take(limit),
      ctx.db
        .query("pdfs")
        .withSearchIndex("search_summary", (q) =>
          q.search("summary", searchQuery).eq("approved", true)
        )
        .take(limit),
      ctx.db
        .query("pdfs")
        .withSearchIndex("search_author", (q) =>
          q.search("author", searchQuery).eq("approved", true)
        )
        .take(limit),
      ctx.db
        .query("pdfs")
        .withSearchIndex("search_company", (q) =>
          q.search("company", searchQuery).eq("approved", true)
        )
        .take(limit),
    ]);

    // Combine and deduplicate results, prioritizing by search relevance
    const seenIds = new Set<string>();
    const combinedResults: typeof titleResults = [];

    // Title matches first (most relevant)
    for (const doc of titleResults) {
      if (doc.status === "completed" && !seenIds.has(doc._id)) {
        seenIds.add(doc._id);
        combinedResults.push(doc);
      }
    }

    // Company matches second
    for (const doc of companyResults) {
      if (doc.status === "completed" && !seenIds.has(doc._id)) {
        seenIds.add(doc._id);
        combinedResults.push(doc);
      }
    }

    // Author matches third
    for (const doc of authorResults) {
      if (doc.status === "completed" && !seenIds.has(doc._id)) {
        seenIds.add(doc._id);
        combinedResults.push(doc);
      }
    }

    // Summary matches last
    for (const doc of summaryResults) {
      if (doc.status === "completed" && !seenIds.has(doc._id)) {
        seenIds.add(doc._id);
        combinedResults.push(doc);
      }
    }

    return combinedResults.slice(0, limit);
  },
});

// Create a new PDF record
export const create = mutation({
  args: {
    title: v.string(),
    filename: v.string(),
    fileHash: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    driveFileId: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    source: v.union(v.literal("upload"), v.literal("drive"), v.literal("url")),
    author: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check for duplicate if hash is provided
    if (args.fileHash) {
      const existing = await ctx.db
        .query("pdfs")
        .withIndex("by_file_hash", (q) => q.eq("fileHash", args.fileHash))
        .first();

      if (existing) {
        throw new Error(`Duplicate file: This PDF has already been uploaded as "${existing.title}"`);
      }
    }

    const pdfId = await ctx.db.insert("pdfs", {
      title: args.title,
      filename: args.filename,
      fileHash: args.fileHash,
      storageId: args.storageId,
      driveFileId: args.driveFileId,
      sourceUrl: args.sourceUrl,
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

// Helper to normalize year from string or number to integer
function normalizeYear(value: string | number | undefined): number | undefined {
  if (value === undefined) return undefined;

  if (typeof value === "number") {
    return Number.isInteger(value) && value >= 1900 && value <= 2100 ? value : undefined;
  }

  if (typeof value === "string") {
    // Try to extract a 4-digit year from the string
    const yearMatch = value.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) {
      const year = parseInt(yearMatch[0], 10);
      if (year >= 1900 && year <= 2100) return year;
    }
    // Try parsing as a number directly
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed) && parsed >= 1900 && parsed <= 2100) return parsed;
  }

  return undefined;
}

// Update extracted metadata from Firecrawl
export const updateExtractedMetadata = mutation({
  args: {
    id: v.id("pdfs"),
    title: v.optional(v.string()),
    company: v.optional(v.string()),
    dateOrYear: v.optional(v.union(v.number(), v.string())),  // Accept both for backward compatibility, normalized to integer
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
  },
  handler: async (ctx, args) => {
    const { id, dateOrYear, ...updates } = args;

    // Normalize dateOrYear to integer
    const normalizedYear = normalizeYear(dateOrYear);

    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    // Add normalized year if provided
    if (normalizedYear !== undefined) {
      (filteredUpdates as Record<string, unknown>).dateOrYear = normalizedYear;
    }

    // Auto-set extraction metadata
    if (Object.keys(filteredUpdates).length > 0) {
      (filteredUpdates as Record<string, unknown>).extractedAt = Date.now();
      (filteredUpdates as Record<string, unknown>).extractionVersion = "v2.0";
    }

    await ctx.db.patch(id, filteredUpdates);
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

// Update the extracted text storage ID
export const updateExtractedTextStorageId = mutation({
  args: {
    id: v.id("pdfs"),
    extractedTextStorageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      extractedTextStorageId: args.extractedTextStorageId,
    });
  },
});

// Get extracted text URL from storage
export const getExtractedTextUrl = query({
  args: { id: v.id("pdfs") },
  handler: async (ctx, args) => {
    const pdf = await ctx.db.get(args.id);
    if (!pdf || !pdf.extractedTextStorageId) {
      return null;
    }
    return await ctx.storage.getUrl(pdf.extractedTextStorageId);
  },
});

// Browse public reports with filters
export const browseReports = query({
  args: {
    continent: v.optional(
      v.union(
        v.literal("us"),
        v.literal("eu"),
        v.literal("asia"),
        v.literal("global"),
        v.literal("other")
      )
    ),
    industry: v.optional(
      v.union(
        v.literal("semicon"),
        v.literal("deeptech"),
        v.literal("biotech"),
        v.literal("fintech"),
        v.literal("cleantech"),
        v.literal("other")
      )
    ),
    company: v.optional(v.string()),
    year: v.optional(v.number()),  // Year as integer (e.g., 2024)
    technologyAreas: v.optional(v.array(v.string())),
    keywords: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    // Get all approved, completed reports using compound index
    let results = await ctx.db
      .query("pdfs")
      .withIndex("by_public_browse", (q) =>
        q.eq("approved", true).eq("status", "completed")
      )
      .collect();

    // Apply additional filters in memory
    if (args.continent) {
      results = results.filter((r) => r.continent === args.continent);
    }
    if (args.industry) {
      results = results.filter((r) => r.industry === args.industry);
    }
    if (args.company) {
      results = results.filter((r) =>
        r.company?.toLowerCase().includes(args.company!.toLowerCase())
      );
    }
    if (args.year) {
      results = results.filter((r) => r.dateOrYear === args.year);
    }
    // Filter by technology areas (report must have at least one of the selected areas)
    if (args.technologyAreas && args.technologyAreas.length > 0) {
      results = results.filter((r) =>
        r.technologyAreas?.some((area) => args.technologyAreas!.includes(area))
      );
    }
    // Filter by keywords (report must have at least one of the selected keywords)
    if (args.keywords && args.keywords.length > 0) {
      results = results.filter((r) =>
        r.keywords?.some((keyword) => args.keywords!.includes(keyword))
      );
    }

    // Sort by most recent first
    results.sort((a, b) => b.uploadedAt - a.uploadedAt);

    return results;
  },
});

// Get available filter options for dropdowns
export const getFilterOptions = query({
  handler: async (ctx) => {
    const publicReports = await ctx.db
      .query("pdfs")
      .withIndex("by_public_browse", (q) =>
        q.eq("approved", true).eq("status", "completed")
      )
      .collect();

    // Extract unique values for each filter
    const continents = [
      ...new Set(publicReports.map((r) => r.continent).filter(Boolean)),
    ] as string[];

    const industries = [
      ...new Set(publicReports.map((r) => r.industry).filter(Boolean)),
    ] as string[];

    const companies = [
      ...new Set(publicReports.map((r) => r.company).filter(Boolean)),
    ] as string[];

    const years = [
      ...new Set(publicReports.map((r) => r.dateOrYear).filter((y): y is number => typeof y === "number")),
    ];

    // Extract technology areas with counts
    const technologyAreaCounts = new Map<string, number>();
    for (const report of publicReports) {
      if (report.technologyAreas) {
        for (const area of report.technologyAreas) {
          technologyAreaCounts.set(area, (technologyAreaCounts.get(area) || 0) + 1);
        }
      }
    }
    const technologyAreas = Array.from(technologyAreaCounts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => a.value.localeCompare(b.value));

    // Extract keywords with counts
    const keywordCounts = new Map<string, number>();
    for (const report of publicReports) {
      if (report.keywords) {
        for (const keyword of report.keywords) {
          keywordCounts.set(keyword, (keywordCounts.get(keyword) || 0) + 1);
        }
      }
    }
    const keywords = Array.from(keywordCounts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => a.value.localeCompare(b.value));

    return {
      continents: continents.sort(),
      industries: industries.sort(),
      companies: companies.sort(),
      years: years.sort((a, b) => b - a), // Most recent first (numeric sort descending)
      technologyAreas,
      keywords,
    };
  },
});

// Get statistics for reprocessing dashboard
export const getReprocessingStats = query({
  handler: async (ctx) => {
    const pdfs = await ctx.db.query("pdfs").collect();

    return {
      total: pdfs.length,
      withMetadata: pdfs.filter((p) => p.summary).length,
      withNewFields: pdfs.filter((p) => p.documentType).length,
      failed: pdfs.filter((p) => p.status === "failed").length,
      missingMetadata: pdfs.filter((p) => !p.summary || !p.documentType).length,
      oldExtraction: pdfs.filter((p) => p.extractionVersion !== "v2.0").length,
    };
  },
});

// Get all PDFs for export with extracted text URLs
export const getAllForExport = query({
  handler: async (ctx) => {
    const pdfs = await ctx.db.query("pdfs").collect();

    // Get extracted text URLs for each PDF that has one
    const pdfsWithTextUrls = await Promise.all(
      pdfs.map(async (pdf) => {
        let extractedTextUrl: string | null = null;
        if (pdf.extractedTextStorageId) {
          extractedTextUrl = await ctx.storage.getUrl(pdf.extractedTextStorageId);
        }
        return {
          ...pdf,
          extractedTextUrl,
        };
      })
    );

    return pdfsWithTextUrls;
  },
});

// Get PDFs that need reprocessing based on filter
export const getPdfsForReprocessing = query({
  args: {
    filter: v.optional(
      v.union(
        v.literal("all"),
        v.literal("missing_metadata"),
        v.literal("old_extraction"),
        v.literal("failed")
      )
    ),
  },
  handler: async (ctx, args) => {
    let pdfs = await ctx.db.query("pdfs").collect();

    const filter = args.filter || "all";

    if (filter === "missing_metadata") {
      // PDFs without summary or new fields
      pdfs = pdfs.filter((pdf) => !pdf.summary || !pdf.documentType);
    } else if (filter === "old_extraction") {
      // PDFs extracted with old version or never extracted
      pdfs = pdfs.filter(
        (pdf) => !pdf.extractionVersion || pdf.extractionVersion !== "v2.0"
      );
    } else if (filter === "failed") {
      pdfs = pdfs.filter((pdf) => pdf.status === "failed");
    }

    return pdfs.map((pdf) => ({
      _id: pdf._id,
      title: pdf.title,
      filename: pdf.filename,
      status: pdf.status,
      extractionVersion: pdf.extractionVersion,
      hasMetadata: !!pdf.summary,
      hasNewFields: !!pdf.documentType,
    }));
  },
});

// Get existing keywords and technology areas for extraction context
// This helps ensure consistency when extracting metadata from new reports
export const getExtractionContext = query({
  handler: async (ctx) => {
    // Get all PDFs with extracted metadata
    const pdfs = await ctx.db.query("pdfs").collect();

    // Collect unique keywords
    const keywordsSet = new Set<string>();
    for (const pdf of pdfs) {
      if (pdf.keywords) {
        for (const keyword of pdf.keywords) {
          keywordsSet.add(keyword);
        }
      }
    }

    // Collect unique technology areas
    const technologyAreasSet = new Set<string>();
    for (const pdf of pdfs) {
      if (pdf.technologyAreas) {
        for (const area of pdf.technologyAreas) {
          technologyAreasSet.add(area);
        }
      }
    }

    return {
      existingKeywords: Array.from(keywordsSet).sort(),
      existingTechnologyAreas: Array.from(technologyAreasSet).sort(),
    };
  },
});

// Migration: Convert any string years to integers in existing data
export const migrateYearsToIntegers = mutation({
  handler: async (ctx) => {
    const pdfs = await ctx.db.query("pdfs").collect();
    let migrated = 0;

    for (const pdf of pdfs) {
      // Check if dateOrYear exists and is a string (shouldn't happen with schema, but legacy data might have it)
      const year = pdf.dateOrYear as unknown;
      if (typeof year === "string") {
        const normalizedYear = normalizeYear(year);
        if (normalizedYear !== undefined) {
          await ctx.db.patch(pdf._id, { dateOrYear: normalizedYear });
          migrated++;
        }
      }
    }

    return { migrated, total: pdfs.length };
  },
});

// Get homepage statistics for public display
export const getHomeStats = query({
  handler: async (ctx) => {
    const publicReports = await ctx.db
      .query("pdfs")
      .withIndex("by_public_browse", (q) =>
        q.eq("approved", true).eq("status", "completed")
      )
      .collect();

    // Count unique companies
    const companies = new Set<string>();
    for (const report of publicReports) {
      if (report.company) {
        companies.add(report.company);
      }
    }

    // Count unique technology areas
    const technologyAreas = new Set<string>();
    for (const report of publicReports) {
      if (report.technologyAreas) {
        for (const area of report.technologyAreas) {
          technologyAreas.add(area);
        }
      }
    }

    // Count unique industries
    const industries = new Set<string>();
    for (const report of publicReports) {
      if (report.industry) {
        industries.add(report.industry);
      }
    }

    // Get year range
    const years = publicReports
      .map((r) => r.dateOrYear)
      .filter((y): y is number => typeof y === "number");
    const minYear = years.length > 0 ? Math.min(...years) : null;
    const maxYear = years.length > 0 ? Math.max(...years) : null;

    return {
      totalReports: publicReports.length,
      uniqueCompanies: companies.size,
      uniqueTechnologyAreas: technologyAreas.size,
      uniqueIndustries: industries.size,
      yearRange: minYear && maxYear ? { min: minYear, max: maxYear } : null,
    };
  },
});

// Get latest uploaded reports for homepage display
export const getLatestReports = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 6;

    const reports = await ctx.db
      .query("pdfs")
      .withIndex("by_public_browse", (q) =>
        q.eq("approved", true).eq("status", "completed")
      )
      .collect();

    // Sort by upload date (most recent first) and take the limit
    reports.sort((a, b) => b.uploadedAt - a.uploadedAt);
    const latestReports = reports.slice(0, limit);

    // Get thumbnail URLs for reports that have them
    return await Promise.all(
      latestReports.map(async (report) => {
        const thumbnailUrl = report.thumbnailUrl || null;

        return {
          _id: report._id,
          title: report.title,
          company: report.company,
          summary: report.summary,
          dateOrYear: report.dateOrYear,
          industry: report.industry,
          technologyAreas: report.technologyAreas,
          thumbnailUrl,
          uploadedAt: report.uploadedAt,
        };
      })
    );
  },
});
