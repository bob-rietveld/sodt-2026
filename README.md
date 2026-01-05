# SODT App

A document management and search application with semantic search powered by Pinecone Assistant.

## Features

- PDF document upload and management
- Automatic metadata extraction using Firecrawl and Anthropic
- Semantic search and chat with documents via Pinecone Assistant
- Document approval workflow
- Google Drive integration for document import
- Admin dashboard for document management

## Prerequisites

- Node.js 18+
- Convex account (for database)
- Pinecone account with Assistant enabled
- Clerk account (for authentication)
- Firecrawl API key (for metadata extraction)
- Anthropic API key (for metadata extraction)

## Environment Variables

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

### Required Variables

| Variable | Description |
|----------|-------------|
| `PINECONE_API_KEY` | Pinecone API key for document indexing and chat |
| `FIRECRAWL_API_KEY` | Firecrawl API key for PDF metadata extraction |
| `ANTHROPIC_API_KEY` | Anthropic API key for metadata extraction |
| `CONVEX_DEPLOYMENT` | Convex deployment ID (set by Convex CLI) |
| `NEXT_PUBLIC_CONVEX_URL` | Convex URL (set by Convex CLI) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `CLERK_SECRET_KEY` | Clerk secret key |

## Pinecone Assistant Setup

1. Create a Pinecone account at [pinecone.io](https://www.pinecone.io/)
2. Navigate to Assistants in the Pinecone console
3. Create a new assistant named `sodt-2026`
4. Copy your API key to `PINECONE_API_KEY`

The assistant handles:
- Document file upload and indexing
- Semantic search across documents
- Chat with citations from uploaded documents

## Installation

```bash
# Install dependencies
npm install

# Start Convex dev server (in a separate terminal)
npm run convex:dev

# Start the development server
npm run dev
```

## Development

```bash
# Run development server
npm run dev

# Run Convex dev server
npm run convex:dev

# Build for production
npm run build

# Start production server
npm start
```

## Architecture

### Document Processing Pipeline

1. **Upload**: PDF is uploaded and stored in Convex
2. **Thumbnail**: Preview image generated from first page
3. **Metadata Extraction**: Firecrawl + Anthropic extract title, company, summary, etc.
4. **Indexing**: PDF is uploaded to Pinecone Assistant for search

### Chat Flow

1. User sends a message
2. Message is sent to Pinecone Assistant
3. Assistant searches indexed documents
4. Response includes citations to source documents
5. Streaming response displayed in UI

### Key Files

- `src/lib/pinecone/client.ts` - Pinecone Assistant client
- `src/app/api/chat/route.ts` - Chat API endpoint
- `src/app/api/pinecone/upload/route.ts` - File upload to Pinecone
- `convex/pdfs.ts` - Document CRUD operations
- `convex/chat.ts` - Chat session management

## License

Proprietary
