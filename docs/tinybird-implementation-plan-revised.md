# Tinybird Event Tracking Implementation Plan (Revised)

## Overview

Server-side event tracking using Tinybird to replace Convex-based search analytics. This revised plan simplifies the original proposal by keeping analytics server-side and focusing on the app's actual use case: search/chat analytics for a B2B Dutch tech intelligence platform.

### Key Design Principles

1. **Server-Side First**: Log from API routes, not client - more reliable, simpler, privacy-friendly
2. **Focused Schema**: Track search events with fields that match current Convex implementation
3. **Minimal Changes**: Same dashboard UI, same data shape, just different backend
4. **Fire-and-Forget**: Analytics failures should never break user experience
5. **Migration-Friendly**: Run parallel to Convex initially, then switch

### Why This Differs from the Original Plan

| Original Plan | Revised Plan | Rationale |
|--------------|--------------|-----------|
| Client-side AnalyticsProvider | No provider needed | Current logging is server-side; keep it that way |
| 25+ field schema with page views, UTM, device tracking | ~12 focused fields | This is a B2B search app, not a marketing site |
| React hooks (useAnalytics) | Simple server functions | Simpler, no client bundle impact |
| Visitor ID via localStorage | Use existing sessionId | Already have session tracking |
| Client-side batching queue | Direct server calls | Low-volume app doesn't need batching |

---

## Current Implementation Analysis

### Existing Data Flow
```
User Query
    ↓
[/api/chat or /api/search]
    ↓
Pinecone Assistant (AI response)
    ↓
Calculate responseTimeMs
    ↓
convex.mutation(api.searchAnalytics.logSearch, {...})  ← Replace this
    ↓
Convex Database (searchQueries table)
    ↓
Admin Dashboard [/admin/analytics]
```

### Current Fields Logged
```typescript
{
  query: string;
  searchType: "agent" | "chat";
  sessionId?: string;
  responseTimeMs?: number;
  answer?: string;          // truncated to 2000 chars
  sources?: Array<{
    convexId?: string;
    title?: string;
    filename?: string;
    pageNumber?: number;
  }>;
  resultCount: number;
  userAgent?: string;
  ipHash?: string;          // SHA-256, first 16 chars
  timestamp: number;        // Date.now()
}
```

### Files to Modify
| File | Change |
|------|--------|
| `src/app/api/chat/route.ts` | Replace Convex logging with Tinybird |
| `src/app/api/search/route.ts` | Replace Convex logging with Tinybird |
| `src/app/admin/analytics/analytics-content.tsx` | Fetch from Tinybird pipes |
| `.env.example` | Add Tinybird env vars |

### Files to Create
| File | Purpose |
|------|---------|
| `tinybird/datasources/events.datasource` | Event schema |
| `tinybird/pipes/*.pipe` | Analytics queries (5 pipes) |
| `src/lib/analytics/tinybird.ts` | Server-side logging client |
| `src/lib/analytics/types.ts` | TypeScript interfaces |
| `src/lib/analytics/index.ts` | Barrel exports |

### Files to Eventually Remove
| File | When |
|------|------|
| `convex/searchAnalytics.ts` | After Tinybird validated |
| `searchQueries` in `convex/schema.ts` | After Tinybird validated |

---

## Phase 1: Tinybird Setup

### 1.1 Data Source Schema

Create `tinybird/datasources/events.datasource`:

```sql
SCHEMA >
    `event_id` String,
    `event_name` LowCardinality(String),
    `query` String,
    `session_id` Nullable(String),
    `timestamp` DateTime64(3),
    `response_time_ms` Nullable(Int32),
    `answer` Nullable(String),
    `sources` String,
    `result_count` Int32,
    `user_agent` Nullable(String),
    `ip_hash` Nullable(String)

ENGINE "MergeTree"
ENGINE_PARTITION_KEY "toYYYYMM(timestamp)"
ENGINE_SORTING_KEY "timestamp, event_name"
ENGINE_TTL "timestamp + toIntervalDay(365)"

TOKEN ingest APPEND
TOKEN analytics READ
```

**Schema Notes:**
- `event_name`: "search_query" or "chat_query" (replaces searchType)
- `sources`: JSON string array (same as current)
- `LowCardinality` for event_name improves query performance
- TTL auto-deletes data after 1 year

### 1.2 Environment Variables

Add to `.env.local`:
```env
# Tinybird Analytics
TINYBIRD_API_URL=https://api.tinybird.co
TINYBIRD_INGEST_TOKEN=p.xxxxx  # Token with DATASOURCE:APPEND scope
TINYBIRD_READ_TOKEN=p.xxxxx    # Token with PIPES:READ scope
```

For local development:
```env
TINYBIRD_API_URL=http://localhost:7181
```

Update `.env.example` with these variables (no values).

---

## Phase 2: Server-Side Analytics Library

### 2.1 Types

Create `src/lib/analytics/types.ts`:

```typescript
export interface SearchEvent {
  event_id: string;
  event_name: 'search_query' | 'chat_query';
  query: string;
  session_id: string | null;
  timestamp: string;  // ISO 8601
  response_time_ms: number | null;
  answer: string | null;
  sources: string;    // JSON stringified array
  result_count: number;
  user_agent: string | null;
  ip_hash: string | null;
}

export interface SearchSource {
  convexId?: string;
  title?: string;
  filename?: string;
  pageNumber?: number;
}
```

### 2.2 Tinybird Client

Create `src/lib/analytics/tinybird.ts`:

```typescript
import crypto from 'crypto';
import { SearchEvent, SearchSource } from './types';

const TINYBIRD_URL = process.env.TINYBIRD_API_URL || 'https://api.tinybird.co';
const TINYBIRD_TOKEN = process.env.TINYBIRD_INGEST_TOKEN;
const DATASOURCE = 'events';

export function hashIP(ip: string | null): string | null {
  if (!ip) return null;
  return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

export async function logSearchEvent(params: {
  eventName: 'search_query' | 'chat_query';
  query: string;
  sessionId?: string;
  responseTimeMs?: number;
  answer?: string;
  sources?: SearchSource[];
  resultCount: number;
  userAgent?: string;
  ip?: string;
}): Promise<void> {
  // Skip if Tinybird not configured (dev environment without local instance)
  if (!TINYBIRD_TOKEN) {
    console.warn('TINYBIRD_INGEST_TOKEN not configured, skipping analytics');
    return;
  }

  const event: SearchEvent = {
    event_id: crypto.randomUUID(),
    event_name: params.eventName,
    query: params.query,
    session_id: params.sessionId || null,
    timestamp: new Date().toISOString(),
    response_time_ms: params.responseTimeMs ?? null,
    answer: params.answer?.slice(0, 2000) ?? null,
    sources: JSON.stringify(params.sources || []),
    result_count: params.resultCount,
    user_agent: params.userAgent || null,
    ip_hash: hashIP(params.ip || null),
  };

  try {
    const response = await fetch(`${TINYBIRD_URL}/v0/events?name=${DATASOURCE}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TINYBIRD_TOKEN}`,
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Tinybird ingestion error:', response.status, error);
    }
  } catch (error) {
    // Fire and forget - don't throw, just log
    console.error('Tinybird ingestion failed:', error);
  }
}
```

### 2.3 Barrel Export

Create `src/lib/analytics/index.ts`:

```typescript
export { logSearchEvent, hashIP } from './tinybird';
export type { SearchEvent, SearchSource } from './types';
```

---

## Phase 3: Integrate with API Routes

### 3.1 Update `/api/chat/route.ts`

Replace the Convex logging block (lines 164-188) with:

```typescript
import { logSearchEvent } from '@/lib/analytics';

// ... inside the stream completion handler, after sources are built ...

// Log to Tinybird (replaces Convex logging)
const responseTimeMs = Date.now() - startTime;
logSearchEvent({
  eventName: 'chat_query',
  query: message,
  sessionId,
  responseTimeMs,
  answer: contentWithCitations.slice(0, 2000),
  sources: sources.flatMap((s) =>
    s.references.map((r) => ({
      convexId: r.fileId,
      title: r.title,
      filename: r.filename,
      pageNumber: r.pageNumbers[0] ?? 0,
    }))
  ),
  resultCount: sources.reduce((acc, s) => acc + s.references.length, 0),
  userAgent,
  ip,
}).catch(() => {}); // Ignore errors - fire and forget
```

**Remove:**
- Import of Convex `api`
- The `getConvexClient()` function (if only used for analytics)
- The existing `convex.mutation(api.searchAnalytics.logSearch, {...})` block

### 3.2 Update `/api/search/route.ts`

Replace the Convex logging block (lines 67-93) with:

```typescript
import { logSearchEvent } from '@/lib/analytics';

// ... after building the result ...

// Log to Tinybird (replaces Convex logging)
logSearchEvent({
  eventName: 'search_query',
  query,
  responseTimeMs,
  answer: result.answer,
  sources: result.sources?.map((s) => ({
    convexId: s.convexId,
    title: s.title,
    filename: s.filename,
    pageNumber: s.pageNumber,
  })),
  resultCount: result.sources?.length ?? 0,
  userAgent: request.headers.get('user-agent') || undefined,
  ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
}).catch(() => {}); // Fire and forget
```

**Remove:**
- Import of Convex `api`
- The `getConvexClient()` function
- The `hashIP()` function (now in lib/analytics)
- The existing Convex logging block

---

## Phase 4: Tinybird Pipes

Create pipes that return data in the same shape as current Convex queries.

### 4.1 Analytics Summary

Create `tinybird/pipes/analytics_summary.pipe`:

```sql
NODE analytics_summary
SQL >
    SELECT
        count() as totalSearches,
        countIf(event_name = 'search_query') as agentSearches,
        countIf(event_name = 'chat_query') as chatSearches,
        round(avgIf(response_time_ms, response_time_ms IS NOT NULL)) as avgResponseTime,
        round(avg(result_count), 1) as avgResultCount,
        countIf(result_count = 0) as noResultSearches
    FROM events
    WHERE timestamp >= now() - INTERVAL {{Int32(days_back, 30)}} DAY

TYPE endpoint

NODE searches_by_day
SQL >
    SELECT
        toDate(timestamp) as date,
        count() as count
    FROM events
    WHERE timestamp >= now() - INTERVAL {{Int32(days_back, 30)}} DAY
    GROUP BY date
    ORDER BY date

TYPE endpoint
```

### 4.2 Popular Search Terms

Create `tinybird/pipes/popular_searches.pipe`:

```sql
NODE popular_searches
SQL >
    SELECT
        lower(trim(query)) as query,
        count() as count,
        round(avg(result_count), 1) as avgResults
    FROM events
    WHERE timestamp >= now() - INTERVAL {{Int32(days_back, 30)}} DAY
    GROUP BY query
    ORDER BY count DESC
    LIMIT {{Int32(limit, 20)}}

TYPE endpoint
```

### 4.3 Popular Sources

Create `tinybird/pipes/popular_sources.pipe`:

```sql
NODE popular_sources
SQL >
    SELECT
        JSONExtractString(source, 'convexId') as convexId,
        JSONExtractString(source, 'title') as title,
        JSONExtractString(source, 'filename') as filename,
        count() as count
    FROM events
    ARRAY JOIN JSONExtractArrayRaw(sources) as source
    WHERE
        timestamp >= now() - INTERVAL {{Int32(days_back, 30)}} DAY
        AND JSONExtractString(source, 'convexId') != ''
    GROUP BY convexId, title, filename
    ORDER BY count DESC
    LIMIT {{Int32(limit, 20)}}

TYPE endpoint
```

### 4.4 Recent Searches

Create `tinybird/pipes/recent_searches.pipe`:

```sql
NODE recent_searches
SQL >
    SELECT
        event_id as _id,
        query,
        event_name as searchType,
        result_count as resultCount,
        response_time_ms as responseTimeMs,
        toUnixTimestamp64Milli(timestamp) as timestamp
    FROM events
    ORDER BY timestamp DESC
    LIMIT {{Int32(limit, 50)}}

TYPE endpoint
```

### 4.5 No Result Searches

Create `tinybird/pipes/no_result_searches.pipe`:

```sql
NODE no_result_searches
SQL >
    SELECT
        event_id as _id,
        query,
        toUnixTimestamp64Milli(timestamp) as timestamp
    FROM events
    WHERE result_count = 0
    ORDER BY timestamp DESC
    LIMIT {{Int32(limit, 20)}}

TYPE endpoint
```

---

## Phase 5: Update Admin Dashboard

### 5.1 Create Tinybird Query Functions

Create `src/lib/analytics/queries.ts`:

```typescript
const TINYBIRD_URL = process.env.NEXT_PUBLIC_TINYBIRD_API_URL || 'https://api.tinybird.co';
const TINYBIRD_TOKEN = process.env.NEXT_PUBLIC_TINYBIRD_READ_TOKEN;

async function queryPipe<T>(pipeName: string, params: Record<string, string | number> = {}): Promise<T> {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    searchParams.set(key, String(value));
  });

  const url = `${TINYBIRD_URL}/v0/pipes/${pipeName}.json?${searchParams}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${TINYBIRD_TOKEN}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Tinybird query failed: ${response.status}`);
  }

  const json = await response.json();
  return json.data;
}

export async function getAnalyticsSummary(daysBack: number = 30) {
  const [summary, searchesByDay] = await Promise.all([
    queryPipe<Array<{
      totalSearches: number;
      agentSearches: number;
      chatSearches: number;
      avgResponseTime: number;
      avgResultCount: number;
      noResultSearches: number;
    }>>('analytics_summary', { days_back: daysBack }),
    queryPipe<Array<{ date: string; count: number }>>('searches_by_day', { days_back: daysBack }),
  ]);

  return {
    ...summary[0],
    searchesByDay: Object.fromEntries(searchesByDay.map(d => [d.date, d.count])),
  };
}

export async function getRecentSearches(limit: number = 50) {
  return queryPipe<Array<{
    _id: string;
    query: string;
    searchType: string;
    resultCount: number;
    responseTimeMs: number | null;
    timestamp: number;
  }>>('recent_searches', { limit });
}

export async function getPopularSearchTerms(limit: number = 20, daysBack: number = 30) {
  return queryPipe<Array<{
    query: string;
    count: number;
    avgResults: number;
  }>>('popular_searches', { limit, days_back: daysBack });
}

export async function getPopularSources(limit: number = 20, daysBack: number = 30) {
  return queryPipe<Array<{
    convexId: string;
    title: string;
    filename: string;
    count: number;
  }>>('popular_sources', { limit, days_back: daysBack });
}

export async function getNoResultSearches(limit: number = 20) {
  return queryPipe<Array<{
    _id: string;
    query: string;
    timestamp: number;
  }>>('no_result_searches', { limit });
}
```

### 5.2 Update Analytics Dashboard Component

Update `src/app/admin/analytics/analytics-content.tsx`:

Replace Convex `useQuery` hooks with React state + useEffect + Tinybird queries:

```typescript
"use client";

import { useState, useEffect } from "react";
import {
  getAnalyticsSummary,
  getRecentSearches,
  getPopularSearchTerms,
  getPopularSources,
  getNoResultSearches,
} from "@/lib/analytics/queries";

export default function AnalyticsContent() {
  const [daysBack, setDaysBack] = useState(30);
  const [isLoading, setIsLoading] = useState(true);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof getAnalyticsSummary>> | null>(null);
  const [recentSearches, setRecentSearches] = useState<Awaited<ReturnType<typeof getRecentSearches>>>([]);
  const [popularTerms, setPopularTerms] = useState<Awaited<ReturnType<typeof getPopularSearchTerms>>>([]);
  const [popularSources, setPopularSources] = useState<Awaited<ReturnType<typeof getPopularSources>>>([]);
  const [noResultSearches, setNoResultSearches] = useState<Awaited<ReturnType<typeof getNoResultSearches>>>([]);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const [summaryData, recent, terms, sources, noResults] = await Promise.all([
          getAnalyticsSummary(daysBack),
          getRecentSearches(20),
          getPopularSearchTerms(10, daysBack),
          getPopularSources(10, daysBack),
          getNoResultSearches(10),
        ]);
        setSummary(summaryData);
        setRecentSearches(recent);
        setPopularTerms(terms);
        setPopularSources(sources);
        setNoResultSearches(noResults);
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [daysBack]);

  // ... rest of component stays the same, just using local state instead of useQuery ...
}
```

### 5.3 Add Client-Side Environment Variables

Update `next.config.js` or `.env.local`:
```env
NEXT_PUBLIC_TINYBIRD_API_URL=https://api.tinybird.co
NEXT_PUBLIC_TINYBIRD_READ_TOKEN=p.xxxxx
```

---

## Phase 6: Testing

### 6.1 Local Development

```bash
# Start Tinybird local
tb local start

# Push datasource
tb push datasources/events.datasource --local

# Push pipes
tb push pipes/*.pipe --local

# Test ingestion
curl -X POST "http://localhost:7181/v0/events?name=events" \
  -H "Authorization: Bearer <local_token>" \
  -d '{"event_id":"test-1","event_name":"chat_query","query":"test query","timestamp":"2024-01-01T00:00:00.000Z","sources":"[]","result_count":5}'

# Query data
tb sql "SELECT * FROM events" --local

# Test pipe
curl "http://localhost:7181/v0/pipes/analytics_summary.json?days_back=30" \
  -H "Authorization: Bearer <local_token>"
```

### 6.2 Integration Tests

1. **Search Logging**: Make a search query, verify event in Tinybird
2. **Chat Logging**: Send a chat message, verify event in Tinybird
3. **Dashboard**: Load admin/analytics, verify data displays
4. **Time Filter**: Change daysBack, verify queries update

### 6.3 Parallel Running

Initially run both Convex and Tinybird logging to compare:

```typescript
// In API routes, temporarily:
await Promise.all([
  convex.mutation(api.searchAnalytics.logSearch, {...}),
  logSearchEvent({...}),
]);
```

Compare data in both systems before fully switching.

---

## Phase 7: Cleanup (After Validation)

### 7.1 Remove Convex Analytics

1. Delete `convex/searchAnalytics.ts`

2. Update `convex/schema.ts` - remove searchQueries table:
```typescript
// Remove this table definition:
searchQueries: defineTable({
  query: v.string(),
  // ...
})
```

3. Remove Convex imports from API routes:
```typescript
// Remove these lines from chat/route.ts and search/route.ts:
import { api } from "../../../../convex/_generated/api";
import { ConvexHttpClient } from "convex/browser";
```

4. Run `npx convex dev` to regenerate types

### 7.2 Update .env.example

Final environment variables:
```env
# Tinybird Analytics
TINYBIRD_API_URL=https://api.tinybird.co
TINYBIRD_INGEST_TOKEN=
TINYBIRD_READ_TOKEN=
NEXT_PUBLIC_TINYBIRD_API_URL=https://api.tinybird.co
NEXT_PUBLIC_TINYBIRD_READ_TOKEN=
```

---

## Implementation Checklist

### Phase 1: Tinybird Setup
- [ ] Create `tinybird/` folder
- [ ] Create `tinybird/datasources/events.datasource`
- [ ] Push to Tinybird local: `tb push --local`
- [ ] Generate tokens (or use local defaults)
- [ ] Add to `.env.local`
- [ ] Update `.env.example`

### Phase 2: Analytics Library
- [ ] Create `src/lib/analytics/` folder
- [ ] Create `src/lib/analytics/types.ts`
- [ ] Create `src/lib/analytics/tinybird.ts`
- [ ] Create `src/lib/analytics/index.ts`

### Phase 3: API Integration
- [ ] Update `src/app/api/chat/route.ts`
- [ ] Update `src/app/api/search/route.ts`
- [ ] Test logging works: make searches, check Tinybird

### Phase 4: Tinybird Pipes
- [ ] Create `tinybird/pipes/analytics_summary.pipe`
- [ ] Create `tinybird/pipes/popular_searches.pipe`
- [ ] Create `tinybird/pipes/popular_sources.pipe`
- [ ] Create `tinybird/pipes/recent_searches.pipe`
- [ ] Create `tinybird/pipes/no_result_searches.pipe`
- [ ] Push pipes: `tb push pipes/*.pipe --local`
- [ ] Test pipes return expected data

### Phase 5: Dashboard Migration
- [ ] Create `src/lib/analytics/queries.ts`
- [ ] Update `src/app/admin/analytics/analytics-content.tsx`
- [ ] Add NEXT_PUBLIC_TINYBIRD_* env vars
- [ ] Test dashboard loads with Tinybird data

### Phase 6: Validation
- [ ] Compare Convex and Tinybird data for 24-48 hours
- [ ] Verify all dashboard features work
- [ ] Check error handling (disable token, verify graceful failure)

### Phase 7: Cleanup
- [ ] Remove `convex/searchAnalytics.ts`
- [ ] Update `convex/schema.ts`
- [ ] Remove Convex imports from API routes
- [ ] Run `npx convex dev` to regenerate
- [ ] Final testing

---

## Future Enhancements (Optional)

These can be added later if needed:

### Client-Side Event Tracking
If you want to track interactions not tied to API calls:

```typescript
// src/lib/analytics/client.ts
export async function trackEvent(eventName: string, properties: Record<string, unknown>) {
  await fetch('/api/analytics/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventName, properties }),
  });
}
```

### Additional Events
| Event | Trigger | Properties |
|-------|---------|------------|
| `source_click` | Citation clicked | sourceId, sourceTitle, position |
| `report_view` | Report detail page | reportId, reportTitle |
| `pdf_download` | PDF downloaded | pdfId, pdfTitle |
| `filter_applied` | Filter changed | filterType, filterValue |

### Real-Time Dashboard
If real-time updates are needed (current Convex provides this), consider:
- Polling with short intervals (30s)
- Or keep Convex for real-time, Tinybird for historical

---

## Summary

This revised plan:
- **Simplifies** the implementation (no client-side provider, batching, or complex schema)
- **Maintains** the current server-side logging pattern
- **Preserves** the existing dashboard structure and data shape
- **Focuses** on the actual use case (search analytics for B2B app)
- **Provides** a clear migration path from Convex to Tinybird
