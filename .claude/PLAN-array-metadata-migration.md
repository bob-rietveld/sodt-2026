# Plan: Migrate to Array-Based Metadata (Backwards Compatible)

## Overview

Currently, `keywords` and `technology_areas` are stored as comma-separated strings in Pinecone file metadata. This prevents using `$in` queries for filtering. We need to migrate to storing these as actual arrays while maintaining backwards compatibility with existing indexed documents.

## Current State

```typescript
// pinecone-index.ts (current)
if (pdf.keywords?.length) metadata.keywords = pdf.keywords.join(", ");
if (pdf.technologyAreas?.length) metadata.technology_areas = pdf.technologyAreas.join(", ");
```

**Result in Pinecone:**
```json
{
  "keywords": "AI, Machine Learning, Robotics",
  "technology_areas": "Semiconductors, Deep Tech"
}
```

## Target State

```typescript
// pinecone-index.ts (new)
if (pdf.keywords?.length) metadata.keywords = pdf.keywords;
if (pdf.technologyAreas?.length) metadata.technology_areas = pdf.technologyAreas;
```

**Result in Pinecone:**
```json
{
  "keywords": ["AI", "Machine Learning", "Robotics"],
  "technology_areas": ["Semiconductors", "Deep Tech"]
}
```

## Migration Strategy

### Phase 1: Update Metadata Type Definition

Update `FileMetadata` interface to support both string and string[] values:

```typescript
// src/lib/pinecone/client.ts
export interface FileMetadata {
  [key: string]: string | string[];
}
```

### Phase 2: Update Upload to Use Arrays

Modify `indexPdfToPineconeFromExtractedText` to store arrays:

```typescript
// src/lib/processing/pinecone-index.ts
const metadata: Record<string, string | string[]> = {
  convex_id: String(pdf._id),
  title: pdf.title || "",
  filename: pdf.filename || "",
};

// ... other fields ...

// Store as arrays instead of comma-separated strings
if (pdf.keywords?.length) metadata.keywords = pdf.keywords;
if (pdf.technologyAreas?.length) metadata.technology_areas = pdf.technologyAreas;
```

### Phase 3: Update Filter Builder for Hybrid Support

Modify `buildMetadataFilter` to handle array fields and support both old (string) and new (array) formats during transition:

```typescript
// src/lib/pinecone/client.ts
export interface ChatFilter {
  continent?: string;
  industry?: string;
  year?: number;
  company?: string;
  keywords?: string[];
  technologyAreas?: string[];
  fileIds?: string[];  // Legacy fallback
}

function buildMetadataFilter(filter?: ChatFilter): Record<string, unknown> | undefined {
  if (!filter) return undefined;

  const conditions: Record<string, unknown>[] = [];

  // Simple equality filters
  if (filter.continent) {
    conditions.push({ continent: { $eq: filter.continent } });
  }
  if (filter.industry) {
    conditions.push({ industry: { $eq: filter.industry } });
  }
  if (filter.year) {
    conditions.push({ year: { $eq: String(filter.year) } });
  }
  if (filter.company) {
    conditions.push({ company: { $eq: filter.company } });
  }

  // Array filters using $in - works with array metadata
  // For backwards compatibility with old string format, we use $in which:
  // - For array metadata: matches if any element is in the filter array
  // - For string metadata: won't match (need fallback or re-index)
  if (filter.keywords?.length) {
    conditions.push({ keywords: { $in: filter.keywords } });
  }
  if (filter.technologyAreas?.length) {
    conditions.push({ technology_areas: { $in: filter.technologyAreas } });
  }

  // Fallback to file ID filtering if no metadata filters
  if (conditions.length === 0 && filter.fileIds?.length) {
    return { id: { $in: filter.fileIds } };
  }

  if (conditions.length === 0) return undefined;
  if (conditions.length === 1) return conditions[0];
  return { $and: conditions };
}
```

### Phase 4: Update Chat API

```typescript
// src/app/api/chat/route.ts
const filter: ChatFilter | undefined = filters
  ? {
      continent: filters.continent,
      industry: filters.industry,
      year: filters.year,
      company: filters.company,
      keywords: filters.keywords,
      technologyAreas: filters.technologyAreas,
    }
  : undefined;
```

### Phase 5: Update Chat Page

```typescript
// src/app/chat/page.tsx
const response = await fetch("/api/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    message: userMessage,
    filters: hasActiveFilters
      ? {
          continent: filters.continent,
          industry: filters.industry,
          year: filters.year,
          keywords: filters.keywords,
          technologyAreas: filters.technologyAreas,
        }
      : undefined,
  }),
});
```

### Phase 6: Re-index Existing Documents

Create a re-indexing script or use existing reprocessing functionality to re-upload all documents with the new array format.

**Option A: Manual re-index via admin UI**
- Use existing reprocessing tools to re-index all documents
- Documents will be re-uploaded with array metadata

**Option B: Create migration script**
```typescript
// scripts/migrate-pinecone-metadata.ts
async function migrateAllDocuments() {
  // 1. Get all PDFs from Convex
  // 2. For each PDF with pineconeFileId:
  //    a. Delete old Pinecone file
  //    b. Re-upload with array metadata
  // 3. Update Convex with new pineconeFileId
}
```

## Backwards Compatibility During Transition

During the transition period (between Phase 2 and Phase 6):

1. **New uploads** will have array metadata → filtering works with `$in`
2. **Old documents** will have string metadata → `$in` won't match

**Hybrid approach during transition:**
- Use metadata filtering for new documents
- Keep file ID fallback for comprehensive results
- Display warning to user if filtering may be incomplete

```typescript
// Optional: Track metadata version
const metadata: Record<string, string | string[]> = {
  // ... other fields ...
  _metadata_version: "2",  // Track format version
};
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/pinecone/client.ts` | Update `FileMetadata` type, add array fields to `ChatFilter`, update `buildMetadataFilter` |
| `src/lib/processing/pinecone-index.ts` | Store keywords/technologyAreas as arrays |
| `src/app/api/chat/route.ts` | Pass array filter fields |
| `src/app/chat/page.tsx` | Send array filters directly |

## Implementation Order

1. **Phase 1-2**: Update types and upload logic (safe, only affects new uploads)
2. **Phase 3**: Update filter builder with hybrid support
3. **Phase 4-5**: Update API and UI to send array filters
4. **Phase 6**: Re-index all existing documents
5. **Cleanup**: Remove file ID fallback after all documents are re-indexed

## Testing Checklist

- [ ] New uploads store arrays in metadata
- [ ] Filtering by keywords works on new documents
- [ ] Filtering by technology areas works on new documents
- [ ] Old documents still appear in unfiltered results
- [ ] Hybrid filtering works during transition
- [ ] Re-indexing script/process works correctly
- [ ] All documents migrated successfully
- [ ] File ID fallback can be safely removed

## Rollback Plan

If issues arise:
1. Revert upload code to use comma-separated strings
2. Re-index affected documents
3. Keep file ID fallback in place

The changes are designed to be additive and non-breaking, so rollback should be straightforward.
