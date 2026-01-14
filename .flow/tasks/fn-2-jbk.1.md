# fn-2-jbk.1 Investigate and fix PDF thumbnail 503 error

## Description
TBD

## Acceptance
- [ ] TBD

## Done summary
# PDF Thumbnail Fix

## Problem
503 error when generating PDF thumbnails

## Root Cause
pdfjs-dist 5.x modern build requires browser APIs (DOMMatrix, Path2D, ImageData) that don't exist in Node.js/serverless environments.

## Solution
Use the legacy build of pdfjs-dist which is compatible with Node.js:
- Changed import from 'pdfjs-dist' to 'pdfjs-dist/legacy/build/pdf.mjs'

## Files Changed
- src/lib/pdf/thumbnail.ts (line 15)
## Evidence
- Commits:
- Tests: curl test
- PRs: