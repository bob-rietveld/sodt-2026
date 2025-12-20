"use client";

import Link from "next/link";
import { PDF } from "@/types";

interface ReportCardProps {
  report: PDF;
}

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

export function ReportCard({ report }: ReportCardProps) {
  return (
    <Link
      href={`/reports/${report._id}`}
      className="block p-4 sm:p-5 hover:bg-foreground/[0.02] transition-colors group"
    >
      <div className="flex gap-3 sm:gap-4">
        {/* Thumbnail */}
        <div className="flex-shrink-0">
          {report.thumbnailUrl ? (
            <img
              src={report.thumbnailUrl}
              alt={report.title}
              className="w-16 h-20 sm:w-20 sm:h-24 object-cover rounded border border-foreground/10"
            />
          ) : (
            <div className="w-16 h-20 sm:w-20 sm:h-24 bg-foreground/5 rounded border border-foreground/10 flex items-center justify-center">
              <svg
                className="w-6 h-6 sm:w-8 sm:h-8 text-foreground/30"
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

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base sm:text-lg mb-1 group-hover:text-primary transition-colors line-clamp-2 sm:truncate">
            {report.title}
          </h3>

          {report.company && (
            <p className="text-xs sm:text-sm text-foreground/60 mb-1 sm:mb-2">{report.company}</p>
          )}

          {report.summary && (
            <p className="text-xs sm:text-sm text-foreground/70 line-clamp-2 mb-2 sm:mb-3 hidden sm:block">
              {report.summary}
            </p>
          )}

          {/* Metadata tags */}
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {report.continent && (
              <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs font-medium bg-info/10 text-info">
                {continentLabels[report.continent] ?? report.continent}
              </span>
            )}
            {report.industry && (
              <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs font-medium bg-secondary/10 text-secondary">
                {industryLabels[report.industry] ?? report.industry}
              </span>
            )}
            {report.dateOrYear && (
              <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs font-medium bg-foreground/10 text-foreground/70">
                {report.dateOrYear}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
