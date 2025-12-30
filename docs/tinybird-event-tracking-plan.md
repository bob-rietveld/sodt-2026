# Tinybird Event Tracking & Analytics Implementation Plan

## Overview

This plan outlines the implementation of a comprehensive event tracking system using Tinybird for the TechStaple platform. The focus is on **ingestion first**, with a uniform event format optimized for **public-facing analytics** where most visitors are anonymous (not logged in).

### Key Design Principles

1. **Anonymous-First**: Tracking works without authentication; user_id is optional enrichment
2. **Visitor Identification**: Persistent visitor ID via localStorage for cross-session tracking
3. **Session Tracking**: Session ID via sessionStorage for single-visit analysis
4. **Privacy-Compliant**: Hashed IPs, no PII, cookie-less identification option
5. **Public Page Focus**: Optimized for reports browse, report detail, search, and homepage

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

### 1.2 Define Uniform Event Schema (Anonymous-First)

Create a standardized event format optimized for anonymous public visitors:

```typescript
// src/lib/analytics/types.ts

export interface TinybirdEvent {
  // Core identifiers
  event_id: string;           // UUID for deduplication
  event_name: string;         // e.g., "report_view", "download_click", "search_query"
  event_category: string;     // e.g., "engagement", "navigation", "conversion"

  // Anonymous visitor identification (PRIMARY)
  visitor_id: string;         // Persistent ID stored in localStorage (cross-session)
  session_id: string;         // Session ID stored in sessionStorage (single visit)

  // Authenticated user (OPTIONAL - only when logged in)
  user_id: string | null;     // Clerk user ID (null for anonymous visitors)

  // Temporal
  timestamp: string;          // ISO 8601 format

  // Page context
  page_path: string;          // e.g., "/reports/abc123"
  page_title: string;         // e.g., "Annual Tech Report 2024"
  referrer: string | null;    // Previous page or external referrer

  // Marketing attribution
  utm_source: string | null;  // e.g., "google", "newsletter"
  utm_medium: string | null;  // e.g., "cpc", "email"
  utm_campaign: string | null; // e.g., "spring_2024"

  // Event-specific properties (flexible JSON)
  properties: Record<string, unknown>;

  // Device/browser context
  user_agent: string;
  device_type: string;        // "desktop", "mobile", "tablet"
  browser: string;            // "Chrome", "Firefox", etc.
  os: string;                 // "Windows", "macOS", "iOS", etc.
  screen_width: number;       // Viewport width
  screen_height: number;      // Viewport height

  // Privacy-safe location
  ip_hash: string;            // SHA-256 hashed IP
  country?: string;           // Derived from IP (optional, server-side)

  // Performance
  response_time_ms?: number;  // For timed events

  // Visit context
  is_new_visitor: boolean;    // First time seeing this visitor_id
  is_new_session: boolean;    // First event in this session
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
    `visitor_id` String,
    `session_id` String,
    `user_id` Nullable(String),
    `timestamp` DateTime64(3),
    `page_path` String,
    `page_title` String,
    `referrer` Nullable(String),
    `utm_source` Nullable(String),
    `utm_medium` Nullable(String),
    `utm_campaign` Nullable(String),
    `properties` String,  -- JSON string
    `user_agent` String,
    `device_type` String,
    `browser` String,
    `os` String,
    `screen_width` Int16,
    `screen_height` Int16,
    `ip_hash` String,
    `country` Nullable(String),
    `response_time_ms` Nullable(Int32),
    `is_new_visitor` UInt8,
    `is_new_session` UInt8

ENGINE "MergeTree"
ENGINE_PARTITION_KEY "toYYYYMM(timestamp)"
ENGINE_SORTING_KEY "timestamp, event_name, visitor_id"
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

### 2.2 Create Event Builder Utilities (Anonymous-First)

```typescript
// src/lib/analytics/event-builder.ts

import { TinybirdEvent } from './types';
import { v4 as uuidv4 } from 'uuid';
import {
  getVisitorId,
  getSessionId,
  getUTMParams,
  getScreenDimensions,
  parseUserAgent
} from './utils';

export function createEvent(
  eventName: string,
  category: string,
  properties: Record<string, unknown> = {},
  context?: Partial<TinybirdEvent>
): TinybirdEvent {
  const ua = typeof window !== 'undefined' ? window.navigator.userAgent : '';
  const parsed = parseUserAgent(ua);

  // Get anonymous visitor identifiers
  const { visitorId, isNew: isNewVisitor } = getVisitorId();
  const { sessionId, isNewSession } = getSessionId();
  const utmParams = getUTMParams();
  const screen = getScreenDimensions();

  return {
    event_id: uuidv4(),
    event_name: eventName,
    event_category: category,

    // Anonymous identification (primary)
    visitor_id: visitorId,
    session_id: sessionId,

    // Authenticated user (optional - set by provider)
    user_id: context?.user_id || null,

    timestamp: new Date().toISOString(),

    // Page context
    page_path: typeof window !== 'undefined' ? window.location.pathname : '',
    page_title: typeof document !== 'undefined' ? document.title : '',
    referrer: typeof document !== 'undefined' ? document.referrer || null : null,

    // Marketing attribution
    utm_source: utmParams.utm_source,
    utm_medium: utmParams.utm_medium,
    utm_campaign: utmParams.utm_campaign,

    // Event properties
    properties,

    // Device context
    user_agent: ua,
    device_type: parsed.deviceType,
    browser: parsed.browser,
    os: parsed.os,
    screen_width: screen.width,
    screen_height: screen.height,

    // Privacy-safe (set by server for API events)
    ip_hash: context?.ip_hash || '',

    // Performance
    response_time_ms: context?.response_time_ms,

    // Visit context
    is_new_visitor: isNewVisitor,
    is_new_session: isNewSession,

    // Allow overrides
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

### 2.3 Create Utility Functions (Anonymous Visitor Support)

```typescript
// src/lib/analytics/utils.ts

import { createHash } from 'crypto';

const VISITOR_KEY = 'ts_visitor_id';    // Persistent (localStorage)
const SESSION_KEY = 'ts_session_id';    // Per-session (sessionStorage)
const UTM_KEY = 'ts_utm_params';        // Persist UTM for session

// Visitor ID - persists across sessions (localStorage)
export function getVisitorId(): { visitorId: string; isNew: boolean } {
  if (typeof window === 'undefined') return { visitorId: '', isNew: false };

  let visitorId = localStorage.getItem(VISITOR_KEY);
  const isNew = !visitorId;

  if (!visitorId) {
    visitorId = crypto.randomUUID();
    localStorage.setItem(VISITOR_KEY, visitorId);
  }

  return { visitorId, isNew };
}

// Session ID - expires when browser closes (sessionStorage)
export function getSessionId(): { sessionId: string; isNewSession: boolean } {
  if (typeof window === 'undefined') return { sessionId: '', isNewSession: false };

  let sessionId = sessionStorage.getItem(SESSION_KEY);
  const isNewSession = !sessionId;

  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }

  return { sessionId, isNewSession };
}

// UTM Parameter extraction and persistence
export interface UTMParams {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term?: string | null;
  utm_content?: string | null;
}

export function getUTMParams(): UTMParams {
  if (typeof window === 'undefined') {
    return { utm_source: null, utm_medium: null, utm_campaign: null };
  }

  // Check if we have stored UTM params from landing
  const stored = sessionStorage.getItem(UTM_KEY);
  if (stored) {
    return JSON.parse(stored);
  }

  // Extract from current URL (landing page)
  const params = new URLSearchParams(window.location.search);
  const utmParams: UTMParams = {
    utm_source: params.get('utm_source'),
    utm_medium: params.get('utm_medium'),
    utm_campaign: params.get('utm_campaign'),
    utm_term: params.get('utm_term'),
    utm_content: params.get('utm_content'),
  };

  // Persist for the session if any UTM params found
  if (utmParams.utm_source || utmParams.utm_medium || utmParams.utm_campaign) {
    sessionStorage.setItem(UTM_KEY, JSON.stringify(utmParams));
  }

  return utmParams;
}

// Screen dimensions
export function getScreenDimensions(): { width: number; height: number } {
  if (typeof window === 'undefined') return { width: 0, height: 0 };
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
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

## Phase 3: React Integration Layer (Anonymous-First)

### 3.1 Create Analytics Provider & Context

The provider works **without requiring authentication** - it uses visitor_id as the primary identifier and optionally enriches with user_id when available.

```typescript
// src/lib/analytics/analytics-provider.tsx

'use client';

import React, { createContext, useContext, useEffect, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { tinybirdClient } from './tinybird-client';
import { createEvent, Events } from './event-builder';
import { TinybirdEvent } from './types';

interface AnalyticsContextValue {
  // Core tracking
  track: (eventName: string, category: string, properties?: Record<string, unknown>) => void;

  // Public page events (primary use case)
  trackReportView: (reportId: string, reportTitle: string, source?: string) => void;
  trackReportDownload: (reportId: string, reportTitle: string, format: string) => void;
  trackReportListView: (filters?: Record<string, string>) => void;
  trackSearch: (query: string, resultCount: number, searchType: 'agent' | 'chat') => void;
  trackSearchResultClick: (query: string, reportId: string, position: number) => void;

  // Interaction events
  trackClick: (elementId: string, elementText: string, location: string) => void;
  trackFilter: (filterType: string, filterValue: string) => void;
  trackSort: (sortField: string, sortDirection: 'asc' | 'desc') => void;
  trackPagination: (page: number, totalPages: number) => void;

  // Navigation
  trackPageView: () => void;

  // Errors
  trackError: (errorType: string, errorMessage: string, stack?: string) => void;

  // Optional: Set authenticated user (call when user logs in)
  setUserId: (userId: string | null) => void;
}

const AnalyticsContext = createContext<AnalyticsContextValue | null>(null);

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const userIdRef = useRef<string | null>(null);
  const lastPathRef = useRef<string>('');

  // Optional: Set user ID when authenticated (doesn't block tracking)
  const setUserId = useCallback((userId: string | null) => {
    userIdRef.current = userId;
  }, []);

  const enrichAndTrack = useCallback((event: TinybirdEvent) => {
    // Enrich with authenticated user if available (optional)
    const enrichedEvent = {
      ...event,
      user_id: userIdRef.current,
    };
    tinybirdClient.queue(enrichedEvent);
  }, []);

  const track = useCallback((
    eventName: string,
    category: string,
    properties: Record<string, unknown> = {}
  ) => {
    const event = createEvent(eventName, category, properties);
    enrichAndTrack(event);
  }, [enrichAndTrack]);

  // === PUBLIC PAGE TRACKING (Primary Use Case) ===

  const trackReportView = useCallback((reportId: string, reportTitle: string, source?: string) => {
    enrichAndTrack(Events.reportView(reportId, reportTitle, source));
  }, [enrichAndTrack]);

  const trackReportDownload = useCallback((reportId: string, reportTitle: string, format: string) => {
    enrichAndTrack(Events.reportDownload(reportId, reportTitle, format));
  }, [enrichAndTrack]);

  const trackReportListView = useCallback((filters?: Record<string, string>) => {
    track('report_list_view', 'engagement', { filters: filters || {} });
  }, [track]);

  const trackSearch = useCallback((query: string, resultCount: number, searchType: 'agent' | 'chat') => {
    enrichAndTrack(Events.searchQuery(query, resultCount, searchType));
  }, [enrichAndTrack]);

  const trackSearchResultClick = useCallback((query: string, reportId: string, position: number) => {
    track('search_result_click', 'engagement', { query, report_id: reportId, position });
  }, [track]);

  // === INTERACTION TRACKING ===

  const trackClick = useCallback((elementId: string, elementText: string, location: string) => {
    enrichAndTrack(Events.buttonClick(elementId, elementText, location));
  }, [enrichAndTrack]);

  const trackFilter = useCallback((filterType: string, filterValue: string) => {
    track('filter_applied', 'interaction', { filter_type: filterType, filter_value: filterValue });
  }, [track]);

  const trackSort = useCallback((sortField: string, sortDirection: 'asc' | 'desc') => {
    track('sort_changed', 'interaction', { sort_field: sortField, sort_direction: sortDirection });
  }, [track]);

  const trackPagination = useCallback((page: number, totalPages: number) => {
    track('pagination', 'interaction', { page, total_pages: totalPages });
  }, [track]);

  // === NAVIGATION ===

  const trackPageView = useCallback(() => {
    if (typeof window === 'undefined') return;
    enrichAndTrack(Events.pageView(window.location.pathname, document.title));
  }, [enrichAndTrack]);

  // === ERROR TRACKING ===

  const trackError = useCallback((errorType: string, errorMessage: string, stack?: string) => {
    enrichAndTrack(Events.error(errorType, errorMessage, stack));
  }, [enrichAndTrack]);

  // Auto-track page views on route changes
  useEffect(() => {
    if (pathname !== lastPathRef.current) {
      lastPathRef.current = pathname;
      // Small delay to ensure document.title is updated
      setTimeout(() => trackPageView(), 100);
    }
  }, [pathname, trackPageView]);

  const value: AnalyticsContextValue = {
    track,
    trackReportView,
    trackReportDownload,
    trackReportListView,
    trackSearch,
    trackSearchResultClick,
    trackClick,
    trackFilter,
    trackSort,
    trackPagination,
    trackPageView,
    trackError,
    setUserId,
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

// Optional hook to sync Clerk auth with analytics (use in authenticated areas)
export function useAuthenticatedAnalytics() {
  const { setUserId } = useAnalytics();

  // Call this with Clerk's userId when available
  const syncUser = useCallback((userId: string | null) => {
    setUserId(userId);
  }, [setUserId]);

  return { syncUser };
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

### 6.1 Add Provider to Root Layout (Outside Auth)

The AnalyticsProvider is placed **outside** the Clerk provider so it works for all visitors, authenticated or not.

```typescript
// src/app/layout.tsx

import { AnalyticsProvider } from '@/lib/analytics/analytics-provider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Analytics works for ALL visitors - no auth required */}
        <AnalyticsProvider>
          <ClerkProvider>
            <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
              {children}
            </ConvexProviderWithClerk>
          </ClerkProvider>
        </AnalyticsProvider>
      </body>
    </html>
  );
}
```

### 6.2 Optional: Sync Authenticated User

For pages where users are logged in, optionally sync the user ID:

```typescript
// src/components/auth-analytics-sync.tsx
'use client';

import { useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useAuthenticatedAnalytics } from '@/lib/analytics/analytics-provider';

export function AuthAnalyticsSync() {
  const { userId } = useAuth();
  const { syncUser } = useAuthenticatedAnalytics();

  useEffect(() => {
    syncUser(userId || null);
  }, [userId, syncUser]);

  return null;
}

// Add to authenticated layouts (e.g., admin layout)
// <AuthAnalyticsSync />
```

---

## Phase 7: Public Page Integration Examples

### 7.1 Reports Browse Page (`/reports`)

```typescript
// src/app/reports/reports-content.tsx
'use client';

import { useAnalytics } from '@/lib/analytics';
import { useEffect } from 'react';

export function ReportsContent() {
  const { trackReportListView, trackFilter, trackSort, trackPagination } = useAnalytics();

  // Track initial page load with current filters
  useEffect(() => {
    trackReportListView({ category: 'all', year: '2024' });
  }, []);

  const handleFilterChange = (filterType: string, value: string) => {
    trackFilter(filterType, value);
    // ... apply filter
  };

  const handleSortChange = (field: string, direction: 'asc' | 'desc') => {
    trackSort(field, direction);
    // ... apply sort
  };

  const handlePageChange = (page: number, totalPages: number) => {
    trackPagination(page, totalPages);
    // ... change page
  };

  return (/* ... */);
}
```

### 7.2 Report Detail Page (`/reports/[id]`)

```typescript
// src/app/reports/[id]/report-detail.tsx
'use client';

import { useAnalytics } from '@/lib/analytics';
import { useEffect } from 'react';

interface Props {
  report: { id: string; title: string };
  source?: string; // "search", "browse", "direct"
}

export function ReportDetail({ report, source }: Props) {
  const { trackReportView, trackReportDownload } = useAnalytics();

  // Track report view on mount
  useEffect(() => {
    trackReportView(report.id, report.title, source);
  }, [report.id]);

  const handleDownload = (format: 'pdf' | 'csv') => {
    trackReportDownload(report.id, report.title, format);
    // ... trigger download
  };

  return (/* ... */);
}
```

### 7.3 Search Page (`/search`)

```typescript
// src/app/search/search-content.tsx
'use client';

import { useAnalytics } from '@/lib/analytics';

export function SearchContent() {
  const { trackSearch, trackSearchResultClick } = useAnalytics();

  const handleSearch = async (query: string) => {
    const results = await performSearch(query);
    trackSearch(query, results.length, 'agent');
    return results;
  };

  const handleResultClick = (query: string, reportId: string, position: number) => {
    trackSearchResultClick(query, reportId, position);
    // ... navigate to report
  };

  return (/* ... */);
}
```

---

## Phase 8: Implementation Priority (Public-First)

### High Priority - Core Infrastructure
1. [ ] Set up Tinybird account and data source with anonymous-first schema
2. [ ] Create `src/lib/analytics/` with visitor ID support
3. [ ] Implement `AnalyticsProvider` (no auth dependency)
4. [ ] Add provider to root layout (outside ClerkProvider)
5. [ ] Implement automatic page view tracking

### High Priority - Public Page Events
6. [ ] Add `trackReportView` to report detail pages
7. [ ] Add `trackReportDownload` to download buttons
8. [ ] Add `trackReportListView` to reports browse page
9. [ ] Add filter/sort/pagination tracking to reports browse
10. [ ] Integrate with `/api/search` endpoint

### Medium Priority - Enhanced Tracking
11. [ ] Add `trackSearchResultClick` for search result interactions
12. [ ] Add UTM parameter capture on landing
13. [ ] Add scroll depth tracking for report pages
14. [ ] Create `TrackedButton` and `TrackedLink` components
15. [ ] Add homepage event tracking

### Lower Priority - Admin & Authenticated
16. [ ] Add `AuthAnalyticsSync` component for authenticated areas
17. [ ] Add admin action tracking (if needed)
18. [ ] Add error boundary tracking
19. [ ] Create Tinybird pipes for analytics dashboards

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

1. **Anonymous-First**: Works for all visitors without requiring authentication
2. **Cross-Session Tracking**: Persistent visitor_id enables return visitor analysis
3. **Session Analysis**: Session-based tracking for user journey analysis
4. **Marketing Attribution**: UTM parameter capture for campaign tracking
5. **Privacy-Compliant**: No cookies required, hashed IPs, GDPR-friendly
6. **Uniform Format**: All events follow the same schema for consistent analysis
7. **Easy Integration**: Drop-in hooks and components for public pages
8. **Batching**: Client-side events are batched to reduce API calls
9. **Type Safety**: Full TypeScript support throughout
10. **Optional Auth**: Can enrich with user_id when authenticated (but doesn't require it)

---

## Key Metrics Enabled

With this tracking in place, you can answer:

### Visitor Metrics
- How many unique visitors per day/week/month?
- What's the new vs returning visitor ratio?
- Average sessions per visitor?

### Content Engagement
- Which reports are most viewed?
- What's the average time on report pages?
- Which reports have the highest download rates?

### Search Behavior
- What are the most common search queries?
- What's the click-through rate on search results?
- Which searches lead to downloads?

### Funnel Analysis
- Browse → Report View → Download conversion rate
- Search → Click → Download conversion rate
- Landing page to engagement conversion

### Marketing Attribution
- Which UTM campaigns drive the most traffic?
- Which sources have the highest engagement?
- Campaign to conversion tracking
