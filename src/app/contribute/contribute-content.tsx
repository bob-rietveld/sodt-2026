"use client";

import { useState, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Header } from "@/components/ui/header";

// Constants
const MAX_FILE_SIZE_MB = 50;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

type UploadStatus = "idle" | "uploading" | "processing" | "completed" | "error";

// Calculate SHA-256 hash of file content
async function calculateFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function ContributeContent() {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const generateUploadUrl = useMutation(api.pdfs.generateUploadUrl);
  const createPdf = useMutation(api.pdfs.create);

  // File validation with 50MB limit
  const validateFile = (selectedFile: File): string | null => {
    if (selectedFile.type !== "application/pdf") {
      return "Please upload a PDF file";
    }
    if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
      return `File size must be less than ${MAX_FILE_SIZE_MB}MB. Your file is ${(selectedFile.size / 1024 / 1024).toFixed(1)}MB.`;
    }
    return null;
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        const validationError = validateFile(droppedFile);
        if (validationError) {
          setError(validationError);
          return;
        }
        setFile(droppedFile);
        if (!title) {
          setTitle(droppedFile.name.replace(".pdf", ""));
        }
        setError("");
      }
    },
    [title]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) {
        const validationError = validateFile(selectedFile);
        if (validationError) {
          setError(validationError);
          return;
        }
        setFile(selectedFile);
        if (!title) {
          setTitle(selectedFile.name.replace(".pdf", ""));
        }
        setError("");
      }
    },
    [title]
  );

  const handleUpload = async () => {
    if (!file || !title) {
      setError("Please select a file and provide a title");
      return;
    }

    // Double-check file size before upload
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError(`File size must be less than ${MAX_FILE_SIZE_MB}MB`);
      return;
    }

    setStatus("uploading");
    setError("");

    try {
      // Calculate file hash and check for duplicates
      const fileHash = await calculateFileHash(file);

      const duplicateCheckResponse = await fetch("/api/check-duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileHash }),
      });

      if (duplicateCheckResponse.ok) {
        const duplicateResult = await duplicateCheckResponse.json();
        if (duplicateResult.isDuplicate) {
          const existingTitle = duplicateResult.existingPdf?.title || "Unknown";
          setError(`This report already exists: "${existingTitle}"`);
          setStatus("error");
          return;
        }
      }

      // Get upload URL from Convex
      const uploadUrl = await generateUploadUrl();

      // Upload file to Convex storage
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!response.ok) throw new Error("Failed to upload file");

      const { storageId } = await response.json();

      // Create PDF record with source: "user-contributed"
      const pdfId = await createPdf({
        title,
        filename: file.name,
        fileHash,
        storageId,
        source: "user-contributed",
        description: description || undefined,
      });

      setStatus("processing");

      // Trigger processing (same pipeline as admin uploads)
      const processResponse = await fetch("/api/process-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pdfId,
          fileUrl: uploadUrl,
          filename: file.name,
          title,
        }),
      });

      if (!processResponse.ok) {
        console.warn("Processing started but may need manual trigger");
      }

      setStatus("completed");
      setFile(null);
      setTitle("");
      setDescription("");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  };

  const resetForm = () => {
    setFile(null);
    setTitle("");
    setDescription("");
    setStatus("idle");
    setError("");
  };

  return (
    <div className="min-h-screen bg-background">
      <Header showAdmin={false} />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-semibold mb-2">Contribute a Report</h1>
          <p className="text-foreground/70 text-sm sm:text-base">
            Missing a report? Upload it here to help grow our database.
          </p>
          <p className="text-xs sm:text-sm text-foreground/50 mt-1">
            Contributions are reviewed before being made public.
          </p>
        </div>

        {status === "completed" ? (
          <div className="text-center">
            <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-success"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold mb-2">Thank you!</h2>
            <p className="text-foreground/70 mb-6">
              Your contribution has been submitted and is being processed.
              <br />
              It will be reviewed by our team before being made public.
            </p>
            <button
              onClick={resetForm}
              className="px-6 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              Submit Another Report
            </button>
          </div>
        ) : (
          <>
            {/* Drop Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-8 sm:p-12 text-center transition-colors ${
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-foreground/20 hover:border-primary/50"
              }`}
            >
              {file ? (
                <div>
                  <svg
                    className="w-12 h-12 text-success mx-auto mb-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-foreground/50 mt-1">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <button
                    onClick={() => setFile(null)}
                    className="mt-4 text-sm text-danger hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div>
                  <svg
                    className="w-12 h-12 text-foreground/30 mx-auto mb-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  <p className="text-foreground/70 mb-2">
                    Drag and drop a PDF file here, or
                  </p>
                  <label className="cursor-pointer text-primary hover:underline">
                    browse files
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </label>
                  <p className="text-xs sm:text-sm text-foreground/50 mt-3">
                    PDF files up to {MAX_FILE_SIZE_MB}MB
                  </p>
                </div>
              )}
            </div>

            {/* Metadata Form */}
            <div className="mt-8 space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Title <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Report title"
                  className="w-full px-4 py-3 rounded-lg border border-foreground/20 bg-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of the report"
                  rows={3}
                  className="w-full px-4 py-3 rounded-lg border border-foreground/20 bg-white focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                />
              </div>

              {error && (
                <div className="p-4 bg-danger/10 text-danger rounded-lg text-sm sm:text-base">
                  {error}
                </div>
              )}

              <button
                onClick={handleUpload}
                disabled={!file || !title || status === "uploading" || status === "processing"}
                className="w-full py-4 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === "uploading"
                  ? "Uploading..."
                  : status === "processing"
                    ? "Processing..."
                    : "Submit Contribution"}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
