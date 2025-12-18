// Shared types for the application
// These match the Convex schema definitions

export interface PDF {
  _id: string;
  title: string;
  filename: string;
  storageId?: string;
  driveFileId?: string;
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
  source: "upload" | "drive";
}

export interface ProcessingJob {
  _id: string;
  pdfId: string;
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
