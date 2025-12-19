// Shared types for the application
// These match the Convex schema definitions
import type { Id } from "../../convex/_generated/dataModel";

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
  dateOrYear?: string;
  topic?: string;
  summary?: string;
  thumbnailUrl?: string;
  continent?: "us" | "eu" | "asia" | "global" | "other";
  industry?: "semicon" | "deeptech" | "biotech" | "fintech" | "cleantech" | "other";
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
