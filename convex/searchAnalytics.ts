import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Log a search query
export const logSearch = mutation({
  args: {
    query: v.string(),
    searchType: v.union(v.literal("agent"), v.literal("chat")),
    sessionId: v.optional(v.string()),
    responseTimeMs: v.optional(v.number()),
    answer: v.optional(v.string()),
    sources: v.optional(v.array(v.object({
      convexId: v.optional(v.string()),
      title: v.optional(v.string()),
      filename: v.optional(v.string()),
      pageNumber: v.optional(v.number()),
    }))),
    resultCount: v.number(),
    userAgent: v.optional(v.string()),
    ipHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("searchQueries", {
      query: args.query,
      searchType: args.searchType,
      sessionId: args.sessionId,
      timestamp: Date.now(),
      responseTimeMs: args.responseTimeMs,
      answer: args.answer,
      sources: args.sources,
      resultCount: args.resultCount,
      userAgent: args.userAgent,
      ipHash: args.ipHash,
    });
  },
});

// Get recent search queries with pagination
export const getRecentSearches = query({
  args: {
    limit: v.optional(v.number()),
    searchType: v.optional(v.union(v.literal("agent"), v.literal("chat"))),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;

    if (args.searchType) {
      const results = await ctx.db
        .query("searchQueries")
        .withIndex("by_search_type", (q) => q.eq("searchType", args.searchType!))
        .order("desc")
        .take(limit);
      return results;
    }

    const results = await ctx.db
      .query("searchQueries")
      .withIndex("by_timestamp")
      .order("desc")
      .take(limit);
    return results;
  },
});

// Get search analytics summary
export const getAnalyticsSummary = query({
  args: {
    daysBack: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const daysBack = args.daysBack ?? 30;
    const cutoffTime = Date.now() - (daysBack * 24 * 60 * 60 * 1000);

    const allSearches = await ctx.db
      .query("searchQueries")
      .withIndex("by_timestamp")
      .order("desc")
      .collect();

    const recentSearches = allSearches.filter(s => s.timestamp >= cutoffTime);

    // Calculate stats
    const totalSearches = recentSearches.length;
    const agentSearches = recentSearches.filter(s => s.searchType === "agent").length;
    const chatSearches = recentSearches.filter(s => s.searchType === "chat").length;

    // Average response time
    const responseTimes = recentSearches
      .filter(s => s.responseTimeMs !== undefined)
      .map(s => s.responseTimeMs!);
    const avgResponseTime = responseTimes.length > 0
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
      : 0;

    // Average results per search
    const avgResultCount = totalSearches > 0
      ? Math.round(recentSearches.reduce((a, b) => a + b.resultCount, 0) / totalSearches * 10) / 10
      : 0;

    // Searches with no results
    const noResultSearches = recentSearches.filter(s => s.resultCount === 0).length;

    // Searches by day (for chart)
    const searchesByDay: Record<string, number> = {};
    recentSearches.forEach(s => {
      const date = new Date(s.timestamp).toISOString().split('T')[0];
      searchesByDay[date] = (searchesByDay[date] || 0) + 1;
    });

    return {
      totalSearches,
      agentSearches,
      chatSearches,
      avgResponseTime,
      avgResultCount,
      noResultSearches,
      searchesByDay,
    };
  },
});

// Get popular search terms
export const getPopularSearchTerms = query({
  args: {
    limit: v.optional(v.number()),
    daysBack: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    const daysBack = args.daysBack ?? 30;
    const cutoffTime = Date.now() - (daysBack * 24 * 60 * 60 * 1000);

    const searches = await ctx.db
      .query("searchQueries")
      .withIndex("by_timestamp")
      .order("desc")
      .collect();

    const recentSearches = searches.filter(s => s.timestamp >= cutoffTime);

    // Count query occurrences (normalize to lowercase)
    const queryCounts: Record<string, { count: number; avgResults: number; totalResults: number }> = {};
    recentSearches.forEach(s => {
      const normalizedQuery = s.query.toLowerCase().trim();
      if (!queryCounts[normalizedQuery]) {
        queryCounts[normalizedQuery] = { count: 0, avgResults: 0, totalResults: 0 };
      }
      queryCounts[normalizedQuery].count++;
      queryCounts[normalizedQuery].totalResults += s.resultCount;
    });

    // Calculate averages and sort by count
    const sortedTerms = Object.entries(queryCounts)
      .map(([query, data]) => ({
        query,
        count: data.count,
        avgResults: Math.round(data.totalResults / data.count * 10) / 10,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    return sortedTerms;
  },
});

// Get frequently returned sources
export const getPopularSources = query({
  args: {
    limit: v.optional(v.number()),
    daysBack: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    const daysBack = args.daysBack ?? 30;
    const cutoffTime = Date.now() - (daysBack * 24 * 60 * 60 * 1000);

    const searches = await ctx.db
      .query("searchQueries")
      .withIndex("by_timestamp")
      .order("desc")
      .collect();

    const recentSearches = searches.filter(s => s.timestamp >= cutoffTime);

    // Count source occurrences
    const sourceCounts: Record<string, { count: number; title: string; filename: string }> = {};
    recentSearches.forEach(s => {
      if (s.sources) {
        s.sources.forEach(source => {
          if (source.convexId) {
            if (!sourceCounts[source.convexId]) {
              sourceCounts[source.convexId] = {
                count: 0,
                title: source.title || 'Unknown',
                filename: source.filename || 'Unknown',
              };
            }
            sourceCounts[source.convexId].count++;
          }
        });
      }
    });

    // Sort by count
    const sortedSources = Object.entries(sourceCounts)
      .map(([convexId, data]) => ({
        convexId,
        title: data.title,
        filename: data.filename,
        count: data.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    return sortedSources;
  },
});

// Get total search count
export const getTotalSearchCount = query({
  handler: async (ctx) => {
    const searches = await ctx.db.query("searchQueries").collect();
    return searches.length;
  },
});

// Get searches with no results (for identifying gaps)
export const getNoResultSearches = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;

    const searches = await ctx.db
      .query("searchQueries")
      .withIndex("by_timestamp")
      .order("desc")
      .collect();

    const noResultSearches = searches
      .filter(s => s.resultCount === 0)
      .slice(0, limit);

    return noResultSearches;
  },
});

// Delete old search data (for maintenance)
export const deleteOldSearches = mutation({
  args: {
    daysToKeep: v.number(),
  },
  handler: async (ctx, args) => {
    const cutoffTime = Date.now() - (args.daysToKeep * 24 * 60 * 60 * 1000);

    const oldSearches = await ctx.db
      .query("searchQueries")
      .withIndex("by_timestamp")
      .collect();

    const toDelete = oldSearches.filter(s => s.timestamp < cutoffTime);

    for (const search of toDelete) {
      await ctx.db.delete(search._id);
    }

    return { deleted: toDelete.length };
  },
});
