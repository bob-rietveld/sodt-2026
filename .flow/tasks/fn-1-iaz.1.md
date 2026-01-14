# fn-1-iaz.1 Fix Tinybird MCP server error in admin analytics

## Description
TBD

## Acceptance
- [ ] TBD

## Done summary
# Fix Summary

## Problem
Tinybird MCP server error when calling analytics AI

## Root Cause
1. MCP SDK version mismatch (1.9.0 installed vs ^1.25.1 required)
2. Using deprecated SSEClientTransport - Tinybird now only supports Streamable HTTP
3. Incorrect URL format (had /sse suffix)

## Changes Made
1. Updated @modelcontextprotocol/sdk to 1.25.2
2. Changed from SSEClientTransport to StreamableHTTPClientTransport
3. Fixed URL from https://mcp.tinybird.co/sse?token=X to https://mcp.tinybird.co?token=X
## Evidence
- Commits:
- Tests: npm run build
- PRs: