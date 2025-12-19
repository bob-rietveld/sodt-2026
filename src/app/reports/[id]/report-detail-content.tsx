"use client";

import { useState } from "react";
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

export default function ReportDetailContent() {
  const params = useParams();
  const reportId = params.id as string;
  const [showPdfViewer, setShowPdfViewer] = useState(false);

  const report = useQuery(api.pdfs.getWithFileUrl, {
    id: reportId as Id<"pdfs">,
  });

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
                    onClick={() => setShowPdfViewer(!showPdfViewer)}
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
              <div className="bg-foreground/5">
                <iframe
                  src={report.fileUrl}
                  className="w-full h-[50vh] sm:h-[60vh] lg:h-[800px]"
                  title={`PDF: ${report.title}`}
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

          {/* Additional metadata */}
          <div className="p-4 sm:p-6 lg:p-8 bg-foreground/[0.02]">
            <h2 className="text-xs sm:text-sm font-medium text-foreground/50 uppercase tracking-wide mb-3 sm:mb-4">
              Details
            </h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
