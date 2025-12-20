"use client";

import { useState, useCallback, useEffect } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import Link from "next/link";
import { Header } from "@/components/ui/header";

const continentLabels: Record<string, string> = {
  us: "United States",
  eu: "Europe",
  asia: "Asia",
  global: "Global",
  other: "Other",
};

const industryLabels: Record<string, string> = {
  semicon: "Semiconductor",
  deeptech: "Deep Tech",
  biotech: "Biotech",
  fintech: "Fintech",
  cleantech: "Clean Tech",
  other: "Other",
};

const documentTypeLabels: Record<string, string> = {
  pitch_deck: "Pitch Deck",
  market_research: "Market Research",
  financial_report: "Financial Report",
  white_paper: "White Paper",
  case_study: "Case Study",
  annual_report: "Annual Report",
  investor_update: "Investor Update",
  other: "Other",
};

export default function ReportDetailContent() {
  const params = useParams();
  const reportId = params.id as string;
  const [showPdfViewer, setShowPdfViewer] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [pdfError, setPdfError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const report = useQuery(api.pdfs.getWithFileUrl, {
    id: reportId as Id<"pdfs">,
  });

  // Reset PDF viewer state when navigating between reports
  useEffect(() => {
    setShowPdfViewer(false);
    setPdfLoading(true);
    setPdfError(false);
    setRetryCount(0);
  }, [reportId]);

  const handlePdfLoad = useCallback(() => {
    setPdfLoading(false);
    setPdfError(false);
  }, []);

  const handlePdfError = useCallback(() => {
    setPdfLoading(false);
    setPdfError(true);
  }, []);

  const handleRetry = useCallback(() => {
    setPdfLoading(true);
    setPdfError(false);
    setRetryCount((c) => c + 1);
  }, []);

  const togglePdfViewer = useCallback(() => {
    setShowPdfViewer((show) => {
      if (!show) {
        // Reset loading state when opening viewer
        setPdfLoading(true);
        setPdfError(false);
      }
      return !show;
    });
  }, []);

  // Timeout fallback for PDF loading - iframes don't reliably fire onError
  useEffect(() => {
    if (!showPdfViewer || !pdfLoading) return;

    const timeoutId = setTimeout(() => {
      if (pdfLoading) {
        setPdfError(true);
        setPdfLoading(false);
      }
    }, 15000); // 15 second timeout

    return () => clearTimeout(timeoutId);
  }, [showPdfViewer, pdfLoading, retryCount]);

  // Loading state
  if (report === undefined) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="animate-pulse space-y-4 sm:space-y-6">
            <div className="h-6 sm:h-8 bg-foreground/10 rounded w-3/4"></div>
            <div className="h-5 sm:h-6 bg-foreground/10 rounded w-1/4"></div>
            <div className="h-48 sm:h-64 bg-foreground/10 rounded"></div>
            <div className="space-y-3">
              <div className="h-4 bg-foreground/10 rounded"></div>
              <div className="h-4 bg-foreground/10 rounded"></div>
              <div className="h-4 bg-foreground/10 rounded w-2/3"></div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Not found state
  if (report === null) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 text-center">
          <h1 className="text-xl sm:text-2xl font-semibold mb-4">Report Not Found</h1>
          <p className="text-foreground/60 mb-6 sm:mb-8 text-sm sm:text-base">
            The report you're looking for doesn't exist or has been removed.
          </p>
          <Link
            href="/reports"
            className="inline-flex items-center gap-2 text-primary hover:underline"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Back to Reports
          </Link>
        </main>
      </div>
    );
  }

  const formattedDate = new Date(report.uploadedAt).toLocaleDateString(
    "en-US",
    {
      year: "numeric",
      month: "long",
      day: "numeric",
    }
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Back link */}
        <Link
          href="/reports"
          className="inline-flex items-center gap-2 text-foreground/60 hover:text-primary mb-4 sm:mb-6 transition-colors text-sm sm:text-base"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Back to Reports
        </Link>

        <article className="bg-white rounded-xl border border-foreground/10 overflow-hidden">
          {/* Header section */}
          <div className="p-4 sm:p-6 lg:p-8 border-b border-foreground/10">
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
              {/* Thumbnail */}
              <div className="flex-shrink-0 flex justify-center sm:justify-start">
                {report.thumbnailUrl ? (
                  <img
                    src={report.thumbnailUrl}
                    alt={report.title}
                    className="w-24 h-32 sm:w-32 sm:h-40 object-cover rounded-lg border border-foreground/10"
                  />
                ) : (
                  <div className="w-24 h-32 sm:w-32 sm:h-40 bg-foreground/5 rounded-lg border border-foreground/10 flex items-center justify-center">
                    <svg
                      className="w-10 h-10 sm:w-12 sm:h-12 text-foreground/30"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                )}
              </div>

              {/* Title and metadata */}
              <div className="flex-1 text-center sm:text-left">
                <h1 className="text-xl sm:text-2xl font-semibold mb-2">{report.title}</h1>

                {report.company && (
                  <p className="text-base sm:text-lg text-foreground/70 mb-3">
                    {report.company}
                  </p>
                )}

                {/* Metadata tags */}
                <div className="flex flex-wrap justify-center sm:justify-start gap-2 mb-3 sm:mb-4">
                  {report.documentType && (
                    <span className="px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium bg-primary/10 text-primary">
                      {documentTypeLabels[report.documentType] ?? report.documentType}
                    </span>
                  )}
                  {report.continent && (
                    <span className="px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium bg-info/10 text-info">
                      {continentLabels[report.continent] ?? report.continent}
                    </span>
                  )}
                  {report.industry && (
                    <span className="px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium bg-secondary/10 text-secondary">
                      {industryLabels[report.industry] ?? report.industry}
                    </span>
                  )}
                  {report.dateOrYear && (
                    <span className="px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium bg-foreground/10 text-foreground/70">
                      {report.dateOrYear}
                    </span>
                  )}
                </div>

                {/* Upload info */}
                <p className="text-xs sm:text-sm text-foreground/50 mb-3 sm:mb-4">
                  Added on {formattedDate}
                  {report.pageCount && ` • ${report.pageCount} pages`}
                </p>

                {/* View PDF Button */}
                {report.fileUrl && (
                  <button
                    onClick={togglePdfViewer}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors text-sm sm:text-base"
                  >
                    <svg
                      className="w-4 h-4 sm:w-5 sm:h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      {showPdfViewer ? (
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                        />
                      ) : (
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      )}
                    </svg>
                    {showPdfViewer ? "Hide PDF" : "View PDF"}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* PDF Viewer */}
          {showPdfViewer && report.fileUrl && (
            <div className="border-b border-foreground/10">
              <div className="p-3 sm:p-4 bg-foreground/[0.02] border-b border-foreground/10 flex items-center justify-between">
                <h2 className="text-xs sm:text-sm font-medium text-foreground/70">
                  PDF Viewer
                </h2>
                <a
                  href={report.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs sm:text-sm text-primary hover:underline"
                >
                  Open in new tab
                  <svg
                    className="w-3 h-3 sm:w-4 sm:h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
              </div>
              <div className="bg-foreground/5 relative">
                {/* Loading indicator */}
                {pdfLoading && !pdfError && (
                  <div className="absolute inset-0 flex items-center justify-center bg-foreground/5 z-10">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm text-foreground/60">Loading PDF...</span>
                    </div>
                  </div>
                )}
                {/* Error state with retry */}
                {pdfError && (
                  <div className="absolute inset-0 flex items-center justify-center bg-foreground/5 z-10">
                    <div className="flex flex-col items-center gap-3 p-4 text-center">
                      <svg
                        className="w-10 h-10 text-foreground/40"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                      </svg>
                      <span className="text-sm text-foreground/60">Failed to load PDF</span>
                      <button
                        onClick={handleRetry}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                      >
                        <svg
                          className="w-4 h-4"
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
                        Retry
                      </button>
                    </div>
                  </div>
                )}
                <iframe
                  key={`pdf-${reportId}-${retryCount}`}
                  src={report.fileUrl}
                  className="w-full h-[50vh] sm:h-[60vh] lg:h-[800px]"
                  title={`PDF: ${report.title}`}
                  onLoad={handlePdfLoad}
                  onError={handlePdfError}
                />
              </div>
            </div>
          )}

          {/* Topic section */}
          {report.topic && (
            <div className="p-4 sm:p-6 lg:p-8 border-b border-foreground/10">
              <h2 className="text-xs sm:text-sm font-medium text-foreground/50 uppercase tracking-wide mb-2">
                Topic
              </h2>
              <p className="text-foreground text-sm sm:text-base">{report.topic}</p>
            </div>
          )}

          {/* Summary section */}
          {report.summary && (
            <div className="p-4 sm:p-6 lg:p-8 border-b border-foreground/10">
              <h2 className="text-xs sm:text-sm font-medium text-foreground/50 uppercase tracking-wide mb-2 sm:mb-3">
                Summary
              </h2>
              <div className="prose prose-foreground max-w-none">
                <p className="text-foreground/80 leading-relaxed whitespace-pre-wrap text-sm sm:text-base">
                  {report.summary}
                </p>
              </div>
            </div>
          )}

          {/* Key Findings section */}
          {report.keyFindings && report.keyFindings.length > 0 && (
            <div className="p-4 sm:p-6 lg:p-8 border-b border-foreground/10">
              <h2 className="text-xs sm:text-sm font-medium text-foreground/50 uppercase tracking-wide mb-2 sm:mb-3">
                Key Findings
              </h2>
              <ul className="space-y-2">
                {report.keyFindings.map((finding, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm sm:text-base text-foreground/80">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-primary flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>{finding}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Technology Areas */}
          {report.technologyAreas && report.technologyAreas.length > 0 && (
            <div className="p-4 sm:p-6 lg:p-8 border-b border-foreground/10">
              <h2 className="text-xs sm:text-sm font-medium text-foreground/50 uppercase tracking-wide mb-2 sm:mb-3">
                Technology Areas
              </h2>
              <div className="flex flex-wrap gap-2">
                {report.technologyAreas.map((tech, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 rounded-full text-xs sm:text-sm font-medium bg-purple-100 text-purple-700"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Keywords */}
          {report.keywords && report.keywords.length > 0 && (
            <div className="p-4 sm:p-6 lg:p-8 border-b border-foreground/10">
              <h2 className="text-xs sm:text-sm font-medium text-foreground/50 uppercase tracking-wide mb-2 sm:mb-3">
                Keywords
              </h2>
              <div className="flex flex-wrap gap-2">
                {report.keywords.map((keyword, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 rounded-full text-xs sm:text-sm font-medium bg-foreground/5 text-foreground/70 border border-foreground/10"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Additional metadata */}
          <div className="p-4 sm:p-6 lg:p-8 bg-foreground/[0.02]">
            <h2 className="text-xs sm:text-sm font-medium text-foreground/50 uppercase tracking-wide mb-3 sm:mb-4">
              Details
            </h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {report.authors && report.authors.length > 0 && (
                <div className="sm:col-span-2">
                  <dt className="text-xs sm:text-sm text-foreground/50">Authors</dt>
                  <dd className="text-foreground text-sm sm:text-base">
                    {report.authors.join(", ")}
                  </dd>
                </div>
              )}
              {report.author && (
                <div>
                  <dt className="text-xs sm:text-sm text-foreground/50">Author</dt>
                  <dd className="text-foreground text-sm sm:text-base">{report.author}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs sm:text-sm text-foreground/50">Filename</dt>
                <dd className="text-foreground truncate text-sm sm:text-base">{report.filename}</dd>
              </div>
              <div>
                <dt className="text-xs sm:text-sm text-foreground/50">Source</dt>
                <dd className="text-foreground capitalize text-sm sm:text-base">{report.source}</dd>
              </div>
              {report.pageCount && (
                <div>
                  <dt className="text-xs sm:text-sm text-foreground/50">Pages</dt>
                  <dd className="text-foreground text-sm sm:text-base">{report.pageCount}</dd>
                </div>
              )}
            </dl>
          </div>
        </article>
      </main>
    </div>
  );
}
