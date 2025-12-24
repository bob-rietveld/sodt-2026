# Specification: Add ASC/DESC Sort Ordering for Reports

## Overview

The reports page currently allows users to sort by two date fields ("Recently Added" and "Published Date"), but both options only sort in descending order (newest first). This feature adds ascending/descending direction controls, giving users full control over sort order with 4 total combinations: Added Date (ASC/DESC) and Published Date (ASC/DESC).

## Workflow Type

**Type**: feature

**Rationale**: This is a new user-facing capability that extends existing sorting functionality. It requires changes to the UI component, state management, and backend query logic, but follows established patterns in the codebase.

## Task Scope

### Services Involved
- **main** (primary) - Next.js frontend with React components and Convex backend

### This Task Will:
- [ ] Extend the `SortOption` type to include sort direction
- [ ] Add ASC/DESC toggle controls to the sort selector UI
- [ ] Update the `SortableHeader` component in the table view to toggle direction
- [ ] Modify client-side sorting logic to respect sort direction
- [ ] Add `sortBy` and `sortDirection` parameters to `browseReportsPaginated` backend query
- [ ] Update backend sorting logic to support ascending order

### Out of Scope:
- Persisting sort preferences to user settings/localStorage
- Adding new sortable fields beyond "added" and "published"
- Modifying search result sorting (remains client-side)
- Admin panel sorting functionality

## Service Context

### Main Service

**Tech Stack:**
- Language: TypeScript
- Framework: Next.js (React)
- Backend: Convex (serverless functions)
- Styling: Tailwind CSS
- Key directories: `src/` (frontend), `convex/` (backend)

**Entry Point:** `src/app/reports/page.tsx`

**How to Run:**
```bash
npm run dev
```

**Port:** 3000

## Files to Modify

| File | Service | What to Change |
|------|---------|---------------|
| `src/components/reports/sort-selector.tsx` | main | Add sort direction toggle, extend `SortOption` type |
| `src/app/reports/reports-content.tsx` | main | Handle new sort direction state, pass to API calls, update client-side sorting |
| `src/components/reports/report-table.tsx` | main | Update `SortableHeader` to toggle direction, show direction indicator |
| `convex/pdfs.ts` | main | Add `sortBy`/`sortDirection` args to `browseReportsPaginated`, update sorting logic |

## Files to Reference

These files show patterns to follow:

| File | Pattern to Copy |
|------|----------------|
| `src/components/reports/view-toggle.tsx` | Toggle button UI pattern for mode switching |
| `src/components/reports/filter-panel.tsx` | Component styling and Tailwind patterns |
| `convex/pdfs.ts` | Existing query structure and validation patterns |

## Patterns to Follow

### Sort State Management Pattern

From `src/app/reports/reports-content.tsx`:

```typescript
const [sortBy, setSortBy] = useState<SortOption>("recently_added");
```

Extend to:
```typescript
type SortDirection = "asc" | "desc";
const [sortBy, setSortBy] = useState<SortField>("recently_added");
const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
```

**Key Points:**
- Keep separate state for field and direction for flexibility
- Default to descending (newest first) to maintain current behavior
- Pass both values to child components and API calls

### Client-Side Sorting Pattern

From `src/app/reports/reports-content.tsx`:

```typescript
if (sortBy === "recently_added") {
  results.sort((a, b) => b.uploadedAt - a.uploadedAt);
} else if (sortBy === "published_date") {
  results.sort((a, b) => getYear(b.dateOrYear) - getYear(a.dateOrYear));
}
```

Extend to support direction:
```typescript
const multiplier = sortDirection === "asc" ? 1 : -1;
if (sortBy === "recently_added") {
  results.sort((a, b) => multiplier * (a.uploadedAt - b.uploadedAt));
} else if (sortBy === "published_date") {
  results.sort((a, b) => multiplier * (getYear(a.dateOrYear) - getYear(b.dateOrYear)));
}
```

### Convex Query Argument Pattern

From `convex/pdfs.ts`:

```typescript
export const browseReportsPaginated = query({
  args: {
    continent: v.optional(...),
    // ...
  },
  handler: async (ctx, args) => {
    // ...
  },
});
```

**Key Points:**
- Use `v.optional()` for new parameters to maintain backward compatibility
- Use `v.union()` with `v.literal()` for enum-like values
- Apply validation before using in logic

## Requirements

### Functional Requirements

1. **Sort Direction Toggle**
   - Description: Users can toggle between ascending and descending order for each sort field
   - Acceptance: Clicking the sort direction control switches between ASC and DESC

2. **Sort by Added Date (ASC/DESC)**
   - Description: Sort reports by when they were uploaded to the system
   - Acceptance: ASC shows oldest first, DESC shows newest first

3. **Sort by Published Date (ASC/DESC)**
   - Description: Sort reports by their publication year/date
   - Acceptance: ASC shows oldest publications first, DESC shows newest first

4. **Table Header Sorting**
   - Description: Clicking sortable column headers toggles sort direction
   - Acceptance: First click sorts by that field descending, second click toggles to ascending, shows visual indicator

5. **Visual Direction Indicator**
   - Description: Show which direction is currently active
   - Acceptance: Up arrow for ASC, down arrow for DESC in both selector and table headers

### Edge Cases

1. **Reports without published date** - Treat missing `dateOrYear` as 0 for sorting purposes (places at end for DESC, start for ASC)
2. **Mixed date formats** - Use existing `getYear()` helper to normalize date values
3. **Pagination with sorting** - Server-side sorting must be consistent across pages
4. **Search results** - Client-side sorting applies after search filtering

## Implementation Notes

### DO
- Follow the existing toggle button styling from `view-toggle.tsx`
- Keep backward compatibility by defaulting to DESC (current behavior)
- Use the existing `SortableHeader` component pattern in `report-table.tsx`
- Add visual arrow indicators (↑/↓) to show current sort direction
- Reuse Tailwind classes from existing components for consistency

### DON'T
- Create a completely new sorting system - extend the existing one
- Remove the dropdown selector - add direction toggle alongside it
- Break existing pagination functionality
- Make direction a required parameter in the API (use optional with default)

## Development Environment

### Start Services

```bash
# Start the Next.js development server with Convex
npm run dev
```

### Service URLs
- Frontend: http://localhost:3000
- Reports Page: http://localhost:3000/reports

### Required Environment Variables
- `CONVEX_DEPLOYMENT`: Convex deployment identifier
- `NEXT_PUBLIC_CONVEX_URL`: Convex cloud URL

## Success Criteria

The task is complete when:

1. [ ] Sort selector includes direction toggle (ASC/DESC buttons or icons)
2. [ ] Clicking direction toggle changes sort order visually and functionally
3. [ ] Table view headers toggle direction when clicked repeatedly
4. [ ] Arrow icons indicate current sort direction in both selector and table
5. [ ] Server-side sorting respects direction for paginated results
6. [ ] Client-side sorting respects direction for search results
7. [ ] Default behavior remains descending (newest first)
8. [ ] No console errors
9. [ ] Existing tests still pass
10. [ ] New functionality verified via browser

## QA Acceptance Criteria

**CRITICAL**: These criteria must be verified by the QA Agent before sign-off.

### Unit Tests
| Test | File | What to Verify |
|------|------|----------------|
| SortSelector renders direction toggle | `src/components/reports/sort-selector.test.tsx` | Component renders ASC/DESC controls |
| SortSelector calls onSortChange with direction | `src/components/reports/sort-selector.test.tsx` | Callback includes direction value |
| Client-side sorting respects direction | `src/app/reports/reports-content.test.tsx` | ASC and DESC produce correct order |

### Integration Tests
| Test | Services | What to Verify |
|------|----------|----------------|
| browseReportsPaginated with sortDirection | frontend ↔ convex | Query accepts and uses sortDirection param |
| Pagination maintains sort order | frontend ↔ convex | Page 2 continues sort order from page 1 |

### End-to-End Tests
| Flow | Steps | Expected Outcome |
|------|-------|------------------|
| Toggle sort direction via selector | 1. Load /reports 2. Select "Published Date" 3. Toggle to ASC 4. Toggle to DESC | Reports reorder correctly each time |
| Toggle sort direction via table header | 1. Load /reports 2. Switch to table view 3. Click "Year" header twice | First click DESC, second click ASC |
| Sort persists across pagination | 1. Set sort to Published ASC 2. Navigate to page 2 | Page 2 continues ascending order |

### Browser Verification (if frontend)
| Page/Component | URL | Checks |
|----------------|-----|--------|
| Reports list page | `http://localhost:3000/reports` | Sort selector shows direction toggle |
| Reports table view | `http://localhost:3000/reports` (table view) | Headers show sort direction arrows |
| Sort functionality | `http://localhost:3000/reports` | Reports reorder when direction changes |

### Database Verification (if applicable)
| Check | Query/Command | Expected |
|-------|---------------|----------|
| N/A - No schema changes | N/A | N/A |

### QA Sign-off Requirements
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All E2E tests pass
- [ ] Browser verification complete
- [ ] Sort by Added Date (ASC) works correctly
- [ ] Sort by Added Date (DESC) works correctly
- [ ] Sort by Published Date (ASC) works correctly
- [ ] Sort by Published Date (DESC) works correctly
- [ ] Table header sorting toggles direction correctly
- [ ] Visual indicators (arrows) show correct direction
- [ ] Pagination maintains sort order
- [ ] Search results respect sort direction
- [ ] No regressions in existing functionality
- [ ] Code follows established patterns
- [ ] No security vulnerabilities introduced

## Technical Design

### Type Definitions

```typescript
// In sort-selector.tsx
export type SortField = "recently_added" | "published_date";
export type SortDirection = "asc" | "desc";

// Combined for convenience (optional approach)
export type SortOption = {
  field: SortField;
  direction: SortDirection;
};

// Or keep as string union if simpler
export type SortOptionLegacy =
  | "recently_added_desc"
  | "recently_added_asc"
  | "published_date_desc"
  | "published_date_asc";
```

### UI Design

```
Sort by: [Recently Added ▼] [↑↓]
         ─────────────────   ───
         Field dropdown     Direction toggle
```

Or integrated approach:
```
Sort by: [Recently Added ▼] [↓ Newest | ↑ Oldest]
```

### API Changes

```typescript
// convex/pdfs.ts - browseReportsPaginated
args: {
  // ... existing args
  sortBy: v.optional(v.union(
    v.literal("recently_added"),
    v.literal("published_date")
  )),
  sortDirection: v.optional(v.union(
    v.literal("asc"),
    v.literal("desc")
  )),
}
```
