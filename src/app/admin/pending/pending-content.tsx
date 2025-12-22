"use client";

import { useState, useMemo } from "react";
import { useMutation, usePaginatedQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { PDF } from "@/types";
import Link from "next/link";
import EditSidePanel, { EditPropertiesForm } from "@/components/admin/edit-side-panel";

type FilterTab = "awaiting_approval" | "processing" | "failed" | "all_unapproved";

const PAGE_SIZE = 15;

export default function PendingContent() {
  const [activeTab, setActiveTab] = useState<FilterTab>("awaiting_approval");
  const [editingPdf, setEditingPdf] = useState<PDF | null>(null);

  // Use paginated query for unapproved PDFs
  const paginatedQuery = usePaginatedQuery(
    api.pdfs.listUnapprovedPaginated,
    {},
    { initialNumItems: PAGE_SIZE }
  );

  const allUnapproved = paginatedQuery.results as PDF[] | undefined;

  // Filter based on active tab (client-side filtering of paginated results)
  const filteredDocs = useMemo(() => {
    if (!allUnapproved) return { awaitingApproval: [], processingDocs: [], failedDocs: [] };

    return {
      awaitingApproval: allUnapproved.filter((p: PDF) => p.status === "completed"),
      processingDocs: allUnapproved.filter((p: PDF) => p.status === "processing" || p.status === "pending"),
      failedDocs: allUnapproved.filter((p: PDF) => p.status === "failed"),
    };
  }, [allUnapproved]);

  const awaitingApproval = filteredDocs.awaitingApproval;
  const processingDocs = filteredDocs.processingDocs;
  const failedDocs = filteredDocs.failedDocs;

  const approvePdf = useMutation(api.pdfs.approve);
  const rejectPdf = useMutation(api.pdfs.reject);
  const removePdf = useMutation(api.pdfs.remove);
  const updateExtractedMetadata = useMutation(api.pdfs.updateExtractedMetadata);

  const handleApprove = async (id: Id<"pdfs">) => {
    await approvePdf({ id, approvedBy: "admin" });
  };

  const handleReject = async (id: Id<"pdfs">) => {
    await rejectPdf({ id });
  };

  const handleDelete = async (id: Id<"pdfs">) => {
    if (confirm("Are you sure you want to delete this document?")) {
      await removePdf({ id });
    }
  };

  const handleApproveAll = async () => {
    if (!awaitingApproval || awaitingApproval.length === 0) return;
    if (!confirm(`Approve all ${awaitingApproval.length} documents?`)) return;

    for (const pdf of awaitingApproval) {
      await approvePdf({ id: pdf._id, approvedBy: "admin" });
    }
  };

  const handleRetry = async (id: Id<"pdfs">) => {
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
      console.error("Retry error:", error);
    }
  };

  // Open edit side panel
  const handleEdit = (pdf: PDF) => {
    setEditingPdf(pdf);
  };

  // Close edit side panel
  const handleCloseEdit = () => {
    setEditingPdf(null);
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

  // Save and approve from side panel
  const handleSaveAndApprove = async (id: Id<"pdfs">, form: EditPropertiesForm) => {
    // First save the properties
    await handleSaveProperties(id, form);
    // Then approve
    await approvePdf({ id, approvedBy: "admin" });
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

  // Get the documents to display based on active tab
  const getDisplayDocs = () => {
    switch (activeTab) {
      case "awaiting_approval":
        return awaitingApproval;
      case "processing":
        return processingDocs;
      case "failed":
        return failedDocs;
      case "all_unapproved":
        return allUnapproved;
      default:
        return awaitingApproval;
    }
  };

  const displayDocs = getDisplayDocs();

  const tabs = [
    {
      id: "awaiting_approval" as FilterTab,
      label: "Ready for Review",
      count: awaitingApproval?.length || 0,
      color: "text-warning",
      description: "Documents processed and ready to approve"
    },
    {
      id: "processing" as FilterTab,
      label: "Still Processing",
      count: processingDocs?.length || 0,
      color: "text-info",
      description: "Documents being processed"
    },
    {
      id: "failed" as FilterTab,
      label: "Need Attention",
      count: failedDocs?.length || 0,
      color: "text-danger",
      description: "Documents that failed processing"
    },
    {
      id: "all_unapproved" as FilterTab,
      label: "All Unapproved",
      count: allUnapproved?.length || 0,
      color: "text-foreground/70",
      description: "All documents not yet approved"
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold">Review Queue</h1>
          <p className="text-foreground/60 mt-1">
            Review and approve documents before they appear in search results
          </p>
        </div>
        {awaitingApproval && awaitingApproval.length > 0 && activeTab === "awaiting_approval" && (
          <button
            onClick={handleApproveAll}
            className="px-6 py-2 bg-success text-white rounded-lg font-medium hover:bg-success/90 transition-colors"
          >
            Approve All ({awaitingApproval.length})
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`p-4 rounded-xl border text-left transition-all ${
              activeTab === tab.id
                ? "bg-white border-primary shadow-sm"
                : "bg-white/50 border-foreground/10 hover:bg-white hover:border-foreground/20"
            }`}
          >
            <div className={`text-2xl font-bold ${tab.color}`}>
              {tab.count}
            </div>
            <div className="font-medium text-sm">{tab.label}</div>
            <div className="text-xs text-foreground/50 mt-1">{tab.description}</div>
          </button>
        ))}
      </div>

      {/* Document List */}
      <div className="space-y-4">
        {displayDocs?.map((pdf: PDF) => (
          <div
            key={pdf._id}
            className="bg-white p-6 rounded-xl border border-foreground/10"
          >
            <div className="flex items-start justify-between">
              <div className="flex gap-4 flex-1">
                {/* Thumbnail */}
                {pdf.thumbnailUrl ? (
                  <img
                    src={pdf.thumbnailUrl}
                    alt={pdf.title}
                    className="w-16 h-20 object-cover rounded border border-foreground/10 flex-shrink-0"
                  />
                ) : (
                  <div className="w-16 h-20 bg-foreground/5 rounded border border-foreground/10 flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-foreground/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}

                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold">{pdf.title}</h3>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        pdf.status === "completed"
                          ? "bg-success/10 text-success"
                          : pdf.status === "failed"
                            ? "bg-danger/10 text-danger"
                            : pdf.status === "processing"
                              ? "bg-info/10 text-info"
                              : "bg-foreground/10 text-foreground/60"
                      }`}
                    >
                      {pdf.status === "completed" ? "Ready" : pdf.status}
                    </span>
                  </div>

                  {pdf.summary && (
                    <p className="text-foreground/70 text-sm mb-3 line-clamp-2">{pdf.summary}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-4 text-sm text-foreground/50">
                    <span>{pdf.filename}</span>
                    {pdf.pageCount && <span>{pdf.pageCount} pages</span>}
                    {pdf.company && <span>{pdf.company}</span>}
                    <span>
                      Source: {pdf.source === "drive" ? "Google Drive" : "Upload"}
                    </span>
                    <span>
                      Uploaded: {new Date(pdf.uploadedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 ml-6">
                {pdf.status === "completed" && (
                  <>
                    <button
                      onClick={() => handleEdit(pdf)}
                      className="px-4 py-2 bg-info/10 text-info rounded-lg font-medium hover:bg-info/20 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleApprove(pdf._id)}
                      className="px-4 py-2 bg-success text-white rounded-lg font-medium hover:bg-success/90 transition-colors"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(pdf._id)}
                      className="px-4 py-2 bg-foreground/10 text-foreground rounded-lg font-medium hover:bg-foreground/20 transition-colors"
                    >
                      Reject
                    </button>
                  </>
                )}
                {pdf.status === "failed" && (
                  <>
                    <button
                      onClick={() => handleEdit(pdf)}
                      className="px-4 py-2 bg-info/10 text-info rounded-lg font-medium hover:bg-info/20 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleRetry(pdf._id)}
                      className="px-4 py-2 bg-warning text-white rounded-lg font-medium hover:bg-warning/90 transition-colors"
                    >
                      Retry
                    </button>
                  </>
                )}
                {(pdf.status === "processing" || pdf.status === "pending") && (
                  <Link
                    href="/admin/status"
                    className="px-4 py-2 bg-info/10 text-info rounded-lg font-medium hover:bg-info/20 transition-colors"
                  >
                    View Status
                  </Link>
                )}
                <button
                  onClick={() => handleDelete(pdf._id)}
                  className="px-4 py-2 bg-danger/10 text-danger rounded-lg font-medium hover:bg-danger/20 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}

        {(!displayDocs || displayDocs.length === 0) && (
          <div className="bg-white p-12 rounded-xl border border-foreground/10 text-center">
            {activeTab === "awaiting_approval" ? (
              <>
                <svg
                  className="w-16 h-16 text-success mx-auto mb-4"
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
                <h3 className="text-xl font-semibold mb-2">All caught up!</h3>
                <p className="text-foreground/50">
                  No documents awaiting approval.
                </p>
              </>
            ) : activeTab === "processing" ? (
              <>
                <svg
                  className="w-16 h-16 text-info mx-auto mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                <h3 className="text-xl font-semibold mb-2">No processing</h3>
                <p className="text-foreground/50">
                  No documents currently being processed.
                </p>
              </>
            ) : activeTab === "failed" ? (
              <>
                <svg
                  className="w-16 h-16 text-success mx-auto mb-4"
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
                <h3 className="text-xl font-semibold mb-2">No failures</h3>
                <p className="text-foreground/50">
                  All documents processed successfully.
                </p>
              </>
            ) : (
              <>
                <svg
                  className="w-16 h-16 text-success mx-auto mb-4"
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
                <h3 className="text-xl font-semibold mb-2">All approved!</h3>
                <p className="text-foreground/50">
                  All documents have been approved.
                </p>
              </>
            )}
          </div>
        )}

        {/* Pagination Controls */}
        {paginatedQuery.status === "CanLoadMore" && (
          <div className="mt-4 flex justify-center">
            <button
              onClick={() => paginatedQuery.loadMore(PAGE_SIZE)}
              className="px-6 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
            >
              Load More
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        )}
        {paginatedQuery.status === "Exhausted" && allUnapproved && allUnapproved.length > PAGE_SIZE && (
          <div className="mt-4 text-center text-sm text-foreground/50">
            All documents loaded
          </div>
        )}
      </div>

      {/* Edit Side Panel */}
      {editingPdf && (
        <EditSidePanel
          pdf={editingPdf}
          isOpen={!!editingPdf}
          onClose={handleCloseEdit}
          onSave={handleSaveProperties}
          onSaveAndApprove={handleSaveAndApprove}
          onRegenerateThumbnail={handleRegenerateThumbnail}
          showApproveButton={editingPdf.status === "completed"}
        />
      )}
    </div>
  );
}
