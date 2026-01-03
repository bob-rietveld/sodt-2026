"use client";

import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useAction, usePaginatedQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { PDF } from "@/types";
import EditSidePanel, { EditPropertiesForm } from "@/components/admin/edit-side-panel";

type StatusFilter = "all" | "pending" | "processing" | "completed" | "failed";
type UploadMode = "file" | "url";
type SortOption = "recently_added" | "published_date" | "title_asc" | "title_desc";

const PAGE_SIZE = 15;

interface UploadItem {
  id: string;
  file: File;
  status: "pending" | "uploading" | "processing" | "completed" | "failed";
  progress: string;
  error?: string;
  pdfId?: Id<"pdfs">;
}

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

  // Edit side panel state
  const [editingPdf, setEditingPdf] = useState<PDF | null>(null);
  const [isExportingCSV, setIsExportingCSV] = useState(false);
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null);
  const [extractingMetadataId, setExtractingMetadataId] = useState<string | null>(null);

  // Search and sort state
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("recently_added");
  const isSearching = searchQuery.trim().length > 0;

  // Pagination using Convex's native cursor-based pagination (used when not searching)
  const paginatedQuery = usePaginatedQuery(
    api.pdfs.listPaginated,
    filter === "all" ? {} : { status: filter as "pending" | "processing" | "completed" | "failed" },
    { initialNumItems: PAGE_SIZE }
  );

  // Search results (used when searching)
  const searchResults = useQuery(
    api.pdfs.adminFullTextSearch,
    isSearching
      ? {
          query: searchQuery,
          status: filter === "all" ? undefined : (filter as "pending" | "processing" | "completed" | "failed"),
        }
      : "skip"
  );

  // Sort and memoize the display results
  const sortedResults = useMemo(() => {
    const results = isSearching ? searchResults : paginatedQuery.results;
    if (!results) return undefined;

    // Create a copy to avoid mutating the original
    const sorted = [...results] as PDF[];

    switch (sortBy) {
      case "recently_added":
        sorted.sort((a, b) => b.uploadedAt - a.uploadedAt);
        break;
      case "published_date":
        sorted.sort((a, b) => {
          const yearA = typeof a.dateOrYear === "number" ? a.dateOrYear : 0;
          const yearB = typeof b.dateOrYear === "number" ? b.dateOrYear : 0;
          return yearB - yearA;
        });
        break;
      case "title_asc":
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "title_desc":
        sorted.sort((a, b) => b.title.localeCompare(a.title));
        break;
    }

    return sorted;
  }, [isSearching, searchResults, paginatedQuery.results, sortBy]);

  const pdfs = sortedResults;
  const paginationStatus = paginatedQuery.status;

  // Get total count for display
  const totalCount = useQuery(
    api.pdfs.getTotalCount,
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

  // Workpool action for batch processing
  const enqueueBatch = useAction(api.pdfWorkpool.enqueueBatch);

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

          // Extract metadata and store extracted text
          setUploadProgress("Extracting metadata...");
          const extractResponse = await fetch("/api/extract-metadata", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: convexFileUrl, pdfId }),
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
              documentType: extractResult.data.documentType,
              authors: extractResult.data.authors,
              keyFindings: extractResult.data.keyFindings,
              keywords: extractResult.data.keywords,
              technologyAreas: extractResult.data.technologyAreas,
            });
            console.log("Metadata extracted and saved:", extractResult.data);
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

              // Extract metadata and store extracted text
              const extractResponse = await fetch("/api/extract-metadata", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: convexFileUrl, pdfId }),
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
                  documentType: extractResult.data.documentType,
                  authors: extractResult.data.authors,
                  keyFindings: extractResult.data.keyFindings,
                  keywords: extractResult.data.keywords,
                  technologyAreas: extractResult.data.technologyAreas,
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

    // Trigger processing for all successfully uploaded PDFs via Convex Workpool
    if (uploadedItems.length > 0) {
      try {
        // Enqueue all items to the workpool for parallel processing
        const workIds = await enqueueBatch({ items: uploadedItems });
        console.log(`Enqueued ${workIds.length} PDFs for processing via workpool`);

        // Mark all queued items as completed (UI-wise, actual processing happens in background)
        setBatchUploads((prev) =>
          prev.map((u) =>
            u.status === "processing" ? { ...u, status: "completed", progress: "Queued in workpool" } : u
          )
        );
      } catch (error) {
        console.error("Failed to enqueue batch processing:", error);
        // Fall back to direct API calls if workpool fails
        for (const item of uploadedItems) {
          fetch("/api/process-pdf", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pdfId: item.pdfId, storageId: item.storageId }),
          }).catch((err) => console.error("Processing request failed:", err));
        }
        setBatchUploads((prev) =>
          prev.map((u) =>
            u.status === "processing" ? { ...u, status: "completed", progress: "Processing started (fallback)" } : u
          )
        );
      }
    }

    setIsBatchUploading(false);

    // Clear the batch uploads after a delay
    setTimeout(() => {
      setBatchUploads([]);
    }, 5000);
  }, [generateUploadUrl, createPdf, metadataExtractionEnabled, updateExtractedMetadata, enqueueBatch]);

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

  // Open edit side panel
  const handleEditProperties = (pdf: PDF) => {
    setEditingPdf(pdf);
  };

  // Save properties from side panel
  const handleSaveProperties = async (id: Id<"pdfs">, form: EditPropertiesForm) => {
    // Parse arrays from comma/newline-separated strings
    const parseArray = (str: string, separator: string = ",") =>
      str
        .split(separator)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

    // Parse year from string to number
    const parseYear = (str: string): number | undefined => {
      if (!str) return undefined;
      const yearMatch = str.match(/\b(19|20)\d{2}\b/);
      if (yearMatch) {
        return parseInt(yearMatch[0], 10);
      }
      const parsed = parseInt(str, 10);
      return !isNaN(parsed) && parsed >= 1900 && parsed <= 2100 ? parsed : undefined;
    };

    await updateExtractedMetadata({
      id,
      title: form.title || undefined,
      company: form.company || undefined,
      dateOrYear: parseYear(form.dateOrYear),
      topic: form.topic || undefined,
      summary: form.summary || undefined,
      continent: form.continent || undefined,
      industry: form.industry || undefined,
      documentType: form.documentType || undefined,
      authors: form.authors ? parseArray(form.authors) : undefined,
      keyFindings: form.keyFindings ? parseArray(form.keyFindings, "\n") : undefined,
      keywords: form.keywords ? parseArray(form.keywords) : undefined,
      technologyAreas: form.technologyAreas ? parseArray(form.technologyAreas) : undefined,
    });
  };

  // Close edit side panel
  const handleCloseEditProperties = () => {
    setEditingPdf(null);
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

  // Extract metadata for a single PDF
  const handleExtractMetadata = async (id: Id<"pdfs">) => {
    setExtractingMetadataId(id);
    try {
      const response = await fetch("/api/reprocess-metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfId: id }),
      });
      const result = await response.json();
      if (response.ok && result.success) {
        alert("Metadata extracted successfully!");
      } else {
        alert(`Metadata extraction failed: ${result.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Extract metadata error:", error);
      alert("Failed to extract metadata. Please try again.");
    } finally {
      setExtractingMetadataId(null);
    }
  };

  // Regenerate thumbnail for a PDF
  const handleRegenerateThumbnail = async (pdf: PDF) => {
    // Get the file URL for this PDF
    const fileUrlResponse = await fetch("/api/get-file-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storageId: pdf.storageId,
        sourceUrl: pdf.sourceUrl
      }),
    });

    if (!fileUrlResponse.ok) {
      throw new Error("Failed to get file URL");
    }

    const { url: pdfUrl } = await fileUrlResponse.json();

    if (!pdfUrl) {
      throw new Error("No file URL available for this PDF");
    }

    // Generate new thumbnail
    const thumbnailResponse = await fetch("/api/generate-thumbnail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pdfUrl }),
    });

    const thumbnailResult = await thumbnailResponse.json();

    if (!thumbnailResponse.ok || !thumbnailResult.success) {
      throw new Error(thumbnailResult.error || "Thumbnail generation failed");
    }

    // Save the new thumbnail to the database
    await updateExtractedMetadata({
      id: pdf._id,
      thumbnailUrl: thumbnailResult.thumbnailDataUrl,
    });

    // Update the local editing state with the new thumbnail
    if (editingPdf && editingPdf._id === pdf._id) {
      setEditingPdf({
        ...editingPdf,
        thumbnailUrl: thumbnailResult.thumbnailDataUrl,
      });
    }
  };

  // Export CSV of all extracted metadata
  const handleExportCSV = async () => {
    setIsExportingCSV(true);
    try {
      const response = await fetch("/api/export-csv");
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to export CSV");
      }

      // Get the filename from the Content-Disposition header
      const contentDisposition = response.headers.get("Content-Disposition");
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : "extracted-metadata.csv";

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("CSV export error:", error);
      alert(`Failed to export CSV: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsExportingCSV(false);
    }
  };

  // Export ZIP of all extracted text files
  const handleExportZip = async () => {
    setIsExportingZip(true);
    try {
      const response = await fetch("/api/export-texts-zip");
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to export ZIP");
      }

      // Get the filename from the Content-Disposition header
      const contentDisposition = response.headers.get("Content-Disposition");
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : "extracted-texts.zip";

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("ZIP export error:", error);
      alert(`Failed to export ZIP: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsExportingZip(false);
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold">Documents</h1>
          <p className="text-foreground/60 mt-1">
            Upload, manage, and organize your PDF documents
          </p>
        </div>

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

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-4">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents..."
            className="w-full pl-10 pr-4 py-2 border border-foreground/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary bg-white"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground/60"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Sort Selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-foreground/60 hidden sm:inline">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="px-3 py-2 bg-white border border-foreground/20 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
          >
            <option value="recently_added">Recently Added</option>
            <option value="published_date">Published Date</option>
            <option value="title_asc">Title A-Z</option>
            <option value="title_desc">Title Z-A</option>
          </select>
        </div>

        {/* Upload Mode Toggle */}
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

        {/* Export Buttons */}
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={handleExportCSV}
            disabled={isExportingCSV}
            className="px-4 py-2 bg-white border border-foreground/10 text-foreground/70 rounded-lg text-sm font-medium hover:bg-foreground/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isExportingCSV ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Exporting...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export CSV
              </>
            )}
          </button>
          <button
            onClick={handleExportZip}
            disabled={isExportingZip}
            className="px-4 py-2 bg-white border border-foreground/10 text-foreground/70 rounded-lg text-sm font-medium hover:bg-foreground/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isExportingZip ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Exporting...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                Export ZIP
              </>
            )}
          </button>
        </div>
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

      {/* Edit Side Panel */}
      {editingPdf && (
        <EditSidePanel
          pdf={editingPdf}
          isOpen={!!editingPdf}
          onClose={handleCloseEditProperties}
          onSave={handleSaveProperties}
          onRegenerateThumbnail={handleRegenerateThumbnail}
        />
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-foreground/10 overflow-hidden">
        <table className="w-full table-fixed">
          <thead className="bg-foreground/5">
            <tr>
              <th className="text-left px-3 py-3 text-sm font-medium text-foreground/70 w-16 lg:w-20">
                Preview
              </th>
              <th className="text-left px-3 py-3 text-sm font-medium text-foreground/70">
                Title
              </th>
              <th className="hidden lg:table-cell text-left px-3 py-3 text-sm font-medium text-foreground/70 w-28">
                Company
              </th>
              <th className="hidden xl:table-cell text-left px-3 py-3 text-sm font-medium text-foreground/70 w-20">
                Year
              </th>
              <th className="hidden xl:table-cell text-left px-3 py-3 text-sm font-medium text-foreground/70 w-24">
                Region
              </th>
              <th className="hidden lg:table-cell text-left px-3 py-3 text-sm font-medium text-foreground/70 w-28">
                Industry
              </th>
              <th className="text-left px-3 py-3 text-sm font-medium text-foreground/70 w-24">
                Status
              </th>
              <th className="text-right px-3 py-3 text-sm font-medium text-foreground/70 w-20">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {pdfs?.map((pdf: PDF) => (
              <tr key={pdf._id} className="border-t border-foreground/5">
                <td className="px-3 py-3">
                  {pdf.thumbnailUrl ? (
                    <img
                      src={pdf.thumbnailUrl}
                      alt={pdf.title}
                      className="w-12 h-16 lg:w-16 lg:h-20 object-cover rounded border border-foreground/10"
                    />
                  ) : (
                    <div className="w-12 h-16 lg:w-16 lg:h-20 bg-foreground/5 rounded border border-foreground/10 flex items-center justify-center">
                      <svg className="w-5 h-5 lg:w-6 lg:h-6 text-foreground/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                </td>
                <td className="px-3 py-3">
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate" title={pdf.title}>{pdf.title}</div>
                    <div className="text-xs text-foreground/50 truncate">
                      {pdf.filename}
                    </div>
                    {pdf.summary && (
                      <div className="mt-1 text-xs text-foreground/60 line-clamp-1 lg:line-clamp-2" title={pdf.summary}>
                        {pdf.summary}
                      </div>
                    )}
                    {/* Show metadata on mobile */}
                    <div className="lg:hidden mt-2 flex flex-wrap gap-1">
                      {pdf.company && (
                        <span className="text-xs text-foreground/60">{pdf.company}</span>
                      )}
                      {pdf.continent && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-info/10 text-info uppercase">
                          {pdf.continent}
                        </span>
                      )}
                      {pdf.industry && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-secondary/10 text-secondary">
                          {pdf.industry}
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="hidden lg:table-cell px-3 py-3 text-sm text-foreground/70 truncate">
                  {pdf.company || "-"}
                </td>
                <td className="hidden xl:table-cell px-3 py-3 text-sm text-foreground/70">
                  {pdf.dateOrYear || "-"}
                </td>
                <td className="hidden xl:table-cell px-3 py-3">
                  {pdf.continent ? (
                    <span className="px-2 py-1 rounded text-xs font-medium bg-info/10 text-info uppercase">
                      {pdf.continent}
                    </span>
                  ) : (
                    <span className="text-foreground/40">-</span>
                  )}
                </td>
                <td className="hidden lg:table-cell px-3 py-3">
                  {pdf.industry ? (
                    <span className="px-2 py-1 rounded text-xs font-medium bg-secondary/10 text-secondary">
                      {pdf.industry}
                    </span>
                  ) : (
                    <span className="text-foreground/40">-</span>
                  )}
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-col gap-1">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium inline-block w-fit ${
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
                    {/* Pinecone indexing status */}
                    {pdf.pineconeFileStatus ? (
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-medium inline-block w-fit ${
                          pdf.pineconeFileStatus === "Available"
                            ? "bg-primary/10 text-primary"
                            : pdf.pineconeFileStatus === "Failed"
                              ? "bg-danger/10 text-danger"
                              : "bg-warning/10 text-warning"
                        }`}
                        title={pdf.pineconeFileId ? `Pinecone ID: ${pdf.pineconeFileId}` : undefined}
                      >
                        {pdf.pineconeFileStatus === "Available" ? "Indexed" : pdf.pineconeFileStatus === "Processing" ? "Indexing..." : "Index Failed"}
                      </span>
                    ) : pdf.status === "completed" ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-foreground/5 text-foreground/40 inline-block w-fit">
                        Not indexed
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="px-3 py-3">
                  {/* Actions Dropdown */}
                  <div className="relative flex justify-end">
                    <button
                      onClick={() => setOpenActionMenu(openActionMenu === pdf._id ? null : pdf._id)}
                      className="p-2 rounded-lg hover:bg-foreground/5 transition-colors"
                      title="Actions"
                    >
                      <svg className="w-5 h-5 text-foreground/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                      </svg>
                    </button>
                    {openActionMenu === pdf._id && (
                      <>
                        {/* Backdrop to close menu */}
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setOpenActionMenu(null)}
                        />
                        {/* Dropdown menu */}
                        <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded-lg shadow-lg border border-foreground/10 py-1 min-w-[140px]">
                          <button
                            onClick={() => {
                              handleEditProperties(pdf);
                              setOpenActionMenu(null);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-foreground/5 flex items-center gap-2"
                          >
                            <svg className="w-4 h-4 text-info" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              handleExtractMetadata(pdf._id);
                              setOpenActionMenu(null);
                            }}
                            disabled={extractingMetadataId === pdf._id}
                            className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-foreground/5 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {extractingMetadataId === pdf._id ? (
                              <>
                                <svg className="w-4 h-4 text-secondary animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Extracting...
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                </svg>
                                Extract Metadata
                              </>
                            )}
                          </button>
                          {!pdf.approved && (
                            <button
                              onClick={() => {
                                approvePdf({ id: pdf._id, approvedBy: "admin" });
                                setOpenActionMenu(null);
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-foreground/5 flex items-center gap-2"
                            >
                              <svg className="w-4 h-4 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Approve
                            </button>
                          )}
                          {pdf.status === "failed" && (
                            <button
                              onClick={() => {
                                handleReprocess(pdf._id);
                                setOpenActionMenu(null);
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-foreground/5 flex items-center gap-2"
                            >
                              <svg className="w-4 h-4 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                              Retry
                            </button>
                          )}
                          <div className="border-t border-foreground/10 my-1" />
                          <button
                            onClick={() => {
                              handleDelete(pdf._id);
                              setOpenActionMenu(null);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-danger hover:bg-danger/5 flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {(!pdfs || pdfs.length === 0) && paginationStatus !== "LoadingFirstPage" && !isSearching && (
              <tr>
                <td
                  colSpan={8}
                  className="px-3 py-12 text-center text-foreground/50"
                >
                  No documents found
                </td>
              </tr>
            )}
            {(!pdfs || pdfs.length === 0) && isSearching && searchResults !== undefined && (
              <tr>
                <td
                  colSpan={8}
                  className="px-3 py-12 text-center text-foreground/50"
                >
                  No documents match &quot;{searchQuery}&quot;
                </td>
              </tr>
            )}
            {paginationStatus === "LoadingFirstPage" && !isSearching && (
              <tr>
                <td
                  colSpan={8}
                  className="px-3 py-12 text-center text-foreground/50"
                >
                  <div className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Loading documents...
                  </div>
                </td>
              </tr>
            )}
            {isSearching && searchResults === undefined && (
              <tr>
                <td
                  colSpan={8}
                  className="px-3 py-12 text-center text-foreground/50"
                >
                  <div className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Searching...
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="mt-4 flex items-center justify-between bg-white rounded-xl border border-foreground/10 px-4 py-3">
        <div className="text-sm text-foreground/60">
          {isSearching && pdfs ? (
            <>
              Found <span className="font-medium text-foreground">{pdfs.length}</span> result{pdfs.length !== 1 ? "s" : ""} for &quot;{searchQuery}&quot;
            </>
          ) : (
            pdfs && totalCount !== undefined && (
              <>
                Showing <span className="font-medium text-foreground">{pdfs.length}</span> of{" "}
                <span className="font-medium text-foreground">{totalCount}</span> documents
              </>
            )
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isSearching && paginationStatus === "LoadingMore" && (
            <button
              disabled
              className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium opacity-50 cursor-not-allowed flex items-center gap-2"
            >
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Loading...
            </button>
          )}
          {!isSearching && paginationStatus === "CanLoadMore" && (
            <button
              onClick={() => paginatedQuery.loadMore(PAGE_SIZE)}
              className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
            >
              Load More
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
          {!isSearching && paginationStatus === "Exhausted" && pdfs && pdfs.length > 0 && (
            <span className="text-sm text-foreground/50">All documents loaded</span>
          )}
          {isSearching && pdfs && pdfs.length > 0 && (
            <button
              onClick={() => setSearchQuery("")}
              className="px-4 py-2 bg-foreground/10 text-foreground/70 rounded-lg text-sm font-medium hover:bg-foreground/20 transition-colors"
            >
              Clear search
            </button>
          )}
        </div>
      </div>

    </div>
  );
}
