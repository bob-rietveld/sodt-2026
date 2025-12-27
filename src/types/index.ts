// Shared types for the application
// These match the Convex schema definitions
import type { Id } from "../../convex/_generated/dataModel";

// Lightweight type for browse/list views - excludes heavy fields like summary
// This is the minimal set of fields needed to display report cards/tables
export interface BrowseReport {
  _id: Id<"pdfs">;
  _creationTime?: number;
  title: string;
  company?: string;
  thumbnailUrl?: string;
  continent?: "us" | "eu" | "asia" | "global" | "other";
  industry?: "semicon" | "deeptech" | "biotech" | "fintech" | "cleantech" | "other";
  dateOrYear?: number | string;
  uploadedAt: number;
  technologyAreas?: string[];
  keywords?: string[];
}

export interface PDF {
  _id: Id<"pdfs">;
  title: string;
  filename: string;
  storageId?: string;
  driveFileId?: string;
  sourceUrl?: string;
  author?: string;
  description?: string;
  pageCount?: number;
  uploadedAt: number;
  status: "pending" | "processing" | "completed" | "failed";
  processingError?: string;
  weaviateId?: string;
  approved: boolean;
  approvedBy?: string;
  approvedAt?: number;
  source: "upload" | "drive" | "url";
  // Extracted metadata from Firecrawl
  company?: string;
  dateOrYear?: number | string;  // Year of publication (normalized to integer, string for migration)
  topic?: string;
  summary?: string;
  thumbnailUrl?: string;
  continent?: "us" | "eu" | "asia" | "global" | "other";
  industry?: "semicon" | "deeptech" | "biotech" | "fintech" | "cleantech" | "other";
  // Extended metadata (v2.0)
  documentType?: "pitch_deck" | "market_research" | "financial_report" | "white_paper" | "case_study" | "annual_report" | "investor_update" | "other";
  authors?: string[];
  keyFindings?: string[];
  keywords?: string[];
  technologyAreas?: string[];
  extractedAt?: number;
  extractionVersion?: string;
}

export interface ProcessingJob {
  _id: Id<"processingJobs">;
  pdfId: Id<"pdfs">;
  stage: "extracting" | "embedding" | "storing" | "completed" | "failed";
  startedAt: number;
  completedAt?: number;
  error?: string;
  metadata?: unknown;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
  timestamp: number;
}

export interface ChatSession {
  _id: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}
