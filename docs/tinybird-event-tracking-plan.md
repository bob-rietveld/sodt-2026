# Tinybird Event Tracking & Analytics Implementation Plan

## Overview

This plan outlines the implementation of a comprehensive event tracking system using Tinybird for the TechStaple platform. The focus is on **ingestion first**, with a uniform event format that makes it easy to track user-level events like clicks, report views, downloads, and more.

---

## Phase 1: Core Infrastructure (Ingestion Foundation)

### 1.1 Tinybird Setup & Configuration

**Tasks:**
- [ ] Create Tinybird account and workspace
- [ ] Generate API tokens (write token for ingestion, read token for queries)
- [ ] Add environment variables to `.env.local`:
  ```env
  TINYBIRD_API_URL=https://api.tinybird.co
  TINYBIRD_INGEST_TOKEN=<write_token>
  TINYBIRD_READ_TOKEN=<read_token>
  ```
- [ ] Add tokens to Vercel/production environment

### 1.2 Define Uniform Event Schema

Create a standardized event format that all events will follow:

```typescript
// src/lib/analytics/types.ts

export interface TinybirdEvent {
  // Core identifiers
  event_id: string;           // UUID for deduplication
  event_name: string;         // e.g., "report_view", "download_click", "search_query"
  event_category: string;     // e.g., "engagement", "navigation", "conversion"

  // User context
  user_id: string | null;     // Clerk user ID (null for anonymous)
  session_id: string;         // Browser session ID

  // Temporal
  timestamp: string;          // ISO 8601 format

  // Page context
  page_path: string;          // e.g., "/reports/abc123"
  page_title: string;         // e.g., "Annual Tech Report 2024"
  referrer: string | null;    // Previous page or external referrer

  // Event-specific properties (flexible JSON)
  properties: Record<string, unknown>;

  // Device/browser context
  user_agent: string;
  device_type: string;        // "desktop", "mobile", "tablet"
  browser: string;            // "Chrome", "Firefox", etc.
  os: string;                 // "Windows", "macOS", "iOS", etc.

  // Privacy-safe location
  ip_hash: string;            // SHA-256 hashed IP
  country?: string;           // Derived from IP (optional)

  // Performance
  response_time_ms?: number;  // For timed events
}
```

### 1.3 Create Tinybird Data Source

Define the data source in Tinybird (via CLI or UI):

```sql
-- events.datasource
SCHEMA >
    `event_id` String,
    `event_name` String,
    `event_category` String,
    `user_id` Nullable(String),
    `session_id` String,
    `timestamp` DateTime64(3),
    `page_path` String,
    `page_title` String,
    `referrer` Nullable(String),
    `properties` String,  -- JSON string
    `user_agent` String,
    `device_type` String,
    `browser` String,
    `os` String,
    `ip_hash` String,
    `country` Nullable(String),
    `response_time_ms` Nullable(Int32)

ENGINE "MergeTree"
ENGINE_PARTITION_KEY "toYYYYMM(timestamp)"
ENGINE_SORTING_KEY "timestamp, event_name, user_id"
ENGINE_TTL "timestamp + toIntervalDay(365)"
```

---

## Phase 2: Analytics Client Library

### 2.1 Create Analytics Client

```typescript
// src/lib/analytics/tinybird-client.ts

import { TinybirdEvent } from './types';
import { v4 as uuidv4 } from 'uuid';

class TinybirdClient {
  private apiUrl: string;
  private token: string;
  private eventQueue: TinybirdEvent[] = [];
  private flushInterval: number = 1000; // 1 second
  private maxBatchSize: number = 25;

  constructor() {
    this.apiUrl = process.env.TINYBIRD_API_URL || 'https://api.tinybird.co';
    this.token = process.env.TINYBIRD_INGEST_TOKEN || '';

    // Auto-flush queue periodically
    if (typeof window !== 'undefined') {
      setInterval(() => this.flush(), this.flushInterval);
      window.addEventListener('beforeunload', () => this.flush());
    }
  }

  async ingest(events: TinybirdEvent | TinybirdEvent[]): Promise<void> {
    const eventArray = Array.isArray(events) ? events : [events];

    const response = await fetch(`${this.apiUrl}/v0/events?name=events`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: eventArray.map(e => JSON.stringify({
        ...e,
        properties: JSON.stringify(e.properties),
      })).join('\n'),
    });

    if (!response.ok) {
      console.error('Tinybird ingestion failed:', await response.text());
    }
  }

  queue(event: TinybirdEvent): void {
    this.eventQueue.push(event);
    if (this.eventQueue.length >= this.maxBatchSize) {
      this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const events = [...this.eventQueue];
    this.eventQueue = [];

    try {
      await this.ingest(events);
    } catch (error) {
      console.error('Failed to flush events:', error);
      // Re-queue failed events (with limit to prevent infinite growth)
      if (this.eventQueue.length < 100) {
        this.eventQueue.push(...events);
      }
    }
  }
}

export const tinybirdClient = new TinybirdClient();
```

### 2.2 Create Event Builder Utilities

```typescript
// src/lib/analytics/event-builder.ts

import { TinybirdEvent } from './types';
import { v4 as uuidv4 } from 'uuid';
import { hashIP, parseUserAgent, getSessionId } from './utils';

export function createEvent(
  eventName: string,
  category: string,
  properties: Record<string, unknown> = {},
  context?: Partial<TinybirdEvent>
): TinybirdEvent {
  const ua = typeof window !== 'undefined' ? window.navigator.userAgent : '';
  const parsed = parseUserAgent(ua);

  return {
    event_id: uuidv4(),
    event_name: eventName,
    event_category: category,
    user_id: context?.user_id || null,
    session_id: getSessionId(),
    timestamp: new Date().toISOString(),
    page_path: typeof window !== 'undefined' ? window.location.pathname : '',
    page_title: typeof document !== 'undefined' ? document.title : '',
    referrer: typeof document !== 'undefined' ? document.referrer : null,
    properties,
    user_agent: ua,
    device_type: parsed.deviceType,
    browser: parsed.browser,
    os: parsed.os,
    ip_hash: context?.ip_hash || '',
    response_time_ms: context?.response_time_ms,
    ...context,
  };
}

// Pre-defined event creators for common events
export const Events = {
  // Engagement events
  reportView: (reportId: string, reportTitle: string, source?: string) =>
    createEvent('report_view', 'engagement', { report_id: reportId, report_title: reportTitle, source }),

  reportDownload: (reportId: string, reportTitle: string, format: string) =>
    createEvent('report_download', 'conversion', { report_id: reportId, report_title: reportTitle, format }),

  searchQuery: (query: string, resultCount: number, searchType: 'agent' | 'chat') =>
    createEvent('search_query', 'engagement', { query, result_count: resultCount, search_type: searchType }),

  // Click events
  buttonClick: (buttonId: string, buttonText: string, location: string) =>
    createEvent('button_click', 'interaction', { button_id: buttonId, button_text: buttonText, location }),

  linkClick: (href: string, linkText: string, location: string) =>
    createEvent('link_click', 'interaction', { href, link_text: linkText, location }),

  // Navigation events
  pageView: (pagePath: string, pageTitle: string) =>
    createEvent('page_view', 'navigation', { page_path: pagePath, page_title: pageTitle }),

  // Filter/sort events
  filterApplied: (filterType: string, filterValue: string, location: string) =>
    createEvent('filter_applied', 'interaction', { filter_type: filterType, filter_value: filterValue, location }),

  sortChanged: (sortField: string, sortDirection: 'asc' | 'desc', location: string) =>
    createEvent('sort_changed', 'interaction', { sort_field: sortField, sort_direction: sortDirection, location }),

  // Error events
  error: (errorType: string, errorMessage: string, stack?: string) =>
    createEvent('error', 'system', { error_type: errorType, error_message: errorMessage, stack }),
};
```

### 2.3 Create Utility Functions

```typescript
// src/lib/analytics/utils.ts

import { createHash } from 'crypto';

const SESSION_KEY = 'ts_session_id';

export function getSessionId(): string {
  if (typeof window === 'undefined') return '';

  let sessionId = sessionStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
}

export function hashIP(ip: string | null): string {
  if (!ip) return '';
  return createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

export function parseUserAgent(ua: string): {
  deviceType: string;
  browser: string;
  os: string;
} {
  // Mobile detection
  const isMobile = /Mobile|Android|iPhone|iPad|iPod/i.test(ua);
  const isTablet = /iPad|Android(?!.*Mobile)/i.test(ua);

  // Browser detection
  let browser = 'Unknown';
  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Edg')) browser = 'Edge';

  // OS detection
  let os = 'Unknown';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac OS')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iOS') || ua.includes('iPhone')) os = 'iOS';

  return {
    deviceType: isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop',
    browser,
    os,
  };
}
```

---

## Phase 3: React Integration Layer

### 3.1 Create Analytics Provider & Context

```typescript
// src/lib/analytics/analytics-provider.tsx

'use client';

import React, { createContext, useContext, useEffect, useCallback } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';
import { tinybirdClient } from './tinybird-client';
import { createEvent, Events } from './event-builder';
import { TinybirdEvent } from './types';

interface AnalyticsContextValue {
  track: (eventName: string, category: string, properties?: Record<string, unknown>) => void;
  trackReportView: (reportId: string, reportTitle: string, source?: string) => void;
  trackReportDownload: (reportId: string, reportTitle: string, format: string) => void;
  trackSearch: (query: string, resultCount: number, searchType: 'agent' | 'chat') => void;
  trackClick: (elementId: string, elementText: string, location: string) => void;
  trackPageView: () => void;
  trackError: (errorType: string, errorMessage: string, stack?: string) => void;
}

const AnalyticsContext = createContext<AnalyticsContextValue | null>(null);

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const { userId } = useAuth();

  const enrichAndTrack = useCallback((event: TinybirdEvent) => {
    // Enrich with user context
    const enrichedEvent = {
      ...event,
      user_id: userId || null,
    };
    tinybirdClient.queue(enrichedEvent);
  }, [userId]);

  const track = useCallback((
    eventName: string,
    category: string,
    properties: Record<string, unknown> = {}
  ) => {
    const event = createEvent(eventName, category, properties);
    enrichAndTrack(event);
  }, [enrichAndTrack]);

  // Pre-built tracking methods
  const trackReportView = useCallback((reportId: string, reportTitle: string, source?: string) => {
    enrichAndTrack(Events.reportView(reportId, reportTitle, source));
  }, [enrichAndTrack]);

  const trackReportDownload = useCallback((reportId: string, reportTitle: string, format: string) => {
    enrichAndTrack(Events.reportDownload(reportId, reportTitle, format));
  }, [enrichAndTrack]);

  const trackSearch = useCallback((query: string, resultCount: number, searchType: 'agent' | 'chat') => {
    enrichAndTrack(Events.searchQuery(query, resultCount, searchType));
  }, [enrichAndTrack]);

  const trackClick = useCallback((elementId: string, elementText: string, location: string) => {
    enrichAndTrack(Events.buttonClick(elementId, elementText, location));
  }, [enrichAndTrack]);

  const trackPageView = useCallback(() => {
    enrichAndTrack(Events.pageView(window.location.pathname, document.title));
  }, [enrichAndTrack]);

  const trackError = useCallback((errorType: string, errorMessage: string, stack?: string) => {
    enrichAndTrack(Events.error(errorType, errorMessage, stack));
  }, [enrichAndTrack]);

  // Auto-track page views on route changes
  useEffect(() => {
    trackPageView();
  }, [trackPageView]);

  const value: AnalyticsContextValue = {
    track,
    trackReportView,
    trackReportDownload,
    trackSearch,
    trackClick,
    trackPageView,
    trackError,
  };

  return (
    <AnalyticsContext.Provider value={value}>
      {children}
    </AnalyticsContext.Provider>
  );
}

export function useAnalytics(): AnalyticsContextValue {
  const context = useContext(AnalyticsContext);
  if (!context) {
    throw new Error('useAnalytics must be used within AnalyticsProvider');
  }
  return context;
}
```

### 3.2 Create Tracking Hooks

```typescript
// src/lib/analytics/hooks.ts

'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useAnalytics } from './analytics-provider';
import { usePathname } from 'next/navigation';

// Auto-track page views on route changes
export function usePageViewTracking() {
  const { trackPageView } = useAnalytics();
  const pathname = usePathname();

  useEffect(() => {
    trackPageView();
  }, [pathname, trackPageView]);
}

// Track time spent on page
export function useTimeOnPage() {
  const { track } = useAnalytics();
  const startTime = useRef(Date.now());
  const pathname = usePathname();

  useEffect(() => {
    startTime.current = Date.now();

    return () => {
      const timeSpent = Date.now() - startTime.current;
      track('time_on_page', 'engagement', {
        page_path: pathname,
        time_spent_ms: timeSpent,
        time_spent_seconds: Math.round(timeSpent / 1000),
      });
    };
  }, [pathname, track]);
}

// Track element visibility (for impressions)
export function useImpressionTracking(
  elementRef: React.RefObject<HTMLElement>,
  eventName: string,
  properties: Record<string, unknown>
) {
  const { track } = useAnalytics();
  const hasTracked = useRef(false);

  useEffect(() => {
    if (!elementRef.current || hasTracked.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasTracked.current) {
            hasTracked.current = true;
            track(eventName, 'impression', properties);
          }
        });
      },
      { threshold: 0.5 }
    );

    observer.observe(elementRef.current);
    return () => observer.disconnect();
  }, [elementRef, eventName, properties, track]);
}

// Create tracked click handler
export function useTrackedClick(
  elementId: string,
  elementText: string,
  location: string,
  onClick?: () => void
) {
  const { trackClick } = useAnalytics();

  return useCallback(() => {
    trackClick(elementId, elementText, location);
    onClick?.();
  }, [trackClick, elementId, elementText, location, onClick]);
}
```

### 3.3 Create Tracked Components

```typescript
// src/components/analytics/tracked-button.tsx

'use client';

import { Button, ButtonProps } from '@/components/ui/button';
import { useTrackedClick } from '@/lib/analytics/hooks';

interface TrackedButtonProps extends ButtonProps {
  trackingId: string;
  trackingLocation: string;
}

export function TrackedButton({
  trackingId,
  trackingLocation,
  children,
  onClick,
  ...props
}: TrackedButtonProps) {
  const trackedClick = useTrackedClick(
    trackingId,
    typeof children === 'string' ? children : trackingId,
    trackingLocation,
    onClick as () => void
  );

  return (
    <Button onClick={trackedClick} {...props}>
      {children}
    </Button>
  );
}
```

```typescript
// src/components/analytics/tracked-link.tsx

'use client';

import Link, { LinkProps } from 'next/link';
import { useAnalytics } from '@/lib/analytics/analytics-provider';
import { useCallback } from 'react';

interface TrackedLinkProps extends LinkProps {
  trackingLocation: string;
  children: React.ReactNode;
  className?: string;
}

export function TrackedLink({
  trackingLocation,
  children,
  onClick,
  ...props
}: TrackedLinkProps) {
  const { track } = useAnalytics();

  const handleClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    track('link_click', 'navigation', {
      href: props.href.toString(),
      link_text: typeof children === 'string' ? children : 'link',
      location: trackingLocation,
    });
    if (onClick) {
      onClick(e);
    }
  }, [track, props.href, children, trackingLocation, onClick]);

  return (
    <Link onClick={handleClick} {...props}>
      {children}
    </Link>
  );
}
```

---

## Phase 4: Server-Side Tracking (API Routes)

### 4.1 Create Server-Side Analytics Client

```typescript
// src/lib/analytics/server.ts

import { TinybirdEvent } from './types';
import { v4 as uuidv4 } from 'uuid';
import { headers } from 'next/headers';
import { createHash } from 'crypto';

class ServerAnalytics {
  private apiUrl: string;
  private token: string;

  constructor() {
    this.apiUrl = process.env.TINYBIRD_API_URL || 'https://api.tinybird.co';
    this.token = process.env.TINYBIRD_INGEST_TOKEN || '';
  }

  private hashIP(ip: string | null): string {
    if (!ip) return '';
    return createHash('sha256').update(ip).digest('hex').slice(0, 16);
  }

  private parseUserAgent(ua: string): { deviceType: string; browser: string; os: string } {
    const isMobile = /Mobile|Android|iPhone|iPad|iPod/i.test(ua);
    const isTablet = /iPad|Android(?!.*Mobile)/i.test(ua);

    let browser = 'Unknown';
    if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
    else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Edg')) browser = 'Edge';

    let os = 'Unknown';
    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac OS')) os = 'macOS';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iOS') || ua.includes('iPhone')) os = 'iOS';

    return {
      deviceType: isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop',
      browser,
      os,
    };
  }

  async track(
    eventName: string,
    category: string,
    properties: Record<string, unknown> = {},
    options: {
      userId?: string;
      sessionId?: string;
      pagePath?: string;
      pageTitle?: string;
      responseTimeMs?: number;
    } = {}
  ): Promise<void> {
    const headersList = await headers();
    const userAgent = headersList.get('user-agent') || '';
    const ip = headersList.get('x-forwarded-for') || headersList.get('x-real-ip');
    const referer = headersList.get('referer');
    const parsed = this.parseUserAgent(userAgent);

    const event: TinybirdEvent = {
      event_id: uuidv4(),
      event_name: eventName,
      event_category: category,
      user_id: options.userId || null,
      session_id: options.sessionId || '',
      timestamp: new Date().toISOString(),
      page_path: options.pagePath || '',
      page_title: options.pageTitle || '',
      referrer: referer,
      properties,
      user_agent: userAgent,
      device_type: parsed.deviceType,
      browser: parsed.browser,
      os: parsed.os,
      ip_hash: this.hashIP(ip),
      response_time_ms: options.responseTimeMs,
    };

    try {
      const response = await fetch(`${this.apiUrl}/v0/events?name=events`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...event,
          properties: JSON.stringify(event.properties),
        }),
      });

      if (!response.ok) {
        console.error('Tinybird ingestion failed:', await response.text());
      }
    } catch (error) {
      console.error('Failed to track event:', error);
    }
  }
}

export const serverAnalytics = new ServerAnalytics();
```

### 4.2 Integrate with Existing API Routes

Example integration with `/api/search`:

```typescript
// In src/app/api/search/route.ts

import { serverAnalytics } from '@/lib/analytics/server';

// After search completes:
await serverAnalytics.track('search_query', 'engagement', {
  query,
  result_count: results.length,
  search_type: 'agent',
  has_results: results.length > 0,
  sources: sources.map(s => s.title),
}, {
  responseTimeMs,
  pagePath: '/search',
});
```

---

## Phase 5: Event Catalog & Documentation

### 5.1 Define Standard Events

| Event Name | Category | Properties | Trigger |
|------------|----------|------------|---------|
| `page_view` | navigation | page_path, page_title | Page load |
| `report_view` | engagement | report_id, report_title, source | Report page viewed |
| `report_download` | conversion | report_id, report_title, format | Download clicked |
| `search_query` | engagement | query, result_count, search_type | Search submitted |
| `search_result_click` | engagement | query, result_position, report_id | Search result clicked |
| `filter_applied` | interaction | filter_type, filter_value, location | Filter changed |
| `sort_changed` | interaction | sort_field, sort_direction, location | Sort changed |
| `button_click` | interaction | button_id, button_text, location | Button clicked |
| `link_click` | navigation | href, link_text, location | Link clicked |
| `error` | system | error_type, error_message, stack | Error occurred |
| `upload_started` | conversion | file_name, file_size, file_type | Upload initiated |
| `upload_completed` | conversion | file_name, processing_time_ms | Upload finished |
| `chat_message_sent` | engagement | message_length, session_id | Chat message sent |
| `chat_response_received` | engagement | response_length, response_time_ms | Chat response |
| `export_initiated` | conversion | export_type, item_count | Export started |

### 5.2 Event Categories

- **navigation**: Page views, link clicks, route changes
- **engagement**: Content interaction, searches, views
- **interaction**: UI interactions (clicks, filters, sorts)
- **conversion**: High-value actions (downloads, uploads, exports)
- **system**: Errors, performance metrics

---

## Phase 6: Layout Integration

### 6.1 Add Provider to Root Layout

```typescript
// src/app/layout.tsx

import { AnalyticsProvider } from '@/lib/analytics/analytics-provider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClerkProvider>
          <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
            <AnalyticsProvider>
              {children}
            </AnalyticsProvider>
          </ConvexProviderWithClerk>
        </ClerkProvider>
      </body>
    </html>
  );
}
```

---

## Phase 7: Implementation Priority

### High Priority (Week 1)
1. [ ] Set up Tinybird account and data source
2. [ ] Create core analytics library (`src/lib/analytics/`)
3. [ ] Implement `AnalyticsProvider` and context
4. [ ] Add provider to root layout
5. [ ] Implement page view tracking

### Medium Priority (Week 2)
6. [ ] Add `trackReportView` to report pages
7. [ ] Add `trackReportDownload` to download buttons
8. [ ] Integrate with `/api/search` endpoint
9. [ ] Integrate with `/api/chat` endpoint
10. [ ] Add filter/sort tracking to reports browse page

### Lower Priority (Week 3+)
11. [ ] Create `TrackedButton` and `TrackedLink` components
12. [ ] Add upload event tracking
13. [ ] Add error boundary tracking
14. [ ] Add export event tracking
15. [ ] Create Tinybird pipes for analytics queries

---

## File Structure Summary

```
src/lib/analytics/
├── types.ts                 # TypeScript interfaces
├── tinybird-client.ts       # Browser client with batching
├── event-builder.ts         # Event creation utilities
├── utils.ts                 # Helper functions
├── analytics-provider.tsx   # React context provider
├── hooks.ts                 # Custom tracking hooks
├── server.ts                # Server-side analytics
└── index.ts                 # Barrel exports

src/components/analytics/
├── tracked-button.tsx       # Pre-tracked button component
├── tracked-link.tsx         # Pre-tracked link component
└── index.ts                 # Barrel exports
```

---

## Usage Examples

### Basic Event Tracking

```typescript
// In any component
import { useAnalytics } from '@/lib/analytics';

function MyComponent() {
  const { track, trackReportView } = useAnalytics();

  // Custom event
  track('custom_action', 'engagement', { custom_prop: 'value' });

  // Pre-defined event
  trackReportView('report-123', 'Annual Report 2024', 'search');
}
```

### Tracked Component

```typescript
import { TrackedButton } from '@/components/analytics';

<TrackedButton
  trackingId="download-pdf"
  trackingLocation="report-detail"
  onClick={handleDownload}
>
  Download PDF
</TrackedButton>
```

### Server-Side Tracking

```typescript
// In API route
import { serverAnalytics } from '@/lib/analytics/server';

await serverAnalytics.track('api_call', 'system', {
  endpoint: '/api/search',
  method: 'POST',
}, {
  responseTimeMs: 150,
  userId: 'user_123',
});
```

---

## Benefits of This Architecture

1. **Uniform Format**: All events follow the same schema, making analysis consistent
2. **User-Level Tracking**: Clerk user IDs are automatically attached to authenticated events
3. **Privacy-First**: IP addresses are hashed, user data is minimal
4. **Easy Integration**: Drop-in components and hooks for quick implementation
5. **Batching**: Client-side events are batched to reduce API calls
6. **Type Safety**: Full TypeScript support throughout
7. **Server & Client**: Works in both environments seamlessly
8. **Extensible**: Easy to add new event types via the `Events` object
