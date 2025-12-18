"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { PDF } from "@/types";

type StatusFilter = "all" | "pending" | "processing" | "completed" | "failed";
type UploadMode = "file" | "url";

export default function PdfsContent() {
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [editingId, setEditingId] = useState<Id<"pdfs"> | null>(null);
  const [editForm, setEditForm] = useState({ title: "", description: "" });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadMode, setUploadMode] = useState<UploadMode>("file");
  const [pdfUrl, setPdfUrl] = useState("");

  const pdfs = useQuery(
    api.pdfs.list,
    filter === "all" ? {} : { status: filter as "pending" | "processing" | "completed" | "failed" }
  );

  const generateUploadUrl = useMutation(api.pdfs.generateUploadUrl);
  const createPdf = useMutation(api.pdfs.create);
  const updatePdf = useMutation(api.pdfs.update);
  const removePdf = useMutation(api.pdfs.remove);
  const approvePdf = useMutation(api.pdfs.approve);

  const handleUpload = useCallback(async (file: File) => {
    if (!file.name.endsWith(".pdf")) {
      alert("Please select a PDF file");
      return;
    }

    setIsUploading(true);
    setUploadProgress("Uploading file...");

    try {
      // Step 1: Get upload URL from Convex
      const uploadUrl = await generateUploadUrl();

      // Step 2: Upload file to Convex storage
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!result.ok) {
        throw new Error("Failed to upload file");
      }

      const { storageId } = await result.json();

      // Step 3: Create PDF record in Convex
      setUploadProgress("Creating PDF record...");
      const title = file.name.replace(".pdf", "");
      const pdfId = await createPdf({
        title,
        filename: file.name,
        storageId,
        source: "upload",
      });

      // Step 4: Kick off processing pipeline
      setUploadProgress("Starting processing pipeline...");
      const processResponse = await fetch("/api/process-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfId, storageId }),
      });

      if (!processResponse.ok) {
        console.error("Processing failed to start, but PDF was uploaded");
      }

      setUploadProgress("Upload complete! Processing started.");
      setTimeout(() => setUploadProgress(null), 3000);
    } catch (error) {
      console.error("Upload error:", error);
      setUploadProgress(`Error: ${error instanceof Error ? error.message : "Upload failed"}`);
      setTimeout(() => setUploadProgress(null), 5000);
    } finally {
      setIsUploading(false);
    }
  }, [generateUploadUrl, createPdf]);

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!pdfUrl.trim()) {
      alert("Please enter a URL");
      return;
    }

    // Basic URL validation
    try {
      new URL(pdfUrl);
    } catch {
      alert("Please enter a valid URL");
      return;
    }

    setIsUploading(true);
    setUploadProgress("Fetching PDF from URL...");

    try {
      // Call API to process PDF from URL
      const response = await fetch("/api/process-pdf-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: pdfUrl }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to process PDF from URL");
      }

      setUploadProgress("PDF fetched! Processing started.");
      setPdfUrl("");
      setTimeout(() => setUploadProgress(null), 3000);
    } catch (error) {
      console.error("URL processing error:", error);
      setUploadProgress(`Error: ${error instanceof Error ? error.message : "Processing failed"}`);
      setTimeout(() => setUploadProgress(null), 5000);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleUpload(file);
    }
    e.target.value = "";
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleUpload(file);
    }
  }, [handleUpload]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleEdit = (pdf: PDF) => {
    setEditingId(pdf._id);
    setEditForm({
      title: pdf.title,
      description: pdf.description || "",
    });
  };

  const handleSave = async () => {
    if (!editingId) return;
    await updatePdf({
      id: editingId,
      title: editForm.title,
      description: editForm.description || undefined,
    });
    setEditingId(null);
  };

  const handleDelete = async (id: Id<"pdfs">) => {
    if (confirm("Are you sure you want to delete this document?")) {
      await removePdf({ id });
    }
  };

  const handleReprocess = async (id: Id<"pdfs">) => {
    try {
      const response = await fetch("/api/process-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfId: id, action: "reprocess" }),
      });
      if (response.ok) {
        alert("Reprocessing started");
      }
    } catch (error) {
      console.error("Reprocess error:", error);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-semibold">PDF Management</h1>

        {/* Filter */}
        <div className="flex items-center gap-2">
          {(["all", "pending", "processing", "completed", "failed"] as const).map(
            (status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === status
                    ? "bg-primary text-white"
                    : "bg-white text-foreground/70 hover:bg-foreground/5"
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            )
          )}
        </div>
      </div>

      {/* Upload Mode Toggle */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setUploadMode("file")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            uploadMode === "file"
              ? "bg-secondary text-white"
              : "bg-white text-foreground/70 hover:bg-foreground/5 border border-foreground/10"
          }`}
        >
          Upload File
        </button>
        <button
          onClick={() => setUploadMode("url")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            uploadMode === "url"
              ? "bg-secondary text-white"
              : "bg-white text-foreground/70 hover:bg-foreground/5 border border-foreground/10"
          }`}
        >
          From URL
        </button>
      </div>

      {/* Upload Section */}
      {uploadMode === "file" ? (
        <div
          className={`mb-8 p-8 border-2 border-dashed rounded-xl transition-colors ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-foreground/20 bg-white"
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <div className="text-center">
            <svg
              className="w-12 h-12 mx-auto mb-4 text-foreground/30"
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
            {uploadProgress ? (
              <p className="text-foreground/70">{uploadProgress}</p>
            ) : (
              <>
                <p className="text-foreground/70 mb-2">
                  Drag and drop a PDF file here, or
                </p>
                <label className="inline-block">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileSelect}
                    disabled={isUploading}
                    className="hidden"
                  />
                  <span className="px-6 py-2 bg-primary text-white rounded-lg font-medium cursor-pointer hover:bg-primary/90 transition-colors">
                    {isUploading ? "Uploading..." : "Select PDF"}
                  </span>
                </label>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="mb-8 p-8 bg-white border border-foreground/10 rounded-xl">
          <form onSubmit={handleUrlSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground/70 mb-2">
                PDF URL
              </label>
              <input
                type="url"
                value={pdfUrl}
                onChange={(e) => setPdfUrl(e.target.value)}
                placeholder="https://example.com/document.pdf"
                disabled={isUploading}
                className="w-full px-4 py-3 border border-foreground/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
              />
              <p className="mt-2 text-sm text-foreground/50">
                Enter the direct URL to a PDF file. The file will be fetched and processed.
              </p>
            </div>
            {uploadProgress ? (
              <p className="text-foreground/70">{uploadProgress}</p>
            ) : (
              <button
                type="submit"
                disabled={isUploading || !pdfUrl.trim()}
                className="px-6 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? "Processing..." : "Fetch & Process PDF"}
              </button>
            )}
          </form>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-foreground/10 overflow-hidden">
        <table className="w-full">
          <thead className="bg-foreground/5">
            <tr>
              <th className="text-left px-6 py-4 text-sm font-medium text-foreground/70">
                Title
              </th>
              <th className="text-left px-6 py-4 text-sm font-medium text-foreground/70">
                Status
              </th>
              <th className="text-left px-6 py-4 text-sm font-medium text-foreground/70">
                Approved
              </th>
              <th className="text-left px-6 py-4 text-sm font-medium text-foreground/70">
                Source
              </th>
              <th className="text-left px-6 py-4 text-sm font-medium text-foreground/70">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {pdfs?.map((pdf: PDF) => (
              <tr key={pdf._id} className="border-t border-foreground/5">
                <td className="px-6 py-4">
                  {editingId === pdf._id ? (
                    <input
                      type="text"
                      value={editForm.title}
                      onChange={(e) =>
                        setEditForm({ ...editForm, title: e.target.value })
                      }
                      className="w-full px-3 py-2 border rounded"
                    />
                  ) : (
                    <div>
                      <div className="font-medium">{pdf.title}</div>
                      <div className="text-sm text-foreground/50">
                        {pdf.filename}
                      </div>
                    </div>
                  )}
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      pdf.status === "completed"
                        ? "bg-success/10 text-success"
                        : pdf.status === "failed"
                          ? "bg-danger/10 text-danger"
                          : pdf.status === "processing"
                            ? "bg-info/10 text-info"
                            : "bg-foreground/10 text-foreground/60"
                    }`}
                  >
                    {pdf.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      pdf.approved
                        ? "bg-success/10 text-success"
                        : "bg-warning/10 text-warning"
                    }`}
                  >
                    {pdf.approved ? "Yes" : "No"}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-foreground/70">
                  {pdf.source}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    {editingId === pdf._id ? (
                      <>
                        <button
                          onClick={handleSave}
                          className="text-sm text-success hover:underline"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-sm text-foreground/50 hover:underline"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleEdit(pdf)}
                          className="text-sm text-info hover:underline"
                        >
                          Edit
                        </button>
                        {!pdf.approved && (
                          <button
                            onClick={() =>
                              approvePdf({ id: pdf._id, approvedBy: "admin" })
                            }
                            className="text-sm text-success hover:underline"
                          >
                            Approve
                          </button>
                        )}
                        {pdf.status === "failed" && (
                          <button
                            onClick={() => handleReprocess(pdf._id)}
                            className="text-sm text-warning hover:underline"
                          >
                            Retry
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(pdf._id)}
                          className="text-sm text-danger hover:underline"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {(!pdfs || pdfs.length === 0) && (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-12 text-center text-foreground/50"
                >
                  No documents found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
