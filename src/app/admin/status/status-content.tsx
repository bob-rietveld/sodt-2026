"use client";

import { useState } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { PDF, ProcessingJob } from "@/types";
import { Id } from "../../../../convex/_generated/dataModel";

interface ReprocessingJob {
  _id: string;
  pdfId: string;
  pdfTitle: string;
  workId: string;
  status: "pending" | "running" | "completed" | "failed";
  enqueuedAt: number;
  completedAt?: number;
  error?: string;
}

export default function StatusContent() {
  const activeJobs = useQuery(api.processing.getActiveJobs);
  const failedJobs = useQuery(api.processing.getFailedJobs);
  const allPdfs = useQuery(api.pdfs.list, {});
  const recentReprocessingJobs = useQuery(api.pdfWorkpool.getRecentReprocessingJobs, { limit: 50 });

  // Reprocessing state
  const [reprocessFilter, setReprocessFilter] = useState<
    "all" | "missing_metadata" | "old_extraction" | "failed"
  >("missing_metadata");
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [reprocessProgress, setReprocessProgress] = useState<{
    total: number;
    enqueued: number;
    status: string;
  } | null>(null);
  const [reprocessMessage, setReprocessMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Reprocessing queries and actions
  const reprocessingStats = useQuery(api.pdfs.getReprocessingStats);
  const pdfsForReprocessing = useQuery(api.pdfs.getPdfsForReprocessing, {
    filter: reprocessFilter,
  });
  const enqueueBatchReprocessing = useAction(
    api.pdfWorkpool.enqueueBatchMetadataReprocessing
  );

  const processingPdfs = allPdfs?.filter((p: PDF) => p.status === "processing");
  const activeReprocessingJobs = recentReprocessingJobs?.filter(
    (j: ReprocessingJob) => j.status === "pending" || j.status === "running"
  );
  const failedReprocessingJobs = recentReprocessingJobs?.filter(
    (j: ReprocessingJob) => j.status === "failed"
  );
  const completedReprocessingJobs = recentReprocessingJobs?.filter(
    (j: ReprocessingJob) => j.status === "completed"
  );

  const handleRetry = async (pdfId: string) => {
    try {
      const response = await fetch("/api/process-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfId, action: "reprocess" }),
      });
      if (response.ok) {
        alert("Reprocessing started");
      }
    } catch (error) {
      console.error("Retry error:", error);
    }
  };

  const handleBulkReprocess = async () => {
    if (!pdfsForReprocessing || pdfsForReprocessing.length === 0) {
      return;
    }

    const confirmMessage = `This will reprocess ${pdfsForReprocessing.length} PDF(s) to extract new metadata. This may take some time and will use API credits. Continue?`;
    if (!confirm(confirmMessage)) {
      return;
    }

    setIsReprocessing(true);
    setReprocessProgress({
      total: pdfsForReprocessing.length,
      enqueued: 0,
      status: "Starting...",
    });
    setReprocessMessage(null);

    try {
      const pdfIds = pdfsForReprocessing.map(
        (pdf) => pdf._id as Id<"pdfs">
      );

      // Process in batches of 10 to avoid overwhelming the system
      const batchSize = 10;
      let enqueuedCount = 0;

      for (let i = 0; i < pdfIds.length; i += batchSize) {
        const batch = pdfIds.slice(i, i + batchSize);
        const result = await enqueueBatchReprocessing({ pdfIds: batch });
        enqueuedCount += result.enqueuedCount;

        setReprocessProgress({
          total: pdfIds.length,
          enqueued: enqueuedCount,
          status: `Enqueued ${enqueuedCount} of ${pdfIds.length}...`,
        });
      }

      setReprocessProgress({
        total: pdfIds.length,
        enqueued: enqueuedCount,
        status: `Complete! ${enqueuedCount} PDFs queued for reprocessing.`,
      });

      setReprocessMessage({
        type: "success",
        text: `Successfully queued ${enqueuedCount} PDFs for metadata reprocessing.`,
      });
    } catch (error) {
      setReprocessMessage({
        type: "error",
        text:
          error instanceof Error ? error.message : "Failed to start reprocessing",
      });
    } finally {
      setIsReprocessing(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-semibold">Processing</h1>
        <p className="text-foreground/60 mt-1">
          Monitor active jobs and reprocess documents when needed
        </p>
      </div>

      {/* Active Processing */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Currently Processing</h2>
        <div className="bg-white rounded-xl border border-foreground/10 overflow-hidden">
          {processingPdfs && processingPdfs.length > 0 ? (
            <div className="divide-y divide-foreground/5">
              {processingPdfs.map((pdf: PDF) => (
                <div
                  key={pdf._id}
                  className="p-6 flex items-center justify-between"
                >
                  <div>
                    <div className="font-medium">{pdf.title}</div>
                    <div className="text-sm text-foreground/50">
                      {pdf.filename}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-info rounded-full animate-pulse" />
                      <span className="text-sm text-info">Processing</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-foreground/50">
              No documents currently processing
            </div>
          )}
        </div>
      </div>

      {/* Active Jobs */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Active Jobs</h2>
        <div className="bg-white rounded-xl border border-foreground/10 overflow-hidden">
          {activeJobs && activeJobs.length > 0 ? (
            <table className="w-full">
              <thead className="bg-foreground/5">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-medium text-foreground/70">
                    PDF ID
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-foreground/70">
                    Stage
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-foreground/70">
                    Started
                  </th>
                </tr>
              </thead>
              <tbody>
                {activeJobs.map((job: ProcessingJob) => (
                  <tr key={job._id} className="border-t border-foreground/5">
                    <td className="px-6 py-4 font-mono text-sm">
                      {job.pdfId}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 bg-info/10 text-info rounded-full text-xs font-medium">
                        {job.stage}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground/50">
                      {new Date(job.startedAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center text-foreground/50">
              No active jobs
            </div>
          )}
        </div>
      </div>

      {/* Failed Jobs */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Failed Jobs</h2>
        <div className="bg-white rounded-xl border border-foreground/10 overflow-hidden">
          {failedJobs && failedJobs.length > 0 ? (
            <table className="w-full">
              <thead className="bg-foreground/5">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-medium text-foreground/70">
                    PDF ID
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-foreground/70">
                    Error
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-foreground/70">
                    Failed At
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-foreground/70">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {failedJobs.map((job: ProcessingJob) => (
                  <tr key={job._id} className="border-t border-foreground/5">
                    <td className="px-6 py-4 font-mono text-sm">
                      {job.pdfId}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-danger">
                        {job.error || "Unknown error"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground/50">
                      {job.completedAt
                        ? new Date(job.completedAt).toLocaleString()
                        : "-"}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleRetry(job.pdfId)}
                        className="text-sm text-warning hover:underline"
                      >
                        Retry
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center text-foreground/50">
              <svg
                className="w-12 h-12 text-success mx-auto mb-2"
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
              No failed jobs
            </div>
          )}
        </div>
      </div>

      {/* Metadata Reprocessing Section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Metadata Reprocessing</h2>

        {/* Bulk Reprocessing Trigger */}
        <div className="bg-white rounded-xl border border-foreground/10 p-6 mb-4">
          <h3 className="text-lg font-medium mb-3">Bulk Metadata Reprocessing</h3>
          <p className="text-foreground/70 mb-4">
            Reprocess PDFs to extract new metadata fields (document type, authors, key findings, keywords, technology areas).
            This uses Firecrawl and Anthropic API credits.
          </p>

          {/* Message */}
          {reprocessMessage && (
            <div
              className={`p-4 rounded-lg mb-4 ${
                reprocessMessage.type === "success"
                  ? "bg-success/10 text-success"
                  : "bg-danger/10 text-danger"
              }`}
            >
              {reprocessMessage.text}
            </div>
          )}

          {/* Stats */}
          {reprocessingStats && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
              <div className="p-3 bg-foreground/5 rounded-lg">
                <div className="text-xl font-bold">{reprocessingStats.total}</div>
                <div className="text-xs text-foreground/60">Total PDFs</div>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <div className="text-xl font-bold text-green-600">
                  {reprocessingStats.withNewFields}
                </div>
                <div className="text-xs text-foreground/60">With New Fields</div>
              </div>
              <div className="p-3 bg-amber-50 rounded-lg">
                <div className="text-xl font-bold text-amber-600">
                  {reprocessingStats.missingMetadata}
                </div>
                <div className="text-xs text-foreground/60">Missing Metadata</div>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="text-xl font-bold text-blue-600">
                  {reprocessingStats.oldExtraction}
                </div>
                <div className="text-xs text-foreground/60">Old Extraction</div>
              </div>
              <div className="p-3 bg-red-50 rounded-lg">
                <div className="text-xl font-bold text-red-600">
                  {reprocessingStats.failed}
                </div>
                <div className="text-xs text-foreground/60">Failed</div>
              </div>
            </div>
          )}

          {/* Filter Selection */}
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-foreground/70 mb-1">
                Select PDFs to Reprocess
              </label>
              <select
                value={reprocessFilter}
                onChange={(e) =>
                  setReprocessFilter(
                    e.target.value as typeof reprocessFilter
                  )
                }
                className="w-full px-3 py-2 rounded-lg border border-foreground/20 bg-white focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
              >
                <option value="missing_metadata">Missing Metadata or New Fields</option>
                <option value="old_extraction">Old Extraction Version</option>
                <option value="failed">Failed Processing</option>
                <option value="all">All PDFs</option>
              </select>
            </div>
            <div className="flex items-end gap-4">
              {pdfsForReprocessing && (
                <span className="text-sm text-foreground/60 py-2">
                  {pdfsForReprocessing.length} PDF(s) match
                </span>
              )}
              <button
                onClick={handleBulkReprocess}
                disabled={
                  isReprocessing ||
                  !pdfsForReprocessing ||
                  pdfsForReprocessing.length === 0
                }
                className="px-4 py-2 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {isReprocessing
                  ? "Reprocessing..."
                  : `Reprocess ${pdfsForReprocessing?.length || 0} PDFs`}
              </button>
            </div>
          </div>

          {/* Progress */}
          {reprocessProgress && (
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">{reprocessProgress.status}</span>
                <span className="text-sm text-foreground/60">
                  {reprocessProgress.enqueued}/{reprocessProgress.total}
                </span>
              </div>
              <div className="w-full bg-foreground/10 rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{
                    width: `${
                      reprocessProgress.total > 0
                        ? (reprocessProgress.enqueued / reprocessProgress.total) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Active Reprocessing Jobs */}
        <div className="bg-white rounded-xl border border-foreground/10 overflow-hidden mb-4">
          <div className="bg-amber-50 px-6 py-3 border-b border-foreground/10">
            <h3 className="font-medium text-amber-700">
              Active Reprocessing Jobs ({activeReprocessingJobs?.length || 0})
            </h3>
          </div>
          {activeReprocessingJobs && activeReprocessingJobs.length > 0 ? (
            <div className="divide-y divide-foreground/5">
              {activeReprocessingJobs.map((job: ReprocessingJob) => (
                <div
                  key={job._id}
                  className="p-4 flex items-center justify-between"
                >
                  <div>
                    <div className="font-medium">{job.pdfTitle}</div>
                    <div className="text-sm text-foreground/50">
                      Started {new Date(job.enqueuedAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        job.status === "running"
                          ? "bg-info animate-pulse"
                          : "bg-amber-400"
                      }`}
                    />
                    <span
                      className={`text-sm ${
                        job.status === "running" ? "text-info" : "text-amber-600"
                      }`}
                    >
                      {job.status === "running" ? "Processing" : "Pending"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center text-foreground/50">
              No active reprocessing jobs
            </div>
          )}
        </div>

        {/* Recent Completed */}
        {completedReprocessingJobs && completedReprocessingJobs.length > 0 && (
          <div className="bg-white rounded-xl border border-foreground/10 overflow-hidden mb-4">
            <div className="bg-green-50 px-6 py-3 border-b border-foreground/10">
              <h3 className="font-medium text-green-700">
                Recently Completed ({completedReprocessingJobs.length})
              </h3>
            </div>
            <div className="divide-y divide-foreground/5 max-h-48 overflow-y-auto">
              {completedReprocessingJobs.slice(0, 10).map((job: ReprocessingJob) => (
                <div
                  key={job._id}
                  className="p-4 flex items-center justify-between"
                >
                  <div>
                    <div className="font-medium">{job.pdfTitle}</div>
                    <div className="text-sm text-foreground/50">
                      Completed {job.completedAt ? new Date(job.completedAt).toLocaleString() : "-"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-5 h-5 text-success"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Failed Reprocessing */}
        {failedReprocessingJobs && failedReprocessingJobs.length > 0 && (
          <div className="bg-white rounded-xl border border-foreground/10 overflow-hidden">
            <div className="bg-red-50 px-6 py-3 border-b border-foreground/10">
              <h3 className="font-medium text-red-700">
                Failed Reprocessing ({failedReprocessingJobs.length})
              </h3>
            </div>
            <div className="divide-y divide-foreground/5">
              {failedReprocessingJobs.map((job: ReprocessingJob) => (
                <div
                  key={job._id}
                  className="p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{job.pdfTitle}</div>
                    <div className="text-sm text-foreground/50">
                      {job.completedAt ? new Date(job.completedAt).toLocaleString() : "-"}
                    </div>
                  </div>
                  <div className="text-sm text-danger mt-1">
                    {job.error || "Unknown error"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
