"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { PDF } from "@/types";

type StatusFilter = "all" | "pending" | "processing" | "completed" | "failed";
type UploadMode = "file" | "url";

interface UploadItem {
  id: string;
  file: File;
  status: "pending" | "uploading" | "processing" | "completed" | "failed";
  progress: string;
  error?: string;
  pdfId?: Id<"pdfs">;
}

interface EditPropertiesForm {
  title: string;
  company: string;
  dateOrYear: string;
  topic: string;
  summary: string;
  continent: "us" | "eu" | "asia" | "global" | "other" | "";
  industry: "semicon" | "deeptech" | "biotech" | "fintech" | "cleantech" | "other" | "";
}

const CONTINENT_OPTIONS = [
  { value: "", label: "Select Region" },
  { value: "us", label: "United States" },
  { value: "eu", label: "Europe" },
  { value: "asia", label: "Asia" },
  { value: "global", label: "Global" },
  { value: "other", label: "Other" },
] as const;

const INDUSTRY_OPTIONS = [
  { value: "", label: "Select Industry" },
  { value: "semicon", label: "Semiconductor" },
  { value: "deeptech", label: "Deep Tech" },
  { value: "biotech", label: "Biotech" },
  { value: "fintech", label: "Fintech" },
  { value: "cleantech", label: "Cleantech" },
  { value: "other", label: "Other" },
] as const;

// Calculate SHA-256 hash of file content
async function calculateFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function PdfsContent() {
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadMode, setUploadMode] = useState<UploadMode>("file");
  const [pdfUrl, setPdfUrl] = useState("");
  const [isRunningWorkflow, setIsRunningWorkflow] = useState(false);
  const [batchUploads, setBatchUploads] = useState<UploadItem[]>([]);
  const [isBatchUploading, setIsBatchUploading] = useState(false);

  // Edit properties modal state
  const [editPropertiesId, setEditPropertiesId] = useState<Id<"pdfs"> | null>(null);
  const [editPropertiesForm, setEditPropertiesForm] = useState<EditPropertiesForm>({
    title: "",
    company: "",
    dateOrYear: "",
    topic: "",
    summary: "",
    continent: "",
    industry: "",
  });
  const [isSavingProperties, setIsSavingProperties] = useState(false);

  const pdfs = useQuery(
    api.pdfs.list,
    filter === "all" ? {} : { status: filter as "pending" | "processing" | "completed" | "failed" }
  );

  // Get workflow ID from settings
  const workflowId = useQuery(api.settings.get, { key: "unstructured_workflow_id" });

  // Get metadata extraction setting
  const metadataExtractionSetting = useQuery(api.settings.get, { key: "metadata_extraction_enabled" });
  const metadataExtractionEnabled = metadataExtractionSetting !== "false"; // Default to true

  // Get Google Drive settings
  const driveFolderId = useQuery(api.settings.get, { key: "google_drive_folder_id" });
  const driveRefreshToken = useQuery(api.settings.get, { key: "google_refresh_token" });

  const generateUploadUrl = useMutation(api.pdfs.generateUploadUrl);
  const createPdf = useMutation(api.pdfs.create);
  const removePdf = useMutation(api.pdfs.remove);
  const approvePdf = useMutation(api.pdfs.approve);
  const updateExtractedMetadata = useMutation(api.pdfs.updateExtractedMetadata);

  const handleUpload = useCallback(async (file: File) => {
    if (!file.name.endsWith(".pdf")) {
      setUploadError("Please select a PDF file");
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadProgress("Checking for duplicates...");

    try {
      // Step 0: Calculate file hash and check for duplicates
      const fileHash = await calculateFileHash(file);

      // Check for duplicate using a direct API call (since we can't use hooks conditionally)
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
          setUploadError(`This file has already been uploaded as "${existingTitle}" on ${uploadDate}`);
          setIsUploading(false);
          setUploadProgress(null);
          return;
        }
      }

      setUploadProgress("Uploading file...");

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

      // Step 3: Create PDF record in Convex (with hash for duplicate detection)
      setUploadProgress("Creating PDF record...");
      const title = file.name.replace(".pdf", "");
      const pdfId = await createPdf({
        title,
        filename: file.name,
        fileHash,
        storageId,
        source: "upload",
      });

      // Step 3.5: Upload to Google Drive if configured
      if (driveRefreshToken) {
        setUploadProgress("Uploading to Google Drive...");
        const driveFormData = new FormData();
        driveFormData.append("file", file);

        const driveResponse = await fetch("/api/google-drive/upload", {
          method: "POST",
          body: driveFormData,
        });

        if (!driveResponse.ok) {
          const errorData = await driveResponse.json();
          console.error("Google Drive upload failed:", errorData.error);
          // Continue anyway - Drive failure shouldn't block processing
        } else {
          const driveResult = await driveResponse.json();
          console.log("Uploaded to Google Drive:", driveResult.fileId);
        }
      }

      // Step 3.6: Get file URL and extract metadata + generate thumbnail
      setUploadProgress("Processing PDF...");
      try {
        // Get the public URL from Convex storage
        const fileUrlResponse = await fetch("/api/get-file-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storageId }),
        });

        if (fileUrlResponse.ok) {
          const { url: convexFileUrl } = await fileUrlResponse.json();

          // Generate thumbnail using pdf.js
          setUploadProgress("Generating thumbnail...");
          let thumbnailDataUrl: string | undefined;
          try {
            const thumbnailResponse = await fetch("/api/generate-thumbnail", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ pdfUrl: convexFileUrl }),
            });
            const thumbnailResult = await thumbnailResponse.json();
            if (thumbnailResponse.ok && thumbnailResult.success) {
              thumbnailDataUrl = thumbnailResult.thumbnailDataUrl;
              console.log("Thumbnail generated successfully");
            } else {
              console.error("Thumbnail generation failed:", thumbnailResult.error);
            }
          } catch (thumbError) {
            console.error("Thumbnail generation error:", thumbError);
          }

          // Extract metadata using Firecrawl
          setUploadProgress("Extracting metadata...");
          const extractResponse = await fetch("/api/extract-metadata", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: convexFileUrl }),
          });

          const extractResult = await extractResponse.json();
          if (extractResponse.ok && extractResult.success && extractResult.data) {
            // Update the PDF with extracted metadata and thumbnail
            await updateExtractedMetadata({
              id: pdfId,
              title: extractResult.data.title || title,
              company: extractResult.data.company,
              dateOrYear: extractResult.data.dateOrYear,
              topic: extractResult.data.topic,
              summary: extractResult.data.summary,
              thumbnailUrl: thumbnailDataUrl,
              continent: extractResult.data.continent,
              industry: extractResult.data.industry,
            });
            console.log("Metadata extracted:", extractResult.data);
          } else {
            // Even if metadata extraction fails, save the thumbnail if we have it
            if (thumbnailDataUrl) {
              await updateExtractedMetadata({
                id: pdfId,
                thumbnailUrl: thumbnailDataUrl,
              });
              console.log("Saved thumbnail without metadata");
            }
            console.error("Metadata extraction failed:", extractResult.error || "Unknown error");
          }
        } else {
          console.error("Failed to get file URL");
        }
      } catch (extractError) {
        console.error("Metadata extraction error:", extractError);
        // Continue anyway - extraction failure shouldn't block upload
      }

      // Note: We don't automatically trigger the Unstructured workflow here because
      // workflows with remote source connectors (Google Drive) process ALL files in the folder,
      // not just the newly uploaded one. Use the "Run Workflow" button for batch processing.

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
  }, [generateUploadUrl, createPdf, workflowId, driveRefreshToken, updateExtractedMetadata]);

  // Handle batch upload of multiple files
  const handleBatchUpload = useCallback(async (files: File[]) => {
    const pdfFiles = files.filter((f) => f.name.endsWith(".pdf"));
    if (pdfFiles.length === 0) {
      setUploadError("No PDF files selected");
      return;
    }

    // Initialize upload items
    const items: UploadItem[] = pdfFiles.map((file) => ({
      id: Math.random().toString(36).substring(2),
      file,
      status: "pending" as const,
      progress: "Waiting...",
    }));

    setBatchUploads(items);
    setIsBatchUploading(true);
    setUploadError(null);

    const uploadedItems: { pdfId: Id<"pdfs">; storageId: Id<"_storage"> }[] = [];

    // Upload files sequentially to avoid overwhelming the system
    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      try {
        // Update status to uploading
        setBatchUploads((prev) =>
          prev.map((u) =>
            u.id === item.id ? { ...u, status: "uploading", progress: "Checking for duplicates..." } : u
          )
        );

        // Check for duplicates
        const fileHash = await calculateFileHash(item.file);
        const duplicateCheckResponse = await fetch("/api/check-duplicate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileHash }),
        });

        if (duplicateCheckResponse.ok) {
          const duplicateResult = await duplicateCheckResponse.json();
          if (duplicateResult.isDuplicate) {
            setBatchUploads((prev) =>
              prev.map((u) =>
                u.id === item.id
                  ? { ...u, status: "failed", progress: "Duplicate", error: `Already uploaded as "${duplicateResult.existingPdf?.title}"` }
                  : u
              )
            );
            continue;
          }
        }

        // Upload file
        setBatchUploads((prev) =>
          prev.map((u) =>
            u.id === item.id ? { ...u, progress: "Uploading file..." } : u
          )
        );

        const uploadUrl = await generateUploadUrl();
        const uploadResult = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": item.file.type },
          body: item.file,
        });

        if (!uploadResult.ok) {
          throw new Error("Failed to upload file");
        }

        const { storageId } = await uploadResult.json();

        // Create PDF record
        setBatchUploads((prev) =>
          prev.map((u) =>
            u.id === item.id ? { ...u, progress: "Creating record..." } : u
          )
        );

        const title = item.file.name.replace(".pdf", "");
        const pdfId = await createPdf({
          title,
          filename: item.file.name,
          fileHash,
          storageId,
          source: "upload",
        });

        // Extract metadata if enabled
        if (metadataExtractionEnabled) {
          setBatchUploads((prev) =>
            prev.map((u) =>
              u.id === item.id ? { ...u, progress: "Extracting metadata..." } : u
            )
          );

          try {
            // Get file URL for extraction
            const fileUrlResponse = await fetch("/api/get-file-url", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ storageId }),
            });

            if (fileUrlResponse.ok) {
              const { url: convexFileUrl } = await fileUrlResponse.json();

              // Generate thumbnail
              let thumbnailDataUrl: string | undefined;
              try {
                const thumbnailResponse = await fetch("/api/generate-thumbnail", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ pdfUrl: convexFileUrl }),
                });
                const thumbnailResult = await thumbnailResponse.json();
                if (thumbnailResponse.ok && thumbnailResult.success) {
                  thumbnailDataUrl = thumbnailResult.thumbnailDataUrl;
                }
              } catch (thumbError) {
                console.error("Thumbnail generation error:", thumbError);
              }

              // Extract metadata using Firecrawl
              const extractResponse = await fetch("/api/extract-metadata", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: convexFileUrl }),
              });

              const extractResult = await extractResponse.json();
              if (extractResponse.ok && extractResult.success && extractResult.data) {
                await updateExtractedMetadata({
                  id: pdfId,
                  title: extractResult.data.title || title,
                  company: extractResult.data.company,
                  dateOrYear: extractResult.data.dateOrYear,
                  topic: extractResult.data.topic,
                  summary: extractResult.data.summary,
                  thumbnailUrl: thumbnailDataUrl,
                  continent: extractResult.data.continent,
                  industry: extractResult.data.industry,
                });
              } else if (thumbnailDataUrl) {
                // Save thumbnail even if metadata extraction failed
                await updateExtractedMetadata({
                  id: pdfId,
                  thumbnailUrl: thumbnailDataUrl,
                });
              }
            }
          } catch (extractError) {
            console.error("Metadata extraction error:", extractError);
            // Continue anyway - extraction failure shouldn't block upload
          }
        }

        // Mark as processing
        setBatchUploads((prev) =>
          prev.map((u) =>
            u.id === item.id ? { ...u, status: "processing", progress: "Queued for processing", pdfId } : u
          )
        );

        uploadedItems.push({ pdfId, storageId });
      } catch (error) {
        setBatchUploads((prev) =>
          prev.map((u) =>
            u.id === item.id
              ? { ...u, status: "failed", progress: "Error", error: error instanceof Error ? error.message : "Upload failed" }
              : u
          )
        );
      }
    }

    // Trigger processing for all successfully uploaded PDFs
    // Process via API calls from the client (fire and forget)
    if (uploadedItems.length > 0) {
      for (const item of uploadedItems) {
        // Fire and forget - processing happens in background
        fetch("/api/process-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pdfId: item.pdfId, storageId: item.storageId }),
        }).catch((err) => console.error("Processing request failed:", err));
      }
      // Mark all queued items as completed (UI-wise, actual processing happens in background)
      setBatchUploads((prev) =>
        prev.map((u) =>
          u.status === "processing" ? { ...u, status: "completed", progress: "Processing started" } : u
        )
      );
    }

    setIsBatchUploading(false);

    // Clear the batch uploads after a delay
    setTimeout(() => {
      setBatchUploads([]);
    }, 5000);
  }, [generateUploadUrl, createPdf, metadataExtractionEnabled, updateExtractedMetadata]);

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!pdfUrl.trim()) {
      setUploadError("Please enter a URL");
      return;
    }

    // Basic URL validation
    try {
      new URL(pdfUrl);
    } catch {
      setUploadError("Please enter a valid URL");
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadProgress("Fetching PDF from URL...");

    try {
      // Call API to process PDF from URL (include workflow ID if configured)
      const response = await fetch("/api/process-pdf-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: pdfUrl,
          workflowId: workflowId || undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        // Handle duplicate file error specially
        if (response.status === 409 && result.isDuplicate) {
          const existingTitle = result.existingPdf?.title || "Unknown";
          const uploadDate = result.existingPdf?.uploadedAt
            ? new Date(result.existingPdf.uploadedAt).toLocaleDateString()
            : "unknown date";
          setUploadError(`This file has already been uploaded as "${existingTitle}" on ${uploadDate}`);
          setIsUploading(false);
          setUploadProgress(null);
          return;
        }
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
    const files = e.target.files;
    if (files && files.length > 0) {
      if (files.length === 1) {
        handleUpload(files[0]);
      } else {
        handleBatchUpload(Array.from(files));
      }
    }
    e.target.value = "";
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length === 1) {
      handleUpload(files[0]);
    } else if (files.length > 1) {
      handleBatchUpload(Array.from(files));
    }
  }, [handleUpload, handleBatchUpload]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDelete = async (id: Id<"pdfs">) => {
    if (confirm("Are you sure you want to delete this document?")) {
      await removePdf({ id });
    }
  };

  // Open edit properties modal
  const handleEditProperties = (pdf: PDF) => {
    setEditPropertiesId(pdf._id);
    setEditPropertiesForm({
      title: pdf.title || "",
      company: pdf.company || "",
      dateOrYear: pdf.dateOrYear || "",
      topic: pdf.topic || "",
      summary: pdf.summary || "",
      continent: pdf.continent || "",
      industry: pdf.industry || "",
    });
  };

  // Save properties from modal
  const handleSaveProperties = async () => {
    if (!editPropertiesId) return;

    setIsSavingProperties(true);
    try {
      await updateExtractedMetadata({
        id: editPropertiesId,
        title: editPropertiesForm.title || undefined,
        company: editPropertiesForm.company || undefined,
        dateOrYear: editPropertiesForm.dateOrYear || undefined,
        topic: editPropertiesForm.topic || undefined,
        summary: editPropertiesForm.summary || undefined,
        continent: editPropertiesForm.continent || undefined,
        industry: editPropertiesForm.industry || undefined,
      });
      setEditPropertiesId(null);
    } catch (error) {
      console.error("Failed to save properties:", error);
      alert("Failed to save properties. Please try again.");
    } finally {
      setIsSavingProperties(false);
    }
  };

  // Close edit properties modal
  const handleCloseEditProperties = () => {
    setEditPropertiesId(null);
    setEditPropertiesForm({
      title: "",
      company: "",
      dateOrYear: "",
      topic: "",
      summary: "",
      continent: "",
      industry: "",
    });
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

  const handleRunWorkflow = async () => {
    if (!workflowId) {
      alert("No workflow configured. Please set the Unstructured Workflow ID in Settings.");
      return;
    }

    if (!confirm("This will process ALL files in the Google Drive folder. Files that have already been processed will be processed again. Continue?")) {
      return;
    }

    setIsRunningWorkflow(true);
    try {
      const response = await fetch("/api/run-workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflowId,
          triggerOnly: true,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        alert(`Workflow failed: ${result.error}`);
      } else {
        alert(`Workflow started! Run ID: ${result.workflowRunId}`);
      }
    } catch (error) {
      console.error("Workflow error:", error);
      alert("Failed to start workflow");
    } finally {
      setIsRunningWorkflow(false);
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
      <div className="mb-4 flex items-center gap-4">
        <div className="flex gap-2">
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

        {/* Google Drive Status Indicator */}
        <div
          className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 ${
            driveRefreshToken
              ? "bg-success/10 text-success"
              : "bg-foreground/5 text-foreground/50"
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              driveRefreshToken ? "bg-success" : "bg-foreground/30"
            }`}
          />
          {driveRefreshToken ? "Google Drive connected" : "Google Drive not connected"}
        </div>

        {/* Workflow Status Indicator */}
        <div
          className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 ${
            workflowId
              ? "bg-success/10 text-success"
              : "bg-foreground/5 text-foreground/50"
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              workflowId ? "bg-success" : "bg-foreground/30"
            }`}
          />
          {workflowId ? "Workflow configured" : "No workflow configured"}
        </div>

        {/* Run Workflow Button - for batch processing */}
        {workflowId && (
          <button
            onClick={handleRunWorkflow}
            disabled={isRunningWorkflow}
            className="px-4 py-1.5 bg-warning text-white rounded-lg text-sm font-medium hover:bg-warning/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRunningWorkflow ? "Running..." : "Run Workflow (All Files)"}
          </button>
        )}
      </div>

      {/* Error Banner */}
      {uploadError && (
        <div className="mb-4 p-4 bg-danger/10 border border-danger/20 rounded-lg flex items-start justify-between">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-danger mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-danger">{uploadError}</p>
          </div>
          <button
            onClick={() => setUploadError(null)}
            className="text-danger/70 hover:text-danger transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Upload Section */}
      {uploadMode === "file" ? (
        <div className="mb-8">
          <div
            className={`p-8 border-2 border-dashed rounded-xl transition-colors ${
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
              ) : isBatchUploading ? (
                <p className="text-foreground/70">Uploading {batchUploads.length} files...</p>
              ) : (
                <>
                  <p className="text-foreground/70 mb-2">
                    Drag and drop PDF files here, or
                  </p>
                  <label className="inline-block">
                    <input
                      type="file"
                      accept=".pdf"
                      multiple
                      onChange={handleFileSelect}
                      disabled={isUploading || isBatchUploading}
                      className="hidden"
                    />
                    <span className="px-6 py-2 bg-primary text-white rounded-lg font-medium cursor-pointer hover:bg-primary/90 transition-colors">
                      {isUploading ? "Uploading..." : "Select PDFs"}
                    </span>
                  </label>
                  <p className="text-foreground/50 text-sm mt-2">
                    You can select multiple files at once
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Batch Upload Progress */}
          {batchUploads.length > 0 && (
            <div className="mt-4 bg-white rounded-xl border border-foreground/10 overflow-hidden">
              <div className="px-4 py-3 bg-foreground/5 border-b border-foreground/10">
                <h3 className="font-medium text-sm">Upload Progress ({batchUploads.filter((u) => u.status === "completed").length}/{batchUploads.length})</h3>
              </div>
              <div className="divide-y divide-foreground/5 max-h-60 overflow-y-auto">
                {batchUploads.map((item) => (
                  <div key={item.id} className="px-4 py-3 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.file.name}</p>
                      <p className="text-xs text-foreground/50">{item.progress}</p>
                      {item.error && (
                        <p className="text-xs text-danger mt-1">{item.error}</p>
                      )}
                    </div>
                    <div className="flex-shrink-0">
                      {item.status === "pending" && (
                        <span className="px-2 py-1 rounded text-xs bg-foreground/10 text-foreground/60">Pending</span>
                      )}
                      {item.status === "uploading" && (
                        <span className="px-2 py-1 rounded text-xs bg-info/10 text-info">Uploading</span>
                      )}
                      {item.status === "processing" && (
                        <span className="px-2 py-1 rounded text-xs bg-warning/10 text-warning">Processing</span>
                      )}
                      {item.status === "completed" && (
                        <span className="px-2 py-1 rounded text-xs bg-success/10 text-success">Done</span>
                      )}
                      {item.status === "failed" && (
                        <span className="px-2 py-1 rounded text-xs bg-danger/10 text-danger">Failed</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
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
      <div className="bg-white rounded-xl border border-foreground/10 overflow-hidden overflow-x-auto">
        <table className="w-full">
          <thead className="bg-foreground/5">
            <tr>
              <th className="text-left px-4 py-4 text-sm font-medium text-foreground/70 w-20">
                Preview
              </th>
              <th className="text-left px-6 py-4 text-sm font-medium text-foreground/70">
                Title
              </th>
              <th className="text-left px-6 py-4 text-sm font-medium text-foreground/70">
                Company
              </th>
              <th className="text-left px-6 py-4 text-sm font-medium text-foreground/70">
                Year
              </th>
              <th className="text-left px-6 py-4 text-sm font-medium text-foreground/70">
                Region
              </th>
              <th className="text-left px-6 py-4 text-sm font-medium text-foreground/70">
                Industry
              </th>
              <th className="text-left px-6 py-4 text-sm font-medium text-foreground/70">
                Status
              </th>
              <th className="text-left px-6 py-4 text-sm font-medium text-foreground/70">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {pdfs?.map((pdf: PDF) => (
              <tr key={pdf._id} className="border-t border-foreground/5">
                <td className="px-4 py-4">
                  {pdf.thumbnailUrl ? (
                    <img
                      src={pdf.thumbnailUrl}
                      alt={pdf.title}
                      className="w-16 h-20 object-cover rounded border border-foreground/10"
                    />
                  ) : (
                    <div className="w-16 h-20 bg-foreground/5 rounded border border-foreground/10 flex items-center justify-center">
                      <svg className="w-6 h-6 text-foreground/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div>
                    <div className="font-medium">{pdf.title}</div>
                    <div className="text-sm text-foreground/50">
                      {pdf.filename}
                    </div>
                    {pdf.summary && (
                      <div className="mt-1 text-xs text-foreground/60 line-clamp-2" title={pdf.summary}>
                        {pdf.summary}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-foreground/70">
                  {pdf.company || "-"}
                </td>
                <td className="px-6 py-4 text-sm text-foreground/70">
                  {pdf.dateOrYear || "-"}
                </td>
                <td className="px-6 py-4">
                  {pdf.continent ? (
                    <span className="px-2 py-1 rounded text-xs font-medium bg-info/10 text-info uppercase">
                      {pdf.continent}
                    </span>
                  ) : (
                    <span className="text-foreground/40">-</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  {pdf.industry ? (
                    <span className="px-2 py-1 rounded text-xs font-medium bg-secondary/10 text-secondary">
                      {pdf.industry}
                    </span>
                  ) : (
                    <span className="text-foreground/40">-</span>
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
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEditProperties(pdf)}
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
                  </div>
                </td>
              </tr>
            ))}
            {(!pdfs || pdfs.length === 0) && (
              <tr>
                <td
                  colSpan={8}
                  className="px-6 py-12 text-center text-foreground/50"
                >
                  No documents found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Properties Modal */}
      {editPropertiesId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-foreground/10">
              <h2 className="text-xl font-semibold">Edit Properties</h2>
              <button
                onClick={handleCloseEditProperties}
                className="text-foreground/50 hover:text-foreground transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-4 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-foreground/70 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={editPropertiesForm.title}
                  onChange={(e) => setEditPropertiesForm({ ...editPropertiesForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-foreground/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  placeholder="Document title"
                />
              </div>

              {/* Company */}
              <div>
                <label className="block text-sm font-medium text-foreground/70 mb-1">
                  Company
                </label>
                <input
                  type="text"
                  value={editPropertiesForm.company}
                  onChange={(e) => setEditPropertiesForm({ ...editPropertiesForm, company: e.target.value })}
                  className="w-full px-3 py-2 border border-foreground/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  placeholder="Company name"
                />
              </div>

              {/* Two columns: Year and Region */}
              <div className="grid grid-cols-2 gap-4">
                {/* Year */}
                <div>
                  <label className="block text-sm font-medium text-foreground/70 mb-1">
                    Year
                  </label>
                  <input
                    type="text"
                    value={editPropertiesForm.dateOrYear}
                    onChange={(e) => setEditPropertiesForm({ ...editPropertiesForm, dateOrYear: e.target.value })}
                    className="w-full px-3 py-2 border border-foreground/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                    placeholder="e.g., 2024"
                  />
                </div>

                {/* Region/Continent */}
                <div>
                  <label className="block text-sm font-medium text-foreground/70 mb-1">
                    Region
                  </label>
                  <select
                    value={editPropertiesForm.continent}
                    onChange={(e) => setEditPropertiesForm({ ...editPropertiesForm, continent: e.target.value as EditPropertiesForm["continent"] })}
                    className="w-full px-3 py-2 border border-foreground/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary bg-white"
                  >
                    {CONTINENT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Industry */}
              <div>
                <label className="block text-sm font-medium text-foreground/70 mb-1">
                  Industry
                </label>
                <select
                  value={editPropertiesForm.industry}
                  onChange={(e) => setEditPropertiesForm({ ...editPropertiesForm, industry: e.target.value as EditPropertiesForm["industry"] })}
                  className="w-full px-3 py-2 border border-foreground/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary bg-white"
                >
                  {INDUSTRY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Topic */}
              <div>
                <label className="block text-sm font-medium text-foreground/70 mb-1">
                  Topic
                </label>
                <input
                  type="text"
                  value={editPropertiesForm.topic}
                  onChange={(e) => setEditPropertiesForm({ ...editPropertiesForm, topic: e.target.value })}
                  className="w-full px-3 py-2 border border-foreground/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  placeholder="Document topic"
                />
              </div>

              {/* Summary */}
              <div>
                <label className="block text-sm font-medium text-foreground/70 mb-1">
                  Summary
                </label>
                <textarea
                  value={editPropertiesForm.summary}
                  onChange={(e) => setEditPropertiesForm({ ...editPropertiesForm, summary: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-foreground/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary resize-none"
                  placeholder="Brief summary of the document"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-foreground/10 bg-foreground/5">
              <button
                onClick={handleCloseEditProperties}
                className="px-4 py-2 text-foreground/70 hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProperties}
                disabled={isSavingProperties}
                className="px-6 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSavingProperties ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
