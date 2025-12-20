"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { PDF, ProcessingJob } from "@/types";

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

  return (
    <div>
      <h1 className="text-3xl font-semibold mb-8">Processing Status</h1>

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

      {/* Metadata Reprocessing Jobs */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Metadata Reprocessing</h2>

        {/* Active Reprocessing */}
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
