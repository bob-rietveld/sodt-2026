"use client";

import { useState, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Header } from "@/components/ui/header";

type UploadStatus = "idle" | "uploading" | "processing" | "completed" | "error";

// Calculate SHA-256 hash of file content
async function calculateFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function UploadContent() {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const generateUploadUrl = useMutation(api.pdfs.generateUploadUrl);
  const createPdf = useMutation(api.pdfs.create);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile?.type === "application/pdf") {
      setFile(droppedFile);
      if (!title) {
        setTitle(droppedFile.name.replace(".pdf", ""));
      }
    } else {
      setError("Please upload a PDF file");
    }
  }, [title]);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile?.type === "application/pdf") {
        setFile(selectedFile);
        if (!title) {
          setTitle(selectedFile.name.replace(".pdf", ""));
        }
        setError("");
      } else {
        setError("Please upload a PDF file");
      }
    },
    [title]
  );

  const handleUpload = async () => {
    if (!file || !title) {
      setError("Please select a file and provide a title");
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
          const uploadDate = duplicateResult.existingPdf?.uploadedAt
            ? new Date(duplicateResult.existingPdf.uploadedAt).toLocaleDateString()
            : "unknown date";
          setError(`This file has already been uploaded as "${existingTitle}" on ${uploadDate}`);
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

      // Create PDF record with hash for duplicate detection
      const pdfId = await createPdf({
        title,
        filename: file.name,
        fileHash,
        storageId,
        source: "upload",
        description: description || undefined,
      });

      setStatus("processing");

      // Trigger processing
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

  return (
    <div className="min-h-screen bg-background">
      <Header showAdmin={true} />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-semibold mb-8">Upload PDF (Admin)</h1>

        {/* Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
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
              placeholder="Document title"
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
              placeholder="Brief description of the document"
              rows={3}
              className="w-full px-4 py-3 rounded-lg border border-foreground/20 bg-white focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            />
          </div>

          {error && (
            <div className="p-4 bg-danger/10 text-danger rounded-lg">{error}</div>
          )}

          {status === "completed" && (
            <div className="p-4 bg-success/10 text-success rounded-lg">
              Upload successful! Your document is being processed.
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={!file || !title || status === "uploading" || status === "processing"}
            className="w-full py-4 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {status === "uploading"
              ? "Uploading..."
              : status === "processing"
                ? "Processing..."
                : "Upload Document"}
          </button>
        </div>
      </main>
    </div>
  );
}
