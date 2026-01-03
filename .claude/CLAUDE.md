# TechStaple - AI Document Intelligence Platform

## Project Overview

TechStaple is an AI-powered document intelligence platform for Dutch tech ecosystem reports. It enables users to search, analyze, and chat with integrated PDF documents. The tagline: "All the Reports, Stapled Together."

## Tech Stack

### Frontend
- **Next.js 16** with App Router and Turbopack
- **React 19** with TypeScript
- **Tailwind CSS 4** for styling
- **Clerk** for authentication

### Backend
- **Convex** - Serverless database and backend functions
- **Anthropic Claude** - LLM for chat and analysis
- **Voyage AI** - Vector embeddings
- **Weaviate** - Vector database for semantic search
- **Firecrawl** - PDF metadata extraction
- **Unstructured** - PDF text extraction

## Directory Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes (chat, search, PDF processing)
│   ├── admin/             # Protected admin dashboard
│   ├── reports/           # Report browsing and details
│   ├── search/            # Semantic search page
│   ├── chat/              # AI chat interface
│   └── upload/            # PDF upload
├── components/            # React components
│   ├── ui/               # Reusable UI components
│   ├── providers/        # Context providers (Convex, Clerk)
│   ├── admin/            # Admin-specific components
│   └── reports/          # Report display components
├── lib/                   # Utility libraries
│   ├── processing/       # PDF processing pipeline
│   ├── weaviate/         # Vector search client
│   ├── voyage/           # Embedding client
│   ├── firecrawl/        # Metadata extraction
│   ├── unstructured/     # Text extraction
│   └── google/           # Drive integration
├── hooks/                 # Custom React hooks
└── types/                 # TypeScript interfaces

convex/                    # Backend functions
├── schema.ts             # Database schema
├── pdfs.ts               # PDF CRUD operations
├── chat.ts               # Chat session management
├── pdfWorkpool.ts        # Processing task queue
├── processing.ts         # Job tracking
└── searchAnalytics.ts    # Analytics logging
```

## Key Commands

```bash
# Development
npm run dev              # Start Next.js dev server with Turbopack
npm run convex:dev       # Start Convex development backend

# Production
npm run build            # Build for production
npm run start            # Start production server
npm run convex:deploy    # Deploy Convex functions

# Code Quality
npm run lint             # Run ESLint
```

## Database Schema (Convex)

### Core Tables
- **pdfs** - Document storage with metadata, status, and approval workflow
- **processingJobs** - Track extraction → embedding → storage stages
- **chatSessions** - Conversation history with sources
- **settings** - Key-value configuration
- **searchQueries** - Analytics logging

### Key Indexes
- `pdfs`: by_status, by_approved, by_drive_file, by_file_hash, by_document_type
- Search indexes on: title, summary, author, company

## Code Patterns

### Component Architecture
- Server/Client split with explicit "use client" directives
- Content separation: `*-content.tsx` for logic, pages for layout
- Custom hooks for state management (e.g., `useUrlFilters`)

### API Routes
- Located in `src/app/api/`
- Consistent JSON error responses
- Clerk middleware for protected routes

### Data Patterns
- Server-side pagination with Convex `paginationOptsValidator`
- Browse endpoints exclude heavy fields (summary) for performance
- SHA-256 hashing for duplicate detection and privacy

## Environment Variables

```bash
# Frontend
NEXT_PUBLIC_CONVEX_URL=

# AI/ML Services
ANTHROPIC_API_KEY=
VOYAGE_API_KEY=
WEAVIATE_URL=
WEAVIATE_API_KEY=
FIRECRAWL_API_KEY=
UNSTRUCTURED_API_KEY=

# Auth & Integrations
CLERK_SECRET_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
APP_URL=  # For Convex processing callbacks
```

## Key Workflows

### PDF Processing Pipeline
1. Upload/import from Google Drive/URL
2. Duplicate detection via SHA-256 hash
3. Metadata extraction with Firecrawl + Claude
4. Text extraction with Unstructured (page-level chunking)
5. Vector embedding with Voyage AI
6. Storage in Weaviate for semantic search

### Search
- Hybrid vector + keyword search via Weaviate
- Agent-based Q&A with QueryAgent
- Analytics tracking for insights

### Chat
- Claude-powered responses with document context
- Source attribution to original PDFs
- Persistent sessions in Convex

## Styling

Custom Tailwind theme:
- **Primary**: #fd5924 (TechLeap Orange)
- **Secondary**: #512986 (Indigo Purple)
- **Background**: #f6f6f3 (Cream)
- **Foreground**: #242424 (Dark Grey)
- **Fonts**: Fira Sans (sans), Fira Mono (mono)

## Protected Routes

Admin routes (`/admin/*`) require Clerk authentication via middleware.

## Performance Considerations

- Exclude `summary` field from browse queries to reduce data transfer
- Server-side pagination (15 items default)
- Batch processing with maxParallelism: 1 for stability
- Singleton patterns for external clients
- Voyage AI batching (128 items/request)
