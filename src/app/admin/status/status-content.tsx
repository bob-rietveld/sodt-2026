"use client";

import { useState } from "react";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";

type MetadataFilter = "missing" | "failed" | "all";
type PineconeFilter = "not_indexed" | "failed" | "all";

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
  // Overview data
  const overview = useQuery(api.pdfs.getProcessingOverview);
  const recentReprocessingJobs = useQuery(api.pdfWorkpool.getRecentReprocessingJobs, { limit: 20 });

  // Metadata extraction state
  const [metadataFilter, setMetadataFilter] = useState<MetadataFilter>("missing");
  const [isReprocessingMetadata, setIsReprocessingMetadata] = useState(false);
  const [selectedMetadataDocs, setSelectedMetadataDocs] = useState<Set<string>>(new Set());

  // Pinecone indexing state
  const [pineconeFilter, setPineconeFilter] = useState<PineconeFilter>("not_indexed");
  const [isIndexingPinecone, setIsIndexingPinecone] = useState(false);
  const [selectedPineconeDocs, setSelectedPineconeDocs] = useState<Set<string>>(new Set());

  // Queries
  const documentsNeedingMetadata = useQuery(api.pdfs.getDocumentsNeedingMetadata, { filter: metadataFilter });
  const documentsNeedingPinecone = useQuery(api.pdfs.getDocumentsNeedingPinecone, { filter: pineconeFilter });

  // Actions
  const enqueueBatchReprocessing = useAction(api.pdfWorkpool.enqueueBatchMetadataReprocessing);
  const updatePineconeStatus = useMutation(api.pdfs.updatePineconeStatus);

  // Active jobs
  const activeReprocessingJobs = recentReprocessingJobs?.filter(
    (j: ReprocessingJob) => j.status === "pending" || j.status === "running"
  );

  // Handlers
  const handleMetadataReprocess = async () => {
    const docsToProcess = selectedMetadataDocs.size > 0
      ? Array.from(selectedMetadataDocs)
      : documentsNeedingMetadata?.map(d => d._id) || [];

    if (docsToProcess.length === 0) return;

    const confirmMessage = `This will extract metadata from ${docsToProcess.length} document(s). This uses API credits. Continue?`;
    if (!confirm(confirmMessage)) return;

    setIsReprocessingMetadata(true);
    try {
      const pdfIds = docsToProcess.map(id => id as Id<"pdfs">);
      const batchSize = 10;

      for (let i = 0; i < pdfIds.length; i += batchSize) {
        const batch = pdfIds.slice(i, i + batchSize);
        await enqueueBatchReprocessing({ pdfIds: batch });
      }

      setSelectedMetadataDocs(new Set());
      alert(`Successfully queued ${docsToProcess.length} documents for metadata extraction.`);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to start reprocessing");
    } finally {
      setIsReprocessingMetadata(false);
    }
  };

  const handlePineconeIndex = async () => {
    const docsToIndex = selectedPineconeDocs.size > 0
      ? Array.from(selectedPineconeDocs)
      : documentsNeedingPinecone?.map(d => d._id) || [];

    if (docsToIndex.length === 0) return;

    const confirmMessage = `This will index ${docsToIndex.length} document(s) in Pinecone. Continue?`;
    if (!confirm(confirmMessage)) return;

    setIsIndexingPinecone(true);
    try {
      // Index documents one at a time
      for (const pdfId of docsToIndex) {
        // Set status to Processing
        await updatePineconeStatus({
          id: pdfId as Id<"pdfs">,
          pineconeFileStatus: "Processing",
        });

        // Call the Pinecone upload API
        const response = await fetch("/api/pinecone/index", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pdfId }),
        });

        if (!response.ok) {
          const error = await response.json();
          await updatePineconeStatus({
            id: pdfId as Id<"pdfs">,
            pineconeFileStatus: "Failed",
          });
          console.error(`Failed to index ${pdfId}:`, error);
        }
      }

      setSelectedPineconeDocs(new Set());
      alert(`Successfully started indexing ${docsToIndex.length} documents in Pinecone.`);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to start indexing");
    } finally {
      setIsIndexingPinecone(false);
    }
  };

  const toggleMetadataDoc = (id: string) => {
    const newSet = new Set(selectedMetadataDocs);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedMetadataDocs(newSet);
  };

  const togglePineconeDoc = (id: string) => {
    const newSet = new Set(selectedPineconeDocs);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedPineconeDocs(newSet);
  };

  const selectAllMetadata = () => {
    if (documentsNeedingMetadata) {
      setSelectedMetadataDocs(new Set(documentsNeedingMetadata.map(d => d._id)));
    }
  };

  const selectAllPinecone = () => {
    if (documentsNeedingPinecone) {
      setSelectedPineconeDocs(new Set(documentsNeedingPinecone.map(d => d._id)));
    }
  };

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-semibold">Document Processing</h1>
        <p className="text-foreground/60 mt-1">
          Manage metadata extraction and Pinecone indexing for your documents
        </p>
      </div>

      {/* Overview Cards */}
      {overview && (
        <div className="grid grid-cols-2 gap-6 mb-8">
          {/* Metadata Status Card */}
          <div className="bg-white rounded-xl border border-foreground/10 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-lg">Metadata Extraction</h3>
                <p className="text-sm text-foreground/60">Extract titles, summaries, and classifications</p>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-xl font-bold text-green-600">{overview.metadata.complete}</div>
                <div className="text-xs text-foreground/60">Complete</div>
              </div>
              <div className="text-center p-3 bg-amber-50 rounded-lg">
                <div className="text-xl font-bold text-amber-600">{overview.metadata.missing}</div>
                <div className="text-xs text-foreground/60">Missing</div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <div className="text-xl font-bold text-red-600">{overview.metadata.failed}</div>
                <div className="text-xs text-foreground/60">Failed</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-xl font-bold text-blue-600">{overview.metadata.processing}</div>
                <div className="text-xs text-foreground/60">Processing</div>
              </div>
            </div>
          </div>

          {/* Pinecone Status Card */}
          <div className="bg-white rounded-xl border border-foreground/10 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-lg">Pinecone Indexing</h3>
                <p className="text-sm text-foreground/60">Index documents for AI-powered search</p>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-xl font-bold text-green-600">{overview.pinecone.indexed}</div>
                <div className="text-xs text-foreground/60">Indexed</div>
              </div>
              <div className="text-center p-3 bg-amber-50 rounded-lg">
                <div className="text-xl font-bold text-amber-600">{overview.pinecone.notIndexed}</div>
                <div className="text-xs text-foreground/60">Not Indexed</div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <div className="text-xl font-bold text-red-600">{overview.pinecone.failed}</div>
                <div className="text-xs text-foreground/60">Failed</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-xl font-bold text-blue-600">{overview.pinecone.processing}</div>
                <div className="text-xs text-foreground/60">Processing</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active Jobs Banner */}
      {activeReprocessingJobs && activeReprocessingJobs.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            <span className="font-medium text-blue-700">
              {activeReprocessingJobs.length} job(s) currently processing
            </span>
          </div>
          <div className="mt-3 space-y-2">
            {activeReprocessingJobs.slice(0, 3).map((job: ReprocessingJob) => (
              <div key={job._id} className="text-sm text-blue-600 flex items-center gap-2">
                <span className="truncate">{job.pdfTitle}</span>
                <span className="text-blue-400">•</span>
                <span className="text-blue-500">{job.status === "running" ? "Processing" : "Pending"}</span>
              </div>
            ))}
            {activeReprocessingJobs.length > 3 && (
              <div className="text-sm text-blue-500">
                +{activeReprocessingJobs.length - 3} more
              </div>
            )}
          </div>
        </div>
      )}

      {/* Two-Column Layout for Actions */}
      <div className="grid grid-cols-2 gap-6">
        {/* Metadata Extraction Section */}
        <div className="bg-white rounded-xl border border-foreground/10 overflow-hidden">
          <div className="border-b border-foreground/10 p-4">
            <h2 className="font-semibold text-lg">Metadata Extraction</h2>
            <p className="text-sm text-foreground/60 mt-1">
              Extract or re-extract metadata from documents
            </p>
          </div>

          <div className="p-4 border-b border-foreground/10 bg-foreground/[0.02]">
            <div className="flex items-center gap-3">
              <select
                value={metadataFilter}
                onChange={(e) => {
                  setMetadataFilter(e.target.value as MetadataFilter);
                  setSelectedMetadataDocs(new Set());
                }}
                className="flex-1 px-3 py-2 rounded-lg border border-foreground/20 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="missing">Missing Metadata</option>
                <option value="failed">Failed Processing</option>
                <option value="all">All Documents</option>
              </select>
              <button
                onClick={selectAllMetadata}
                className="px-3 py-2 text-sm text-foreground/70 hover:text-foreground border border-foreground/20 rounded-lg hover:bg-foreground/5"
              >
                Select All
              </button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {documentsNeedingMetadata && documentsNeedingMetadata.length > 0 ? (
              <div className="divide-y divide-foreground/5">
                {documentsNeedingMetadata.map((doc) => (
                  <label
                    key={doc._id}
                    className="flex items-center gap-3 p-3 hover:bg-foreground/[0.02] cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedMetadataDocs.has(doc._id)}
                      onChange={() => toggleMetadataDoc(doc._id)}
                      className="w-4 h-4 rounded border-foreground/30 text-primary focus:ring-primary/50"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{doc.title}</div>
                      <div className="text-xs text-foreground/50 flex items-center gap-2">
                        {!doc.hasSummary && (
                          <span className="text-amber-600">No summary</span>
                        )}
                        {!doc.hasDocumentType && (
                          <span className="text-amber-600">No type</span>
                        )}
                        {doc.status === "failed" && (
                          <span className="text-red-600">Failed</span>
                        )}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-foreground/50">
                <svg className="w-10 h-10 mx-auto mb-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm">All documents have complete metadata</div>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-foreground/10 bg-foreground/[0.02]">
            <button
              onClick={handleMetadataReprocess}
              disabled={isReprocessingMetadata || (!selectedMetadataDocs.size && !documentsNeedingMetadata?.length)}
              className="w-full px-4 py-2.5 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {isReprocessingMetadata ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Processing...
                </span>
              ) : (
                `Extract Metadata (${selectedMetadataDocs.size || documentsNeedingMetadata?.length || 0})`
              )}
            </button>
          </div>
        </div>

        {/* Pinecone Indexing Section */}
        <div className="bg-white rounded-xl border border-foreground/10 overflow-hidden">
          <div className="border-b border-foreground/10 p-4">
            <h2 className="font-semibold text-lg">Pinecone Indexing</h2>
            <p className="text-sm text-foreground/60 mt-1">
              Index documents for AI-powered search
            </p>
          </div>

          <div className="p-4 border-b border-foreground/10 bg-foreground/[0.02]">
            <div className="flex items-center gap-3">
              <select
                value={pineconeFilter}
                onChange={(e) => {
                  setPineconeFilter(e.target.value as PineconeFilter);
                  setSelectedPineconeDocs(new Set());
                }}
                className="flex-1 px-3 py-2 rounded-lg border border-foreground/20 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="not_indexed">Not Indexed</option>
                <option value="failed">Failed Indexing</option>
                <option value="all">All Documents</option>
              </select>
              <button
                onClick={selectAllPinecone}
                className="px-3 py-2 text-sm text-foreground/70 hover:text-foreground border border-foreground/20 rounded-lg hover:bg-foreground/5"
              >
                Select All
              </button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {documentsNeedingPinecone && documentsNeedingPinecone.length > 0 ? (
              <div className="divide-y divide-foreground/5">
                {documentsNeedingPinecone.map((doc) => (
                  <label
                    key={doc._id}
                    className="flex items-center gap-3 p-3 hover:bg-foreground/[0.02] cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedPineconeDocs.has(doc._id)}
                      onChange={() => togglePineconeDoc(doc._id)}
                      className="w-4 h-4 rounded border-foreground/30 text-primary focus:ring-primary/50"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{doc.title}</div>
                      <div className="text-xs text-foreground/50">
                        {doc.pineconeFileStatus === "Failed" ? (
                          <span className="text-red-600">Indexing failed</span>
                        ) : doc.pineconeFileStatus === "Processing" ? (
                          <span className="text-blue-600">Processing...</span>
                        ) : doc.pineconeFileId ? (
                          <span className="text-green-600">Indexed</span>
                        ) : (
                          <span className="text-amber-600">Not indexed</span>
                        )}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-foreground/50">
                <svg className="w-10 h-10 mx-auto mb-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm">All documents are indexed in Pinecone</div>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-foreground/10 bg-foreground/[0.02]">
            <button
              onClick={handlePineconeIndex}
              disabled={isIndexingPinecone || (!selectedPineconeDocs.size && !documentsNeedingPinecone?.length)}
              className="w-full px-4 py-2.5 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {isIndexingPinecone ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Indexing...
                </span>
              ) : (
                `Index in Pinecone (${selectedPineconeDocs.size || documentsNeedingPinecone?.length || 0})`
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
