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
      className="block bg-white p-6 rounded-xl border border-foreground/10 hover:border-primary/20 hover:shadow-md transition-all group"
    >
      <div className="flex gap-4">
        {/* Thumbnail */}
        <div className="flex-shrink-0">
          {report.thumbnailUrl ? (
            <img
              src={report.thumbnailUrl}
              alt={report.title}
              className="w-20 h-24 object-cover rounded border border-foreground/10"
            />
          ) : (
            <div className="w-20 h-24 bg-foreground/5 rounded border border-foreground/10 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-foreground/30"
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
          <h3 className="font-semibold text-lg mb-1 group-hover:text-primary transition-colors truncate">
            {report.title}
          </h3>

          {report.company && (
            <p className="text-sm text-foreground/60 mb-2">{report.company}</p>
          )}

          {report.summary && (
            <p className="text-sm text-foreground/70 line-clamp-2 mb-3">
              {report.summary}
            </p>
          )}

          {/* Metadata tags */}
          <div className="flex flex-wrap gap-2">
            {report.continent && (
              <span className="px-2 py-1 rounded text-xs font-medium bg-info/10 text-info">
                {continentLabels[report.continent] ?? report.continent}
              </span>
            )}
            {report.industry && (
              <span className="px-2 py-1 rounded text-xs font-medium bg-secondary/10 text-secondary">
                {industryLabels[report.industry] ?? report.industry}
              </span>
            )}
            {report.dateOrYear && (
              <span className="px-2 py-1 rounded text-xs font-medium bg-foreground/10 text-foreground/70">
                {report.dateOrYear}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
